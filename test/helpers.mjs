import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server/index.mjs";

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Starts the app on a free port with an in-memory store. Returns helpers for making requests as a browser would. */
export async function boot(env = {}, opts = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "karasu-test-"));
  const made = createApp({ env, log() {}, storeFile: opts.storeFile ?? null, dataDir });
  const srv = await new Promise((res) => { const s = made.app.listen(0, "127.0.0.1", () => res(s)); });
  const base = `http://127.0.0.1:${srv.address().port}`;
  const client = () => {
    let cookie = "";
    const call = async (method, url, body, headers = {}) => {
      const r = await fetch(base + url, { method, redirect: "manual", headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined });
      for (const c of r.headers.getSetCookie()) cookie = c.split(";")[0];
      const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
      return { status: r.status, json, text, headers: r.headers };
    };
    return { get: (u, h) => call("GET", u, undefined, h), post: (u, b, h) => call("POST", u, b ?? {}, h), put: (u, b) => call("PUT", u, b), patch: (u, b) => call("PATCH", u, b), del: (u, b) => call("DELETE", u, b), cookie: () => cookie };
  };
  const close = () => { made.ais.stop?.(); srv.closeAllConnections(); srv.close(); };
  return { ...made, base, client, close, dataDir };
}
export const account = (n = 1) => ({ email: `trader${n}@example.com`, name: `Trader ${n}`, password: "correct horse battery", agree: true });
