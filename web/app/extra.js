/* Karasu: ships, state and country panels, listed companies, API record.
   Loads after the core script in index.html and plugs into its hooks (window.KX). */
(function () {
  "use strict";
  var X = window.KX; if (!X) return;
  var K = X.K, P = X.P, T = X.T, LAY = X.LAY, state = X.state, proj = X.proj, esc = X.esc, fmt = X.fmt;
  var $ = function (s) { return document.querySelector(s); };
  state.ships = true; state.ship = null; state.region = null;

  /* ================= listed companies ================= */
  var CO = [], coBy = {}, coState = {}, coCountry = {}, coReady = false;
  function symKey(s) { return String(s).replace(".", "-"); }
  function cap(m) { return !m ? "" : m >= 1e6 ? "$" + (m / 1e6).toFixed(2) + "T" : m >= 1e3 ? "$" + (m / 1e3).toFixed(m >= 1e4 ? 0 : 1) + "B" : "$" + m + "M"; }
  X.company = function (s) { return coBy[symKey(s)]; };
  function tied(s) { return T[s] || T[String(s).replace("-", ".")]; }
  function coRow(c) {
    return '<button type="button" class="tie co" data-sym="' + esc(tied(c.s) && !T[c.s] ? c.s.replace("-", ".") : c.s) + '"><span class="sym">' + esc(c.s) + '</span><span class="why"><b>' + esc(c.n) + "</b>" + (c.city ? " · " + esc(c.city) : "") + (c.sec ? " · " + esc(c.sec) : "") + '</span><span class="capv">' + cap(c.cap) + "</span></button>";
  }
  function coList(list, n) {
    var head = list.slice(0, n).map(coRow).join(""), rest = list.slice(n, 400);
    return '<div class="ties">' + head + (rest.length ? "<details><summary>Show " + (list.length - n) + " more</summary>" + rest.map(coRow).join("") + (list.length > 400 ? '<p class="src">The list stops at 400. Search for the rest.</p>' : "") + "</details>" : "") + "</div>";
  }
  function sectorBars(list, color) {
    var by = {}; list.forEach(function (c) { var k = c.sec || "Unclassified"; by[k] = (by[k] || 0) + 1; });
    var rows = Object.keys(by).map(function (k) { return [k, by[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6), mx = rows.length ? rows[0][1] : 1;
    return rows.map(function (r) { return '<div class="hb" style="--c:' + color + ';grid-template-columns:150px minmax(0,1fr) auto"><span>' + esc(r[0]) + '</span><span class="tr"><i style="width:' + (r[1] / mx * 100).toFixed(1) + '%"></i></span><span class="vl num">' + r[1] + "</span></div>"; }).join("");
  }
  X.companyFacts = function (sym) {
    var c = X.company(sym); if (!c) return "";
    var f = [["Exchange", c.x], ["Country", c.c], ["Headquarters", c.city ? c.city + (c.st ? ", " + c.st : "") : null], ["Sector", c.sec], ["Industry", c.ind], ["Market value", c.cap ? cap(c.cap) + " (list snapshot)" : null]].filter(function (x) { return x[1]; });
    return '<dl class="spec facts">' + f.map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + esc(x[1]) + "</dd>"; }).join("") + "</dl>";
  };
  var TK_ADDS = ["Earnings dates and results", "Filings as they post", "Insider trades", "Fund holdings", "Suppliers and customers", "Contract awards", "Shipment records", "Hiring and layoffs", "Patents"];
  X.companyHTML = function (sym) {
    var c = X.company(sym); if (!c) return "";
    var where = c.st ? '<button type="button" class="btn" data-x="st:' + c.st + '">See ' + esc(c.st) + " on the map</button>" : c.c ? '<button type="button" class="btn" data-x="co:' + esc(c.c) + '">See ' + esc(c.c) + " on the map</button>" : "";
    return '<div class="tk-head"><span class="big">' + esc(c.s) + "</span><div><h2>" + esc(c.n) + '</h2><div class="sub">' + esc(c.sec || "Listed company") + "</div></div></div>" + (X.tickerTop ? X.tickerTop(c.s) : "") + X.companyFacts(sym) +
      '<div class="grid2"><div class="blk"><h3 class="kick">No data points tied yet</h3><p>Nothing on the map touches ' + esc(c.s) + ' yet. Data points attach on their own as feeds connect: a contract award names the company, a shipment record names the importer, a filing names the customer.</p><p class="note">The company is listed here so its page is ready the day the first data point lands.</p><div style="margin-top:12px">' + where + '</div></div><div class="blk"><h3 class="kick">This page adds at launch</h3><div class="chips">' + TK_ADDS.map(function (x) { return '<span class="chip" style="border-style:dashed">' + x + "</span>"; }).join("") + "</div></div></div>";
  };
  X.tkRows = function (q, filter) {
    if (filter !== "all" || !coReady) return "";
    var rows = [], n = 0;
    CO.forEach(function (c) { if (tied(c.s)) return; if (q && !(c.s.toLowerCase().indexOf(q) === 0 || c.n.toLowerCase().indexOf(q) >= 0)) return; n++; if (rows.length < 150) rows.push(c); });
    return rows.map(function (c) { return '<tr class="tk-row' + (c.s === state.ticker ? " on" : "") + '" data-sym="' + esc(c.s) + '" tabindex="0"><td><span class="sym">' + esc(c.s) + '</span></td><td class="nm"><b>' + esc(c.n) + "</b>" + esc(c.sec || "") + '</td><td class="r mono num" style="color:var(--dim)">0</td><td class="r"><span class="capv">' + cap(c.cap) + "</span></td></tr>"; }).join("") +
      (n > rows.length ? '<tr><td colspan="4" class="nm" style="padding:12px 10px">Showing ' + rows.length + " of " + fmt(n) + " more listed companies. Type in the filter to narrow.</td></tr>" : "");
  };
  X.search = function (q, hits) {
    (X.stateFeat || []).forEach(function (f) { var n = f.properties.name; if (n.toLowerCase().indexOf(q) === 0) hits.push(["State", n, "x", "st:" + X.POSTAL[n]]); });
    (X.worldFeat || []).forEach(function (f) { var n = cname(f); if (q.length > 2 && n.toLowerCase().indexOf(q) === 0) hits.push(["Country", n, "x", "co:" + n]); });
    var k = 0; CO.some(function (c) { if (tied(c.s)) return false; if (c.s.toLowerCase().indexOf(q) === 0 || (q.length > 2 && c.n.toLowerCase().indexOf(q) >= 0)) { hits.push(["Listed", c.s + " · " + c.n, "sym", c.s]); k++; } return k >= 5; });
  };

  /* ================= states and countries ================= */
  function cname(f) { var n = f.properties.name; return n === "United States of America" ? "United States" : n; }
  function contains(feats, ll) { for (var i = 0; i < feats.length; i++) if (d3.geoContains(feats[i], ll)) return feats[i]; return null; }
  function near(feats, ll) { var f = contains(feats, ll); if (f) return f; var o = [[.15, 0], [-.15, 0], [0, .15], [0, -.15], [.3, .3], [-.3, .3], [.3, -.3], [-.3, -.3]]; for (var i = 0; i < o.length && !f; i++) f = contains(feats, [ll[0] + o[i][0], ll[1] + o[i][1]]); return f; }
  X.onGeo = function () {
    var sf = X.stateFeat || [], wf = X.worldFeat || [];
    P.forEach(function (p) {
      if (!p.stName && sf.length && p.ll[0] < -66 && p.ll[0] > -180 && p.ll[1] > 18) { var f = near(sf, p.ll); if (f) p.stName = f.properties.name; }
      if (!p.country && wf.length) { var c = near(wf, p.ll); if (c) p.country = cname(c); }
    });
  };
  X.onGeo();
  function regionAt(ll, rel) {
    if (!ll) return null;
    if (rel >= 2.2) { var s = contains(X.stateFeat || [], ll); if (s) return { kind: "state", name: s.properties.name, f: s }; }
    var c = contains(X.worldFeat || [], ll); return c ? { kind: "country", name: cname(c), f: c } : null;
  }
  function setRegion(r, fly) {
    state.region = r; state.ship = null; state.sel = null; state.cluster = null;
    $("#region").setAttribute("d", X.path(r.f) || "");
    X.renderCard();
    if (fly) { var b = d3.geoBounds(r.f); if (b[0][0] > b[1][0] || r.name === "United States") X.go(X.boundsT(r.name === "United States" ? [[-125.5, 24], [-66.5, 49.8]] : [[-180, b[0][1]], [180, b[1][1]]]), 800); else X.go(X.boundsT(b), 800); } else X.draw();
  }
  X.clear = function () { state.ship = null; state.region = null; var r = $("#region"); if (r) r.setAttribute("d", ""); };
  var ST_ADDS = ["State GDP and growth", "Jobs and unemployment", "Population and income", "Energy output and prices", "Crops and livestock", "Federal awards by county", "Ports and trade", "Building permits", "Power grid load", "Storms and disasters", "Every listed company, not only the S&P 500"];
  var CO_ADDS = ["GDP, inflation and rates", "Trade by product and partner", "Companies on its own exchanges", "Central bank decisions", "Government contract awards", "Ports and shipping", "Energy output", "Sanctions and export controls", "News events pinned to places"];
  function minis(a) { return '<div class="minis">' + a.map(function (x) { return "<div><b class=\"num\">" + x[0] + "</b><span>" + x[1] + "</span></div>"; }).join("") + "</div>"; }
  function adds(a) { return '<div class="sec"><h3 class="kick">This panel adds at launch</h3><div class="chips">' + a.map(function (x) { return '<span class="chip" style="border-style:dashed">' + x + "</span>"; }).join("") + '</div><p class="src">Each item maps to an API in the record on the Sources tab.</p></div>'; }
  function ptsHTML(pts, empty) { return '<div class="sec"><h3 class="kick">Data points here</h3>' + (pts.length ? pts.sort(function (a, b) { return (b.hot ? 1 : 0) - (a.hot ? 1 : 0); }).map(function (p) { return X.pointRow(p.id); }).join("") : '<p class="note">' + empty + "</p>") + "</div>"; }
  function awardSum(pts) { var u = 0; pts.forEach(function (p) { if (p.hot && p.usd) u += p.usd; }); return u ? (u >= 1000 ? "$" + (u / 1000).toFixed(1) + "B" : "$" + Math.round(u) + "M") : "$0"; }
  function stateHTML(r) {
    var ab = X.POSTAL[r.name], list = coState[ab] || [], pts = P.filter(function (p) { return p.stName === r.name; }), live = pts.filter(function (p) { return p.hot; }).length;
    return '<div class="card"><div class="card-top"><span class="kick">State</span><span class="when">' + ab + "</span></div><h2>" + esc(r.name) + "</h2>" +
      minis([[coReady ? list.length : "...", "S&amp;P 500 companies based here"], [live, "live data points"], [awardSum(pts), "in awards on the map"]]) +
      ptsHTML(pts, "No data points in " + esc(r.name) + " yet. They appear as feeds connect.") +
      '<div class="sec"><h3 class="kick">Listed companies based here</h3>' + (list.length ? sectorBars(list, "#49D7FF") + '<div style="height:8px"></div>' + coList(list, 8) : '<p class="note">' + (coReady ? "No S&amp;P 500 company is based here. Smaller listed companies arrive with the SEC feed." : "Loading the company list.") + "</p>") +
      '<p class="src">S&amp;P 500 members only for now, from a public list. The SEC feed adds every listed company in the state.</p></div>' + adds(ST_ADDS) + "</div>";
  }
  function countryHTML(r) {
    var us = r.name === "United States", list = coCountry[r.name] || [], pts = P.filter(function (p) { return p.country === r.name; }), live = pts.filter(function (p) { return p.hot; }).length;
    return '<div class="card"><div class="card-top"><span class="kick">Country</span></div><h2>' + esc(r.name) + "</h2>" +
      minis([[coReady ? fmt(list.length) : "...", us ? "companies on US exchanges" : "companies listed in the US"], [live, "live data points"], [pts.length - live, "points planned"]]) +
      (us ? '<p class="note">Zoom in and select a state for its companies and data points.</p>' : "") +
      ptsHTML(pts, "No data points in " + esc(r.name) + " yet. They appear as feeds connect.") +
      '<div class="sec"><h3 class="kick">' + (us ? "Largest listed companies" : "Companies from here listed in the US") + "</h3>" + (list.length ? sectorBars(list, "#49D7FF") + '<div style="height:8px"></div>' + coList(list, 8) : '<p class="note">' + (coReady ? "None on US exchanges. Companies on its own exchanges arrive with the listings feed." : "Loading the company list.") + "</p>") +
      '<p class="src">US exchange listings only, from a public list snapshot. Country labels come from that list and some are out of date.</p></div>' + adds(CO_ADDS) + "</div>";
  }

  /* ================= ships ================= */
  var cv = $("#shipc"), ctx = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
  var fleet = [], mode = "sim", liveInfo = null, liveNote = "", SIMX = 60, T0 = Date.now(), lanes = [];
  var COL = { Tanker: "#FF6FB6", Cargo: "#49D7FF" }, GREY = "#8F8BA3";
  var ENDS = [["the Persian Gulf", "Tokyo Bay"], ["the Gulf of Oman", "Rotterdam"], ["the Gulf of Oman", "Northwest Europe"], ["the mid-Atlantic", "Houston"], ["Novorossiysk", "the Mediterranean"], ["Houston", "the Pacific"], ["the Pacific", "Tokyo Bay"], ["the Florida Straits", "the English Channel"], ["Shanghai", "the North Pacific"], ["the North Pacific", "Los Angeles"]];
  function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function bearing(a, b) { var r = Math.PI / 180, y = Math.sin((b[0] - a[0]) * r) * Math.cos(b[1] * r), x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos((b[0] - a[0]) * r); return (Math.atan2(y, x) / r + 360) % 360; }
  function pad3(n) { return ("00" + n).slice(-3); }
  function buildSim() {
    var r = rng(11), out = [], n = 0;
    lanes = K.lanes.map(function (ln, i) { var seg = [], tot = 0; for (var j = 0; j < ln.length - 1; j++) { var nm = d3.geoDistance(ln[j], ln[j + 1]) * 3440.07; seg.push({ a: ln[j], b: ln[j + 1], nm: nm, at: tot, brg: bearing(ln[j], ln[j + 1]) }); tot += nm; } return { seg: seg, nm: tot, ends: ENDS[i] || ["port", "port"], oil: i < 5 }; });
    lanes.forEach(function (L, li) {
      var c = Math.max(6, Math.round(L.nm / 150));
      for (var i = 0; i < c; i++) {
        var tanker = r() < (L.oil ? .72 : .18); n++;
        out.push({ id: "sim-" + n, sim: true, name: "SIM " + (tanker ? "TANKER " : "CARGO ") + pad3(n), type: tanker ? "Tanker" : "Cargo", lane: li, d0: r() * 2 * L.nm, off: (r() + r() - 1) * .32, sog: tanker ? 10.5 + r() * 4 : 14 + r() * 6, draught: tanker ? 8 + r() * 13 : 9 + r() * 6, len: Math.round(tanker ? 180 + r() * 153 : 200 + r() * 200), beam: Math.round(tanker ? 32 + r() * 28 : 32 + r() * 29), nav: 0 });
      }
    });
    for (var i = 0; i < 28; i++) { n++; out.push({ id: "sim-" + n, sim: true, name: "SIM TANKER " + pad3(n), type: "Tanker", lon: 56.52 + (r() + r() - 1) * .26, lat: 25.22 + (r() + r() - 1) * .3, sog: 0, cog: Math.round(r() * 359), draught: 8 + r() * 13, len: Math.round(180 + r() * 153), beam: Math.round(32 + r() * 28), nav: 1, dest: "Fujairah anchorage", stillH: Math.round(6 + r() * 400) }); }
    out.push({ id: "albateen", real: true, name: "AL BATEEN", type: "Tanker", sub: "LR2 tanker", lon: 56.42, lat: 25.2, sog: 0, cog: 0, draught: 9.3, nav: 1, dest: "Khor Fakkan", quiet: true });
    return out;
  }
  function simPos(s, now) {
    if (s.lane === undefined) return;
    var L = lanes[s.lane], h = (now - T0) / 3.6e6 * (X.reduce ? 0 : SIMX), ph = (s.d0 + s.sog * h) % (2 * L.nm), fwd = ph <= L.nm, d = fwd ? ph : 2 * L.nm - ph, g = L.seg[L.seg.length - 1];
    for (var i = 0; i < L.seg.length; i++) if (d <= L.seg[i].at + L.seg[i].nm) { g = L.seg[i]; break; }
    var f = Math.min(1, (d - g.at) / g.nm), lat = g.a[1] + (g.b[1] - g.a[1]) * f, th = g.brg * Math.PI / 180;
    s.lat = lat - s.off * Math.sin(th); s.lon = g.a[0] + (g.b[0] - g.a[0]) * f + s.off * Math.cos(th) / Math.max(.3, Math.cos(lat * Math.PI / 180));
    s.cog = fwd ? g.brg : (g.brg + 180) % 360; s.dest = L.ends[fwd ? 1 : 0];
  }
  function isQuiet(s, now) { return s.quiet || (!s.sim && s.ts && now - s.ts > 6 * 3.6e6); }
  function drawShips() {
    var t = state.t, d = X.dims(); if (!t || !d.W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, d.W, d.H);
    var st = $("#shipstat");
    if (!state.ships || state.view !== "map") { if (st) st.hidden = true; return; }
    var rel = t.k / d.k0, now = Date.now(), n = 0, sz = rel < 6 ? 3.4 : rel < 16 ? 4.8 : 6.2, names = [];
    for (var i = 0; i < fleet.length; i++) {
      var s = fleet[i]; if (s.sim) simPos(s, now);
      if (X.shipPass && !X.shipPass(s)) { s.vis = false; continue; }
      var b = proj([s.lon, s.lat]), x = b[0] * t.k + t.x, y = b[1] * t.k + t.y;
      s.sx = x; s.sy = y; s.vis = x > -8 && x < d.W + 8 && y > -8 && y < d.H + 8; if (!s.vis) continue; n++;
      var c = COL[s.type] || GREY, sel = state.ship && state.ship.id === s.id;
      ctx.fillStyle = c; ctx.strokeStyle = c; ctx.globalAlpha = s.type === "Tanker" || s.type === "Cargo" ? .95 : .6;
      if (rel < 2.2 && !sel) { ctx.fillRect(x - 1.1, y - 1.1, 2.2, 2.2); }
      else if (s.sog < .5) { ctx.beginPath(); ctx.arc(x, y, sz * .55, 0, 6.2832); ctx.globalAlpha = .35; ctx.fill(); ctx.globalAlpha = .95; ctx.lineWidth = 1.2; ctx.stroke(); }
      else { var a = ((s.hdg != null && s.hdg < 360 ? s.hdg : s.cog) || 0) * Math.PI / 180; ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, -sz * 1.25); ctx.lineTo(sz * .7, sz * .85); ctx.lineTo(0, sz * .45); ctx.lineTo(-sz * .7, sz * .85); ctx.closePath(); ctx.fill(); ctx.restore(); }
      ctx.globalAlpha = 1;
      if (isQuiet(s, now) && rel >= 2.2) { ctx.strokeStyle = "#E8C77F"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(x, y, sz + 3.5, 0, 6.2832); ctx.stroke(); }
      if (sel) { ctx.strokeStyle = "#E4E2EC"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, sz + 6, 0, 6.2832); ctx.stroke(); names.unshift(s); }
      else if (rel >= 14 && names.length < 36) names.push(s);
    }
    ctx.font = "500 11px 'JetBrains Mono', monospace"; ctx.lineJoin = "round";
    names.forEach(function (s) { ctx.lineWidth = 3.2; ctx.strokeStyle = "#08070B"; ctx.strokeText(s.name, s.sx + sz + 9, s.sy + 4); ctx.fillStyle = "#E4E2EC"; ctx.fillText(s.name, s.sx + sz + 9, s.sy + 4); });
    if (st) { st.hidden = false; st.innerHTML = mode === "live" ? '<b style="--c:#35E08F">Ships live</b> · ' + fmt(n) + " in view" + (liveInfo ? " of " + fmt(liveInfo.total) + " tracked · updated " + ago(liveInfo.at) : "") : "<b>Ships simulated</b> at " + SIMX + "x speed · " + n + " in view · " + (liveNote || "live feed needs its key"); }
  }
  function shipAt(x, y) { var best = null, bd = 100; for (var i = 0; i < fleet.length; i++) { var s = fleet[i]; if (!s.vis) continue; var dd = (s.sx - x) * (s.sx - x) + (s.sy - y) * (s.sy - y); if (dd < bd) { bd = dd; best = s; } } return best; }
  function ago(ms) { var s = Math.max(0, (Date.now() - ms) / 1000); return s < 90 ? Math.round(s) + " seconds ago" : s < 5400 ? Math.round(s / 60) + " minutes ago" : s < 172800 ? Math.round(s / 3600) + " hours ago" : Math.round(s / 86400) + " days ago"; }
  function span(h) { return h < 48 ? Math.round(h) + " hours" : Math.round(h / 24) + " days"; }
  function setShip(s) { state.ship = s; state.region = null; state.sel = null; state.cluster = null; $("#region").setAttribute("d", ""); X.renderCard(); X.draw(); }
  var NAV = { 0: "Under way", 1: "At anchor", 2: "Not under command", 3: "Restricted in movement", 4: "Held by her draught", 5: "Moored", 6: "Aground", 7: "Fishing", 8: "Under sail" };
  var OIL_TIES = [["BZ", "~", "Brent is priced off seaborne supply."], ["CL", "~", "US crude moves with Brent."], ["FRO", "~", "Crude tanker owner. Waiting ships tighten the fleet and lift day rates."], ["DHT", "~", "Crude tanker owner. Same effect."], ["INSW", "~", "Tanker owner. Same effect."], ["STNG", "~", "Product tanker owner. Same effect."]];
  var BOX_TIES = [["ZIM", "~", "Ocean carrier. One ship says little. The count per day is the signal."], ["MATX", "~", "Ocean carrier. Same."], ["EXPD", "~", "Freight forwarder. Books the space on ships like this one."], ["UNP", "~", "Railroad. Carries the boxes inland once they land."]];
  function shipHTML(s) {
    var now = Date.now(), layer = s.type === "Tanker" ? "energy" : "goods", quiet = isQuiet(s, now), still = s.sog < .5, stat = quiet ? "Silent" : still ? (NAV[s.nav] && s.nav !== 0 ? NAV[s.nav] : "Stopped") : (NAV[s.nav] || "Under way");
    var stillH = s.stillH || (s.still ? (now - s.still) / 3.6e6 : 0);
    var h = '<div class="card"><div class="card-top"><span class="lyrchip" style="--c:' + (COL[s.type] || GREY) + '">' + X.glyph(layer, true) + esc(s.sub || s.type) + '</span><span class="soonchip"' + (s.sim ? "" : ' style="border-style:solid;color:var(--green);border-color:var(--green)"') + ">" + (s.sim ? "Simulated" : s.real ? "From the reference post" : "Live") + "</span>" + (X.star ? X.star("ships", s.id) : "") + '<span class="when">' + (s.sim ? "" : s.real ? "Nov 4th" : ago(s.ts)) + "</span></div><h2>" + esc(s.name || "Unnamed ship") + "</h2>";
    if (s.sim) h += '<p class="simnote">Simulated ship. Every value on this card is generated to show the layout. Real ships replace these when the ship feed has its key.</p>';
    var what = s.real ? X.byId.albateen.what : (s.sub || s.type) + (s.len ? ", " + s.len + " m long" : "") + ". " + (still ? stat + (stillH ? " for " + span(stillH) : "") : stat + " at " + s.sog.toFixed(1) + " knots on course " + Math.round(s.cog) + "°") + (s.dest ? ", " + (still ? "listed for " : "bound for ") + esc(s.dest) : "") + "." + (s.draught ? " Draught " + s.draught.toFixed(1) + " m." : "");
    var spec = [["Status", stat], ["Speed", s.sog.toFixed(1) + " knots"], ["Course", still ? null : Math.round(s.cog) + "°"], ["Draught", s.draught ? s.draught.toFixed(2) + " m" + (s.real ? " of 15.37 m" : "") : null], ["Destination", s.dest], ["Arrival", s.eta], ["Size", s.real ? "114,637 tonnes deadweight" : s.len ? s.len + " m by " + s.beam + " m" : null], ["Flag", s.flag], ["MMSI", s.sim || s.real ? null : s.id], ["IMO", s.imo], ["Call sign", s.callsign], ["Position", Math.abs(s.lat).toFixed(3) + "°" + (s.lat >= 0 ? "N" : "S") + " " + Math.abs(s.lon).toFixed(3) + "°" + (s.lon >= 0 ? "E" : "W")], ["Last signal", s.real ? "Nov 4th, 21:31 UTC" : s.sim ? null : ago(s.ts)]].filter(function (x) { return x[1]; });
    h += '<div class="sec"><h3 class="kick">What we see</h3><p>' + (s.real ? esc(what) : what) + '</p><dl class="spec" style="margin-top:12px">' + spec.map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + esc(x[1]) + "</dd>"; }).join("") + '</dl><p class="src">' + (s.sim ? "Simulated" : s.real ? "Ship positions · sample from the reference post" : "aisstream.io ship position feed") + "</p></div>";
    if (!X.paid()) return h + X.lockHTML() + "</div>";
    var tk = s.type === "Tanker", read, checks;
    if (s.real) { var p = X.byId.albateen; read = X.readBox(p.readLabel, p.tone, p.weight, p.horizon, p.read); checks = p.checks; }
    else if (quiet) { read = X.readBox("Flagged: silent", "open", "Medium", "Days", "No position report for more than six hours. Ships go quiet for ordinary reasons, such as sailing out of range of shore stations. A ship that stays quiet near a loading port is worth a second look."); checks = ["Does it reappear, and where?", "Count the other ships nearby that went quiet in the same window.", "Check its name against the sanctions lists."]; }
    else if (still) { read = X.readBox(tk ? "Waiting" : "In port or waiting", "open", "Low", "Days", tk ? "A tanker that waits is one of two things: a cargo not yet delivered, or an empty ship queuing to load. The draught tells them apart once it is set against the ship's design draught." : "A cargo ship that waits outside a port means the port is backed up. One ship is ordinary. A growing line is a signal for the port and the retailers behind it."); checks = [tk ? "Compare the draught with the ship's design draught. That needs a ship registry, which is on the API record." : "Count the ships waiting at the same port against the usual.", "How long has it been stopped? Days are normal, weeks are not.", "Watch for neighbours showing the same pattern."]; }
    else { read = X.readBox("Routine", "flat", "Low", "Days", "Under way toward " + (s.dest || "its next port") + ". One ship moving is ordinary traffic. The signal is in the count: how many " + (tk ? "tankers" : "cargo ships") + " pass a chokepoint each day against the usual."); checks = ["A change of destination mid-voyage is worth noting.", "A sharp drop in speed away from port can mean orders changed.", "The count through the nearest chokepoint matters more than this one ship."]; }
    h += '<div class="sec"><h3 class="kick">The read</h3>' + read + '</div><div class="sec"><h3 class="kick">How to check it</h3>' + X.checksHTML(checks) + "</div>";
    var nr = P.map(function (p) { return [p, d3.geoDistance(p.ll, [s.lon, s.lat]) * 6371]; }).filter(function (x) { return x[1] < 900 && x[0].id !== "albateen"; }).sort(function (a, b) { return a[1] - b[1]; }).slice(0, 3);
    if (s.real) h += '<div class="sec"><h3 class="kick">Its data point</h3>' + X.pointRow("albateen") + "</div>";
    if (nr.length) h += '<div class="sec"><h3 class="kick">Nearest data points</h3>' + nr.map(function (x) { return X.pointRow(x[0].id, "About " + fmt(Math.round(x[1] / 10) * 10) + " km away"); }).join("") + "</div>";
    return h + '<div class="sec"><h3 class="kick">Tied to</h3>' + X.tiesHTML(tk ? OIL_TIES : BOX_TIES) + "</div></div>";
  }

  /* live feed from the server, simulation when there is none */
  function bbox() {
    var d = X.dims(), t = state.t; if (!t || !d.W) return null;
    // Longitude is linear in map x (the base map is 1000 units wide), which avoids wrap-around at the date line.
    var w = Math.max(-180, Math.min(180, t.invertX(0) / 1000 * 360 - 180)), e = Math.max(-180, Math.min(180, t.invertX(d.W) / 1000 * 360 - 180));
    var s0 = proj.invert([500, t.invertY(d.H)])[1], n = proj.invert([500, t.invertY(0)])[1];
    return [w, Math.max(-85, s0), e, Math.min(85, n)].map(function (v) { return v.toFixed(3); }).join(",");
  }
  var polling = false, pollT = null, serverSeen = false;
  function poll() {
    var bb = bbox(); if (!bb || polling || document.hidden) return; polling = true;
    fetch("/api/ships?limit=1800&bbox=" + bb).then(function (r) { if (!r.ok) throw new Error("none"); return r.json(); }).then(function (j) {
      polling = false; serverSeen = true;
      if (!j.live) { liveNote = j.reason || ""; if (mode === "live") { mode = "sim"; fleet = buildSim(); X.renderLayers(); } return; }
      var first = mode !== "live"; mode = "live"; liveInfo = { total: j.total, at: j.at || Date.now() };
      fleet = j.ships; if (state.ship) { var cur = fleet.filter(function (s) { return s.id === state.ship.id; })[0]; if (cur) { state.ship = cur; X.renderCard(); } }
      if (first) X.renderLayers(); drawShips();
    }).catch(function () { polling = false; });
  }
  function schedule() { clearTimeout(pollT); pollT = setTimeout(poll, 500); }

  X.onFit.push(function (W, H) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); });
  X.onDraw.push(function () { drawShips(); if (mode === "live") schedule(); });
  X.panel = function () { return state.ship ? shipHTML(state.ship) : state.region ? (state.region.kind === "state" ? stateHTML(state.region) : countryHTML(state.region)) : ""; };
  X.layerRows = function () {
    return '<button type="button" class="lyr-row" style="--c:#E4E2EC" data-x="ships" aria-pressed="' + state.ships + '"><span class="sw"></span><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style="flex:none"><path d="M9 2.5 L13 14 L9 12 L5 14 Z" fill="#E4E2EC"/></svg><span class="nm">Ships</span><span class="ct">' + (mode === "live" ? "live" : "simulated") + "<br>" + fmt(fleet.length) + " loaded</span></button>";
  };
  X.act = function (x) {
    if (x === "ships") { state.ships = !state.ships; if (!state.ships && state.ship) { state.ship = null; X.renderCard(); } X.renderLayers(); X.draw(); return; }
    var k = x.slice(0, 3), v = x.slice(3), f = null;
    if (k === "st:") f = (X.stateFeat || []).filter(function (s) { return X.POSTAL[s.properties.name] === v; })[0];
    else if (k === "co:") f = (X.worldFeat || []).filter(function (c) { return cname(c) === v; })[0];
    if (!f) return;
    X.show("map", true); setRegion({ kind: k === "st:" ? "state" : "country", name: k === "st:" ? f.properties.name : cname(f), f: f }, true);
  };
  var mapEl = $("#map"), tip = $("#shiptip");
  function local(e) { var r = mapEl.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  mapEl.addEventListener("click", function (e) {
    if (e.target.closest("g.mk") || !state.t) return;
    var m = local(e), s = state.ships ? shipAt(m[0], m[1]) : null; if (s) return setShip(s);
    var r = regionAt(proj.invert(state.t.invert(m)), state.t.k / X.dims().k0); if (r) setRegion(r, false);
  });
  mapEl.addEventListener("mousemove", function (e) {
    if (e.target.closest("g.mk")) { tip.hidden = true; return; }
    var m = local(e), s = state.ships ? shipAt(m[0], m[1]) : null; tip.hidden = !s; mapEl.style.cursor = s ? "pointer" : "";
    if (s) { tip.textContent = (s.name || "Unnamed ship") + " · " + (s.sub || s.type) + (s.sog >= .5 ? " · " + s.sog.toFixed(1) + " kn" : " · stopped"); tip.style.left = Math.min(m[0] + 14, X.dims().W - 230) + "px"; tip.style.top = (m[1] + 14) + "px"; }
  });
  mapEl.addEventListener("mouseleave", function () { tip.hidden = true; });
  setInterval(function () { if (mode === "sim" && state.ships && state.view === "map" && !document.hidden && !X.reduce) drawShips(); }, 120);
  setInterval(function () { if (mode === "live" || serverSeen) poll(); }, 12000);

  /* ================= API record ================= */
  var APIS = [], keySet = null;
  var KEYL = { none: ["No key", "none"], free: ["Free key", "free"], pick: ["Decision", "pick"] }, STL = { wired: "Built, waiting for its key", planned: "To build", decision: "Decision needed" };
  X.sourcesExtra = function () {
    if (!APIS.length) return "";
    var n = { none: 0, free: 0, pick: 0 }; APIS.forEach(function (a) { n[a.key]++; });
    return '<h2 style="margin-top:40px">API record</h2><p class="lede">Every outside service the terminal and the site need, with the name of the setting each key or link goes into. Keys are added on the server in one pass. None are stored in this page.</p>' +
      X.kpisHTML([["Need no key", String(n.none), "Public data. These can be built now."], ["Need a free key", String(n.free), "A sign-up each. No cost."], ["Need a decision", String(n.pick), "Paid, or a vendor to pick."], ["Checked with the provider", String(APIS.filter(function (a) { return a.checked; }).length), "The rest are confirmed as each feed is built."]]) +
      '<div class="blk" style="padding:4px 10px;margin-top:18px"><div class="scroller"><table class="tbl"><thead><tr><th>Service</th><th>What it feeds</th><th>Key</th><th>Setting name</th><th>Status</th><th>Checked</th><th>Notes</th></tr></thead><tbody>' + APIS.map(function (a) {
        var set = keySet && keySet[a.id];
        return '<tr><td><b style="font-weight:500">' + esc(a.name) + '</b><div class="sm">' + esc(a.layer) + '</div></td><td class="sm">' + esc(a.feeds) + '</td><td><span class="keyst ' + (set ? "set" : KEYL[a.key][1]) + '">' + (set ? "Key added" : KEYL[a.key][0]) + '</span></td><td class="mn" style="font-size:11.5px">' + esc(a.env || "") + '</td><td class="sm">' + (set && a.status === "wired" && a.key !== "none" ? "Live" : a.status === "wired" && a.key === "none" ? "Built, not yet run on the server" : STL[a.status]) + '</td><td class="sm" style="white-space:nowrap">' + esc(a.checked || "") + '</td><td class="sm">' + esc(a.note) + "</td></tr>";
      }).join("") + "</tbody></table></div></div>";
  };

  /* ================= boot ================= */
  function refresh() { X.renderLayers(); X.renderCard(); if (state.view === "tickers") X.renderTicker(); if (state.view === "sources") X.renderSources(); X.draw(); }
  var lg = $("#legend"); if (lg && lg.lastElementChild) lg.lastElementChild.lastChild.textContent = "Ships. Select one for details.";
  fleet = buildSim();
  var d0 = X.dims(); if (d0.W) { cv.width = Math.round(d0.W * dpr); cv.height = Math.round(d0.H * dpr); }
  refresh(); poll();
  fetch("companies.json").then(function (r) { return r.json(); }).then(function (d) {
    CO = d.rows.map(function (r) { var o = {}; d.fields.forEach(function (k, i) { o[k] = r[i]; }); return o; });
    CO.forEach(function (c) { coBy[c.s] = c; if (c.st) (coState[c.st] = coState[c.st] || []).push(c); if (c.c) (coCountry[c.c] = coCountry[c.c] || []).push(c); });
    coReady = true; refresh();
  }).catch(function () {});
  fetch("apis.json").then(function (r) { return r.json(); }).then(function (a) { APIS = a; if (state.view === "sources") X.renderSources(); return fetch("/api/apis"); })
    .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.set) { keySet = j.set; if (state.view === "sources") X.renderSources(); } }).catch(function () {});
  X.ships = { fleet: function () { return fleet; }, mode: function () { return mode; }, select: setShip, at: shipAt, region: setRegion };
  X.companies = function () { return CO; }; X.capText = cap; X.refresh = refresh;
})();
