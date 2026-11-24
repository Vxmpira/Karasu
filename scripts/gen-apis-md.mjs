// Writes docs/APIS.md and .env.example from web/apis.json, the single record of every API Karasu needs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const apis = JSON.parse(fs.readFileSync(path.join(root, "web", "apis.json"), "utf8"));
const groups = [["free", "Free key needed", "Sign up once for each. No cost."], ["none", "No key needed", "Public data. These can be built without anything from the owner."], ["pick", "Decision needed", "Paid, or a vendor still to choose."]];
const status = { wired: "Built, waiting for its key", planned: "To build", decision: "Decision needed" };
let md = `# Karasu API record\n\nEvery outside service the terminal needs. This file is generated from \`web/apis.json\`: edit that file, then run \`npm run apis\`.\n\nKeys go in \`.env\` on the server under the setting names below. They never go in the repo or in the page.\n\nKey requirements are as each provider documents them to the best of our knowledge. aisstream.io was checked on Nov 24th, 2026. Each line gets confirmed when its feed is built.\n\nTotals: ${apis.length} services. ${apis.filter((a) => a.key === "none").length} need no key, ${apis.filter((a) => a.key === "free").length} need a free key, ${apis.filter((a) => a.key === "pick").length} need a decision.\n`;
for (const [k, title, lede] of groups) {
  md += `\n## ${title}\n\n${lede}\n\n| Service | What it feeds | Layers | Setting name | Status | Notes |\n|---|---|---|---|---|---|\n`;
  for (const a of apis.filter((x) => x.key === k)) md += `| ${a.name} | ${a.feeds} | ${a.layer} | ${a.env ? "`" + a.env.split(", ").join("`, `") + "`" : ""} | ${a.status === "wired" && a.key === "none" ? "Built, not yet run on the server" : status[a.status]} | ${a.note} |\n`;
}
fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs", "APIS.md"), md);
let env = "# Karasu server settings. Copy to .env and fill in. Never commit .env.\n# Generated from web/apis.json by `npm run apis`.\n\nPORT=3010\n";
for (const [k, title] of groups) { env += `\n# ---- ${title}\n`; for (const a of apis.filter((x) => x.key === k && x.env)) { env += `# ${a.name}: ${a.feeds}\n`; for (const e of a.env.split(", ")) env += `${e}=\n`; } }
fs.writeFileSync(path.join(root, ".env.example"), env);
console.log(`Wrote docs/APIS.md and .env.example for ${apis.length} services.`);
