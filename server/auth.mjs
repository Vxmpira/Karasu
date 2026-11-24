// Sign up, log in, the account itself, the watchlist and the contact form.
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { checkPassword, hashPassword } from "./store.mjs";

const COOKIE = "karasu_sid";
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const publicUser = (u) => ({ email: u.email, name: u.name, plan: u.plan, created: u.created });

export function readCookie(req) { const m = /(?:^|;\s*)karasu_sid=([0-9a-f]{64})/.exec(req.headers.cookie || ""); return m ? m[1] : null; }
function setCookie(req, res, token, ms) { res.append("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.round(ms / 1000)}${req.secure ? "; Secure" : ""}`); }

/** Small in-memory limiter: at most `max` hits per `windowMs` for each key. */
export function limiter(max, windowMs) {
  const hits = new Map();
  return (key) => { const now = Date.now(), h = hits.get(key); if (!h || now > h.reset) { hits.set(key, { n: 1, reset: now + windowMs }); return true; } return ++h.n <= max; };
}

export function authRoutes({ store, env, dataDir }) {
  const r = express.Router();
  const loginOk = limiter(10, 10 * 60_000), signupOk = limiter(6, 60 * 60_000), contactOk = limiter(5, 60 * 60_000);
  r.use(express.json({ limit: "20kb" }));
  // Writes must come from our own pages: same origin, and JSON so a plain cross-site form cannot post.
  r.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") return next();
    const origin = req.headers.origin;
    let host = null; try { host = origin ? new URL(origin).host : null; } catch { host = "invalid"; }
    if (origin && host !== req.headers.host) return res.status(403).json({ error: "This request came from another site." });
    if (!req.is("application/json")) return res.status(415).json({ error: "Send JSON." });
    next();
  });
  r.use((req, res, next) => { req.token = readCookie(req); req.user = store.userFor(req.token); next(); });
  const need = (req, res, next) => (req.user ? next() : res.status(401).json({ error: "Log in first." }));

  r.post("/auth/signup", async (req, res) => {
    if (!signupOk(req.ip)) return res.status(429).json({ error: "Too many sign-ups from this connection. Try again in an hour." });
    const email = clean(req.body.email, 256).toLowerCase(), name = clean(req.body.name, 80), password = String(req.body.password ?? "");
    if (!EMAIL.test(email)) return res.status(400).json({ error: "Enter a valid email address.", field: "email" });
    if (password.length < 10) return res.status(400).json({ error: "Use a password of at least 10 characters.", field: "password" });
    if (password.length > 200) return res.status(400).json({ error: "That password is too long.", field: "password" });
    if (req.body.agree !== true) return res.status(400).json({ error: "You need to accept the terms to create an account.", field: "agree" });
    if (store.byEmail(email)) return res.status(409).json({ error: "An account with that email already exists. Log in instead.", field: "email" });
    const user = await store.createUser({ email, name, password });
    setCookie(req, res, store.openSession(user.id), store.sessionMs);
    res.status(201).json({ user: publicUser(user) });
  });

  r.post("/auth/login", async (req, res) => {
    const email = clean(req.body.email, 256).toLowerCase();
    if (!loginOk(req.ip + "|" + email)) return res.status(429).json({ error: "Too many attempts. Wait ten minutes and try again." });
    const user = store.byEmail(email);
    // Always run the hash so a wrong email and a wrong password take the same time.
    const ok = await checkPassword(String(req.body.password ?? ""), user ? user.pw : { salt: "00", hash: "00".repeat(64) });
    if (!user || !ok) return res.status(401).json({ error: "That email and password do not match an account." });
    setCookie(req, res, store.openSession(user.id), store.sessionMs);
    res.json({ user: publicUser(user) });
  });

  r.post("/auth/logout", (req, res) => { store.closeSession(req.token); setCookie(req, res, "0".repeat(64), 0); res.json({ ok: true }); });

  r.get("/me", need, (req, res) => res.set("Cache-Control", "no-store").json({ user: publicUser(req.user), watch: req.user.watch }));
  r.patch("/me", need, (req, res) => { req.user.name = clean(req.body.name, 80); store.save(); res.json({ user: publicUser(req.user) }); });
  r.post("/me/password", need, async (req, res) => {
    const next = String(req.body.next ?? "");
    if (!(await checkPassword(String(req.body.current ?? ""), req.user.pw))) return res.status(401).json({ error: "Your current password is not right.", field: "current" });
    if (next.length < 10 || next.length > 200) return res.status(400).json({ error: "Use a new password of at least 10 characters.", field: "next" });
    req.user.pw = await hashPassword(next); store.closeOthers(req.user.id, req.token); store.save();
    res.json({ ok: true });
  });
  r.delete("/me", need, async (req, res) => {
    if (!(await checkPassword(String(req.body.password ?? ""), req.user.pw))) return res.status(401).json({ error: "That password is not right.", field: "password" });
    store.deleteUser(req.user.id); setCookie(req, res, "0".repeat(64), 0); res.json({ ok: true });
  });

  r.put("/watchlist", need, (req, res) => {
    const w = {};
    for (const k of ["tickers", "points", "ships"]) w[k] = (Array.isArray(req.body[k]) ? req.body[k] : []).filter((v) => typeof v === "string" && v.length < 40).slice(0, 200);
    req.user.watch = w; store.save(); res.json({ watch: w });
  });

  r.post("/contact", (req, res) => {
    if (!contactOk(req.ip)) return res.status(429).json({ error: "Too many messages from this connection. Email us instead." });
    const msg = { at: new Date().toISOString(), name: clean(req.body.name, 80), email: clean(req.body.email, 256), topic: clean(req.body.topic, 40), message: String(req.body.message ?? "").trim().slice(0, 4000), account: req.user ? req.user.email : null };
    if (!EMAIL.test(msg.email)) return res.status(400).json({ error: "Enter an email address we can reply to.", field: "email" });
    if (msg.message.length < 10) return res.status(400).json({ error: "Tell us a little more so we can help.", field: "message" });
    fs.mkdirSync(dataDir, { recursive: true }); fs.appendFileSync(path.join(dataDir, "contact.jsonl"), JSON.stringify(msg) + "\n", { mode: 0o600 });
    res.status(201).json({ ok: true });
  });

  // What the public pages need to know about pricing. Empty until the owner sets it.
  r.get("/config", (req, res) => res.json({ priceMonthly: env.PRICE_MONTHLY || null, priceYearly: env.PRICE_YEARLY || null, linkMonthly: env.CHECKOUT_LINK_MONTHLY || null, linkYearly: env.CHECKOUT_LINK_YEARLY || null }));

  // Owner only: switch an account between free and paid until billing is automated.
  r.post("/admin/plan", (req, res) => {
    if (!env.ADMIN_TOKEN || req.headers["x-admin-token"] !== env.ADMIN_TOKEN) return res.status(403).json({ error: "Not allowed." });
    const user = store.byEmail(req.body.email), plan = req.body.plan;
    if (!user) return res.status(404).json({ error: "No account with that email." });
    if (plan !== "free" && plan !== "paid") return res.status(400).json({ error: "Plan must be free or paid." });
    user.plan = plan; store.save(); res.json({ user: publicUser(user) });
  });
  return r;
}
