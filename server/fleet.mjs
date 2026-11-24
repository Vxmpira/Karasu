// In-memory picture of the world's ships, built from AIS messages.
// Pure logic, no network: ais.mjs feeds it, index.mjs reads it, tests exercise it directly.

const HOUR = 3_600_000;

/** AIS ship type code (0 to 99) to the groups the terminal draws. */
export function shipType(code) {
  const c = Number(code) || 0;
  if (c >= 80 && c <= 89) return "Tanker";
  if (c >= 70 && c <= 79) return "Cargo";
  if (c >= 60 && c <= 69) return "Passenger";
  if (c === 30) return "Fishing";
  if (c === 31 || c === 32 || c === 52) return "Tug";
  return "Other";
}

// First three digits of an MMSI name the flag state. A short table of the largest registries.
const MID = { 201: "Albania", 205: "Belgium", 209: "Cyprus", 210: "Cyprus", 211: "Germany", 212: "Cyprus", 215: "Malta", 218: "Germany", 219: "Denmark", 220: "Denmark", 224: "Spain", 225: "Spain", 226: "France", 227: "France", 228: "France", 229: "Malta", 230: "Finland", 232: "United Kingdom", 233: "United Kingdom", 234: "United Kingdom", 235: "United Kingdom", 236: "Gibraltar", 237: "Greece", 239: "Greece", 240: "Greece", 241: "Greece", 244: "Netherlands", 245: "Netherlands", 246: "Netherlands", 247: "Italy", 248: "Malta", 249: "Malta", 255: "Madeira", 256: "Malta", 257: "Norway", 258: "Norway", 259: "Norway", 261: "Poland", 263: "Portugal", 265: "Sweden", 266: "Sweden", 271: "Turkey", 272: "Ukraine", 273: "Russia", 303: "United States", 304: "Antigua and Barbuda", 305: "Antigua and Barbuda", 308: "Bahamas", 309: "Bahamas", 310: "Bermuda", 311: "Bahamas", 316: "Canada", 319: "Cayman Islands", 338: "United States", 345: "Mexico", 351: "Panama", 352: "Panama", 353: "Panama", 354: "Panama", 355: "Panama", 356: "Panama", 357: "Panama", 366: "United States", 367: "United States", 368: "United States", 369: "United States", 370: "Panama", 371: "Panama", 372: "Panama", 373: "Panama", 374: "Panama", 403: "Saudi Arabia", 412: "China", 413: "China", 414: "China", 416: "Taiwan", 419: "India", 422: "Iran", 428: "Israel", 431: "Japan", 432: "Japan", 440: "South Korea", 441: "South Korea", 447: "Kuwait", 461: "Oman", 463: "Pakistan", 466: "Qatar", 470: "United Arab Emirates", 471: "United Arab Emirates", 477: "Hong Kong", 503: "Australia", 512: "New Zealand", 525: "Indonesia", 533: "Malaysia", 538: "Marshall Islands", 548: "Philippines", 563: "Singapore", 564: "Singapore", 565: "Singapore", 566: "Singapore", 567: "Thailand", 574: "Vietnam", 577: "Vanuatu", 620: "Comoros", 636: "Liberia", 637: "Liberia", 657: "Nigeria", 667: "Sierra Leone", 671: "Togo", 677: "Tanzania", 710: "Brazil", 725: "Chile" };
export function flagFromMmsi(mmsi) { return MID[String(mmsi).slice(0, 3)] || null; }

const text = (v) => (typeof v === "string" ? v.replace(/@+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) : "");
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

export class Fleet {
  constructor({ silentAfterH = 6, dropAfterH = 72 } = {}) {
    this.ships = new Map();
    this.silentAfter = silentAfterH * HOUR;
    this.dropAfter = dropAfterH * HOUR;
    this.messages = 0;
    this.lastAt = 0;
  }

