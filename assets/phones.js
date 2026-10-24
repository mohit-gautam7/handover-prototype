"use strict";
/* Two simulated phones: the stand-in's (code, care card, 72-hour check-in) and reporting by SMS. */

const AV = `<span class="av" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 28 28"><path d="M10 8h11.5A1.5 1.5 0 0 1 23 9.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-5-6z" fill="#fff"/><circle cx="10.5" cy="14" r="1.9" fill="#ffc72c"/></svg></span>`;
const bubble = (m) => `<div class="bubble ${m.dir}">${esc(m.text)}<span class="t">${fmtTime(m.t)}</span></div>`;
function phone(title, sub, inner) {
  return `<div class="phone" role="region" aria-label="Simulated phone screen"><div class="screen"><header>${AV}<div><b>${esc(title)}</b><span>${esc(sub)}</span></div></header>${inner}</div></div>`;
}
HEADER.standin = () => `<div class="wrap"><span class="brand">${LOGO}Handover <small>on the stand-in’s phone</small></span></div>`;
HEADER.sms = () => `<div class="wrap"><span class="brand">${LOGO}Handover <small>report by text message</small></span></div>`;

/* ---------------- stand-in ---------------- */
VIEW.standin = (p) => {
  const all = db.cases.filter((c) => c.standIn || c.declinedStandIn).sort((a, b) => (a.status === "closed") - (b.status === "closed") || b.createdAt - a.createdAt);
  const c = (p[1] && byId(p[1])) || all[0];
  const pick = `<div class="panel"><h2 style="font-size:1.05rem">Switch stand-in</h2><ul class="stack" style="list-style:none;margin:0;padding:0">${all.map((x) =>
    `<li><a href="#/standin/${x.id}" ${x === c ? 'aria-current="true" style="font-weight:600"' : ""}>${esc((x.standIn || x.declinedStandIn).name)}</a> <span class="small muted">for ${depLine(x.dep)}, ${x.standIn ? esc(statusText(x)) : "declined"}</span></li>`).join("")}</ul></div>`;
  if (!c) return `<div class="wrap"><h1>No stand-ins yet</h1><p>Report someone and name a stand-in to see their phone.</p></div>`;
  const si = c.standIn || c.declinedStandIn;
  return `<div class="wrap"><div class="phone-stage">
    <div class="explain">
      <h1>${esc(si.name)}’s phone</h1>
      <p class="lede">${esc(si.name)}${si.relation ? `, ${esc(si.relation.toLowerCase())},` : ""} was named by the family to take over care of ${depLine(c.dep)}. They don’t need the app: everything arrives by text.</p>
      <ul><li><b>The code</b> is what they show the responder at the door. Without it, the responder won’t hand over.</li>
        <li><b>The care card</b> holds what the vanished carer knew: medicines, routine, allergies, people to call.</li>
        <li><b>The 72-hour check-in</b> asks whether the arrangement is holding. A reply of “need help” goes straight to the coordinator.</li></ul>
      ${c.status !== "closed" && c.standIn ? note("info", `Case ${c.id} is still open. <a href="#/responder/case/${c.id}">Play the responder</a> to hand over using this code.`) : ""}
      ${pick}
    </div>
    ${phone("Handover", "Text messages", standinScreen(c))}
  </div></div>`;
};

