// Karasu server: the public site, accounts, the gated terminal and the live data behind it.
import express from "express";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { Fleet } from "./fleet.mjs";
import { startAis } from "./ais.mjs";
import { Store } from "./store.mjs";
import { authRoutes, readCookie } from "./auth.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const web = path.join(root, "web"), appDir = path.join(web, "app");

/** Reads web/app/data.js and returns what a paid account sees and what a free account sees. */
export function loadTerminalData(file = path.join(appDir, "data.js")) {
  const box = { window: {} }; vm.runInNewContext(fs.readFileSync(file, "utf8"), box, { timeout: 3000 });
  const paid = JSON.parse(JSON.stringify(box.window.KARASU)), free = JSON.parse(JSON.stringify(paid));
  for (const p of free.points) {
    if (!p.hot) continue;
    for (const k of ["read", "readLabel", "tone", "horizon", "checks"]) delete p[k];
    p.tied = (p.tied || []).map((t) => [t[0], "?", ""]); p.corr = [];
  }
  for (const t of Object.values(free.tickers)) { delete t.read; delete t.steps; }
  for (const d of Object.values(free.desks)) { d.read = { label: "", tone: "flat", weight: "", horizon: "", text: "" }; d.checks = []; }
  free.feed = free.feed.map((f) => [f[0], f[1], f[2], "flat", "", f[5]]);
  const js = (plan, k) => `window.KARASU_PLAN=${JSON.stringify(plan)};window.KARASU=${JSON.stringify(k)};`;
  return { paid: js("paid", paid), free: js("free", free) };
}

export function createApp({ env = process.env, log = console.log, storeFile = path.join(root, "data", "store.json"), dataDir = path.join(root, "data") } = {}) {
  const fleet = new Fleet();
  const ais = startAis(fleet, { key: env.AISSTREAM_API_KEY, url: env.AISSTREAM_URL || undefined, log });
  const store = new Store(storeFile);
  const apis = JSON.parse(fs.readFileSync(path.join(appDir, "apis.json"), "utf8"));
  const data = loadTerminalData();
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback"); // nginx sits in front on the same machine
  app.use((req, res, next) => { res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin" }); next(); });

  app.get("/api/health", (req, res) => res.json({ ok: true, accounts: Object.keys(store.data.users).length, ships: { live: ais.live, reason: ais.reason, tracked: fleet.ships.size, messages: fleet.messages } }));
  app.use("/api", authRoutes({ store, env, dataDir }));

  // Everything below this line in /api needs an account.
  const signedIn = (req) => store.userFor(readCookie(req));
  app.use("/api", (req, res, next) => { req.user = signedIn(req); return req.user ? next() : res.status(401).json({ error: "Log in first." }); });

  // Ships inside a map view. bbox is west,south,east,north in degrees.
  app.get("/api/ships", (req, res) => {
    if (!ais.live) return res.json({ live: false, reason: ais.reason === "no key" ? "live feed needs its key on the server" : ais.reason });
    const bbox = String(req.query.bbox || "").split(",").map(Number);
    const ok = bbox.length === 4 && bbox.every(Number.isFinite);
    const limit = Math.min(3000, Math.max(1, Number(req.query.limit) || 1500));
    const types = req.query.types ? String(req.query.types).split(",") : null;
    const r = fleet.query({ bbox: ok ? bbox : undefined, limit, types });
    res.set("Cache-Control", "no-store").json({ live: true, at: fleet.lastAt, total: r.total, matched: r.matched, ships: r.ships });
  });
  app.get("/api/ships/near", (req, res) => {
    const lat = Number(req.query.lat), lon = Number(req.query.lon), km = Math.min(500, Math.max(5, Number(req.query.km) || 80));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: "lat and lon are required." });
    res.set("Cache-Control", "no-store").json({ live: ais.live, ...fleet.near(lat, lon, km) });
  });
  app.get("/api/ships/:id", (req, res) => { const s = fleet.get(req.params.id); return s ? res.json(s) : res.status(404).json({ error: "No ship with that MMSI is being tracked." }); });

  // Which API keys are set. Reports names only, never values.
  app.get("/api/apis", (req, res) => {
    const set = {};
    for (const a of apis) set[a.id] = a.env ? a.env.split(",").map((s) => s.trim()).every((k) => Boolean(env[k])) : false;
    res.json({ set });
  });
  app.use("/api", (req, res) => res.status(404).json({ error: "Unknown API route." }));

  // The terminal and the account page are for signed-in people. Everyone else goes to the login page.
  const gate = (req, res, next) => { req.user = signedIn(req); return req.user ? next() : res.redirect(302, "/login?next=" + encodeURIComponent(req.originalUrl)); };
  app.use("/app", gate);
  // The free plan gets the facts. Reads, checks and ties are left out on the server, not hidden in the page.
  app.get("/app/data.js", (req, res) => res.type("text/javascript").set("Cache-Control", "private, no-store").send(req.user.plan === "paid" ? data.paid : data.free));
  app.use("/app", express.static(appDir, { maxAge: "5m" }));
  app.get(["/account", "/account.html"], gate, (req, res) => res.set("Cache-Control", "private, no-store").sendFile(path.join(web, "account.html")));

  app.use(express.static(web, { maxAge: "5m", extensions: ["html"] }));
  app.use((req, res) => res.status(404).sendFile(path.join(web, "404.html"), (e) => { if (e) res.type("text/plain").send("Not found"); }));
  return { app, fleet, ais, store };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3010);
  const { app, ais, store } = createApp();
  app.listen(port, "127.0.0.1", () => console.log(`[karasu] listening on 127.0.0.1:${port}. Ships: ${ais.reason}.`));
  for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { store.flush(); process.exit(0); });
}
