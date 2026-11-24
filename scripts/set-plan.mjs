// Owner tool: switch an account between free and paid on the running server.
//   ADMIN_TOKEN=... node scripts/set-plan.mjs someone@example.com paid
const [email, plan] = process.argv.slice(2), port = process.env.PORT || 3010;
if (!email || !["free", "paid"].includes(plan)) { console.error("Usage: node scripts/set-plan.mjs <email> <free|paid>"); process.exit(1); }
const r = await fetch(`http://127.0.0.1:${port}/api/admin/plan`, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": process.env.ADMIN_TOKEN || "" }, body: JSON.stringify({ email, plan }) });
console.log(r.status, JSON.stringify(await r.json()));
