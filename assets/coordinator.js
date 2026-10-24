"use strict";
/* Coordinator console: ward board, cases, priority changes, phone checks, metrics, audit log. */

ui.caseFilter = "open";
ui.consoleView = "table";

HEADER.coordinator = (p) => {
  const cur = (t) => ((p[1] || "") === t || (t === "" && p[1] === "case") ? 'aria-current="page"' : "");
  const pc = db.cases.filter((c) => c.status !== "closed" && c.prio === "PC").length;
  return `<div class="wrap console"><a class="brand" href="#/coordinator">${LOGO}Handover <small>coordinator console</small></a>
      <span class="idchip"><b>${esc(COORD.split(",")[0])}</b><span class="role-note">city disaster cell</span></span></div>
    <div class="wrap console"><nav class="tabs" aria-label="Console sections">
      <a href="#/coordinator" ${cur("")}>Cases</a>
      <a href="#/coordinator/phone" ${cur("phone")}>Phone checks${pc ? `<span class="count">${pc}</span>` : ""}</a>
      <a href="#/coordinator/metrics" ${cur("metrics")}>Metrics</a>
      <a href="#/coordinator/audit" ${cur("audit")}>Audit log</a></nav></div>`;
};

VIEW.coordinator = (p) => {
  const body = p[1] === "phone" ? phoneView() : p[1] === "metrics" ? metricsView() : p[1] === "audit" ? auditView() : casesView(p[1] === "case" ? byId(p[2]) : null);
  return `<div class="wrap console">${body}</div>`;
};

/* ---------------- cases ---------------- */
function needsAttention(c) {
  return c.status !== "closed" && (c.deadline < now() || (c.prio !== "PC" && c.status === "open" && !onlineIn(c.ward).length) || c.flags.length > 0 || !c.reporterVerified);
}
function boardHTML() {
  return `<div class="board" role="group" aria-label="Wards">${Object.entries(WARDS).map(([k, w]) => {
    const open = db.cases.filter((c) => c.ward === k && c.status !== "closed");
    const visits = open.filter((c) => c.prio !== "PC" && c.status === "open");
    const late = open.filter((c) => c.deadline < now()).length;
    const rs = db.responders.filter((r) => r.ward === k), on = rs.filter((r) => r.status !== "offline").length;
    const counts = ["P1", "P2", "P3", "PC"].map((pr) => { const n = open.filter((c) => c.prio === pr).length; return n ? `<span class="pill">${TAG_TEXT[pr]}: ${n}</span>` : ""; }).join("");
    return `<button type="button" class="ward" data-act="ward" data-w="${k}" aria-pressed="${ui.wardFilter === k}">
      <span class="name">${esc(w.name)}</span>
      <span class="small muted">${on} of ${rs.length} responder${rs.length === 1 ? "" : "s"} on shift, ${open.length} open</span>
      <span class="counts">${counts || `<span class="pill ok">No open cases</span>`}</span>
      ${!on && visits.length ? `<span class="alert">No responder for ${visits.length} visit${visits.length > 1 ? "s" : ""}</span>` : late ? `<span class="alert">${late} past window</span>` : ""}
    </button>`;
  }).join("")}</div>`;
}

