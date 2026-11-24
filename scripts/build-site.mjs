// Builds the public pages from site-src/ into web/, and a single-file preview into preview/site.html.
//   node scripts/build-site.mjs
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))), src = path.join(root, "site-src"), web = path.join(root, "web");
const read = (...p) => fs.readFileSync(path.join(...p), "utf8");
const box = { window: {} }; vm.runInNewContext(read(web, "app", "data.js"), box);
const K = box.window.KARASU, companies = JSON.parse(read(web, "app", "companies.json")).rows.length;
const n = { points: String(K.points.length), live: String(K.points.filter((p) => p.hot).length), companies: companies.toLocaleString("en-US"), sources: String(K.sources.length) };
const fill = (s, vars) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
const layout = read(src, "layout.html"), css = read(src, "site.css"), js = read(src, "site.js");
const pages = fs.readdirSync(path.join(src, "pages")).filter((f) => f.endsWith(".html")).map((f) => { const raw = read(src, "pages", f), m = /^<!--(\{.*?\})-->\n?/.exec(raw); return { ...JSON.parse(m[1]), body: fill(raw.slice(m[0].length), n) }; });

// 1. the real pages
fs.mkdirSync(path.join(web, "img"), { recursive: true });
for (const f of fs.readdirSync(path.join(src, "img"))) fs.copyFileSync(path.join(src, "img", f), path.join(web, "img", f));
fs.writeFileSync(path.join(web, "site.css"), css); fs.writeFileSync(path.join(web, "site.js"), js);
for (const p of pages) fs.writeFileSync(path.join(web, p.file), fill(layout, { title: p.title, desc: p.desc, body: p.body, css: '<link rel="stylesheet" href="/site.css">', js: '<script src="/site.js"></script>' }));

// 2. one self-contained file to review the pages without a server
const inlineImg = (h) => h.replace(/src="img\/([\w.-]+)"/g, (m, f) => `src="data:image/jpeg;base64,${fs.readFileSync(path.join(src, "img", f)).toString("base64")}"`);
const sections = pages.map((p) => `<div class="pg" data-path="${p.path}" data-title="${p.title}" hidden>\n${inlineImg(p.body)}\n</div>`).join("\n");
const router = `<script>window.KARASU_PREVIEW=true;window.KARASU_TERMINAL="https://claude.ai/artifact/2rSHmrwCrhKmGkMzSSdLHG";
window.KARASU_ROUTE=function(href){var u=href.split("#"),p=u[0].split("?")[0]||"/",pg=document.querySelector('.pg[data-path="'+p+'"]')||document.querySelector('.pg[data-path="/404"]');
document.querySelectorAll(".pg").forEach(function(e){e.hidden=e!==pg});document.title=pg.dataset.title;var name=p==="/"?"home":p.slice(1);try{history.replaceState(null,"","#"+name)}catch(e){}
var t=u[1]&&document.getElementById(u[1]);if(t)t.scrollIntoView();else window.scrollTo(0,0);if(window.KARASU_SITE)window.KARASU_SITE.paint()};
document.addEventListener("click",function(e){var a=e.target.closest("a[href]");if(!a)return;var h=a.getAttribute("href");if(h.charAt(0)==="/"&&h.indexOf("/app")!==0){e.preventDefault();window.KARASU_ROUTE(h)}else if(h.charAt(0)==="#"){e.preventDefault();var t=document.getElementById(h.slice(1));if(t)t.scrollIntoView()}});
var start=location.hash.slice(1);window.KARASU_ROUTE(start&&start!=="home"?"/"+start:"/");
window.addEventListener("hashchange",function(){var h=location.hash.slice(1),p=h==="home"?"/":"/"+h;if(document.querySelector('.pg[data-path="'+p+'"]'))window.KARASU_ROUTE(p)});</script>`;
const banner = '<div style="background:#121017;border-bottom:1px solid rgba(220,218,227,.18);padding:7px 20px;font:500 12px JetBrains Mono,monospace;color:#E8C77F;text-align:center">Preview of the public pages. Forms run against a stand-in, so nothing is saved. The real pages are served from the Karasu server.</div>';
fs.mkdirSync(path.join(root, "preview"), { recursive: true });
fs.writeFileSync(path.join(root, "preview", "site.html"), fill(layout, { title: "Karasu Site", desc: "Preview of the Karasu public pages.", body: banner + sections, css: `<style>\n${css}\n</style>`, js: `${router}\n<script>\n${js}\n</script>` }).replace("<main>", "<main>").replace(/<header class="top">/, '<header class="top" style="position:sticky">'));
console.log(`Built ${pages.length} pages into web/ and preview/site.html (${Math.round(fs.statSync(path.join(root, "preview", "site.html")).size / 1024)} KB). Stats: ${JSON.stringify(n)}`);
