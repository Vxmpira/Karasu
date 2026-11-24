import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { boot, account, wait } from "./helpers.mjs";
import { Store } from "../server/store.mjs";

test("the terminal and its data are closed to visitors who are not signed in", async () => {
  const s = await boot(); const c = s.client();
  const app = await c.get("/app/"); assert.equal(app.status, 302); assert.equal(app.headers.get("location"), "/login?next=%2Fapp%2F");
  assert.equal((await c.get("/app/data.js")).status, 302);
  assert.equal((await c.get("/account")).status, 302);
  assert.equal((await c.get("/api/ships")).status, 401);
  assert.equal((await c.get("/api/me")).status, 401);
  assert.equal((await c.get("/api/health")).status, 200);
  assert.deepEqual((await c.get("/api/config")).json, { priceMonthly: null, priceYearly: null, linkMonthly: null, linkYearly: null });
  s.close();
});

test("sign-up checks its input, then signs the person in with an HttpOnly cookie", async () => {
  const s = await boot(); const c = s.client();
  assert.equal((await c.post("/api/auth/signup", { ...account(), email: "not-an-email" })).json.field, "email");
  assert.equal((await c.post("/api/auth/signup", { ...account(), password: "short" })).json.field, "password");
  assert.equal((await c.post("/api/auth/signup", { ...account(), agree: false })).json.field, "agree");
  const ok = await c.post("/api/auth/signup", { ...account(), email: "  Trader1@Example.com " });
  assert.equal(ok.status, 201); assert.deepEqual([ok.json.user.email, ok.json.user.plan], ["trader1@example.com", "free"]);
  assert.match(ok.headers.getSetCookie()[0], /^karasu_sid=[0-9a-f]{64}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000$/);
  assert.equal((await c.get("/app/")).status, 200);
  assert.equal((await s.client().post("/api/auth/signup", account())).status, 409);
  s.close();
});

test("login, logout and wrong passwords behave", async () => {
  const s = await boot(); await s.client().post("/api/auth/signup", account());
  const c = s.client();
  assert.equal((await c.post("/api/auth/login", { email: "trader1@example.com", password: "wrong password!" })).status, 401);
  assert.equal((await c.post("/api/auth/login", { email: "nobody@example.com", password: "correct horse battery" })).status, 401);
  assert.equal((await c.post("/api/auth/login", { email: "TRADER1@example.com", password: "correct horse battery" })).status, 200);
  const me = await c.get("/api/me"); assert.equal(me.json.user.name, "Trader 1"); assert.deepEqual(me.json.watch, { tickers: [], points: [], ships: [] });
  assert.equal(JSON.stringify(me.json).includes("hash"), false);
  await c.post("/api/auth/logout"); assert.equal((await c.get("/api/me")).status, 401);
  s.close();
});

test("too many wrong passwords are slowed down", async () => {
  const s = await boot(); await s.client().post("/api/auth/signup", account()); const c = s.client();
  let last = 0; for (let i = 0; i < 11; i++) last = (await c.post("/api/auth/login", { email: "trader1@example.com", password: "wrong password!" })).status;
  assert.equal(last, 429); s.close();
});

test("the watchlist is saved per account and cleaned on the way in", async () => {
  const s = await boot(); const c = s.client(); await c.post("/api/auth/signup", account());
  const r = await c.put("/api/watchlist", { tickers: ["PLTR", 7, "x".repeat(50), "HII"], points: ["hormuz"], ships: "nope", extra: ["x"] });
  assert.deepEqual(r.json.watch, { tickers: ["PLTR", "HII"], points: ["hormuz"], ships: [] });
  assert.deepEqual((await c.get("/api/me")).json.watch.tickers, ["PLTR", "HII"]);
  s.close();
});

test("changing the password needs the current one and signs out other devices", async () => {
  const s = await boot(); const a = s.client(), b = s.client(); await a.post("/api/auth/signup", account());
  await b.post("/api/auth/login", { email: "trader1@example.com", password: "correct horse battery" });
  assert.equal((await a.post("/api/me/password", { current: "nope nope nope", next: "a brand new password" })).status, 401);
  assert.equal((await a.post("/api/me/password", { current: "correct horse battery", next: "short" })).status, 400);
  assert.equal((await a.post("/api/me/password", { current: "correct horse battery", next: "a brand new password" })).status, 200);
  assert.equal((await a.get("/api/me")).status, 200); assert.equal((await b.get("/api/me")).status, 401);
  assert.equal((await b.post("/api/auth/login", { email: "trader1@example.com", password: "correct horse battery" })).status, 401);
  assert.equal((await b.post("/api/auth/login", { email: "trader1@example.com", password: "a brand new password" })).status, 200);
  s.close();
});