function casesView(sel) {
  let list = db.cases.slice();
  if (ui.wardFilter) list = list.filter((c) => c.ward === ui.wardFilter);
  if (ui.caseFilter === "open") list = list.filter((c) => c.status !== "closed");
  if (ui.caseFilter === "attention") list = list.filter(needsAttention);
  if (ui.caseFilter === "closed") list = list.filter((c) => c.status === "closed");
  list.sort((a, b) => (a.status === "closed") - (b.status === "closed") || a.deadline - b.deadline);
  const chips = [["open", "Open"], ["attention", "Needs attention"], ["closed", "Closed"], ["all", "All"]].map(([k, t]) =>
    `<button type="button" class="chip" data-act="casefilter" data-f="${k}" aria-pressed="${ui.caseFilter === k}">${t}</button>`).join("");
  const rows = list.map((c) => `<tr class="${sel && sel.id === c.id ? "sel" : ""} ${c.status === "closed" ? "closed" : ""}">
      <td>${c.status === "closed" ? `<span class="tag ${isSafe(c) ? "SAFE" : "MISS"}">${isSafe(c) ? "Safe" : "Miss"}</span>` : tag(c.prio)}</td>
      <td><a href="#/coordinator/case/${c.id}">${depLine(c.dep)}</a><div class="small muted">${c.id}${c.reports > 1 ? `, ${c.reports} reports` : ""}</div></td>
      <td class="hide-sm">${esc(WARDS[c.ward].name.split(",")[0])}</td>
      <td>${left(c)}</td>
      <td>${esc(statusText(c))}${c.flags.length ? ` <span class="pill bad">Flag</span>` : ""}${!c.reporterVerified ? ` <span class="pill warn">Unverified</span>` : ""}</td>
      <td class="hide-sm">${{ web: "Web", sms: "SMS", helpline: "Police" }[c.channel]}</td></tr>`).join("");
  return `
    <h1 class="sr">Cases</h1>
    ${boardHTML()}
    <div class="split ${sel ? "has-detail" : ""}">
      <div class="list-col">
        <div class="filters" role="group" aria-label="Filter cases">${chips}${ui.wardFilter ? `<button class="btn quiet small" data-act="ward" data-w="${ui.wardFilter}">Clear ward filter</button>` : ""}
          <span class="row" style="margin-left:auto;gap:.4rem"><button type="button" class="chip" data-act="consoleview" data-v="table" aria-pressed="${ui.consoleView === "table"}">Table</button><button type="button" class="chip" data-act="consoleview" data-v="map" aria-pressed="${ui.consoleView === "map"}">Map</button>
          <button type="button" class="btn small" data-act="surge">Simulate a surge</button></span></div>
        ${ui.consoleView === "map" ? mapSVG(list.filter((c) => c.status !== "closed"), (c) => `#/coordinator/case/${c.id}`, { selected: sel && sel.id, responders: true }) : `<div class="tablewrap"><table class="cases"><caption class="sr">Cases, most urgent first</caption>
          <thead><tr><th scope="col">Priority</th><th scope="col">Dependent</th><th scope="col" class="hide-sm">Ward</th><th scope="col">Time left</th><th scope="col">Status</th><th scope="col" class="hide-sm">Channel</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6">No cases match this filter.</td></tr>`}</tbody></table></div>`}
        <details class="panel" style="margin-top:1rem"><summary><b>Responders on shift</b> <span class="muted small">(${db.responders.filter((r) => r.status !== "offline").length} available)</span></summary>
          <table class="log" style="margin-top:.6rem"><thead><tr><th>Name</th><th>Organisation</th><th>Ward</th><th>Status</th></tr></thead><tbody>
          ${db.responders.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(ORG[r.org])}</td><td>${esc(WARDS[r.ward].name)}</td><td>${{ online: "Available", busy: "On a case", offline: "Off shift" }[r.status]}</td></tr>`).join("")}
          </tbody></table></details>
      </div>
      ${sel ? `<aside class="detail" aria-label="Case ${sel.id}">${detailHTML(sel)}</aside>` : `<aside class="detail">${feedHTML()}<div class="panel flat wide-only"><h2 style="font-size:1.1rem">Pick a case</h2><p class="muted small" style="margin:0">Select a dependent to see why it has its priority, change the priority with a reason, ask a responder, or see its full history.</p></div></aside>`}
    </div>`;
}

function feedHTML() {
  const ev = db.events.slice(-8).reverse();
  return `<section class="panel" aria-labelledby="h-feed"><div class="row spread"><h2 id="h-feed" style="font-size:1.1rem;margin:0">Live activity</h2><span class="small muted">Newest first</span></div>
    <ul class="feed" style="margin-top:.5rem" aria-live="polite">${ev.map((e) => `<li><span class="t">${fmtTime(e.t)}</span><a href="#/coordinator/case/${e.id}">${e.id}</a> ${esc(e.act)}<div class="small muted">${esc(e.who)}${e.note ? `: ${esc(e.note)}` : ""}</div></li>`).join("")}</ul></section>`;
}

