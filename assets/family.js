"use strict";
/* Family side: the public site, the report flow, tracking, safety and about pages. */

function emptyDraft() {
  return { vanished: "", relation: "", caredFor: "", dep: { name: "", age: "", needs: [], adultPresent: "", lastContact: "" },
           ward: "", address: "", standIn: { name: "", relation: "", phone: "" }, phone: "", otpEntry: "",
           care: { meds: "", routine: "", allergies: "", contacts: "" } };
}
ui.draft = emptyDraft();
ui.reportState = "form";   // form | nocare | sending | queued
const EXAMPLE = {
  vanished: "Kavita", relation: "sibling", caredFor: "yes",
  dep: { name: "Aarav", age: "u5", needs: [], adultPresent: "no", lastContact: "12plus" },
  ward: "w7", address: "Flat 3B, Lotus Apartments, Riverside Road (fictional)",
  standIn: { name: "Mrs Fernandes", relation: "Neighbour, flat 3A", phone: "00000 11111" }, phone: "00000 22222", otpEntry: "",
  care: { meds: "None regular. Paracetamol syrup 5 ml if fever (kitchen, top shelf)", routine: "Wakes about 7. Nap 1 to 3 pm. Sleeps about 8:30 with his blue elephant", allergies: "Peanuts: lips swell", contacts: "Dr Rao, Riverside Clinic (fictional). Aunt Meera via Handover relay" },
};
const CARE_LABEL = { meds: "Medicines and when", routine: "Daily routine", allergies: "Allergies", contacts: "Doctor and people to call" };

HEADER.family = (p) => {
  const cur = (r) => (p[0] || "") === r ? 'aria-current="page"' : "";
  const links = `<a href="#/" ${cur("")}>Home</a><a href="#/track" ${cur("track")}>Track a request</a><a href="#/safety" ${cur("safety")}>Safety and privacy</a><a href="#/about" ${cur("about")}>About this prototype</a>
    <button type="button" class="btn quiet small" data-act="textsize" aria-pressed="${document.documentElement.classList.contains("large")}">Larger text</button>
    <a class="btn primary small" href="#/report">Ask for a check</a>`;
  return `<div class="wrap"><a class="brand" href="#/">${LOGO}Handover</a>
    <nav class="nav" aria-label="Main">${links}</nav>
    <details class="menu"><summary>Menu</summary><nav class="nav" aria-label="Main, mobile">${links}</nav></details></div>`;
};

VIEW.family = (p) => {
  switch (p[0]) {
    case "report": return reportView();
    case "track": return p[1] ? trackView(p[1]) : lookupView();
    case "safety": return safetyView();
    case "about": return aboutView();
    default: return homeView();
  }
};

