import test from "node:test";
import assert from "node:assert/strict";
import { WebSocketServer } from "ws";
import { boot, wait, account } from "./helpers.mjs";

test("without a key the ship route says so and nothing connects", async () => {
  const s = await boot({}); const c = s.client(); await c.post("/api/auth/signup", account());
  const r = await c.get("/api/ships?bbox=-180,-85,180,85");
  assert.equal(r.json.live, false); assert.match(r.json.reason, /key/); assert.equal(s.ais.connects, 0);
  assert.equal((await c.get("/api/apis")).json.set.aisstream, false);
  s.close();
});

test("with a key the server subscribes, tracks ships from the stream, and serves them", async () => {
  const feed = new WebSocketServer({ port: 0, perMessageDeflate: true }); let sub = null;
  await new Promise((r) => feed.on("listening", r));
  feed.on("connection", (ws) => ws.on("message", (m) => {
    sub = JSON.parse(m.toString());
    ws.send(JSON.stringify({ MessageType: "SubscriptionConfirmation", Message: { CompressionEnabled: true } }));
    ws.send(JSON.stringify({ MessageType: "PositionReport", MetaData: { MMSI: 538006090, ShipName: "FRONT ALTA", Latitude: 25.2, Longitude: 56.4 }, Message: { PositionReport: { UserID: 538006090, Latitude: 25.2, Longitude: 56.4, Sog: 0, Cog: 90, TrueHeading: 511, NavigationalStatus: 1 } } }));
    ws.send(JSON.stringify({ MessageType: "ShipStaticData", MetaData: { MMSI: 538006090 }, Message: { ShipStaticData: { UserID: 538006090, Name: "FRONT ALTA", Type: 80, Destination: "FUJAIRAH", MaximumStaticDraught: 11.4, Dimension: { A: 200, B: 133, C: 30, D: 30 } } } }));
    ws.send(JSON.stringify({ MessageType: "PositionReport", MetaData: { MMSI: 211000001 }, Message: { PositionReport: { UserID: 211000001, Latitude: 25.25, Longitude: 56.45, Sog: 11, Cog: 300, TrueHeading: 300, NavigationalStatus: 0 } } }));
  }));
  const s = await boot({ AISSTREAM_API_KEY: "test-key", AISSTREAM_URL: `ws://127.0.0.1:${feed.address().port}` });
  const c = s.client(); await c.post("/api/auth/signup", account());
  for (let i = 0; i < 40 && !s.ais.live; i++) await wait(50);
  assert.equal(sub.APIKey, "test-key"); assert.deepEqual(sub.BoundingBoxes, [[[-90, -180], [90, 180]]]); assert.deepEqual(sub.FilterMessageTypes, ["PositionReport", "ShipStaticData"]);
  await wait(100);
  const gulf = await c.get("/api/ships?bbox=50,20,60,30");
  assert.equal(gulf.json.live, true); assert.equal(gulf.json.ships.length, 2);
  const t = gulf.json.ships[0];
  assert.deepEqual([t.id, t.name, t.type, t.dest, t.draught, t.len, t.sog, t.nav, t.flag], ["538006090", "FRONT ALTA", "Tanker", "FUJAIRAH", 11.4, 333, 0, 1, "Marshall Islands"]);
  assert.equal((await c.get("/api/ships?bbox=-10,40,10,60")).json.ships.length, 0);
  assert.equal((await c.get("/api/ships/538006090")).json.name, "FRONT ALTA");
  assert.equal((await c.get("/api/ships/111111111")).status, 404);
  const near = (await c.get("/api/ships/near?lat=25.2&lon=56.4&km=80")).json;
  assert.deepEqual([near.tanker.n, near.tanker.stopped, near.other.n, near.other.stopped, near.longest[0].name], [1, 1, 1, 0, "FRONT ALTA"]);
  assert.equal((await c.get("/api/ships/near?lat=51&lon=4")).json.tanker.n, 0);
  assert.equal((await c.get("/api/apis")).json.set.aisstream, true);
  for (const ws of feed.clients) ws.terminate(); feed.close(); s.close();
});
