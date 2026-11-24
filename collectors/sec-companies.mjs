// Builds web/companies.json from SEC EDGAR: every company with a ticker on a US exchange,
// with its exchange, headquarters city and state (or country), and industry.
//
// No API key. SEC asks for a contact in the User-Agent header and at most 10 requests a second.
// Set SEC_USER_AGENT, for example:  SEC_USER_AGENT="Karasu BlackCrownVxJ.LLC@outlook.com"
//
// STATUS: written from SEC's published file formats and not yet run against the live service
// (the build sandbox cannot reach sec.gov). Run it once on the server and check the summary it prints.
//
//   node collectors/sec-companies.mjs            full run, about 20 minutes, resumes from its cache
//   node collectors/sec-companies.mjs --limit 50 quick check on the first 50 companies
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(root, "web", "companies.json");
const CACHE = path.join(root, "data", "sec-cache");
const UA = process.env.SEC_USER_AGENT;
const limit = process.argv.includes("--limit") ? Number(process.argv[process.argv.indexOf("--limit") + 1]) : Infinity;
const US = new Set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "));
const FIELDS = ["s", "n", "x", "c", "sec", "ind", "cap", "st", "city", "sp"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const title = (s) => String(s || "").toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "gzip, deflate" } });
    if (r.ok) return r.json();
    if (r.status === 404) return null;
    await sleep(1500 * (i + 1)); // 403 or 429 means slow down
  }
  throw new Error(`SEC refused ${url}`);
}

async function main() {
  if (!UA || !UA.includes("@")) throw new Error("Set SEC_USER_AGENT to a name and contact email first. SEC blocks requests without one.");
  fs.mkdirSync(CACHE, { recursive: true });
  const list = await get("https://www.sec.gov/files/company_tickers_exchange.json");
  const f = list.fields, iC = f.indexOf("cik"), iN = f.indexOf("name"), iT = f.indexOf("ticker"), iX = f.indexOf("exchange");
  const byCik = new Map();
  for (const row of list.data) { if (!row[iX]) continue; if (!byCik.has(row[iC])) byCik.set(row[iC], { cik: row[iC], name: row[iN], ticker: row[iT], exchange: row[iX] }); }
  const prior = new Map();
  if (fs.existsSync(OUT)) { const p = JSON.parse(fs.readFileSync(OUT, "utf8")); for (const r of p.rows) prior.set(r[0], Object.fromEntries(p.fields.map((k, i) => [k, r[i]]))); }

  const rows = []; let n = 0, withState = 0;
  for (const c of byCik.values()) {
    if (n >= limit) break; n++;
    const file = path.join(CACHE, `${c.cik}.json`);
    let sub = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
    if (!sub) { sub = await get(`https://data.sec.gov/submissions/CIK${String(c.cik).padStart(10, "0")}.json`); await sleep(125); if (sub) fs.writeFileSync(file, JSON.stringify({ sicDescription: sub.sicDescription, addresses: sub.addresses })); }
    const biz = (sub && sub.addresses && sub.addresses.business) || {};
    const code = String(biz.stateOrCountry || "").toUpperCase(), sym = String(c.ticker).toUpperCase().replace(".", "-"), old = prior.get(sym) || {};
    const st = US.has(code) ? code : null; if (st) withState++;
    rows.push({ s: sym, n: old.n || title(c.name), x: String(c.exchange).toUpperCase(), c: st ? "United States" : biz.stateOrCountryDescription ? title(biz.stateOrCountryDescription) : old.c || null,
      sec: old.sec || null, ind: (sub && sub.sicDescription && title(sub.sicDescription)) || old.ind || null, cap: old.cap || 0, st, city: biz.city ? title(biz.city) : old.city || null, sp: old.sp || null });
    if (n % 250 === 0) console.log(`  ${n} of ${byCik.size}`);
  }
  rows.sort((a, b) => b.cap - a.cap || a.s.localeCompare(b.s));
  fs.writeFileSync(OUT, JSON.stringify({ asof: new Date().toISOString().slice(0, 10) + " · SEC EDGAR", fields: FIELDS, rows: rows.map((r) => FIELDS.map((k) => r[k] ?? null)) }));
  console.log(`Wrote ${rows.length} companies to web/companies.json. ${withState} have a US state.`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