function detailHTML(c) {
  const open = c.status !== "closed", shown = ui.showAddress[c.id];
  const others = PRIO_ORDER.filter((x) => x !== c.prio);
  const avail = db.responders.filter((r) => r.status === "online").sort((a, b) => (b.ward === c.ward) - (a.ward === c.ward) || WARDS[a.ward].km - WARDS[b.ward].km);
  const hist = db.events.filter((e) => e.id === c.id).slice().reverse();
  return `<div class="panel">
    <a class="btn quiet small close-detail" href="#/coordinator">‹ All cases</a>
    <div class="row spread"><span class="row" style="gap:.5rem">${c.status === "closed" ? `<span class="tag ${isSafe(c) ? "SAFE" : "MISS"}">${isSafe(c) ? "Safe" : "Miss"}</span>` : tag(c.prio)}<span class="small muted">${c.id}</span></span>${left(c)}</div>
    <h2 style="margin-top:.6rem">${depLine(c.dep)}</h2>
    <dl class="kv small">
      <dt>Status</dt><dd>${esc(statusText(c))}</dd>
      <dt>Why</dt><dd>${esc(c.reasons.join("; "))}</dd>
      <dt>Rules said</dt><dd>${TAG_TEXT[c.autoPrio]}${c.override ? `, changed to ${TAG_TEXT[c.override.to]}: “${esc(c.override.reason)}”` : ""}</dd>
      <dt>Reported by</dt><dd>${esc(c.reporter)} via ${{ web: "web", sms: "SMS", helpline: "police control room" }[c.channel]}${c.reports > 1 ? `, ${c.reports} reports` : ""}${c.reporterVerified ? "" : ` <span class="pill warn">Phone not verified</span>`}</dd>
      <dt>Area</dt><dd>${esc(WARDS[c.ward].name)}</dd>
      <dt>Address</dt><dd>${shown ? `<b>${esc(c.address)}</b> <span class="small muted">(your view was logged)</span>` : `<button type="button" class="btn small" data-act="show-address" data-id="${c.id}">Show address</button> <span class="small muted">Logged</span>`}</dd>
      <dt>Stand-in</dt><dd>${c.standIn ? `${esc(c.standIn.name)}${c.standIn.relation ? `, ${esc(c.standIn.relation)}` : ""}` : "None named"}</dd>
      <dt>Responder</dt><dd>${c.responder ? `${esc(responder(c.responder).name)}${c.partner ? ` with ${esc(responder(c.partner).name)}` : ""}` : c.offeredTo ? `Asked ${esc(responder(c.offeredTo).name)}` : "None yet"}</dd>
      ${c.flags.length ? `<dt>Flags</dt><dd class="stack">${c.flags.map((f, i) => `<div class="row"><span class="pill bad">${esc(f)}</span>${/new handover/.test(f) ? "" : `<button type="button" class="btn quiet small" data-act="resolve-flag" data-id="${c.id}" data-i="${i}">Mark as handled</button>`}</div>`).join("")}</dd>` : ""}
    </dl>
    <p style="margin:.75rem 0 0"><a class="small" href="#/track/${c.id}">See what the family sees</a></p>
  </div>
  ${open ? `<form class="panel" id="override" data-id="${c.id}" novalidate>
      <h3>Change the priority</h3>
      <p class="hint">Use this when you know something the rules don’t. The family is told, and the reason is kept in the log.</p>
      ${radios("newprio", others.map((x) => [x, x === "PC" ? "Phone check first" : `${x}: ${PRIO_LABEL[x].toLowerCase()}`]), ui.check.newprio, { cols: true, legend: "New priority" })}
      ${field("reason", "Reason", `<textarea id="reason" data-check="reason" ${invalid("reason")}>${esc(ui.check.reason || "")}</textarea>`)}
      <button class="btn" type="submit">Change priority</button></form>` : ""}
  ${open && c.prio !== "PC" && c.status === "open" ? `<form class="panel" id="offer" data-id="${c.id}" novalidate>
      <h3>Ask a responder</h3>
      ${!onlineIn(c.ward).length ? note("bad", `Nobody is available in ${esc(WARDS[c.ward].name)}. Ask someone from a nearby ward.`) : ""}
      ${field("rid", "Responder", select("rid", "", avail.map((r) => [r.id, `${r.name}, ${WARDS[r.ward].name}`]), ""))}
      <button class="btn" type="submit">Ask to take it</button></form>` : ""}
  ${!open && c.flags.some((f) => /new handover/.test(f)) ? `<div class="panel"><h3>The carer can’t continue</h3>
      <p class="small">${esc(c.handedTo || "The stand-in")} replied to the 72-hour check-in that they can’t keep caring for ${esc(c.dep.name)}. Start a new handover: the case reopens with a fresh deadline and the family is told.</p>
      <p class="small muted">Re-handover is planned for after day one in the written case. Shown here as a preview.</p>
      <button type="button" class="btn primary" data-act="rehandover" data-id="${c.id}">Start a new handover</button></div>` : ""}
  ${c.prio === "PC" && open ? `<div class="panel"><h3>Phone check</h3><p class="small">This case needs a call to confirm the adult with ${esc(c.dep.name)}.</p><a class="btn small" href="#/coordinator/phone">Go to phone checks</a></div>` : ""}
  <div class="panel"><h3>History</h3><ol class="tl small">${hist.map((e) => `<li class="done"><span class="dot" aria-hidden="true"></span><b>${esc(e.act)}</b>${e.note ? `: ${esc(e.note)}` : ""}<div class="t">${fmtTime(e.t)}, ${esc(e.who)}</div></li>`).join("")}</ol></div>`;
}
const PRIO_ORDER = ["P1", "P2", "P3", "PC"];