/* ---------------- home ---------------- */
function lookupForm(compact = false) {
  return `<form class="panel" id="lookup" novalidate>
    <h2 class="${compact ? "" : "sr"}" style="font-size:1.15rem">Track a request</h2>
    <label class="lbl" for="ref">Reference number</label>
    <p class="hint">It’s in your confirmation text, for example HO-2390.</p>
    <div class="row"><input type="text" id="ref" class="grow" autocomplete="off" style="min-width:150px" ${invalid("ref")}><button class="btn" type="submit">Find</button></div>
    <div aria-live="polite">${errText("ref")}</div>
  </form>`;
}
function homeView() {
  const mine = db.myCases.map(byId).filter(Boolean);
  return `<div class="wrap">
    <section class="hero">
      <div>
        <h1>Did the person who vanished look after anyone?</h1>
        <p class="lede">A child, a parent with dementia, a neighbour on insulin. If they relied on someone who vanished in the Snap, they may be alone right now. Tell us who and where. A verified local responder goes to the door, and care passes to an adult you trust.</p>
        <div class="cta"><a class="btn primary" href="#/report">Ask for a check on someone</a><a class="btn" href="#/sms">Report by text message</a></div>
        <p class="emergency">${"<span aria-hidden='true'>⚠</span>"}<span>If someone is injured or in danger right now, <b>call 112 first</b>. Handover is not an emergency service.</span></p>
      </div>
      <div>
        ${lookupForm(true)}
        ${mine.length ? `<div class="panel"><h2 style="font-size:1.15rem">Your requests</h2><ul class="stack" style="list-style:none;margin:0;padding:0">${mine.map((c) =>
          `<li class="row spread"><span class="row" style="gap:.5rem">${tag(c.prio)}<a href="#/track/${c.id}">${depLine(c.dep)}</a></span><span class="small muted">${esc(statusText(c))}</span></li>`).join("")}</ul></div>` : ""}
        <div class="panel example" aria-label="Example of what a family sees">
          <div class="row spread"><span class="pill">Example</span><span class="small muted">What you’ll see after you ask</span></div>
          <div class="row spread" style="margin:.8rem 0 .2rem"><span class="row" style="gap:.5rem">${tag("P1")}<b>Aarav, under 5</b></span><span class="left">1 h 52 min left</span></div>
          <p class="small muted">Visit within 2 hours. Why: child under 5; no contact for 12+ hours.</p>
          <ol class="tl small">
            <li class="done"><span class="dot" aria-hidden="true"></span>Request received and priority set</li>
            <li class="done"><span class="dot" aria-hidden="true"></span>Asha R., a verified responder, accepted</li>
            <li class="now"><span class="dot" aria-hidden="true"></span>Hand over to Mrs Fernandes, who has the code</li>
          </ol>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="h-next">
      <h2 id="h-next">What happens after you ask</h2>
      <p class="sub">The Snap took the people who would normally raise the alarm. Handover turns the reports people are already making into a search for whoever was left behind.</p>
      <ol class="steps5">
        <li><b>Ask</b><span>Every report of a vanished person comes with one question: did they look after anyone?</span></li>
        <li><b>Triage</b><span>By hours to harm, not by who asked first. The rules are public.</span></li>
        <li><b>Check</b><span>A verified responder from a partner organisation goes to the door.</span></li>
        <li><b>Hand over</b><span>Care passes to a named adult who shows a code, with a care card.</span></li>
        <li><b>Follow up</b><span>We check in with the new carer after 72 hours.</span></li>
      </ol>
    </section>

    <section class="section" aria-labelledby="h-rules">
      <h2 id="h-rules">How urgently we visit</h2>
      <p class="sub">The same rules for everyone. A ward coordinator can change a priority, and every change is recorded with a reason.</p>
      <div style="overflow-x:auto"><table class="rules">
        <thead><tr><th scope="col">Priority</th><th scope="col">Who</th><th scope="col">Visit within</th></tr></thead>
        <tbody>
          <tr><td>${tag("P1")}</td><td>Child under 5; needs insulin, oxygen or dialysis; can’t reach water or food alone</td><td class="num">2 hours</td></tr>
          <tr><td>${tag("P2")}</td><td>Child aged 5–12; dementia; bed-bound</td><td class="num">6 hours</td></tr>
          <tr><td>${tag("P3")}</td><td>Teenager aged 13–17; adult who needs daily help</td><td class="num">24 hours</td></tr>
          <tr><td>${tag("PC")}</td><td>An adult is confirmed with them, or no urgent need: we phone first</td><td class="num">24 hours</td></tr>
        </tbody></table></div>
      <p class="small muted" style="margin-top:.6rem">No contact for 12 hours or more moves a case up one level. These windows are pilot settings, not clinical guidance.</p>
    </section>

    <section class="section two" aria-label="Who checks and how">
      <div><h2>Who comes to the door</h2>
        <p>Only responders already vetted by a partner organisation: Civil Defence volunteers, partner NGOs and resident welfare associations. They see an address only after they accept a case. Children’s cases always get two people.</p>
        <p><a href="#/safety">How we keep people safe</a></p></div>
      <div><h2>For police and helplines</h2>
        <p>When someone reports a vanished person, add one question:</p>
        <p class="script">“Did they look after anyone who can’t look after themselves?”</p>
        <p class="small muted">If yes, take the dependent’s name, age, needs and address, and pass it to Handover. Duplicate reports merge on their own.</p></div>
    </section>
  </div>`;
}

function lookupView() {
  return `<div class="wrap narrow"><h1>Track a request</h1><p class="muted">See what has happened so far, the texts we sent, and update the care card.</p>${lookupForm()}</div>`;
}

/* ---------------- report flow ---------------- */
function triagePreview() {
  const d = ui.draft.dep;
  if (!d.age) return `<div class="triage-box"><b>How urgently we’d visit</b><p class="muted small" style="margin:.25rem 0 0">Choose an age and any needs to see the priority.</p></div>`;
  const t = triage(d);
  return `<div class="triage-box ${t.prio}"><div class="row spread"><b>How urgently we’d visit</b>${tag(t.prio)}</div>
    <div style="margin-top:.3rem">${PRIO_LABEL[t.prio]}</div><ul>${t.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
    <p class="muted small" style="margin:.4rem 0 0">The rules are the same for everyone, and a coordinator can change them.</p></div>`;
}

