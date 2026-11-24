// Karasu server: serves the terminal and the live data behind it.
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Fleet } from "./fleet.mjs";
import { startAis } from "./ais.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const web = path.join(root, "web");

export function createApp({ env = process.env, log = console.log } = {}) {
  const fleet = new Fleet();
  const ais = startAis(fleet, { key: env.AISSTREAM_API_KEY, url: env.AISSTREAM_URL || undefined, log });
  const apis = JSON.parse(fs.readFileSync(path.join(web, "apis.json"), "utf8"));
  const app = express();
  app.disable("x-powered-by");

  app.get("/api/health", (req, res) => res.json({ ok: true, ships: { live: ais.live, reason: ais.reason, tracked: fleet.ships.size, messages: fleet.messages } }));

  // Ships inside a map view. bbox is west,south,east,north in degrees.
  app.get("/api/ships", (req, res) => {
    if (!ais.live) return res.json({ live: false, reason: ais.reason === "no key" ? "add AISSTREAM_API_KEY on the server to go live" : ais.reason });
    const bbox = String(req.query.bbox || "").split(",").map(Number);
    const ok = bbox.length === 4 && bbox.every(Number.isFinite);
    const limit = Math.min(3000, Math.max(1, Number(req.query.limit) || 1500));
    const types = req.query.types ? String(req.query.types).split(",") : null;
    const r = fleet.query({ bbox: ok ? bbox : undefined, limit, types });
    res.set("Cache-Control", "no-store").json({ live: true, at: fleet.lastAt, total: r.total, matched: r.matched, ships: r.ships });
  });

  app.get("/api/ships/:id", (req, res) => {
    const s = fleet.get(req.params.id);
    return s ? res.json(s) : res.status(404).json({ error: "No ship with that MMSI is being tracked." });
  });

  // Which API keys are set. Reports names only, never values.
  app.get("/api/apis", (req, res) => {
    const set = {};
    for (const a of apis) set[a.id] = a.env ? a.env.split(",").map((s) => s.trim()).every((k) => Boolean(env[k])) : false;
    res.json({ set });
  });

  app.use("/api", (req, res) => res.status(404).json({ error: "Unknown API route." }));
  app.use(express.static(web, { maxAge: "5m", extensions: ["html"] }));
  return { app, fleet, ais };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3010);
  const { app, ais } = createApp();
  app.listen(port, "127.0.0.1", () => console.log(`[karasu] listening on 127.0.0.1:${port}. Ships: ${ais.reason}.`));
}
