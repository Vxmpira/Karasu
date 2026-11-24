import test from "node:test";
import assert from "node:assert/strict";
import { Fleet, shipType, flagFromMmsi } from "../server/fleet.mjs";

const pos = (mmsi, lat, lon, extra = {}) => ({ MessageType: "PositionReport", MetaData: { MMSI: mmsi, ShipName: "FRONT ALTA   ", Latitude: lat, Longitude: lon }, Message: { PositionReport: { UserID: mmsi, Latitude: lat, Longitude: lon, Sog: 12.4, Cog: 281.5, TrueHeading: 280, NavigationalStatus: 0, ...extra } } });
const stat = (mmsi, extra = {}) => ({ MessageType: "ShipStaticData", MetaData: { MMSI: mmsi, ShipName: "FRONT ALTA" }, Message: { ShipStaticData: { UserID: mmsi, Name: "FRONT ALTA@@@@", Type: 80, ImoNumber: 9806524, CallSign: "V7A2", Destination: "FUJAIRAH", MaximumStaticDraught: 11.4, Dimension: { A: 200, B: 133, C: 30, D: 30 }, Eta: { Month: 11, Day: 28, Hour: 6, Minute: 0 }, ...extra } } });

test("ship type codes map to the groups the map draws", () => {
  assert.equal(shipType(80), "Tanker"); assert.equal(shipType(89), "Tanker"); assert.equal(shipType(70), "Cargo");
  assert.equal(shipType(60), "Passenger"); assert.equal(shipType(30), "Fishing"); assert.equal(shipType(52), "Tug"); assert.equal(shipType(0), "Other");
});
test("flag comes from the first three MMSI digits", () => { assert.equal(flagFromMmsi("538006090"), "Marshall Islands"); assert.equal(flagFromMmsi("999000000"), null); });

test("a position report and a static report build one ship", () => {
  const f = new Fleet(), t0 = 1_800_000_000_000;
  f.apply(pos(538006090, 25.2, 56.4), t0); const s = f.apply(stat(538006090), t0 + 1000);
  assert.equal(f.ships.size, 1);
  assert.deepEqual([s.id, s.name, s.type, s.imo, s.callsign, s.dest, s.draught, s.len, s.beam, s.flag], ["538006090", "FRONT ALTA", "Tanker", "9806524", "V7A2", "FUJAIRAH", 11.4, 333, 60, "Marshall Islands"]);
  assert.deepEqual([s.lat, s.lon, s.sog, s.cog, s.hdg, s.nav, s.ts, s.still], [25.2, 56.4, 12.4, 281.5, 280, 0, t0, null]);
  assert.equal(s.eta, "11-28 06:00 UTC");
});
test("not-available values are dropped, and a bad MMSI or position is ignored", () => {
  const f = new Fleet();
  const s = f.apply(pos(538006090, 10, 20, { Sog: 102.3, Cog: 360, TrueHeading: 511 }), 1000);
  assert.deepEqual([s.sog, s.cog, s.hdg], [0, 0, null]);
  assert.equal(f.apply(pos(538006091, 91, 181), 1000), null);
  assert.equal(f.apply(pos(12345, 10, 20), 1000), null);
  assert.equal(f.apply({ MessageType: "SubscriptionConfirmation", Message: { CompressionEnabled: true } }, 1000), null);
});
test("a stopped ship records when it stopped, and clears it when it moves", () => {
  const f = new Fleet();
  f.apply(pos(538006090, 25, 56, { Sog: 0.1 }), 1000); f.apply(pos(538006090, 25, 56, { Sog: 0 }), 5000);
  assert.equal(f.get("538006090").still, 1000);
  f.apply(pos(538006090, 25, 56, { Sog: 9 }), 9000); assert.equal(f.get("538006090").still, null);
});
test("query filters by box, puts tankers first, and respects the limit", () => {
  const f = new Fleet();
  f.apply(pos(211000001, 51.9, 4.1), 1000); f.apply(stat(211000001, { Type: 70 }), 1000);   // cargo, Rotterdam
  f.apply(pos(538000002, 51.95, 4.2), 2000); f.apply(stat(538000002, { Type: 81 }), 2000);  // tanker, Rotterdam
  f.apply(pos(367000003, 29.7, -95.0), 3000);                                                // unknown type, Houston
  const eu = f.query({ bbox: [0, 45, 10, 55] });
  assert.deepEqual(eu.ships.map((s) => s.type), ["Tanker", "Cargo"]); assert.equal(eu.total, 3); assert.equal(eu.matched, 2);
  assert.equal(f.query({ bbox: [0, 45, 10, 55], limit: 1 }).ships.length, 1);
  assert.equal(f.query({ bbox: [170, 20, -90, 40] }).ships[0].id, "367000003"); // a box that crosses the date line
  assert.equal(f.query({ types: ["Tanker"] }).ships.length, 1);
});
test("ships silent past the drop window are forgotten", () => {
  const f = new Fleet({ dropAfterH: 1 }); f.apply(pos(538006090, 25, 56), 0); f.apply(pos(211000001, 51, 4), 3_500_000);
  assert.equal(f.prune(3_700_000), 1); assert.equal(f.ships.size, 1);
});
