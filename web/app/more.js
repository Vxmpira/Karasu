/* Karasu: account session, watchlist, ships near a point, ship filters, keyboard shortcuts, copy and deep links.
   Loads after extra.js. Works signed in on the Karasu server and as a preview with no server. */
(function () {
  "use strict";
  var X = window.KX; if (!X || !X.ships) return;
  var state = X.state, esc = X.esc, fmt = X.fmt, P = X.P, T = X.T;
  var $ = function (s) { return document.querySelector(s); };
  var me = null, watch = { tickers: [], points: [], ships: [] }, KM = 120;
  function norm(w) { var o = { tickers: [], points: [], ships: [] }; ["tickers", "points", "ships"].forEach(function (k) { if (w && Array.isArray(w[k])) o[k] = w[k].filter(function (v) { return typeof v === "string" && v.length < 40; }).slice(0, 200); }); return o; }
  function saveWatch() {
    if (me) fetch("/api/watchlist", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(watch) }).catch(function () {});
    else try { localStorage.setItem("karasu-watch", JSON.stringify(watch)); } catch (e) { /* storage can be unavailable; the list still works for this visit */ }
  }
  function toast(t) { var el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); el.textContent = t; document.body.appendChild(el); setTimeout(function () { el.remove(); }, 1800); }

  /* ---------- watchlist */
  function has(kind, id) { return watch[kind].indexOf(id) >= 0; }
  X.star = function (kind, id) { var on = has(kind, id); return '<button type="button" class="star' + (on ? " on" : "") + '" data-x="watch:' + kind + ":" + esc(id) + '" aria-pressed="' + on + '">' + (on ? "Watching" : "Watch") + "</button>"; };
  X.tickerTop = function (sym) { return '<div class="tools">' + X.star("tickers", sym) + (me ? '<button type="button" class="star" data-x="link:t-' + esc(sym) + '">Copy link</button>' : "") + "</div>"; };
  function shipName(id) { var s = X.ships.fleet().filter(function (x) { return x.id === id; })[0]; return s ? s.name : "Ship " + id; }
  function renderWatch() {
    var el = $("#watchlist"); if (!el) return;
    var n = watch.tickers.length + watch.points.length + watch.ships.length;
    if (!n) { el.innerHTML = '<p style="font-size:12.5px;color:var(--mute);line-height:1.45">Nothing yet. Press Watch on a data point, ship or ticker to keep it here.</p>'; return; }
    el.innerHTML = watch.points.map(function (id) { var p = X.byId[id]; return p ? '<button type="button" class="hv" data-point="' + p.id + '">' + X.glyph(p.layer, p.hot, 5.5) + "<span><b>" + esc(p.lab) + '</b><small style="--tone:var(--mute)">' + esc(p.hot ? p.detail : "Coverage at launch") + "</small></span></button>" : ""; }).join("") +
      watch.ships.map(function (id) { return '<button type="button" class="hv" data-x="ship:' + esc(id) + '"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 2.5 L13 14 L9 12 L5 14 Z" fill="#DCDAE3"/></svg><span><b>' + esc(shipName(id)) + '</b><small style="--tone:var(--mute)">Ship</small></span></button>'; }).join("") +
      watch.tickers.map(function (s) { var c = T[s] || (X.company && X.company(s)); return '<button type="button" class="hv" data-sym="' + esc(s) + '"><span class="sym" style="font-size:11px;margin-top:2px">' + esc(s.slice(0, 2)) + "</span><span><b>" + esc(s) + '</b><small style="--tone:var(--mute)">' + esc(c ? c.n : "Ticker") + "</small></span></button>"; }).join("");
  }
  var tkRows0 = X.tkRows;
  X.tkRows = function (q, filter) {
    if (filter !== "watch") return tkRows0 ? tkRows0(q, filter) : "";
    var rows = watch.tickers.filter(function (s) { return !q || s.toLowerCase().indexOf(q) >= 0; });
    if (!rows.length) return '<tr><td colspan="4" class="nm" style="padding:16px 10px">Your watchlist has no tickers yet. Open a ticker and press Watch.</td></tr>';
    return rows.map(function (s) { var c = T[s] || (X.company && X.company(s)) || { n: s, s: "" }; return '<tr class="tk-row' + (s === state.ticker ? " on" : "") + '" data-sym="' + esc(s) + '" tabindex="0"><td><span class="sym">' + esc(s) + '</span></td><td class="nm"><b>' + esc(c.n) + "</b>" + esc(c.s || c.sec || "") + '</td><td class="r mono num">' + (X.tix[s] ? X.tix[s].length : 0) + '</td><td class="r"></td></tr>'; }).join("");
  };

  /* ---------- ships near a data point */
  X.cardExtra = function (p) { return p.layer === "energy" || p.layer === "goods" ? '<div class="sec" id="nearsec" data-pt="' + p.id + '" hidden></div>' : ""; };
  function nearHTML(r, live) {
    var tot = r.tanker.n + r.cargo.n + r.other.n; if (!tot) return "";
    var cell = function (label, g) { return "<div><b class=\"num\">" + g.n + "</b><span>" + label + "<br>" + g.stopped + " stopped</span></div>"; };
    var stopped = r.tanker.stopped + r.cargo.stopped + r.other.stopped;
    return '<h3 class="kick">Ships within ' + r.km + ' km right now</h3><div class="minis" style="margin-top:0">' + cell("tankers", r.tanker) + cell("cargo ships", r.cargo) + cell("other", r.other) + '</div><div class="size" style="border:0;padding-top:8px"><div class="bar"><i style="width:' + (stopped / tot * 100).toFixed(1) + '%;background:var(--gold)"></i></div><p>' + stopped + " of " + tot + " are stopped. " + (stopped / tot > .6 ? "That is a waiting crowd, not traffic passing through." : "Most are under way.") + "</p></div>" +
      (r.longest && r.longest.length ? r.longest.map(function (s) { return '<button type="button" class="rowbtn" data-x="ship:' + esc(s.id) + '"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="4" fill="none" stroke="#E8C77F" stroke-width="1.4"/></svg><span><b>' + esc(s.name || "Unnamed ship") + "</b><small>" + esc(s.type) + ", stopped " + (s.hours < 48 ? Math.round(s.hours) + " hours" : Math.round(s.hours / 24) + " days") + "</small></span></button>"; }).join("") : "") +
      '<p class="src">' + (live ? "Live count from the ship feed" : "Simulated ships. The live count needs the ship feed key.") + "</p>";
  }
  function countLocal(p) {
    var r = { km: KM, tanker: { n: 0, stopped: 0 }, cargo: { n: 0, stopped: 0 }, other: { n: 0, stopped: 0 }, longest: [] };
    X.ships.fleet().forEach(function (s) { if (s.lat === undefined || d3.geoDistance(p.ll, [s.lon, s.lat]) * 6371 > KM) return; var g = s.type === "Tanker" ? r.tanker : s.type === "Cargo" ? r.cargo : r.other; g.n++; if (s.sog < .5) { g.stopped++; if (s.stillH) r.longest.push({ id: s.id, name: s.name, type: s.type, hours: s.stillH }); } });
    r.longest.sort(function (a, b) { return b.hours - a.hours; }); r.longest = r.longest.slice(0, 3); return r;
  }
  X.afterCard = function () {
    renderWatch();
    var el = $("#nearsec"); if (!el) return; var p = X.byId[el.dataset.pt]; if (!p) return;
    var put = function (r, live) { var h = nearHTML(r, live); el.hidden = !h; el.innerHTML = h; };
    if (X.ships.mode() === "live") fetch("/api/ships/near?km=" + KM + "&lat=" + p.ll[1] + "&lon=" + p.ll[0]).then(function (r) { return r.json(); }).then(function (r) { if (r && r.tanker && $("#nearsec") === el) put(r, true); }).catch(function () {});
    else put(countLocal(p), false);
  };

  /* ---------- ship filters */
  state.shipFilter = "all";
  X.shipPass = function (s) { var f = state.shipFilter; return f === "all" || (f === "tanker" && s.type === "Tanker") || (f === "cargo" && s.type === "Cargo") || (f === "stopped" && s.sog < .5); };
  function renderShipF() { var el = $("#shipf"); if (!el) return; el.hidden = !state.ships; el.innerHTML = [["all", "All ships"], ["tanker", "Tankers"], ["cargo", "Cargo"], ["stopped", "Stopped only"]].map(function (f) { return '<button type="button" class="chipbtn" data-x="sf:' + f[0] + '" aria-pressed="' + (state.shipFilter === f[0]) + '">' + f[1] + "</button>"; }).join(""); }

  /* ---------- copy and deep links */
  function copy(text, done) { try { navigator.clipboard.writeText(text).then(function () { toast(done); }, function () { toast("Copy was blocked by the browser"); }); } catch (e) { toast("Copy is not available here"); } }
  function pointText(p) {
    var t = p.name + (p.when ? " (" + p.when + ")" : "") + "\n\nWhat we see: " + (p.hot ? p.what : p.note) + (p.src ? "\nSource: " + p.src : "");
    if (p.hot && X.paid() && p.read) t += "\n\nThe read: " + p.readLabel + ". Weight " + p.weight + ", horizon " + p.horizon.toLowerCase() + ".\n" + p.read + "\n\nHow to check it:\n" + p.checks.map(function (c, i) { return (i + 1) + ". " + c; }).join("\n");
    return t + "\n\nKarasu by BlackCrown. Research, not investment advice.";
  }
  function route() { var h = location.hash.slice(1); if (h.indexOf("t-") === 0) { var s = h.slice(2).toUpperCase(); if (T[s] || (X.company && X.company(s))) X.goTicker(s); } else if (h.indexOf("p-") === 0 && X.byId[h.slice(2)]) X.goPoint(h.slice(2)); }

  /* ---------- actions */
  var act0 = X.act;
  X.act = function (x, el) {
    if (x.indexOf("watch:") === 0) { var a = x.split(":"), k = a[1], id = a.slice(2).join(":"), i = watch[k].indexOf(id); if (i >= 0) watch[k].splice(i, 1); else watch[k].unshift(id); saveWatch(); X.renderCard(); if (state.view === "tickers") X.renderTicker(); renderWatch(); return; }
    if (x.indexOf("sf:") === 0) { state.shipFilter = x.slice(3); if (state.ship && !X.shipPass(state.ship)) { state.ship = null; X.renderCard(); } renderShipF(); X.draw(); return; }
    if (x.indexOf("ship:") === 0) { var s = X.ships.fleet().filter(function (v) { return v.id === x.slice(5); })[0]; if (!s) { toast("That ship is not in view right now"); return; } X.show("map", true); state.shipFilter = "all"; renderShipF(); X.ships.select(s); if (s.lat !== undefined) X.flyTo({ xy: X.proj([s.lon, s.lat]) }, 9); return; }
    if (x.indexOf("copy:") === 0) { var p = X.byId[x.slice(5)]; if (p) copy(pointText(p), "Copied"); return; }
    if (x.indexOf("link:") === 0) { copy(location.origin + location.pathname + "#" + x.slice(5).toLowerCase(), "Link copied"); return; }
    if (x === "keys") { var kb = $("#keys"); kb.hidden = !kb.hidden; return; }
    if (x === "acct") { var m = $("#acct-menu"); m.hidden = !m.hidden; return; }
    if (x === "signout") { fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(function () { location.href = "/"; }, function () { location.href = "/"; }); return; }
    if (x === "ships" && act0) { act0(x, el); renderShipF(); return; }
    if (act0) return act0(x, el);
  };
  var star0 = X.star;
  X.star = function (kind, id) { return star0(kind, id) + (kind === "points" ? '<button type="button" class="star" data-x="copy:' + esc(id) + '">Copy</button>' + (me ? '<button type="button" class="star" data-x="link:p-' + esc(id) + '">Link</button>' : "") : ""); };

  /* ---------- keyboard */
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return; var tg = e.target, typing = tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA" || tg.isContentEditable);
    if (e.key === "Escape") { $("#keys").hidden = true; var m = $("#acct-menu"); if (m) m.hidden = true; return; }
    if (typing) return;
    if (e.key === "/") { e.preventDefault(); $("#q").focus(); }
    else if (e.key >= "1" && e.key <= "4") X.show(["map", "tickers", "desks", "sources"][+e.key - 1], true);
    else if (e.key === "?") { var kb = $("#keys"); kb.hidden = !kb.hidden; }
    else if (e.key === "w") { var b = document.querySelector("#cardp .star[data-x^='watch:'], #tk-detail .star[data-x^='watch:']"); if (state.view === "tickers") b = document.querySelector("#tk-detail .star[data-x^='watch:']"); if (b) b.click(); }
    else if (e.key === "s") { X.act("ships"); }
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act='plan-paid']"); if (b && me) { e.stopPropagation(); e.preventDefault(); location.href = "/account#plan"; }
    if (!e.target.closest(".acct")) { var m = $("#acct-menu"); if (m) m.hidden = true; }
  }, true);

  /* ---------- page furniture */
  var rail = document.querySelector(".rail"), heavy = $("#heavy");
  if (rail && heavy) { var sec = document.createElement("section"); sec.innerHTML = '<h3 class="kick">Watchlist</h3><div id="watchlist"></div>'; rail.insertBefore(sec, heavy.parentNode); }
  var mw = $("#mapwrap"); if (mw) { var sf = document.createElement("div"); sf.className = "ov shipf"; sf.id = "shipf"; mw.appendChild(sf); }
  var kb = document.createElement("div"); kb.className = "keys"; kb.id = "keys"; kb.hidden = true;
  kb.innerHTML = '<span class="kick">Keyboard</span><dl><dt>/</dt><dd>Search</dd><dt>1 2 3 4</dt><dd>Map, Tickers, Desks, Sources</dd><dt>w</dt><dd>Watch or unwatch what is open</dd><dt>s</dt><dd>Show or hide ships</dd><dt>+ and -</dt><dd>Zoom, with the map focused</dd><dt>Arrows</dt><dd>Pan, with the map focused</dd><dt>Esc</dt><dd>Close</dd></dl>';
  document.body.appendChild(kb);

  /* ---------- session: signed in on the server, or a preview with no server */
  function signedIn(u) {
    me = u.user; watch = norm(u.watch); state.plan = me.plan === "paid" ? "paid" : "free";
    var plan = document.querySelector(".plan"); if (plan) {
      var ini = (me.name || me.email).trim().slice(0, 1).toUpperCase(), d = document.createElement("div"); d.className = "acct";
      d.innerHTML = '<button type="button" data-x="acct" aria-haspopup="true"><span>' + esc(ini) + "</span><span>" + (state.plan === "paid" ? "Paid" : "Free") + '</span></button><div class="acct-menu" id="acct-menu" hidden><p><b style="color:var(--bone);font-weight:500">' + esc(me.name || "Your account") + "</b><br>" + esc(me.email) + '</p><a href="/account">Account and plan</a><a href="/contact">Contact</a><button type="button" data-x="signout">Sign out</button></div>';
      plan.replaceWith(d);
    }
    var chip = document.querySelector(".samplechip"); if (chip) chip.textContent = "Early access · sample data";
    X.refresh(); renderShipF(); renderWatch(); route();
  }
  try { var w = JSON.parse(localStorage.getItem("karasu-watch") || "null"); if (w) watch = norm(w); } catch (e) { /* no stored list */ }
  renderShipF(); renderWatch(); X.renderCard(); route();
  window.addEventListener("hashchange", route);
  fetch("/api/me").then(function (r) { return r.ok ? r.json() : null; }).then(function (u) { if (u && u.user) signedIn(u); }).catch(function () {});
  X.session = function () { return me; };
})();