function reportView() {
  const d = ui.draft, s = ui.step;
  if (ui.reportState === "nocare") return `<div class="wrap narrow"><h1>Thank you for telling us</h1><div class="panel">
    <p>If ${esc(d.vanished || "they")} didn’t look after anyone, there’s nothing for Handover to check.</p>
    <p class="muted small">Handover doesn’t search for people who vanished. To record a missing person, use your local police missing-persons desk.</p>
    <div class="row"><a class="btn primary" href="#/">Back to start</a><button class="btn" data-act="report-step" data-to="1">I made a mistake</button></div></div></div>`;
  if (ui.reportState === "sending") return `<div class="wrap narrow"><h1>Sending your request…</h1><div class="panel row"><div class="spinner" aria-hidden="true"></div><span>Setting the priority and finding responders near the address</span></div></div>`;
  if (ui.reportState === "queued") return `<div class="wrap narrow"><h1>Saved on this phone, not sent yet</h1>
    ${note("warn", `<b>No network right now.</b> Your request for ${esc(db.queued ? db.queued.dep.name : "them")} is stored on this device and will be sent automatically when the connection comes back. You can close this page.`, "alert")}
    <div class="panel"><h2 style="font-size:1.1rem">While you wait</h2><ul><li>If you can reach a neighbour, ask them to go now. They can still be confirmed as the stand-in later.</li><li>If anyone is in immediate danger, call 112.</li></ul></div>
    <p class="muted small">Demo: turn off “Simulate no network” in the dark bar at the top to see it send.</p></div>`;

  const steps = `<ol class="stepper" aria-label="Step ${s} of 3"><li class="${s >= 1 ? "on" : ""}">1. Who vanished</li><li class="${s >= 2 ? "on" : ""}">2. Who might be alone</li><li class="${s >= 3 ? "on" : ""}">3. Who can step in</li></ol>`;
  let body;
  if (s === 1) body = `<h1>Who vanished?</h1>${errSummary()}
    <form class="panel" id="report" novalidate>
      <div class="row spread" style="margin-bottom:.75rem"><span class="muted small">Takes about two minutes. No account needed.</span><button type="button" class="btn quiet small" data-act="example">Fill with example</button></div>
      ${field("vanished", "Their first name", input("vanished", "vanished", d.vanished), "So we can merge reports from other people about the same family.")}
      ${field("relation", "How do you know them?", select("relation", "relation", Object.entries(RELATION), d.relation))}
      ${radios("caredFor", [["yes", "Yes"], ["unsure", "Not sure"], ["no", "No"]], d.caredFor, { bind: "caredFor", legend: "Did they look after anyone who can’t fully look after themselves?", hint: "A child, an older or disabled person, someone who relied on them for medicine or meals." })}
      <div class="row"><button class="btn primary" type="submit">Continue</button><a class="btn quiet" href="#/">Cancel</a></div>
    </form>`;
  else if (s === 2) body = `<h1>Who might be alone now?</h1>${errSummary()}
    <form class="panel" id="report" novalidate>
      ${field("depname", "Their first name", input("depname", "dep.name", d.dep.name), "Or a description, like ‘the baby’.")}
      ${field("age", "Age", select("age", "dep.age", Object.entries(AGE_TEXT), d.dep.age))}
      <fieldset><legend>Do any of these apply?</legend><p class="hint">Tick all that apply.</p><div class="choices cols">${Object.entries(NEED_TEXT).map(([v, t]) =>
        `<label class="choice"><input type="checkbox" value="${v}" data-bind="dep.needs" ${d.dep.needs.includes(v) ? "checked" : ""}><span>${t}</span></label>`).join("")}</div></fieldset>
      ${radios("adultPresent", [["no", "No"], ["dontknow", "Don’t know"], ["yes", "Yes"]], d.dep.adultPresent, { cols: true, bind: "dep.adultPresent", legend: "Is an adult with them right now?" })}
      ${radios("lastContact", Object.entries(CONTACT_TEXT).map(([k, v]) => [k, v[0].toUpperCase() + v.slice(1)]), d.dep.lastContact, { cols: true, bind: "dep.lastContact", legend: "When did anyone last hear from them or their carer?" })}
      <div id="triage-preview" aria-live="polite">${triagePreview()}</div>
      ${field("ward", "Area", select("ward", "ward", Object.entries(WARDS).map(([k, w]) => [k, w.name]), d.ward))}
      ${field("address", "Address or landmark", input("address", "address", d.address), "Shown only to the verified responder who accepts the case and the ward coordinator.")}
      <div class="row"><button class="btn primary" type="submit">Continue</button><button type="button" class="btn quiet" data-act="report-step" data-to="1">Back</button></div>
    </form>`;
  else {
    const o = ui.otp;
    body = `<h1>Who can step in?</h1>${errSummary()}
    <form class="panel" id="report" novalidate>
      <p>Is there an adult near ${esc(d.dep.name || "them")} you trust to take over care? We’ll text them a code. The responder checks the code before handing over, so nobody else can claim ${esc(d.dep.name || "them")}.</p>
      <div class="two">
        ${field("sname", "Stand-in’s name <span class='muted'>(optional)</span>", input("sname", "standIn.name", d.standIn.name))}
        ${field("srel", "Who are they to the family? <span class='muted'>(optional)</span>", input("srel", "standIn.relation", d.standIn.relation))}
      </div>
      ${field("sphone", "Stand-in’s phone <span class='muted'>(optional)</span>", `<input type="tel" inputmode="numeric" id="sphone" data-bind="standIn.phone" value="${esc(d.standIn.phone)}" autocomplete="off" ${invalid("sphone")}>`, "Demo: any 10 digits. No message is sent.")}
      <details class="more" ${Object.values(d.care).some(Boolean) ? "open" : ""}><summary>Add a care card (recommended)</summary>
        <p class="hint">What did ${esc(d.vanished || "the carer")} know that a stand-in won’t? It’s shared with whoever takes over, and you can edit it later.</p>
        <div class="two">${Object.entries(CARE_LABEL).map(([k, l]) => field("c" + k, l, `<textarea id="c${k}" data-bind="care.${k}">${esc(d.care[k])}</textarea>`)).join("")}</div>
      </details>
      <h2 style="font-size:1.1rem;margin-top:1rem">Your phone, for updates</h2>
      <p class="hint">We text you a code to check it’s really you. This stops false reports from sending responders to someone’s door.</p>
      <div class="otp">
        <div class="grow" style="min-width:200px"><label class="lbl" for="phone">Your phone number</label><input type="tel" inputmode="numeric" id="phone" data-bind="phone" value="${esc(d.phone)}" autocomplete="off" ${invalid("phone")}></div>
        <button type="button" class="btn" data-act="send-otp">${o && o.code ? "Text me a new code" : "Text me a code"}</button>
      </div>
      ${errText("phone")}
      ${o && o.code ? `${note("info", `Demo: a code would be texted to ${esc(o.to)}. <b>The code is ${o.code}.</b>`)}
        ${field("otp", "Code from the text", `<input type="text" inputmode="numeric" maxlength="4" id="otp" class="code-input" data-bind="otpEntry" value="${esc(d.otpEntry)}" autocomplete="one-time-code" ${invalid("otp")}>`)}` : ""}
      ${o && o.offline ? note("warn", "No network, so we can’t text a code now. Your request will be saved on this phone and your number checked when it sends.") : ""}
      ${ui.errors.otp && !(o && o.code) ? errText("otp") : ""}
      <div class="row" style="margin-top:1rem"><button class="btn primary" type="submit">Send request</button><button type="button" class="btn quiet" data-act="report-step" data-to="2">Back</button></div>
    </form>`;
  }
  return `<div class="wrap narrow">${steps}${body}</div>`;
}