function standinThread(c) {
  return db.messages.filter((m) => m.id === c.id && (m.to === "standin" || m.to === "from-standin")).map((m) => ({ dir: m.to === "standin" ? "in" : "out", text: m.text, t: m.t }));
}
function standinScreen(c) {
  const s = ui.standinScreen;
  if (!c.standIn) return `<div class="thread" aria-live="polite">${standinThread(c).map(bubble).join("")}</div><div style="height:.75rem"></div>`;
  if (s === "decline") return `<div class="in-app"><button class="btn quiet small" data-act="si-screen" data-s="inbox">‹ Messages</button>
    <h2 style="margin-top:.5rem">Can’t take this on?</h2><p class="small">That’s all right. Your code will stop working, and the family will be asked to name someone else. Until then the responder will choose a safe option.</p>
    <div class="stack"><button class="btn danger block" data-act="si-decline" data-id="${c.id}">Yes, I can’t take this on</button><button class="btn block" data-act="si-screen" data-s="inbox">Go back</button></div></div>`;
  if (s === "code") return `<div class="in-app"><button class="btn quiet small" data-act="si-screen" data-s="inbox">‹ Messages</button>
    <h2 style="margin-top:.5rem">Your handover code</h2><p class="small">Show this to the verified responder at ${esc(c.dep.name)}’s door. Never read it out over the phone.</p>
    <div class="bigcode" aria-label="Code ${c.standIn.code.split("").join(" ")}">${esc(c.standIn.code)}</div>
    <p class="small muted">Responder for this case: ${c.responder ? `${esc(responder(c.responder).name)} <span class="verified">✓ verified</span>` : "not assigned yet"}.</p></div>`;
  if (s === "care") return `<div class="in-app"><button class="btn quiet small" data-act="si-screen" data-s="inbox">‹ Messages</button>
    <h2 style="margin-top:.5rem">Care card for ${esc(c.dep.name)}</h2>${careCardHTML(c, false)}</div>`;
  const th = standinThread(c);
  const ck = c.checkin, asked = db.messages.some((m) => m.id === c.id && m.kind === "checkin");
  let actions = `<button data-act="si-screen" data-s="code">Show my code</button><button data-act="si-screen" data-s="care">Open care card</button>${c.status !== "closed" ? `<button data-act="si-screen" data-s="decline">I can’t take this on</button>` : ""}`;
  if (c.status === "closed" && c.outcome === "standin" && !asked) actions += `<button data-act="si-checkin" data-id="${c.id}">Preview the 72-hour check-in</button>`;
  if (asked && !ck.reply) actions = `<button data-act="si-reply" data-id="${c.id}" data-r="ok">1</button><button data-act="si-reply" data-id="${c.id}" data-r="help">2</button><button data-act="si-reply" data-id="${c.id}" data-r="stop">3</button>` + actions;
  return `<div class="thread" aria-live="polite">${th.length ? th.map(bubble).join("") : `<p class="small muted">No messages yet.</p>`}</div>
    <div class="quick" role="group" aria-label="Actions">${actions}</div><div style="height:.75rem"></div>`;
}

Object.assign(ACT, {
  "si-screen"(b) { ui.standinScreen = b.dataset.s; render(false); },
  "si-decline"(b) { const c = byId(b.dataset.id); standinDecline(c); ui.standinScreen = "inbox"; render(false); toast("The family has been asked to name someone else."); },
  "si-checkin"(b) {
    const c = byId(b.dataset.id);
    db.messages.push({ t: now(), to: "standin", id: c.id, kind: "checkin", text: `Handover 72-hour check-in (demo preview): is ${c.dep.name} still with you and OK?\nReply 1 for yes, 2 if you need help, 3 if you can’t continue caring for them.` });
    save(); render(false);
  },
  "si-reply"(b) {
    const c = byId(b.dataset.id), r = b.dataset.r;
    db.messages.push({ t: now(), to: "from-standin", id: c.id, text: { ok: "1", help: "2", stop: "3" }[r] });
    checkinReply(c, r);
    db.messages.push({ t: now(), to: "standin", id: c.id, text: { ok: `Thank you. We’ll stay in touch with ${c.dep.name}’s family.`, help: "Thank you for telling us. The ward coordinator will call you today about food, medicine or other help.", stop: `Thank you for caring for ${c.dep.name}. The ward coordinator will call you today to arrange someone new. Please stay with them until then.` }[r] });
    save(); render(false);
    toast(r === "ok" ? "Check-in recorded: the handover is holding." : "Check-in recorded and flagged to the coordinator.");
  },
});

/* ---------------- report by SMS ---------------- */
const SMS_Q = {
  vanished: "What is the first name of the person who vanished?",
  cared: "Did NAME look after anyone who can’t fully look after themselves? Reply YES, NO or NOT SURE.",
  depname: "What is the first name of the person who may be alone?",
  age: "How old is DEP? Reply 1 under 5, 2 for 5–12, 3 for 13–17, 4 for 18–64, 5 for 65 or older.",
  needs: "Do any of these apply? Reply all the numbers that do, or 0 for none.\n1 insulin, oxygen or dialysis\n2 can’t get water or food alone\n3 bed-bound\n4 dementia or confusion\n5 needs daily help",
  adult: "Is an adult with DEP right now? Reply YES, NO or DON’T KNOW.",
  contact: "When did anyone last hear from them? Reply 1 under 6 hours, 2 for 6–12 hours, 3 for 12 hours or more.",
  ward: "Which ward? Reply 4 Old Market, 7 Riverside, 12 Lakeview or 15 Hill Road.",
  address: "What is the address or a landmark? Only the verified responder who accepts will see it.",
  sname: "What is the stand-in’s name?",
  sphone: "What is their 10-digit phone number? We’ll text them a code.",
};
const SMS_QUICK = {
  idle: ["CARE"], vanished: ["Kavita"], cared: ["YES", "NO", "NOT SURE"], depname: ["Aarav"], age: ["1", "2", "3", "4", "5"],
  needs: ["0", "1", "3 4"], adult: ["NO", "YES", "DON’T KNOW"], contact: ["3", "2", "1"], ward: ["7", "4", "12", "15"],
  address: ["Flat 3B, Lotus Apartments, Riverside Road (fictional)"], done: ["STATUS", "STANDIN", "CARE"], sname: ["Mrs Fernandes"], sphone: ["0000011111"],
};
function smsSession() { if (!db.sms) db.sms = { state: "idle", d: { dep: { needs: [] } }, msgs: [], caseId: null }; return db.sms; }

