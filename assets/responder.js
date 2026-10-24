"use strict";
/* Responder app: queue, case, safeguarding and pairing, the door check, the coded handover. */

ui.responderLoaded = false;
ui.respView = "list";

HEADER.responder = () => {
  const me = responder(ME);
  return `<div class="wrap narrow"><a class="brand" href="#/responder">${LOGO}Handover <small>for responders</small></a>
    <span class="idchip"><b>${esc(me.name)}</b><span class="verified">✓ verified</span></span></div>`;
};

VIEW.responder = (p) => {
  if (!ui.responderLoaded) {
    setTimeout(() => { ui.responderLoaded = true; if (roleOf(parts()) === "responder") render(false); }, 600);
    return `<div class="wrap narrow"><h1>Cases near you</h1><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><p class="sr" role="status">Loading cases</p></div>`;
  }
  const c = p[2] && byId(p[2]);
  if (p[1] === "case" && c) return `<div class="wrap narrow">${caseView(c)}</div>`;
  if (p[1] === "check" && c) return `<div class="wrap narrow">${checkView(c)}</div>`;
  if (p[1] === "done" && c) return `<div class="wrap narrow">${doneView(c)}</div>`;
  return `<div class="wrap narrow">${queueView()}</div>`;
};

/* ---------------- queue ---------------- */
function visible(c) { return c.prio !== "PC" && (c.status === "open" || c.responder === ME); }
function queueView() {
  const me = responder(ME), m = metric();
  const mine = db.cases.filter((c) => c.responder === ME && c.status !== "closed");
  let list = db.cases.filter((c) => visible(c) && c.status === "open");
  if (ui.filter !== "all") list = list.filter((c) => c.prio === ui.filter);
  if (ui.near) list = list.filter((c) => WARDS[c.ward].km <= 2);
  list.sort((a, b) => (b.offeredTo === ME) - (a.offeredTo === ME) || a.deadline - b.deadline);
  const chips = ["all", "P1", "P2", "P3"].map((f) => `<button type="button" class="chip" data-act="filter" data-f="${f}" aria-pressed="${ui.filter === f}">${f === "all" ? "All" : f}</button>`).join("");
  return `
    <p class="small muted" style="margin:0">${esc(ORG[me.org])}, based in ${esc(WARDS[me.ward].name)}</p>
    <h1>Cases near you</h1>
    <section class="panel" aria-labelledby="h-shift">
      <div class="row spread"><h2 id="h-shift" style="font-size:1.05rem;margin:0">Safe-within-window rate, today</h2><span class="small muted">All wards, fictional</span></div>
      <div class="shift" style="margin-top:.6rem">
        <div><span class="v">${m.pct}%</span><span class="k">${m.safe} of ${m.due} due cases handed over in time</span></div>
        <div><span class="v">${list.length}</span><span class="k">open visits shown</span></div>
        <div><span class="v" style="color:${m.late ? "var(--p1)" : "inherit"}">${m.late}</span><span class="k">past their window</span></div>
      </div>
      <p class="muted small" style="margin:.6rem 0 0">“Due” means closed, or past its window. “Not found” counts as a miss.</p>
    </section>
    ${mine.length ? `<h2 style="font-size:1.15rem">Your active cases</h2>${mine.map(queueCard).join("")}` : ""}
    <h2 style="font-size:1.15rem">Open visits</h2>
    <div class="filters" role="group" aria-label="Filter cases">${chips}
      <label class="inline-check"><input type="checkbox" id="near" ${ui.near ? "checked" : ""}> Within 2 km</label>
      <span class="row" style="gap:.4rem"><button type="button" class="chip" data-act="respview" data-v="list" aria-pressed="${ui.respView === "list"}">List</button><button type="button" class="chip" data-act="respview" data-v="map" aria-pressed="${ui.respView === "map"}">Map</button></span></div>
    <p class="sr" role="status">${list.length} case${list.length === 1 ? "" : "s"} shown</p>
    ${ui.respView === "map" ? mapSVG(list, (c) => `#/responder/case/${c.id}`, { me: me.ward }) : list.length ? list.map(queueCard).join("") : `<div class="panel"><h3>No cases match</h3><p class="muted" style="margin:0">${ui.filter === "all" && !ui.near ? "Nothing open near you. Thank you." : "Try another filter. Urgent cases further away may still need someone."}</p></div>`}
    <p class="muted small">Sorted by time left in each case’s window, not by when it was reported. Phone checks are handled by the ward coordinator.</p>`;
}

function queueCard(c) {
  const w = WARDS[c.ward], mine = c.responder === ME, asked = c.offeredTo === ME && c.status === "open";
  return `<article class="panel qcard ${asked ? "asked" : ""}">
    <div>
      <div class="row" style="gap:.5rem">${tag(c.prio)}<span class="who">${depLine(c.dep)}</span>${c.reports > 1 ? `<span class="pill">${c.reports} reports merged</span>` : ""}${mine ? `<span class="pill ok">${c.status === "atdoor" ? "You’re at the door" : "Accepted by you"}</span>` : ""}${asked ? `<span class="pill warn">Coordinator asked you</span>` : ""}</div>
      <div class="small" style="margin-top:.3rem">${esc(c.reasons.join("; "))}</div>
      <div class="meta" style="margin-top:.25rem"><span>${esc(w.name)}</span><span>${w.km} km</span><span>${mine ? esc(c.address) : `<span class="lock"><span aria-hidden="true">🔒</span> Address shown after you accept</span>`}</span></div>
    </div>
    <div class="side">${left(c)}<a class="btn small" href="#/responder/case/${c.id}" aria-label="${mine ? "Continue" : "View"} case ${esc(c.id)}, ${esc(c.dep.name)}">${mine ? "Continue" : "View"}</a></div>
  </article>`;
}

/* ---------------- case ---------------- */
function caseView(c) {
  const w = WARDS[c.ward], mine = c.responder === ME, child = CHILD.includes(c.dep.age);
  if (c.status === "closed") return `<a class="btn quiet" href="#/responder">‹ All cases</a><h1>${depLine(c.dep)}</h1>${note("info", `This case is closed: ${esc(statusText(c))}.`)}`;
  if (c.responder && !mine) return `<a class="btn quiet" href="#/responder">‹ All cases</a><h1>${depLine(c.dep)}</h1>${note("info", `${esc(responder(c.responder).name)} has already taken this case.`)}`;
  const partners = db.responders.filter((r) => r.id !== ME && r.status === "online").sort((a, b) => (b.ward === c.ward) - (a.ward === c.ward));
  return `
    <a class="btn quiet" href="#/responder">‹ All cases</a>
    <h1>${depLine(c.dep)}</h1>
    <div class="panel">
      <div class="row spread"><span class="row" style="gap:.6rem">${tag(c.prio)}<span class="small">${PRIO_LABEL[c.prio]}</span></span>${left(c)}</div>
      <dl class="kv" style="margin-top:.8rem">
        <dt>Why this priority</dt><dd>${esc(c.reasons.join("; "))}${c.override ? ` <span class="pill warn">Changed by coordinator</span>` : ""}</dd>
        <dt>Reported by</dt><dd>${esc(c.reporter)}${c.reports > 1 ? ` (+${c.reports - 1} more)` : ""}${c.reporterVerified ? ` <span class="verified">✓ phone verified</span>` : ` <span class="pill warn">Phone not verified</span>`}</dd>
        <dt>Area</dt><dd>${esc(w.name)}, ${w.km} km away</dd>
        <dt>Address</dt><dd>${mine ? `<b>${esc(c.address)}</b>` : `<span class="lock"><span aria-hidden="true">🔒</span> Shown after you accept</span>`}</dd>
        <dt>Last contact</dt><dd>${esc(CONTACT_TEXT[c.dep.lastContact] || "Unknown")} when reported</dd>
        <dt>Adult with them</dt><dd>${{ no: "No", dontknow: "Don’t know", yes: "Yes" }[c.dep.adultPresent]}</dd>
        <dt>Stand-in</dt><dd>${c.standIn ? `${esc(c.standIn.name)}${c.standIn.relation ? ` (${esc(c.standIn.relation)})` : ""}, has a code` : "None named by the family"}</dd>
        ${c.partner ? `<dt>Going with you</dt><dd>${esc(responder(c.partner).name)}</dd>` : ""}
      </dl>
    </div>
    ${mine ? `
      <div class="panel"><h2 style="font-size:1.15rem">Care card</h2>${careCardHTML(c, false)}</div>
      <div class="row">${c.status === "accepted" ? `<button class="btn primary" data-act="atdoor" data-id="${c.id}">I’m at the door</button>` : `<a class="btn primary" href="#/responder/check/${c.id}">Record the check</a>`}
        <button class="btn" data-act="relay">Call the family</button></div>
      <details class="more panel" style="margin-top:1rem"><summary>I can’t go after all</summary>
        <form id="release" data-id="${c.id}" novalidate>
          <p class="hint">The case goes straight back to the top of the queue for someone else, with the same deadline. The family is told.</p>
          ${radios("relreason", [["Vehicle or road problem", "Vehicle or road problem"], ["Called to another emergency", "Called to another emergency"], ["Unwell or unsafe to continue", "Unwell or unsafe to continue"], ["Something else", "Something else"]], "", { legend: "Why?" })}
          <button class="btn danger" type="submit">Release the case</button></form></details>`
    : `
      ${note("warn", `<b>Before you accept</b><ul style="margin:.4rem 0 0;padding-left:1.1rem">
        ${child ? "<li>Children’s cases: go with a second verified responder or the named stand-in. Never alone.</li>" : ""}
        <li>Don’t force entry. If you hear distress, call 112.</li><li>Only hand over to an adult who passes the code check, or to a hospital or shelter.</li></ul>`)}
      <form class="panel" id="accept" data-id="${c.id}" novalidate>
        ${child ? field("partner", "Who is going with you?", select("partner", "", [...partners.map((r) => [r.id, `${r.name}, ${ORG[r.org]} (${WARDS[r.ward].name})`]), ["standin", c.standIn ? `The stand-in, ${c.standIn.name}, will meet me there` : "The stand-in will meet me there"]], ui.check.partner || ""), "Required for children. They are told when you accept.") : ""}
        <label class="choice"><input type="checkbox" id="agree" ${invalid("agree")}><span>I’ll follow these safeguarding steps</span></label>
        ${errText("agree")}
        <div class="row" style="margin-top:.8rem"><button class="btn primary" type="submit">Accept case</button><a class="btn quiet" href="#/responder">Not now</a></div>
      </form>`}`;
}

SUBMIT.accept = (f) => {
  const c = byId(f.dataset.id), child = CHILD.includes(c.dep.age);
  const partner = child ? $("#partner").value : "";
  ui.check.partner = partner;
  ui.errors = {};
  if (child && !partner) ui.errors.partner = "Choose who is going with you.";
  if (child && partner === "standin" && !c.standIn) ui.errors.partner = "No stand-in was named. Choose a second responder.";
  if (!$("#agree").checked) ui.errors.agree = "Please confirm the safeguarding steps first.";
  if (Object.keys(ui.errors).length) { const agreed = $("#agree").checked; render(false); $("#agree").checked = agreed; $("[aria-invalid='true']").focus(); return; }
  accept(c, partner && partner !== "standin" ? partner : null);
  ui.check = {};
  render(false);
  toast("Accepted. The address is now visible to you and the family has been told.");
};

/* ---------------- door check ---------------- */
function checkView(c) {
  const k = ui.check;
  let body = "";
  if (k.found === "yes") {
    body = `
      ${radios("condition", [["ok", "OK for now"], ["supplies", "Needs food, water or medicine"], ["medical", "Needs medical care now"]], k.condition, { cols: true, legend: "How are they?" })}
      ${k.condition === "medical" ? note("bad", "<b>Call 112 now.</b> Then record the hospital below.", "alert") : ""}
      ${radios("to", [["standin", c.standIn ? `Stand-in: ${esc(c.standIn.name)}` : "Stand-in (none named)"], ["adult", "Another adult who is here"], ["facility", "Hospital or shelter"]], k.to, { legend: "Who takes over care?" })}
      ${k.to === "standin" && !c.standIn ? note("warn", "The family didn’t name a stand-in. Choose another option, or ask the family to add one.") : ""}
      ${k.to === "standin" && c.standIn ? field("code", `Code shown on ${esc(c.standIn.name)}’s phone`, `<input id="code" class="code-input" inputmode="numeric" maxlength="4" autocomplete="off" data-check="code" value="${esc(k.code || "")}" ${invalid("code")}>`, `Ask them to open the text from Handover. Demo code: ${esc(c.standIn.code)}`) : ""}
      ${k.to === "adult" ? field("aname", "Their name and relationship", `<input type="text" id="aname" data-check="aname" value="${esc(k.aname || "")}" autocomplete="off" ${invalid("aname")}>`, "The ward coordinator will call the family to confirm this person.") : ""}
      ${k.to === "facility" ? field("place", "Hospital or shelter name", `<input type="text" id="place" data-check="place" value="${esc(k.place || "")}" autocomplete="off" ${invalid("place")}>`) : ""}`;
  } else if (k.found === "no") {
    body = `${note("warn", "Before closing, knock again and ask at least two neighbours.")}
      <label class="choice"><input type="checkbox" data-check="asked" ${k.asked ? "checked" : ""} ${invalid("asked")}><span>I asked two neighbours</span></label>${errText("asked")}
      ${field("nnote", "What did they say? <span class='muted'>(optional)</span>", `<input type="text" id="nnote" data-check="nnote" value="${esc(k.nnote || "")}" placeholder="For example: not seen since yesterday evening" autocomplete="off">`)}`;
  }
  return `
    <a class="btn quiet" href="#/responder/case/${c.id}">‹ Back to case</a>
    <h1>Check on ${esc(c.dep.name)}</h1>${Object.keys(ui.errors).length ? note("bad", "Please complete the highlighted items.", "alert") : ""}
    <form class="panel" id="checkform" data-id="${c.id}" novalidate>
      ${radios("found", [["yes", "Yes, they’re here"], ["no", "No one answered"]], k.found, { cols: true, legend: `Did you find ${esc(c.dep.name)}?` })}
      ${body}
      ${k.found ? `<div class="row" style="margin-top:1rem"><button class="btn primary" type="submit">${k.found === "yes" ? "Confirm handover" : "Close as not found"}</button></div>` : ""}
    </form>`;
}

SUBMIT.checkform = (f) => {
  const c = byId(f.dataset.id), k = ui.check, e = {};
  if (!k.found) e.found = "Choose an answer.";
  if (k.found === "yes") {
    if (!k.condition) e.condition = "Choose how they are.";
    if (!k.to) e.to = "Choose who takes over care.";
    if (k.to === "standin" && !c.standIn) e.to = "No stand-in was named. Choose another option.";
    if (k.to === "standin" && c.standIn && (k.code || "") !== c.standIn.code) { e.code = "Code doesn’t match. Don’t hand over. Call the ward coordinator."; wrongCode(c); }
    if (k.to === "adult" && !(k.aname || "").trim()) e.aname = "Enter their name and relationship.";
    if (k.to === "facility" && !(k.place || "").trim()) e.place = "Enter the hospital or shelter.";
  } else if (k.found === "no" && !k.asked) e.asked = "Ask two neighbours before closing.";
  ui.errors = e;
  if (Object.keys(e).length) { render(false); ($("[aria-invalid='true']") || $("fieldset[aria-describedby] input"))?.focus(); return; }
  closeCase(c, { found: k.found === "yes", to: k.to, condition: k.condition, aname: (k.aname || "").trim(), place: (k.place || "").trim(), nnote: (k.nnote || "").trim() });
  ui.check = {}; ui.errors = {};
  go(`#/responder/done/${c.id}`);
};