SUBMIT.override = (f) => {
  const c = byId(f.dataset.id);
  ui.check.reason = $("#reason").value;
  ui.errors = {};
  if (!ui.check.newprio) ui.errors.newprio = "Choose the new priority.";
  if (ui.check.reason.trim().length < 8) ui.errors.reason = "Give a reason the family and the audit can understand.";
  if (Object.keys(ui.errors).length) { render(false); ($("[aria-invalid='true']") || $("fieldset[aria-describedby] input")).focus(); return; }
  const to = ui.check.newprio;
  overridePrio(c, to, ui.check.reason.trim());
  ui.check = {}; render(false); toast(`Priority changed to ${TAG_TEXT[to]}. The family has been told.`);
};

SUBMIT.offer = (f) => {
  const c = byId(f.dataset.id), rid = $("#rid").value;
  if (!rid) { ui.errors = { rid: "Choose a responder." }; render(false); $("#rid").focus(); return; }
  ui.errors = {}; offer(c, rid); render(false);
  toast(`${responder(rid).name} has been asked to take ${c.dep.name}’s case.`);
};

/* ---------------- phone checks ---------------- */
function phoneView() {
  const list = db.cases.filter((c) => c.status !== "closed" && c.prio === "PC").sort((a, b) => a.deadline - b.deadline);
  const done = db.events.filter((e) => /^Phone check/.test(e.act)).slice().reverse();
  return `<h1>Phone checks</h1>
    <p class="muted" style="max-width:70ch">When an adult is reported to be with the dependent, or there’s no urgent need, we phone before sending anyone. If you can’t confirm a named adult, the case becomes a visit.</p>
    ${list.length ? list.map((c) => c.id !== (list.find((x) => x.id === ui.pcActive) || list[0]).id
      ? `<div class="panel tight row spread"><span class="row" style="gap:.5rem">${tag("PC")}<b>${depLine(c.dep)}</b><span class="small muted">${c.id}, ${esc(WARDS[c.ward].name)}</span></span><span class="row">${left(c)}<button type="button" class="btn small" data-act="pc-pick" data-id="${c.id}">Take this call</button></span></div>`
      : `<form class="panel" id="phonecheck" data-id="${c.id}" novalidate>
      <div class="row spread"><span class="row" style="gap:.5rem">${tag("PC")}<b>${depLine(c.dep)}</b><span class="small muted">${c.id}, ${esc(WARDS[c.ward].name)}</span></span>${left(c)}</div>
      <p class="small" style="margin:.5rem 0">${esc(c.reasons.join("; "))}. Reported by ${esc(c.reporter)}.</p>
      <div class="row" style="margin-bottom:.75rem"><button type="button" class="btn small" data-act="relay">Call through the relay</button><span class="small muted">Care card: ${esc(c.care.routine || "no notes")}</span></div>
      ${radios("pcresult", [["confirmed", "An adult is there and taking over care"], ["failed", "Couldn’t confirm an adult: send a visit"]], ui.check.pcresult, { legend: "Result of the call" })}
      ${ui.check.pcresult === "confirmed" ? field("pcname", "Name and relationship of the adult", `<input type="text" id="pcname" data-check="pcname" value="${esc(ui.check.pcname || "")}" autocomplete="off" ${invalid("pcname")}>`) : ""}
      <button class="btn primary" type="submit">Record result</button></form>`).join("")
      : `<div class="panel"><h2 style="font-size:1.1rem">No phone checks waiting</h2><p class="muted" style="margin:0">New ones appear here when a report says an adult is with the dependent.</p></div>`}
    ${done.length ? `<div class="panel"><h2 style="font-size:1.1rem">Done today</h2><ul>${done.map((e) => `<li>${fmtTime(e.t)}: ${esc(e.id)}, ${esc(e.act.replace("Phone check: ", "").replace("Phone check failed: ", "failed, "))}${e.note ? ` (${esc(e.note)})` : ""}</li>`).join("")}</ul></div>` : ""}`;
}