VIEW.sms = () => {
  const s = smsSession();
  return `<div class="wrap"><div class="phone-stage">
    <div class="explain">
      <h1>Report by text message</h1>
      <p class="lede">The same questions as the web form, one text at a time. It works on basic phones and on congested networks, where web pages may not load.</p>
      <ul><li>Text <b>CARE</b> to start. Replies are numbers or yes and no.</li>
        <li>The number you text from is how we reach you, so there’s no separate code to check.</li>
        <li>The case lands in the same queue, with the same rules, as web reports. Try reporting Aarav again here: it merges with the web report.</li></ul>
      <p class="small muted">Demo: tap the suggested replies under the messages, or type your own. Nothing is sent.</p>
      <div class="row"><button class="btn" data-act="sms-reset">Start a new conversation</button>${s.caseId ? `<a class="btn quiet" href="#/track/${s.caseId}">Track ${s.caseId}</a><a class="btn quiet" href="#/coordinator/case/${s.caseId}">See it in the console</a>` : ""}</div>
    </div>
    ${phone("Handover", "Text messages", `<div class="thread" aria-live="polite">${s.msgs.length ? s.msgs.map(bubble).join("") : `<p class="small muted">Text CARE to start a report.</p>`}</div>
      <div class="quick" role="group" aria-label="Suggested replies">${(SMS_QUICK[s.state] || []).map((q) => `<button type="button" data-act="sms-quick" data-v="${esc(q)}">${esc(q)}</button>`).join("")}</div>
      <form class="composer" id="smsform" novalidate><label class="sr" for="smsin">Message</label><input type="text" id="smsin" autocomplete="off" placeholder="Text message"><button class="btn primary small" type="submit">Send</button></form>`)}
  </div></div>`;
};

function smsAsk(s, key) {
  s.state = key;
  smsBot(s, SMS_Q[key].replace("NAME", s.d.vanished || "they").replace(/DEP/g, s.d.dep.name || "them"));
}
function smsBot(s, text) { s.msgs.push({ dir: "in", text, t: now() }); }