function validateReport(step) {
  const d = ui.draft, e = {};
  if (step === 1) {
    if (!d.vanished.trim()) e.vanished = "Enter their first name.";
    if (!d.relation) e.relation = "Choose how you know them.";
    if (!d.caredFor) e.caredFor = "Choose an answer.";
  } else if (step === 2) {
    if (!d.dep.name.trim()) e.depname = "Enter their first name, or a description like ‘the baby’.";
    if (!d.dep.age) e.age = "Choose an age range.";
    if (!d.dep.adultPresent) e.adultPresent = "Choose an answer.";
    if (!d.dep.lastContact) e.lastContact = "Choose an answer.";
    if (!d.ward) e.ward = "Choose the area.";
    if (d.address.trim().length < 6) e.address = "Add enough detail for a responder to find the door.";
  } else {
    const any = d.standIn.name.trim() || d.standIn.phone.trim();
    if (any && !d.standIn.name.trim()) e.sname = "Add the stand-in’s name, or clear their phone.";
    if (any && digits(d.standIn.phone).length !== 10) e.sphone = "Enter a 10-digit phone number so we can send the code.";
    if (digits(d.phone).length !== 10) e.phone = "Enter a 10-digit number so we can update you.";
    else if (!ui.offline) {
      if (!ui.otp || !ui.otp.code || digits(ui.otp.to) !== digits(d.phone)) e.otp = "Tap ‘Text me a code’ to check your number.";
      else if (d.otpEntry.trim() !== ui.otp.code) e.otp = "That code doesn’t match. Check the latest text.";
    }
  }
  return e;
}

SUBMIT.report = () => {
  ui.errors = validateReport(ui.step);
  if (Object.keys(ui.errors).length) { render(false); ($("[aria-invalid='true']") || $("fieldset[aria-describedby] input"))?.focus(); return; }
  if (ui.step === 1 && ui.draft.caredFor === "no") { ui.reportState = "nocare"; render(); return; }
  if (ui.step < 3) { ui.step++; render(); return; }
  const d = JSON.parse(JSON.stringify(ui.draft));
  if (ui.offline) { d.verified = false; db.queued = d; save(); ui.reportState = "queued"; render(); return; }
  ui.reportState = "sending"; render();
  setTimeout(() => {
    const c = createCase(d);
    ui.draft = emptyDraft(); ui.step = 1; ui.otp = null; ui.reportState = "form";
    go(`#/track/${c.id}`);
    toast(c.reports > 1 ? `Added to the existing request ${c.id}. Two reports make it stronger.` : `Request ${c.id} sent. We’ll text you at each step.`);
  }, 900);
};