SUBMIT.phonecheck = (f) => {
  const c = byId(f.dataset.id), k = ui.check;
  ui.errors = {};
  if (!k.pcresult) ui.errors.pcresult = "Choose the result of the call.";
  if (k.pcresult === "confirmed" && !(k.pcname || "").trim()) ui.errors.pcname = "Enter who is taking over care.";
  if (Object.keys(ui.errors).length) { render(false); ($("[aria-invalid='true']") || $("fieldset[aria-describedby] input")).focus(); return; }
  phoneCheck(c, k.pcresult, (k.pcname || "").trim());
  toast(k.pcresult === "confirmed" ? `${c.dep.name}: adult confirmed. Case closed as safe.` : `${c.dep.name}: changed to a ${TAG_TEXT[c.prio]} visit.`);
  ui.check = {}; render(false);
};

/* ---------------- metrics ---------------- */
function bar(label, n, d) {
  const pct = d ? Math.round((n / d) * 100) : 0;
  return `<div class="bar"><span>${label}</span><span class="track" role="img" aria-label="${pct}%"><span class="fill" style="width:${pct}%"></span></span><span class="val">${d ? `${pct}% (${n}/${d})` : "none due"}</span></div>`;
}
function metricsView() {
  const m = metric();
  const firstDue = db.cases.filter((c) => c.checkin).map((c) => c.checkin.due).sort((a, b) => a - b)[0];
  return `<h1>Metrics</h1>
    <p class="muted" style="max-width:72ch">How we know Handover is working. Definitions are the same as in the written case. All numbers are fictional and update as you use the demo.</p>
    <div class="metrics">
      <section class="panel metric lead" aria-labelledby="m1">
        <h2 id="m1">Safe-within-window rate</h2>
        <span class="v">${m.pct}%</span>
        <p>${m.safe} of ${m.due} due cases were seen in person and confirmed with a named adult (stand-in, adult present, or hospital or shelter) within their priority window. “Due” means closed, or past its window. Merged duplicates are excluded. “Not found” counts as a miss.</p>
        <div class="two">
          <div><h3>By priority</h3><div class="bars">${PRIO_ORDER.map((p) => bar(TAG_TEXT[p], m.byPrio[p][1], m.byPrio[p][0])).join("")}</div></div>
          <div><h3>By ward</h3><div class="bars">${Object.entries(WARDS).map(([k, w]) => bar(w.name.split(",")[0], m.byWard[k][1], m.byWard[k][0])).join("")}</div></div>
        </div>
        <p class="small muted" style="margin:.75rem 0 0">Pilot hypothesis: at least 70% for P1 in week one. Earlier cases today are included in the totals.</p>
      </section>
      <section class="panel metric"><h2 style="font-size:1.1rem">Detection</h2><span class="v">${m.detection}%</span><p class="small">${m.careAnswered} of ${m.reports} vanished-person reports answered “Did they look after anyone?”. This tests the core idea.</p></section>
      <section class="panel metric"><h2 style="font-size:1.1rem">Speed</h2><span class="v">${m.medianDoor} min</span><p class="small">Median time from report to a responder at the door, across ${m.doorN} visits today.</p></section>
      <section class="panel metric"><h2 style="font-size:1.1rem">Durability</h2><span class="v">${m.checkinReplies ? `${m.checkinOk}/${m.checkinReplies}` : "Day 4"}</span><p class="small">${m.checkinReplies ? "Handovers still in place at the 72-hour check-in." : `Handovers still in place at the 72-hour check-in. The first check-ins fall due ${firstDue ? new Date(firstDue).toLocaleDateString([], { weekday: "long" }) : "in three days"}. Preview one from the stand-in’s phone.`}</p></section>
      <section class="panel metric"><h2 style="font-size:1.1rem">Safety</h2><span class="v">${m.addressUnaccepted}</span><p class="small">Address views without an accepted case. Target: zero. Wrong stand-in codes blocked today: <b>${m.wrongCodes}</b>. Safeguarding incidents reported: <b>0</b>.</p></section>
    </div>
    ${chartHTML()}
    <p class="small muted">Downloads and report counts aren’t on this page on purpose. Dependents in safe hands are what count.</p>`;
}

