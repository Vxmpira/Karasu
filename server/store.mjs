// Accounts, sessions and saved lists in one JSON file, written atomically.
// Sized for launch (thousands of accounts). Move to a database when that stops being true.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const DAY = 86_400_000;
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: (await scrypt(pw, salt, 64)).toString("hex") };
}
export async function checkPassword(pw, rec) {
  if (!rec || !rec.salt) return false;
  const got = await scrypt(pw, rec.salt, 64), want = Buffer.from(rec.hash, "hex");
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

export class Store {
  constructor(file, { sessionDays = 30 } = {}) {
    this.file = file; this.sessionMs = sessionDays * DAY; this.timer = null;
    this.data = { users: {}, sessions: {} };
    if (file && fs.existsSync(file)) this.data = { users: {}, sessions: {}, ...JSON.parse(fs.readFileSync(file, "utf8")) };
  }
  save() { if (!this.file || this.timer) return; this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 150); this.timer.unref?.(); }
  flush() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 }); fs.renameSync(tmp, this.file);
  }
  byEmail(email) { const e = String(email || "").trim().toLowerCase(); return Object.values(this.data.users).find((u) => u.email === e) || null; }
  async createUser({ email, name, password }) {
    const id = crypto.randomBytes(8).toString("hex");
    const user = { id, email: String(email).trim().toLowerCase(), name: String(name || "").trim().slice(0, 80), pw: await hashPassword(password), plan: "free", created: Date.now(), watch: { tickers: [], points: [], ships: [] } };
    this.data.users[id] = user; this.save(); return user;
  }
  deleteUser(id) { delete this.data.users[id]; for (const [k, s] of Object.entries(this.data.sessions)) if (s.uid === id) delete this.data.sessions[k]; this.save(); }
  /** Returns the secret token for the cookie. Only its hash is stored. */
  openSession(uid) { const token = crypto.randomBytes(32).toString("hex"); this.data.sessions[sha(token)] = { uid, at: Date.now() }; this.save(); return token; }
  closeSession(token) { if (token) { delete this.data.sessions[sha(token)]; this.save(); } }
  closeOthers(uid, keepToken) { const keep = keepToken ? sha(keepToken) : null; for (const [k, s] of Object.entries(this.data.sessions)) if (s.uid === uid && k !== keep) delete this.data.sessions[k]; this.save(); }
  userFor(token) {
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
    const s = this.data.sessions[sha(token)]; if (!s) return null;
    if (Date.now() - s.at > this.sessionMs) { delete this.data.sessions[sha(token)]; this.save(); return null; }
    return this.data.users[s.uid] || null;
  }
}