Object.assign(ACT, {
  example() { ui.draft = JSON.parse(JSON.stringify(EXAMPLE)); ui.errors = {}; render(false); toast("Example filled in: Meera reporting for her sister Kavita’s son."); },
  "report-step"(b) { ui.step = +b.dataset.to; ui.reportState = "form"; ui.errors = {}; render(); },
  "send-otp"() {
    const ph = ui.draft.phone;
    if (digits(ph).length !== 10) { ui.errors = { phone: "Enter a 10-digit number first." }; render(false); $("#phone").focus(); return; }
    ui.errors = {};
    ui.otp = ui.offline ? { offline: true } : { code: code4(), to: ph };
    render(false); ($("#otp") || $("#phone")).focus();
    if (!ui.offline) toast("Code sent (demo: shown on screen).");
  },
  "add-standin"(b) {
    const c = byId(b.dataset.id), f = $("#standin-form");
    const s = { name: f.elements.sname.value, relation: f.elements.srel.value, phone: f.elements.sphone.value };
    ui.errors = {};
    if (!s.name.trim()) ui.errors.sname = "Enter their name.";
    if (digits(s.phone).length !== 10) ui.errors.sphone = "Enter a 10-digit phone number so we can send the code.";
    if (Object.keys(ui.errors).length) { render(false); $("[aria-invalid='true']").focus(); return; }
    setStandIn(c, s); render(false); toast(`${s.name.trim()} is now the stand-in. We texted them a code.`);
  },
  "toggle-original"(b) { ui.translated[b.dataset.id] = !ui.translated[b.dataset.id]; render(false); },
});

/* ---------------- tracking ---------------- */
SUBMIT.lookup = () => {
  const ref = $("#ref").value.trim().toUpperCase();
  if (!/^HO-\d{4}$/.test(ref)) ui.errors = { ref: "References look like HO-1234." };
  else if (!byId(ref)) ui.errors = { ref: `We couldn’t find ${ref}. Check the code in your confirmation text.` };
  else { ui.errors = {}; go(`#/track/${ref}`); return; }
  render(false); $("#ref").value = ref; $("#ref").focus();
};

SUBMIT.carecard = (f) => {
  const c = byId(f.dataset.id);
  c.care = Object.fromEntries(Object.keys(CARE_LABEL).map((k) => [k, f.elements[k].value.trim()]));
  c.careOriginal = null;
  log(c.id, "Family", "Care card updated");
  save(); render(false);
  toast(c.status === "closed" ? "Care card updated and shared again." : "Care card saved. The stand-in gets it at handover.");
};

const TRACK_STEPS = [
  ["received", "Request received"], ["triaged", "Priority set"], ["accepted", "Verified responder assigned"],
  ["atdoor", "Responder at the door"], ["outcome", "Care handed over"], ["checkin", "72-hour check-in with the new carer"],
];
function careCardHTML(c, editable) {
  const care = c.care || {}, orig = c.careOriginal, showOrig = orig && ui.translated[c.id];
  const transl = orig ? `<div class="note info small"><b>Some notes were written in ${esc(orig.lang)}.</b> ${showOrig ? "Showing the original." : "Showing a machine translation. It may contain mistakes."}
      <button type="button" class="btn quiet small" data-act="toggle-original" data-id="${c.id}">${showOrig ? "Show translation" : "Show original"}</button></div>` : "";
  const val = (k) => (showOrig && orig[k] ? orig[k] : care[k]);
  if (!editable) return `${transl}<dl class="kv">${Object.entries(CARE_LABEL).map(([k, l]) => `<dt>${l}</dt><dd ${showOrig && orig[k] ? 'lang="hi"' : ""}>${esc(val(k) || "Not given")}</dd>`).join("")}</dl>`;
  return `${transl}${Object.entries(CARE_LABEL).map(([k, l]) => field("cc-" + k, l, `<textarea id="cc-${k}" name="${k}" ${showOrig && orig[k] ? 'lang="hi"' : ""}>${esc(val(k))}</textarea>`)).join("")}`;
}