function doneView(c) {
  const m = metric(), safe = isSafe(c), inTime = c.closedAt <= c.deadline;
  return `
    <div class="done-mark"><span class="tag big flip ${safe ? "SAFE" : "MISS"}">${safe ? "Handed over" : "Not found"}</span></div>
    <h1>${safe ? "Handover recorded" : "Closed as not found"}</h1>
    ${note(safe ? "ok" : "warn", safe
      ? `${esc(c.dep.name)} is with <b>${esc(c.handedTo)}</b>. The family has been told${c.outcome === "standin" ? " and the care card is now with the stand-in" : ""}. A 72-hour check-in is scheduled. ${inTime ? "Closed within the priority window." : "Closed after the priority window."}`
      : `The case has gone to the police missing-persons desk and the family has been told honestly what you found. ${inTime ? "Closed within the priority window." : "Closed after the priority window."}`, "status")}
    <div class="panel small">Safe-within-window rate is now <b>${m.pct}%</b> (${m.safe} of ${m.due}).${safe ? "" : " A case that ends “not found” counts as a miss."}</div>
    <div class="row"><a class="btn primary" href="#/responder">Back to cases</a><a class="btn" href="#/track/${c.id}">See what the family sees</a>${c.outcome === "standin" ? `<a class="btn quiet" href="#/standin/${c.id}">See the stand-in’s phone</a>` : ""}</div>`;
}

SUBMIT.release = (f) => {
  const c = byId(f.dataset.id), r = f.elements.relreason.value;
  if (!r) { ui.errors = { relreason: "Choose a reason so the coordinator knows what happened." }; render(false); $(".more").open = true; $("input[name=relreason]").focus(); return; }
  releaseCase(c, r); ui.errors = {};
  go("#/responder"); toast(`${c.dep.name}’s case is back in the queue for another responder.`);
};

Object.assign(ACT, {
  respview(b) { ui.respView = b.dataset.v; render(false); $(`[data-act="respview"][data-v="${ui.respView}"]`).focus(); },
  filter(b) { ui.filter = b.dataset.f; render(false); $(`[data-f="${ui.filter}"]`).focus(); },
  atdoor(b) { const c = byId(b.dataset.id); atDoor(c); ui.check = {}; ui.errors = {}; go(`#/responder/check/${c.id}`); toast("Family told: the responder is at the door."); },
  relay() { toast("Demo: this would connect through a relay number, so neither side sees the other’s phone number."); },
});