function smsHandle(raw) {
  const s = smsSession(), v = raw.trim(), up = v.toUpperCase().replace(/[’']/g, "'");
  if (!v) return;
  s.msgs.push({ dir: "out", text: v, t: now() });
  const d = s.d;
  const again = (msg) => smsBot(s, msg);
  if (up === "STOP") { again("You won’t get more texts from Handover. Text CARE to start again."); s.state = "idle"; return save(); }
  if (up === "CARE" || s.state === "idle") {
    s.d = { dep: { needs: [] } }; s.caseId = null;
    smsBot(s, "Handover: free help when someone who looked after others vanished. If anyone is in danger, call 112 first.");
    smsAsk(s, "vanished"); return save();
  }
  switch (s.state) {
    case "vanished": if (!/[a-z]/i.test(v)) { again("Please reply with their first name."); break; } d.vanished = v; smsAsk(s, "cared"); break;
    case "cared":
      if (/^(Y|YES)$/.test(up) || /NOT SURE|UNSURE/.test(up)) { d.caredFor = up.startsWith("Y") ? "yes" : "unsure"; smsAsk(s, "depname"); }
      else if (/^(N|NO)$/.test(up)) { again("Thank you for telling us. Handover only checks on people left without care. To report a missing person, contact your local police."); s.state = "idle"; db.stats.reports += 1; db.stats.careAnswered += 1; }
      else again("Please reply YES, NO or NOT SURE.");
      break;
    case "depname": if (!/[a-z]/i.test(v)) { again("Please reply with their first name, or a description like ‘the baby’."); break; } d.dep.name = v; smsAsk(s, "age"); break;
    case "age": { const a = { 1: "u5", 2: "5to12", 3: "13to17", 4: "18to64", 5: "65plus" }[v]; if (!a) { again("Please reply 1, 2, 3, 4 or 5."); break; } d.dep.age = a; smsAsk(s, "needs"); break; }
    case "needs": {
      const ns = v.split(/[\s,]+/).filter(Boolean), map = { 1: "meds", 2: "water", 3: "bedbound", 4: "dementia", 5: "daily" };
      if (!ns.length || ns.some((n) => !(n in map) && n !== "0")) { again("Please reply with numbers from 1 to 5, or 0 for none."); break; }
      d.dep.needs = [...new Set(ns.filter((n) => n !== "0").map((n) => map[n]))]; smsAsk(s, "adult"); break;
    }
    case "adult": {
      const a = /^(Y|YES)$/.test(up) ? "yes" : /^(N|NO)$/.test(up) ? "no" : /DON'?T KNOW|DONT KNOW|DK/.test(up) ? "dontknow" : "";
      if (!a) { again("Please reply YES, NO or DON’T KNOW."); break; } d.dep.adultPresent = a; smsAsk(s, "contact"); break;
    }
    case "contact": { const c = { 1: "lt6", 2: "6to12", 3: "12plus" }[v]; if (!c) { again("Please reply 1, 2 or 3."); break; } d.dep.lastContact = c; smsAsk(s, "ward"); break; }
    case "ward": { const w = { 4: "w4", 7: "w7", 12: "w12", 15: "w15" }[v]; if (!w) { again("Please reply 4, 7, 12 or 15."); break; } d.ward = w; smsAsk(s, "address"); break; }
    case "address": {
      if (v.length < 6) { again("Please add enough detail for a responder to find the door."); break; }
      d.address = v;
      const before = db.cases.length;
      const c = createCase({ vanished: d.vanished, reporter: `Texted in by someone who knows ${d.vanished}`, caredFor: d.caredFor, dep: d.dep, ward: d.ward, address: d.address, care: {}, phone: "SMS sender", verified: true }, "sms");
      s.caseId = c.id; s.state = "done";
      if (db.cases.length === before) again(`We already had a request for ${c.dep.name} at this address (${c.id}). Your report has been added to it, which makes it stronger. Reply STATUS for an update.`);
      else again(`Thank you. Your request is ${c.id}. ${c.prio === "PC" ? "We will phone to confirm who is with them within 24 hours." : `Priority ${c.prio}: a verified responder should visit by ${dueBy(c)}.`}\nReply STANDIN to name an adult nearby who can take over care, or STATUS for an update.`);
      save(); break;
    }
    case "done": {
      const c = byId(s.caseId);
      if (up === "STATUS") again(`${c.id} for ${c.dep.name}: ${statusText(c)}.${c.status === "closed" ? "" : ` ${c.prio === "PC" ? "Phone check" : "Visit"} due by ${dueBy(c)}.`}`);
      else if (up === "STANDIN" || up === "STAND-IN") { if (c.standIn) again(`${c.standIn.name} is already the stand-in for ${c.dep.name}.`); else smsAsk(s, "sname"); }
      else again("Reply STATUS for an update, STANDIN to name a stand-in, or CARE to report someone else.");
      break;
    }
    case "sname": if (!/[a-z]/i.test(v)) { again("Please reply with their name."); break; } d.sname = v; smsAsk(s, "sphone"); break;
    case "sphone": {
      if (digits(v).length !== 10) { again("Please reply with a 10-digit number."); break; }
      const c = byId(s.caseId); setStandIn(c, { name: d.sname, relation: "Named by text", phone: v });
      s.state = "done"; again(`Thank you. We texted ${d.sname} a code. The responder will check it before handing over ${c.dep.name}.`);
      break;
    }
  }
  save();
}

SUBMIT.smsform = () => { const el = $("#smsin"), v = el.value; el.value = ""; smsHandle(v); render(false); $("#smsin").focus(); };
Object.assign(ACT, {
  "sms-quick"(b) { smsHandle(b.dataset.v); render(false); $("#smsin").focus(); },
  "sms-reset"() { db.sms = null; save(); render(false); },
});