function trackView(id) {
  const c = byId(id);
  if (!c) return `<div class="wrap narrow"><h1>Request not found</h1><div class="panel"><p>There’s no request ${esc(id)} in this demo.</p><a class="btn" href="#/track">Try another reference</a></div></div>`;
  const w = WARDS[c.ward], rs = onlineIn(c.ward);
  const ahead = db.cases.filter((x) => x.status !== "closed" && x.prio !== "PC" && x.ward === c.ward && x.id !== c.id && x.deadline <= c.deadline).length;
  const at = Object.fromEntries(c.timeline.map((e) => [e.k, e.t]));
  let state = "";
  if (c.status === "closed") {
    state = isSafe(c)
      ? note("ok", `<b>${esc(c.dep.name)} is now in the care of ${esc(c.handedTo)}.</b> ${c.closedAt <= c.deadline ? "Handed over within the priority window." : "Handed over after the priority window."} ${esc(c.condition || "")}`, "status")
      : note("bad", `<b>The responder found nobody at the address.</b> Neighbours had not seen ${esc(c.dep.name)} since ${esc(c.neighbourNote || "the Snap")}. ${esc(c.dep.name)} may also have vanished, or someone may already have taken them in. The case has gone to the police missing-persons desk with everything you told us.`, "status");
  } else if (c.status !== "open") {
    const r = responder(c.responder);
    state = note("ok", `<b>${esc(r.name)}</b> <span class="verified">✓ verified</span>, from ${esc(ORG[r.org])}, ${c.status === "atdoor" ? "is at the door now" : "has accepted and is on the way"}.${c.partner ? ` ${esc(responder(c.partner).name)} is going too.` : ""}`);
  } else if (c.prio === "PC") {
    state = note("info", `An adult may already be with ${esc(c.dep.name)}, so the ward coordinator will phone first to confirm who is caring for them. If nobody can be confirmed, a responder will visit.`);
  } else if (!rs.length) {
    state = note("bad", `<b>No verified responder is online in ${esc(w.name)} right now.</b> The ward coordinator has been alerted and can send someone from a nearby ward. ${c.standIn ? `The fastest option is to ask ${esc(c.standIn.name)} to go now. Their code works without a responder.` : "If you know any adult nearby, add them as a stand-in below."}`, "alert");
  } else {
    state = note("info", `${rs.length} verified responder${rs.length > 1 ? "s are" : " is"} active in ${esc(w.name)}. ${ahead ? `${ahead} case${ahead > 1 ? "s" : ""} in this ward ${ahead > 1 ? "are" : "is"} due before yours.` : "Yours is next in this ward."} We’ll text you when someone accepts.`);
  }
  const override = c.override ? note("warn", `<b>The ward coordinator changed the priority from ${TAG_TEXT[c.override.from]} to ${TAG_TEXT[c.override.to]}.</b> Reason: ${esc(c.override.reason)}`) : "";
  const steps = TRACK_STEPS.map(([k, label]) => {
    let cls = at[k] ? "done" : "", t = at[k] ? fmtTime(at[k]) : "";
    if (k === "accepted" && c.prio === "PC" && c.status !== "closed") { label = "Phone check by the ward coordinator"; }
    if (k === "outcome" && c.outcome === "notfound") { cls = "miss"; label = "Not found: passed to police"; }
    if (k === "checkin") {
      if (c.outcome === "notfound") return "";
      if (c.checkin && c.checkin.reply) { cls = c.checkin.reply === "ok" ? "done" : "flag"; t = c.checkin.reply === "ok" ? "Reply: still in place and OK" : "Reply: needs support. The coordinator is on it."; }
      else if (c.status === "closed") { cls = "now"; t = `Scheduled for ${new Date(c.checkin.due).toLocaleDateString([], { weekday: "long" })}, ${fmtTime(c.checkin.due)}`; }
    }
    return `<li class="${cls}"><span class="dot" aria-hidden="true"></span>${label}${cls === "done" ? '<span class="sr"> (done)</span>' : ""}<div class="t">${t}</div></li>`;
  }).join("");
  const extra = c.timeline.filter((e) => ["escalated", "override", "merged", "tovisit"].includes(e.k)).map((e) =>
    `<li class="flag"><span class="dot" aria-hidden="true"></span>${{ escalated: "Priority raised: 12 hours without contact", override: "Priority changed by the ward coordinator", merged: "Another report about the same person was merged", tovisit: "Phone check failed: changed to a visit" }[e.k]}<div class="t">${fmtTime(e.t)}</div></li>`).join("");
  const texts = db.messages.filter((m) => m.id === c.id && m.to === "family").slice().reverse();
  const standin = c.standIn
    ? `<div class="panel"><div class="row spread"><h2 style="font-size:1.15rem;margin:0">Stand-in</h2><a class="btn quiet small" href="#/standin/${c.id}">See their phone</a></div>
        <p style="margin:.4rem 0 0">${esc(c.standIn.name)}${c.standIn.relation ? `, ${esc(c.standIn.relation)}` : ""}. We texted them a code. <span class="muted">Demo code: <b>${esc(c.standIn.code)}</b></span></p></div>`
    : c.status === "closed" ? "" : `<form class="panel" id="standin-form" novalidate><h2 style="font-size:1.15rem">Add a stand-in</h2>
        <p class="hint">An adult near ${esc(c.dep.name)} you trust to take over. We’ll text them a code that the responder checks.</p>
        <div class="two">${field("sname", "Their name", `<input type="text" id="sname" name="sname" autocomplete="off" ${invalid("sname")}>`)}${field("srel", "Who are they to the family? <span class='muted'>(optional)</span>", `<input type="text" id="srel" name="srel" autocomplete="off">`)}</div>
        ${field("sphone", "Their phone", `<input type="tel" inputmode="numeric" id="sphone" name="sphone" autocomplete="off" ${invalid("sphone")}>`, "Demo: any 10 digits. No message is sent.")}
        <button type="button" class="btn" data-act="add-standin" data-id="${c.id}">Add stand-in</button></form>`;
  return `<div class="wrap narrow">
    <p class="muted small" style="margin:0">Request ${esc(c.id)}, <span data-since="${c.timeline[c.timeline.length - 1].t}">updated ${ago(c.timeline[c.timeline.length - 1].t)}</span>${c.reporterVerified ? "" : ` <span class="pill warn">Phone not verified yet</span>`}</p>
    <h1>${depLine(c.dep)}</h1>
    <div class="panel"><div class="row spread"><span class="row" style="gap:.6rem">${tag(c.prio)}<span>${PRIO_LABEL[c.prio]}</span></span>${left(c)}</div>
      <p class="small muted" style="margin:.5rem 0 0">Due by ${fmtTime(c.deadline)}. Why: ${c.reasons.map(esc).join("; ")}.</p></div>
    ${override}${state}${c.declinedStandIn && !c.standIn && c.status !== "closed" ? note("warn", `<b>${esc(c.declinedStandIn.name)} can’t take over.</b> Their code has been cancelled. Name someone else below if you can.`, "status") : ""}${standin}
    ${c.status === "open" && c.prio !== "PC" ? `<details class="more panel"><summary>Has anything changed?</summary>
      <form id="family-update" data-id="${c.id}" novalidate>
        <p class="hint">If an adult is with ${esc(c.dep.name)} now, tell us. The ward coordinator will phone them to confirm, and the responder can go to someone who is still alone.</p>
        ${field("funame", "Who is with them now?", `<input type="text" id="funame" name="funame" autocomplete="off" placeholder="Name and relationship" ${invalid("funame")}>`)}
        <button class="btn" type="submit">An adult is with them now</button></form></details>` : ""}
    <div class="two">
      <div class="panel"><h2 style="font-size:1.15rem">Progress</h2><ol class="tl">${steps}${extra}</ol></div>
      <div class="panel"><h2 style="font-size:1.15rem">Texts we sent you</h2>${texts.length ? `<ul class="texts">${texts.map((m) => `<li><span class="t">${fmtTime(m.t)}</span>${esc(m.text)}</li>`).join("")}</ul>` : `<p class="muted small">None yet.</p>`}</div>
    </div>
    <form class="panel" id="carecard" data-id="${c.id}" novalidate>
      <div class="row spread"><h2 style="font-size:1.15rem;margin:0">Care card</h2><span class="pill">${c.status === "closed" && isSafe(c) ? `Shared with ${esc(c.handedTo)}` : "Shared with whoever takes over"}</span></div>
      <p class="hint" style="margin-top:.4rem">What the vanished carer knew. Keep it short and practical.</p>
      ${careCardHTML(c, true)}
      <div class="row"><button class="btn" type="submit">Save care card</button><button type="button" class="btn quiet" data-act="print-card">Print care card</button></div>
    </form>
    <section class="print-only" aria-hidden="true">
      <p>Handover care card, request ${esc(c.id)}. Printed ${new Date(now()).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}.</p>
      <p class="print-title">Care card: ${depLine(c.dep)}</p>
      <p>${c.standIn ? `Stand-in: ${esc(c.standIn.name)}${c.standIn.relation ? `, ${esc(c.standIn.relation)}` : ""}.` : ""} In an emergency call 112.</p>
      <dl class="kv">${Object.entries(CARE_LABEL).map(([k, l]) => `<dt>${l}</dt><dd>${esc((c.care || {})[k] || "Not given")}</dd>`).join("")}</dl>
      <p>Keep this card with ${esc(c.dep.name)}. Handover will check in 72 hours after the handover.</p>
    </section>
    <div class="row"><a class="btn" href="#/">Back to start</a><a class="btn quiet" href="#/report" data-act="new-report">Ask about someone else</a></div>
  </div>`;
}
SUBMIT["family-update"] = (f) => {
  const c = byId(f.dataset.id), name = f.elements.funame.value.trim();
  if (name.length < 2) { ui.errors = { funame: "Enter who is with them now." }; render(false); $("details.more").open = true; $("#funame").focus(); return; }
  ui.errors = {}; familyAdult(c, name); render(false);
  toast("Thanks. The ward coordinator will phone to confirm.");
};
Object.assign(ACT, {
  "print-card"() { window.print(); },
  textsize(b) {
    const on = document.documentElement.classList.toggle("large");
    try { localStorage.setItem("handover-text", on ? "large" : ""); } catch (e) {}
    b.setAttribute("aria-pressed", String(on)); toast(on ? "Larger text on." : "Larger text off.");
  },
});
ACT["new-report"] = () => { ui.draft = emptyDraft(); ui.step = 1; ui.otp = null; ui.reportState = "form"; ui.errors = {}; };

