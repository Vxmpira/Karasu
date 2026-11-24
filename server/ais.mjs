// Connects to aisstream.io and keeps the Fleet current.
// The key stays on the server: aisstream does not allow browsers to connect directly.
import WebSocket from "ws";

const URL_DEFAULT = "wss://stream.aisstream.io/v0/stream";

export function startAis(fleet, { key, url = URL_DEFAULT, boxes = [[[-90, -180], [90, 180]]], log = console.log } = {}) {
  const state = { live: false, reason: key ? "connecting" : "no key", connects: 0, lastError: null, stop };
  let ws = null, timer = null, stopped = false, delay = 2000;
  if (!key) return state;

  function connect() {
    if (stopped) return;
    state.connects++;
    ws = new WebSocket(url, { perMessageDeflate: true, handshakeTimeout: 15000 });
    ws.on("open", () => {
      // The subscription must arrive within 3 seconds of connecting or the service closes the socket.
      ws.send(JSON.stringify({ APIKey: key, BoundingBoxes: boxes, FilterMessageTypes: ["PositionReport", "ShipStaticData"] }));
      state.reason = "subscribed, waiting for data"; delay = 2000;
    });
    ws.on("message", (raw) => {
      let env; try { env = JSON.parse(raw.toString()); } catch { return; }
      if (env.error || env.Error) { state.lastError = String(env.error || env.Error); state.reason = state.lastError; log("[ais] service said:", state.lastError); return; }
      if (fleet.apply(env)) { state.live = true; state.reason = "live"; }
    });
    ws.on("error", (e) => { state.lastError = e.message; });
    ws.on("close", () => {
      state.live = false; if (stopped) return;
      state.reason = "reconnecting"; log(`[ais] connection closed, retrying in ${Math.round(delay / 1000)}s`);
      timer = setTimeout(connect, delay); delay = Math.min(delay * 2, 60000);
    });
  }
  function stop() { stopped = true; clearTimeout(timer); clearInterval(sweep); try { ws && ws.close(); } catch { /* already closed */ } }
  const sweep = setInterval(() => fleet.prune(), 15 * 60 * 1000); sweep.unref();
  connect();
  return state;
}
