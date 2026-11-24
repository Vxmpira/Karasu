import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { WebSocketServer } from "ws";
import { createApp } from "../server/index.mjs";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const listen = (app) => new Promise((res) => { const srv = app.listen(0, "127.0.0.1", () => res(srv)); });
const getJson = (port, p) => new Promise((res, rej) => http.get({ host: "127.0.0.1", port, path: p, agent: false }, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res({ status: r.statusCode, body: JSON.parse(b) })); }).on("error", rej));

test("without a key the ship route says so and nothing connects", async () => {
  const { app, ais } = createApp({ env: {}, log() {} });
  const srv = await listen(app); const port = srv.address().port;
  const r = await getJson(port, "/api/ships?bbox=-180,-85,180,85");
  assert.equal(r.body.live, false); assert.match(r.body.reason, /AISSTREAM_API_KEY/); assert.equal(ais.connects, 0);
  assert.equal((await getJson(port, "/api/apis")).body.set.aisstream, false);
  srv.closeAllConnections(); srv.close();
});

test("with a key the server subscribes, tracks ships from the stream, and serves them", async () => {
  const feed = new WebSocketServer({ port: 0, perMessageDeflate: true }); let sub = null;
  await new Promise((r) => feed.on("listening", r));
  feed.on("connection", (ws) => ws.on("message", (m) => {
    sub = JSON.parse(m.toString());
    ws.send(JSON.stringify({ MessageType: "SubscriptionConfirmation", Message: { CompressionEnabled: true } }));
    ws.send(JSON.stringify({ MessageType: "PositionReport", MetaData: { MMSI: 538006090, ShipName: "FRONT ALTA", Latitude: 25.2, Longitude: 56.4 }, Message: { PositionReport: { UserID: 538006090, Latitude: 25.2, Longitude: 56.4, Sog: 0, Cog: 90, TrueHeading: 511, NavigationalStatus: 1 } } }));
    ws.send(JSON.stringify({ MessageType: "ShipStaticData", MetaData: { MMSI: 538006090 }, Message: { ShipStaticData: { UserID: 538006090, Name: "FRONT ALTA", Type: 80, Destination: "FUJAIRAH", MaximumStaticDraught: 11.4, Dimension: { A: 200, B: 133, C: 30, D: 30 } } } }));
  }));
  const { app, ais } = createApp({ env: { AISSTREAM_API_KEY: "test-key", AISSTREAM_URL: `ws://127.0.0.1:${feed.address().port}` }, log() {} });
  const srv = await listen(app); const port = srv.address().port;
  for (let i = 0; i < 40 && !ais.live; i++) await wait(50);
  assert.equal(sub.APIKey, "test-key"); assert.deepEqual(sub.BoundingBoxes, [[[-90, -180], [90, 180]]]); assert.deepEqual(sub.FilterMessageTypes, ["PositionReport", "ShipStaticData"]);
  await wait(100);
  const gulf = await getJson(port, "/api/ships?bbox=50,20,60,30");
  assert.equal(gulf.body.live, true); assert.equal(gulf.body.ships.length, 1);
  const s = gulf.body.ships[0];
  assert.deepEqual([s.id, s.name, s.type, s.dest, s.draught, s.len, s.sog, s.nav, s.flag], ["538006090", "FRONT ALTA", "Tanker", "FUJAIRAH", 11.4, 333, 0, 1, "Marshall Islands"]);
  assert.ok(s.still > 0);
  assert.equal((await getJson(port, "/api/ships?bbox=-10,40,10,60")).body.ships.length, 0);
  assert.equal((await getJson(port, "/api/ships/538006090")).body.name, "FRONT ALTA");
  assert.equal((await getJson(port, "/api/ships/111111111")).status, 404);
  assert.equal((await getJson(port, "/api/apis")).body.set.aisstream, true);
  ais.stop(); srv.closeAllConnections(); srv.close(); for (const c of feed.clients) c.terminate(); feed.close();
});