/* ---------------- safety and about ---------------- */
function safetyView() {
  return `<div class="wrap narrow">
    <h1>Safety and privacy</h1>
    <p class="lede muted">A list of people who are alone is exactly what a bad actor would want. Handover is built so that list never exists in public.</p>
    <div class="panel"><h2>Who can see an address</h2><p>Only the verified responder who accepts the case, and the ward coordinator. Responders see the area and distance before they accept, never the address. Every time anyone opens an address, it is logged with who, when and why.</p></div>
    <div class="panel"><h2>How we know a stand-in is the right person</h2><p>The family names the stand-in. We text that person a four-digit code. The responder only hands over care after the stand-in shows the matching code. A wrong code blocks the handover and alerts the coordinator.</p></div>
    <div class="panel"><h2>Who responders are</h2><p>Members of partner organisations who were vetted before the Snap: Civil Defence volunteers, partner NGOs and resident welfare associations. Nobody signs up as a responder through this site. Children’s cases always go to two people, or one responder with the named stand-in.</p></div>
    <div class="panel"><h2>False and duplicate reports</h2><p>Reporters confirm their phone number with a code. Reports about the same person at the same address merge into one case and make it stronger. If nobody is found, the case goes to the police missing-persons desk.</p></div>
    <div class="panel"><h2>What we keep</h2><p>Only what a responder needs to reach the person and hand over care. Case data is deleted 90 days after the case closes.</p></div>
    <div class="panel"><h2>No AI decides anything</h2><p>Priorities come from the rules on the home page, which anyone can read and a coordinator can change with a reason. Machine translation is used only for free-text notes, and the original is always one tap away.</p></div>
    <div class="panel"><h2>What Handover is not</h2><ul><li>Not a replacement for 112.</li><li>Not a search for the people who vanished.</li><li>Not a custody decision. Long-term care is decided by the family and the authorities.</li></ul></div>
  </div>`;
}

