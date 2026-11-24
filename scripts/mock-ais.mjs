// A stand-in ship feed for development: speaks the aisstream.io message format on a local port,
// so the live ship layer can be seen without a key.
//   node scripts/mock-ais.mjs            then start the server with
//   AISSTREAM_API_KEY=dev AISSTREAM_URL=ws://127.0.0.1:8790 npm start
import { WebSocketServer } from "ws";
const port = Number(process.env.MOCK_AIS_PORT || 8790), N = 600;
const spots = [[56.5, 25.3], [103.8, 1.2], [4.1, 51.95], [-118.2, 33.7], [-95, 29.5], [121.9, 31.2], [32.5, 30.5], [-74, 40.5], [43.3, 12.6], [18.4, -34.2]];
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const ships = Array.from({ length: N }, (_, i) => { const s = spots[i % spots.length], tanker = rnd() < 0.5, moving = rnd() < 0.7;
  return { mmsi: 538000000 + i, name: `MOCK ${tanker ? "TANKER" : "CARGO"} ${String(i).padStart(3, "0")}`, type: tanker ? 80 : 70, lon: s[0] + (rnd() - 0.5) * 6, lat: s[1] + (rnd() - 0.5) * 5, sog: moving ? 8 + rnd() * 9 : 0, cog: rnd() * 359, dest: ["FUJAIRAH", "SINGAPORE", "ROTTERDAM", "LOS ANGELES", "HOUSTON"][i % 5], draught: 8 + rnd() * 12 }; });
const wss = new WebSocketServer({ port, perMessageDeflate: true });
wss.on("connection", (ws) => {
  let timer = null;
  ws.on("message", () => {
    ws.send(JSON.stringify({ MessageType: "SubscriptionConfirmation", Message: { CompressionEnabled: true } }));
    for (const s of ships) ws.send(JSON.stringify({ MessageType: "ShipStaticData", MetaData: { MMSI: s.mmsi, ShipName: s.name }, Message: { ShipStaticData: { UserID: s.mmsi, Name: s.name, Type: s.type, Destination: s.dest, MaximumStaticDraught: s.draught, Dimension: { A: 150, B: 100, C: 20, D: 24 }, ImoNumber: 9000000 + (s.mmsi % 100000), CallSign: "MOCK" } } }));
    let i = 0; timer = setInterval(() => { for (let k = 0; k < 60; k++) { const s = ships[i++ % N]; const th = (s.cog * Math.PI) / 180; s.lat += (Math.cos(th) * s.sog) / 60 / 600; s.lon += (Math.sin(th) * s.sog) / 60 / 600;
      ws.send(JSON.stringify({ MessageType: "PositionReport", MetaData: { MMSI: s.mmsi, ShipName: s.name, Latitude: s.lat, Longitude: s.lon }, Message: { PositionReport: { UserID: s.mmsi, Latitude: s.lat, Longitude: s.lon, Sog: s.sog, Cog: s.cog, TrueHeading: Math.round(s.cog), NavigationalStatus: s.sog ? 0 : 1 } } })); } }, 250);
  });
  ws.on("close", () => clearInterval(timer));
});
console.log(`[mock-ais] ${N} made-up ships on ws://127.0.0.1:${port}`);
