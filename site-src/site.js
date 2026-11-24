/* Karasu public site: sign-in state, forms, the account page and pricing.
   On the server it talks to /api. In the preview build (window.KARASU_PREVIEW) it uses a stand-in so the pages can be reviewed with no server. */
(function () {
  "use strict";
  var PREVIEW = !!window.KARASU_PREVIEW, TERMINAL = window.KARASU_TERMINAL || "/app/";
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var demo = { user: null, watch: { tickers: ["PLTR", "HII", "TSN"], points: ["hormuz"], ships: [] } };
  function fake(method, url, body) {
    var ok = function (d, s) { return Promise.resolve({ ok: true, status: s || 200, data: d }); }, no = function (s, d) { return Promise.resolve({ ok: false, status: s, data: d }); };
    if (url === "/api/config") return ok({ priceMonthly: null, priceYearly: null, linkMonthly: null, linkYearly: null });
    if (url === "/api/auth/signup" || url === "/api/auth/login") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email || "")) return no(400, { error: "Enter a valid email address.", field: "email" });
      if ((body.password || "").length < 10) return no(400, { error: "Use a password of at least 10 characters.", field: "password" });
      if (url === "/api/auth/signup" && body.agree !== true) return no(400, { error: "You need to accept the terms to create an account.", field: "agree" });
      demo.user = { email: body.email.toLowerCase(), name: body.name || "", plan: "free", created: Date.now() }; return ok({ user: demo.user }, 201);
    }
    if (url === "/api/contact") return (body.message || "").length < 10 ? no(400, { error: "Tell us a little more so we can help.", field: "message" }) : ok({ ok: true }, 201);
    if (!demo.user) return no(401, { error: "Log in first." });
    if (url === "/api/me" && method === "GET") return ok({ user: demo.user, watch: demo.watch });
    if (url === "/api/me" && method === "PATCH") { demo.user.name = body.name || ""; return ok({ user: demo.user }); }
    if (url === "/api/watchlist") { demo.watch = body; return ok({ watch: body }); }
    if (url === "/api/auth/logout" || (url === "/api/me" && method === "DELETE")) { demo.user = null; return ok({ ok: true }); }
    return ok({ ok: true });
  }
  function api(method, url, body) {
    if (PREVIEW) return fake(method, url, body || {});
    return fetch(url, { method: method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
      .catch(function () { return { ok: false, status: 0, data: { error: "We could not reach the server. Check your connection and try again." } }; });
  }
  function go(path) { if (window.KARASU_ROUTE) window.KARASU_ROUTE(path); else location.href = path; }
  function nextPath() { var n = new URLSearchParams(location.search).get("next"); return n && n.charAt(0) === "/" && n.charAt(1) !== "/" ? n : TERMINAL; }
  function say(form, text, kind) { var m = $(".msg", form); if (m) { m.textContent = text || ""; m.className = "msg" + (kind ? " " + kind : ""); } }
  function mark(form, field) { $$("[aria-invalid]", form).forEach(function (e) { e.removeAttribute("aria-invalid"); }); var el = field && form.elements[field]; if (el) { el.setAttribute("aria-invalid", "true"); el.focus(); } }
  function vals(form) { var o = {}; $$("input,select,textarea", form).forEach(function (e) { if (e.name) o[e.name] = e.type === "checkbox" ? e.checked : e.value; }); return o; }

  var me = null;
  function paint() {
    document.body.classList.toggle("in", !!me);
    if (PREVIEW) $$('a[href="/app/"]').forEach(function (a) { a.href = TERMINAL; a.target = "_blank"; a.rel = "noopener"; });
    var acct = $("[data-me]"); if (!acct || acct.closest("[hidden]")) return;
    if (!me) { if (PREVIEW) go("/login"); return; }
    var u = me.user, paid = u.plan === "paid";
    $('[data-me="email"]').textContent = u.email;
    var dt = new Date(u.created), dd = dt.getDate(), ord = dd % 10 === 1 && dd !== 11 ? "st" : dd % 10 === 2 && dd !== 12 ? "nd" : dd % 10 === 3 && dd !== 13 ? "rd" : "th";
    $('[data-me="since"]').textContent = dt.toLocaleDateString("en-US", { month: "short" }) + " " + dd + ord + ", " + dt.getFullYear();
    $('[data-me="plan"]').textContent = paid ? "Paid" : "Free"; $('[data-me="plan"]').style.color = paid ? "var(--green)" : "var(--mute)";
    $('[data-me="includes"]').textContent = paid ? "Everything: the facts, the reads, the checks and the tied tickers." : "The full map, every company page and the facts on each data point.";
    $("#acct-name").value = u.name || "";
    var w = me.watch || {}, rows = [];
    (w.tickers || []).forEach(function (v) { rows.push(["tickers", v, "Ticker"]); }); (w.points || []).forEach(function (v) { rows.push(["points", v, "Data point"]); }); (w.ships || []).forEach(function (v) { rows.push(["ships", v, "Ship"]); });
    var wl = $("[data-wl]"); wl.textContent = "";
    if (!rows.length) { var li0 = document.createElement("li"); li0.innerHTML = "<small>Nothing yet. Press Watch on a ticker, ship or data point in the terminal.</small>"; wl.appendChild(li0); }
    rows.forEach(function (r) { var li = document.createElement("li"), a = document.createElement("span"), b = document.createElement("small"), x = document.createElement("button"); a.textContent = r[1]; b.textContent = r[2]; x.type = "button"; x.textContent = "Remove"; x.onclick = function () { me.watch[r[0]] = me.watch[r[0]].filter(function (v) { return v !== r[1]; }); api("PUT", "/api/watchlist", me.watch).then(paint); }; li.appendChild(a); li.appendChild(b); li.appendChild(x); wl.appendChild(li); });
    if (paid) $("[data-upgrade]").innerHTML = '<p style="color:var(--mute)">You are on the paid plan. Thank you.</p>';
    else if (cfg && (cfg.linkMonthly || cfg.linkYearly)) { var up = $("[data-upgrade]"); up.textContent = ""; [["linkMonthly", "priceMonthly", "monthly"], ["linkYearly", "priceYearly", "yearly"]].forEach(function (k) { if (!cfg[k[0]]) return; var a = document.createElement("a"); a.className = "btn pri sm"; a.style.marginRight = "10px"; a.href = cfg[k[0]]; a.textContent = "Upgrade, " + (cfg[k[1]] || k[2]); up.appendChild(a); }); }
  }
  var cfg = null;
  function pricing() {
    if (!cfg) return; var p = $("[data-price]"); if (!p) return;
    if (cfg.priceMonthly) { p.textContent = cfg.priceMonthly; var n = $("[data-price-note]"); if (n) n.textContent = cfg.priceYearly ? "Or " + cfg.priceYearly + " billed yearly. Cancel any time." : "Cancel any time."; var b = $("[data-buy]"); if (b) b.textContent = "Start free, upgrade any time"; }
  }

  var FORMS = {
    login: function (f, v) { return api("POST", "/api/auth/login", { email: v.email, password: v.password }).then(function (r) { if (!r.ok) { say(f, r.data.error, "err"); mark(f, r.data.field || "password"); return; } if (PREVIEW) { me = { user: r.data.user, watch: demo.watch }; go("/account"); paint(); } else location.href = nextPath(); }); },
    signup: function (f, v) { return api("POST", "/api/auth/signup", { name: v.name, email: v.email, password: v.password, agree: v.agree }).then(function (r) { if (!r.ok) { say(f, r.data.error, "err"); mark(f, r.data.field); return; } if (PREVIEW) { me = { user: r.data.user, watch: demo.watch }; go("/account"); paint(); } else location.href = TERMINAL; }); },
    contact: function (f, v) { return api("POST", "/api/contact", v).then(function (r) { if (!r.ok) { say(f, r.data.error, "err"); mark(f, r.data.field); return; } f.reset(); mark(f); say(f, "Thank you. Your message is with us and we will reply by email.", "ok"); }); },
    name: function (f, v) { return api("PATCH", "/api/me", { name: v.name }).then(function (r) { if (r.ok) { me.user = r.data.user; say(f, "Saved.", "ok"); } else say(f, r.data.error, "err"); }); },
    password: function (f, v) { return api("POST", "/api/me/password", v).then(function (r) { if (!r.ok) { say(f, r.data.error, "err"); mark(f, r.data.field); return; } f.reset(); mark(f); say(f, "Password changed.", "ok"); }); },
    "delete": function (f, v) { return api("DELETE", "/api/me", { password: v.password }).then(function (r) { if (!r.ok) { say(f, r.data.error, "err"); mark(f, r.data.field); return; } me = null; go("/"); paint(); }); }
  };
  document.addEventListener("submit", function (e) {
    var f = e.target.closest("form[data-form]"); if (!f) return; e.preventDefault();
    var b = $("button[type=submit]", f); say(f, ""); b.disabled = true;
    FORMS[f.dataset.form](f, vals(f)).then(function () { b.disabled = false; });
  });
  document.addEventListener("click", function (e) { if (e.target.closest("[data-do='signout']")) api("POST", "/api/auth/logout", {}).then(function () { me = null; go("/"); paint(); }); });

  api("GET", "/api/config").then(function (r) { if (r.ok) { cfg = r.data; pricing(); paint(); } });
  api("GET", "/api/me").then(function (r) { me = r.ok ? r.data : null; paint(); });
  window.KARASU_SITE = { paint: paint };
})();