function chartHTML() {
  const rows = hourly(), max = Math.max(4, ...rows.map((r) => r.reports)), W = 640, H = 220, base = 180, gw = (W - 40) / rows.length;
  const y = (v) => base - (v / max) * 150;
  const bars = rows.map((r, i) => {
    const x = 30 + i * gw;
    return `<rect x="${x + 6}" y="${y(r.reports)}" width="${gw / 2 - 8}" height="${base - y(r.reports)}" fill="#b9cbe8" rx="2"/>
      <rect x="${x + gw / 2}" y="${y(r.safe)}" width="${gw / 2 - 8}" height="${base - y(r.safe)}" fill="#1a4fa3" rx="2"/>
      <text x="${x + 6 + (gw / 2 - 8) / 2}" y="${y(r.reports) - 4}" text-anchor="middle" font-size="11" fill="#4a5866">${r.reports}</text>
      <text x="${x + gw / 2 + (gw / 2 - 8) / 2}" y="${y(r.safe) - 4}" text-anchor="middle" font-size="11" fill="#1a4fa3">${r.safe}</text>
      <text x="${x + gw / 2}" y="${base + 18}" text-anchor="middle" font-size="11" fill="#4a5866">${esc(r.label)}</text>`;
  }).join("");
  return `<section class="panel chart" aria-labelledby="h-chart" style="margin-top:1rem"><h2 id="h-chart" style="font-size:1.1rem">Today, hour by hour</h2>
    <div class="legend small"><span><i class="sq" style="background:#b9cbe8"></i>Reports received</span><span><i class="sq"></i>Handed over in time</span></div>
    <svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><line x1="24" y1="${base}" x2="${W - 6}" y2="${base}" stroke="#b9c3ce"/>${bars}</svg>
    <div class="sr"><table><caption>Reports received and handovers in time, by hour</caption><thead><tr><th>Hour</th><th>Reports</th><th>Handed over in time</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${esc(r.label)}</td><td>${r.reports}</td><td>${r.safe}</td></tr>`).join("")}</tbody></table></div>
    <p class="small muted" style="margin:.4rem 0 0">Earlier hours are fictional history. New reports and handovers you make are added live.</p></section>`;
}

/* ---------------- audit log ---------------- */
function auditView() {
  const closed = db.cases.filter((c) => c.status === "closed" && isSafe(c));
  const sample = closed.filter((_, i) => i % 20 === 0);   // 5% of closed cases, at least one
  const rows = db.events.slice().reverse();
  return `<h1>Audit log</h1>
    <p class="muted" style="max-width:72ch">Every status change and every address view is a timestamped event. Each week coordinators phone 5% of closed cases to confirm the outcome really happened.</p>
    <div class="panel"><h2 style="font-size:1.1rem">This week’s audit calls</h2>
      ${sample.length ? `<ul class="stack" style="list-style:none;padding:0;margin:0">${sample.map((c) => {
        const called = db.events.some((e) => e.id === c.id && e.act === "Audit call made");
        return `<li class="row spread"><span><a href="#/coordinator/case/${c.id}">${c.id}</a>: ${depLine(c.dep)}, handed to ${esc(c.handedTo)}</span>${called ? `<span class="pill ok">Called, outcome confirmed</span>` : `<button class="btn small" data-act="audit-call" data-id="${c.id}">Mark as called</button>`}</li>`; }).join("")}</ul>` : `<p class="muted small" style="margin:0">No closed cases yet.</p>`}</div>
    <div class="panel tight">
      <label class="lbl" for="logq">Filter the log</label>
      <input type="search" id="logq" placeholder="Case number, name or action, for example ‘Address’" value="${esc(ui.logFilter)}" autocomplete="off">
    </div>
    <div class="tablewrap"><table class="log"><caption class="sr">Audit events, newest first</caption>
      <thead><tr><th scope="col">Time</th><th scope="col">Who</th><th scope="col">What</th><th scope="col">Case</th><th scope="col">Detail</th></tr></thead>
      <tbody>${rows.map((e) => `<tr data-text="${esc(`${e.who} ${e.act} ${e.id} ${e.note}`.toLowerCase())}"><td class="num">${fmtTime(e.t)}</td><td>${esc(e.who)}</td><td>${esc(e.act)}</td><td><a href="#/coordinator/case/${e.id}">${e.id}</a></td><td>${esc(e.note)}</td></tr>`).join("")}</tbody></table></div>
    <p class="sr" role="status" id="logcount"></p>`;
}
function filterLog() {
  const q = ui.logFilter.trim().toLowerCase();
  let n = 0;
  $$("table.log tbody tr[data-text]").forEach((tr) => { const hit = !q || tr.dataset.text.includes(q); tr.hidden = !hit; n += hit; });
  const s = $("#logcount"); if (s) s.textContent = `${n} events shown`;
}

Object.assign(ACT, {
  ward(b) { ui.wardFilter = ui.wardFilter === b.dataset.w ? "" : b.dataset.w; render(false); },
  casefilter(b) { ui.caseFilter = b.dataset.f; render(false); $(`[data-act="casefilter"][data-f="${ui.caseFilter}"]`).focus(); },
  "show-address"(b) { const c = byId(b.dataset.id); ui.showAddress[c.id] = true; log(c.id, COORD, "Address viewed", "Ward coordinator"); save(); render(false); },
  consoleview(b) { ui.consoleView = b.dataset.v; render(false); $(`[data-act="consoleview"][data-v="${ui.consoleView}"]`).focus(); },
  surge() {
    const made = surge(5), n = (p) => made.filter((c) => c.prio === p).length;
    render(false);
    toast(`${made.length} new reports arrived: ${["P1", "P2", "P3", "PC"].filter(n).map((p) => `${n(p)} ${TAG_TEXT[p]}`).join(", ")}. Each was triaged by the same rules.`);
  },
  "resolve-flag"(b) { const c = byId(b.dataset.id), f = c.flags.splice(+b.dataset.i, 1)[0]; log(c.id, COORD, "Flag handled", f); save(); render(false); toast("Flag marked as handled."); },
  rehandover(b) { const c = byId(b.dataset.id); rehandover(c); render(false); toast(`New handover started for ${c.dep.name}: ${TAG_TEXT[c.prio]}, visit by ${dueBy(c)}.`); },
  "pc-pick"(b) { ui.pcActive = b.dataset.id; ui.check = {}; ui.errors = {}; render(false); },
  "audit-call"(b) { log(b.dataset.id, COORD, "Audit call made", "Outcome confirmed with the new carer"); save(); render(false); toast("Audit call recorded."); },
});