  /** Apply one aisstream envelope. Returns the ship it touched, or null if the message was not usable. */
  apply(env, now = Date.now()) {
    if (!env || typeof env !== "object" || !env.Message) return null;
    const meta = env.MetaData || {};
    const body = env.Message[env.MessageType] || {};
    const mmsi = String(meta.MMSI ?? body.UserID ?? "");
    if (!/^\d{9}$/.test(mmsi)) return null;
    let s = this.ships.get(mmsi);
    if (!s) { s = { id: mmsi, name: "", type: "Other", sog: 0, cog: 0, hdg: null, nav: null, flag: flagFromMmsi(mmsi), ts: 0, still: null }; this.ships.set(mmsi, s); }
    const metaName = text(meta.ShipName);
    if (metaName && !s.name) s.name = metaName;

    if (env.MessageType === "PositionReport") {
      const lat = num(body.Latitude ?? meta.Latitude ?? meta.latitude), lon = num(body.Longitude ?? meta.Longitude ?? meta.longitude);
      if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null; // 91 and 181 mean "not available"
      s.lat = lat; s.lon = lon;
      const sog = num(body.Sog); s.sog = sog === null || sog > 102 ? 0 : sog;          // 102.3 means "not available"
      const cog = num(body.Cog); if (cog !== null && cog < 360) s.cog = cog;            // 360 means "not available"
      const hdg = num(body.TrueHeading); s.hdg = hdg !== null && hdg < 360 ? hdg : null; // 511 means "not available"
      s.nav = num(body.NavigationalStatus);
      s.ts = now;
      if (s.sog < 0.5) { if (!s.still) s.still = now; } else s.still = null;
    } else if (env.MessageType === "ShipStaticData") {
      const name = text(body.Name); if (name) s.name = name;
      s.typeCode = num(body.Type); s.type = shipType(s.typeCode);
      const imo = num(body.ImoNumber); if (imo) s.imo = String(imo);
      const call = text(body.CallSign); if (call) s.callsign = call;
      const dest = text(body.Destination); if (dest) s.dest = dest;
      const dr = num(body.MaximumStaticDraught); if (dr) s.draught = dr;
      const d = body.Dimension || {};
      const len = (num(d.A) || 0) + (num(d.B) || 0), beam = (num(d.C) || 0) + (num(d.D) || 0);
      if (len) s.len = len; if (beam) s.beam = beam;
      const e = body.Eta || {};
      if (num(e.Month) && num(e.Day)) s.eta = `${String(e.Month).padStart(2, "0")}-${String(e.Day).padStart(2, "0")} ${String(num(e.Hour) ?? 0).padStart(2, "0")}:${String(num(e.Minute) ?? 0).padStart(2, "0")} UTC`;
    } else return null;
    this.messages++; this.lastAt = now;
    return s;
  }

  get(id) { return this.ships.get(String(id)) || null; }

  /** Ships with a known position inside the box [west, south, east, north]. Tankers and cargo ships first, newest first. */
  query({ bbox = [-180, -90, 180, 90], limit = 1500, types = null } = {}) {
    const [w, s0, e, n] = bbox, wrap = w > e, out = [];
    for (const s of this.ships.values()) {
      if (s.lat === undefined || s.lat < s0 || s.lat > n) continue;
      if (wrap ? s.lon < w && s.lon > e : s.lon < w || s.lon > e) continue;
      if (types && !types.includes(s.type)) continue;
      out.push(s);
    }
    const rank = (x) => (x.type === "Tanker" ? 0 : x.type === "Cargo" ? 1 : 2);
    out.sort((a, b) => rank(a) - rank(b) || b.ts - a.ts);
    return { total: this.ships.size, matched: out.length, ships: out.slice(0, limit) };
  }

  /** Count ships within `km` of a point, split by type and by moving or stopped, with the longest-stopped named. */
  near(lat, lon, km = 80, now = Date.now()) {
    const r = { km, tanker: { n: 0, stopped: 0 }, cargo: { n: 0, stopped: 0 }, other: { n: 0, stopped: 0 }, longest: [] };
    const rad = Math.PI / 180, dLat = km / 111.2, dLon = dLat / Math.max(0.2, Math.cos(lat * rad));
    for (const s of this.ships.values()) {
      if (s.lat === undefined || Math.abs(s.lat - lat) > dLat || Math.abs(s.lon - lon) > dLon) continue;
      const a = Math.sin(((s.lat - lat) * rad) / 2) ** 2 + Math.cos(lat * rad) * Math.cos(s.lat * rad) * Math.sin(((s.lon - lon) * rad) / 2) ** 2;
      if (2 * 6371 * Math.asin(Math.sqrt(a)) > km) continue;
      const g = s.type === "Tanker" ? r.tanker : s.type === "Cargo" ? r.cargo : r.other;
      g.n++;
      if (s.sog < 0.5) { g.stopped++; if (s.still) r.longest.push({ id: s.id, name: s.name, type: s.type, hours: (now - s.still) / 3_600_000 }); }
    }
    r.longest.sort((x, y) => y.hours - x.hours); r.longest = r.longest.slice(0, 3);
    return r;
  }

  /** Forget ships that have been silent longer than the drop window. */
  prune(now = Date.now()) {
    let n = 0;
    for (const [k, s] of this.ships) if (now - s.ts > this.dropAfter) { this.ships.delete(k); n++; }
    return n;
  }
}