test("deleting an account needs the password and removes it", async () => {
  const s = await boot(); const c = s.client(); await c.post("/api/auth/signup", account());
  assert.equal((await c.del("/api/me", { password: "wrong password!" })).status, 401);
  assert.equal((await c.del("/api/me", { password: "correct horse battery" })).status, 200);
  assert.equal((await c.get("/api/me")).status, 401);
  assert.equal((await c.post("/api/auth/login", { email: "trader1@example.com", password: "correct horse battery" })).status, 401);
  s.close();
});

test("a free account is not sent the reads, and a paid account is", async () => {
  const s = await boot({ ADMIN_TOKEN: "owner-secret" }); const c = s.client(); await c.post("/api/auth/signup", account());
  const free = (await c.get("/app/data.js")).text;
  assert.match(free, /^window\.KARASU_PLAN="free";window\.KARASU=\{/); assert.match(free, /Tankers are bunching off Fujairah/);
  for (const paidOnly of ["supply waiting to land", "Draft readings split loaded from empty", "Bullish for cattle", "Its profit follows the crude price", "Bearish drift, not a rout"]) assert.equal(free.includes(paidOnly), false, paidOnly);
  assert.equal((await c.post("/api/admin/plan", { email: "trader1@example.com", plan: "paid" })).status, 403);
  assert.equal((await c.post("/api/admin/plan", { email: "trader1@example.com", plan: "gold" }, { "x-admin-token": "owner-secret" })).status, 400);
  assert.equal((await c.post("/api/admin/plan", { email: "trader1@example.com", plan: "paid" }, { "x-admin-token": "owner-secret" })).json.user.plan, "paid");
  const paid = (await c.get("/app/data.js")).text; assert.match(paid, /^window\.KARASU_PLAN="paid";/);
  for (const t of ["supply waiting to land", "Draft readings split loaded from empty", "Its profit follows the crude price"]) assert.equal(paid.includes(t), true, t);
  s.close();
});

test("writes from another site or in the wrong format are refused", async () => {
  const s = await boot(); const c = s.client();
  assert.equal((await c.post("/api/auth/signup", account(), { Origin: "https://evil.example" })).status, 403);
  const form = await fetch(s.base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "email=a&password=b" });
  assert.equal(form.status, 415); s.close();
});

test("the contact form validates and saves the message on the server", async () => {
  const s = await boot(); const c = s.client();
  assert.equal((await c.post("/api/contact", { email: "x", message: "hello there, a question" })).json.field, "email");
  assert.equal((await c.post("/api/contact", { email: "a@b.co", message: "hi" })).json.field, "message");
  assert.equal((await c.post("/api/contact", { name: "Ada", email: "a@b.co", topic: "Billing", message: "When does the paid plan open?" })).status, 201);
  const saved = JSON.parse(fs.readFileSync(path.join(s.dataDir, "contact.jsonl"), "utf8").trim());
  assert.deepEqual([saved.name, saved.email, saved.topic, saved.message, saved.account], ["Ada", "a@b.co", "Billing", "When does the paid plan open?", null]);
  s.close();
});

test("accounts survive a restart, and no password is stored in the clear", async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "karasu-store-")), "store.json");
  const one = await boot({}, { storeFile: file }); const c = one.client(); await c.post("/api/auth/signup", account());
  one.store.flush(); one.close();
  const raw = fs.readFileSync(file, "utf8"); assert.equal(raw.includes("correct horse battery"), false); assert.equal(raw.includes(c.cookie().split("=")[1]), false);
  assert.equal((fs.statSync(file).mode & 0o077), 0);
  const two = await boot({}, { storeFile: file });
  assert.equal((await two.client().post("/api/auth/login", { email: "trader1@example.com", password: "correct horse battery" })).status, 200);
  assert.equal((await two.client().get("/api/me", { Cookie: c.cookie() })).status, 200);
  two.close();
});

test("sessions expire", async () => {
  const st = new Store(null, { sessionDays: 0.00000001 }); const u = await st.createUser({ email: "a@b.co", name: "", password: "long enough pw" });
  const t = st.openSession(u.id); await wait(5); assert.equal(st.userFor(t), null); assert.equal(st.userFor("zz"), null);
});