function aboutView() {
  const row = (a, b, c) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`;
  return `<div class="wrap narrow">
    <h1>About this prototype</h1>
    ${note("warn", "<b>This is a prototype for a product case study, not a live service.</b> Every person, address, phone number, responder and statistic is fictional. Nothing you type leaves this browser: there is no server and no network request.")}
    <div class="panel"><h2>The idea in one line</h2><p>The day after the Snap, the people most at risk are those whose carer vanished, because the carer was the person who would have called for help. Handover finds them through the reports people are already making, and closes a case only when a named adult has taken over their care.</p></div>
    <div class="panel"><h2>Five ways to look at it</h2>
      <p>Use the dark bar at the top to switch view. All views share the same data, so what you do in one shows up in the others.</p>
      <dl class="kv"><dt>Family</dt><dd>Report someone, verify your phone, track progress, add a stand-in, edit the care card.</dd>
        <dt>Report by SMS</dt><dd>The same report as a text conversation, for weak networks and basic phones.</dd>
        <dt>Stand-in</dt><dd>The code to show at the door, the care card, and the 72-hour check-in.</dd>
        <dt>Responder</dt><dd>Queue sorted by time left, safeguarding and pairing, coded handover, not-found path.</dd>
        <dt>Coordinator</dt><dd>Ward board, priority changes with reasons, phone checks, metrics and the audit log.</dd></dl>
      <p style="margin-top:.75rem"><button class="btn" data-act="open-guide">Open the demo guide</button></p></div>
    <div class="panel"><h2>What is and isn’t built</h2>
      <div style="overflow-x:auto"><table class="rules"><thead><tr><th>Feature</th><th>In this prototype</th><th>Notes</th></tr></thead><tbody>
      ${row("Web and SMS report, rule triage", "Yes", "Rules match the written case exactly")}
      ${row("Reporter phone check, duplicate merge", "Yes", "Code shown on screen in the demo")}
      ${row("Responder queue, safeguarding, coded handover", "Yes", "Wrong codes block the handover")}
      ${row("Care card, family tracking, texts", "Yes", "Texts are shown, not sent")}
      ${row("Coordinator console, overrides, phone checks", "Yes", "Every change needs a reason and is logged")}
      ${row("Metrics and audit log", "Yes", "Definitions from section 4 of the case")}
      ${row("72-hour check-in", "Yes", "Preview it from the stand-in’s phone")}
      ${row("Offline report queue, 12-hour escalation", "Yes", "Use the demo bar to simulate")}
      ${row("Ward map, surge simulation, live activity feed", "Yes", "Pins show the ward only, never the address")}
      ${row("Family updates, responder release, stand-in decline", "Yes", "Each one is logged and the right people are told")}
      ${row("Printable care card, larger text", "Yes", "For stand-ins and older family members")}
      ${row("Re-handover when a carer can’t continue", "Preview", "Planned after day one in the written case")}
      ${row("Voice line, importing registers", "No", "Planned next")}
      ${row("Real SMS, maps, logins", "No", "Out of scope for a prototype")}
      </tbody></table></div></div>
    <div class="panel"><h2>Running it</h2><p>Open <code>index.html</code> in any modern browser. It works offline. Demo data is kept in this browser for three hours, or until you press Reset in the demo bar.</p></div>
  </div>`;
}
