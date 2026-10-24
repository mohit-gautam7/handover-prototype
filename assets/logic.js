"use strict";
/* Handover prototype: rules, demo data, case state changes and metrics. No DOM code here.
   Every person, place, responder and number is fictional. Nothing leaves this browser. */

const MIN = 60e3, HOUR = 36e5;

// ---------- triage: identical to the rule table in the written case ----------
const WINDOW_H = { P1: 2, P2: 6, P3: 24, PC: 24 };
const PRIO_LABEL = { P1: "Visit within 2 hours", P2: "Visit within 6 hours", P3: "Visit within 24 hours", PC: "Phone check within 24 hours" };
const TAG_TEXT = { P1: "P1", P2: "P2", P3: "P3", PC: "Phone check" };
const RANK = { P1: 1, P2: 2, P3: 3, PC: 4 };
const AGE_TEXT = { u5: "under 5", "5to12": "5–12", "13to17": "13–17", "18to64": "18–64", "65plus": "65+" };
const NEED_TEXT = { meds: "Needs insulin, oxygen or dialysis", water: "Can’t get water or food alone", bedbound: "Bed-bound", dementia: "Dementia or confusion", daily: "Needs daily help but can move" };
const CONTACT_TEXT = { lt6: "under 6 hours ago", "6to12": "6–12 hours ago", "12plus": "12+ hours ago" };
const CONTACT_H = { lt6: 3, "6to12": 9, "12plus": 12 };   // hours since contact assumed at report time
const CHILD = ["u5", "5to12", "13to17"];

function triage(d) {
  const needs = d.needs || [];
  const reasons = [];
  let level = 0;
  if (d.age === "u5") { level = 1; reasons.push("Child under 5"); }
  if (needs.includes("meds")) { level = 1; reasons.push("Needs insulin, oxygen or dialysis"); }
  if (needs.includes("water")) { level = 1; reasons.push("Can’t get water or food alone"); }
  if (!level) {
    if (d.age === "5to12") { level = 2; reasons.push("Child aged 5–12"); }
    if (needs.includes("dementia")) { level = 2; reasons.push("Dementia or confusion"); }
    if (needs.includes("bedbound")) { level = 2; reasons.push("Bed-bound"); }
  }
  if (!level) {
    if (d.age === "13to17") { level = 3; reasons.push("Teenager aged 13–17"); }
    if (needs.includes("daily")) { level = 3; reasons.push("Needs daily help but can move"); }
  }
  if (d.adultPresent === "yes") return { prio: "PC", reasons: reasons.concat("An adult is with them now, so we confirm by phone first") };
  if (!level) return { prio: "PC", reasons: ["No urgent need selected, so we call first"] };
  if (d.lastContact === "12plus" && level > 1) { level -= 1; reasons.push("No contact for 12+ hours: moved up one level"); }
  return { prio: "P" + level, reasons };
}

// ---------- fictional reference data ----------
const WARDS = {
  w4:  { name: "Ward 4, Old Market", km: 1.9 },
  w7:  { name: "Ward 7, Riverside", km: 0.8 },
  w12: { name: "Ward 12, Lakeview", km: 2.6 },
  w15: { name: "Ward 15, Hill Road", km: 4.2 },
};
const ORG = { cd: "Civil Defence volunteers", ngo: "Partner NGO", rwa: "Resident welfare association" };
const ME = "r1";                                   // the responder you play
const COORD = "Priya N., ward coordinator";        // the coordinator you play
const RELATION = { parent: "Parent", child: "Son or daughter", sibling: "Sibling", spouse: "Partner", "other-family": "Relative", neighbour: "Neighbour", colleague: "Colleague or friend" };

function seedResponders() {
  return [
    { id: "r1", name: "Asha R.", org: "cd", ward: "w7", status: "online" },
    { id: "r2", name: "Imran S.", org: "ngo", ward: "w7", status: "online" },
    { id: "r3", name: "Neha P.", org: "cd", ward: "w7", status: "online" },
    { id: "r4", name: "Joseph M.", org: "ngo", ward: "w4", status: "busy" },
    { id: "r5", name: "Farah K.", org: "rwa", ward: "w4", status: "online" },
    { id: "r6", name: "Vikram D.", org: "cd", ward: "w12", status: "online" },
    { id: "r7", name: "Rohan T.", org: "ngo", ward: "w15", status: "offline" },
  ];
}

// ---------- store ----------
const KEY = "handover-demo-v2";
let db = load();
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 2 && Date.now() - s.seededAt < 3 * HOUR) return s; } catch (e) {}
  return seed();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
const now = () => Date.now() + (db ? db.clock : 0);
const byId = (id) => db.cases.find((c) => c.id === id);
const responder = (id) => db.responders.find((r) => r.id === id);
const onlineIn = (ward) => db.responders.filter((r) => r.ward === ward && r.status !== "offline");
const code4 = () => String(1000 + Math.floor(Math.random() * 9000));

function seed() {
  const t0 = Date.now();
  const cases = [];
  const events = [];
  const messages = [];
  const mk = (o) => {
    const t = triage(o.dep);
    const c = Object.assign({
      status: "open", outcome: null, reports: 1, channel: "web", reporterVerified: true, standIn: null, responder: null, partner: null,
      offeredTo: null, override: null, flags: [], checkin: null, care: {}, careOriginal: null,
    }, o);
    c.prio = t.prio; c.autoPrio = t.prio; c.reasons = t.reasons;
    c.bumped = o.dep.lastContact === "12plus";
    c.lastContactAt = c.createdAt - CONTACT_H[o.dep.lastContact] * HOUR;
    c.deadline = c.createdAt + WINDOW_H[t.prio] * HOUR;
    c.timeline = [{ k: "received", t: c.createdAt }, { k: "triaged", t: c.createdAt + MIN }];
    events.push({ t: c.createdAt, who: o.channel === "sms" ? "Reporter (SMS)" : o.channel === "helpline" ? "Police control room" : "Reporter (web)", act: "Report received", id: c.id, note: `${c.reporter}` });
    events.push({ t: c.createdAt + MIN, who: "Rules", act: `Triaged ${TAG_TEXT[t.prio]}`, id: c.id, note: t.reasons.join("; ") });
    cases.push(c);
    return c;
  };
  mk({ id: "HO-2398", ward: "w7", createdAt: t0 - 68 * MIN, reports: 2, reporter: "Neighbour of the vanished mother",
       dep: { name: "Riya", age: "u5", needs: [], adultPresent: "no", lastContact: "6to12" },
       address: "House 14, Ferry Lane (fictional)",
       care: { meds: "None known", routine: "Neighbour says she naps after lunch", allergies: "Unknown", contacts: "Grandmother lives in another state" } });
  mk({ id: "HO-2401", ward: "w4", createdAt: t0 - 20 * MIN, channel: "helpline", reporter: "Colleague of the vanished son",
       dep: { name: "Mr Iyer", age: "65plus", needs: ["meds"], adultPresent: "no", lastContact: "6to12" },
       address: "2nd floor, Clocktower Building (fictional)", standIn: { name: "Mr Das", relation: "Shop owner downstairs", phone: "00000 33333", code: "3906" },
       care: { meds: "Insulin, morning and night; pens in fridge door", routine: "Eats at 8, 1 and 8", allergies: "None known", contacts: "GP: Dr Menon (fictional)" } });
  mk({ id: "HO-2390", ward: "w7", createdAt: t0 - 160 * MIN, reporter: "Daughter, lives abroad",
       dep: { name: "Mrs Pinto", age: "65plus", needs: ["dementia"], adultPresent: "no", lastContact: "lt6" },
       address: "Flat 9, Riverside Court (fictional)", standIn: { name: "Ms Kaur", relation: "Neighbour, flat 10", phone: "00000 44444", code: "5512" },
       care: { meds: "Donepezil 5 mg at night", routine: "Gets anxious after dark; radio helps", allergies: "Penicillin", contacts: "Daughter via Handover relay" } });
  mk({ id: "HO-2385", ward: "w12", createdAt: t0 - 115 * MIN, channel: "sms", reporter: "Class teacher",
       dep: { name: "Kabir", age: "5to12", needs: [], adultPresent: "dontknow", lastContact: "6to12" },
       address: "Lakeview Colony, block C (fictional)",
       care: { meds: "Asthma inhaler (blue)", routine: "Walks to school with a neighbour’s son", allergies: "None known", contacts: "School office" } });
  mk({ id: "HO-2377", ward: "w15", createdAt: t0 - 7 * HOUR, reporter: "Brother, other city",
       dep: { name: "Mr Khan", age: "18to64", needs: ["daily"], adultPresent: "no", lastContact: "lt6" },
       address: "Hill Road, house 3 (fictional)",
       care: { meds: "None", routine: "Wheelchair user; needs help with meals", allergies: "None", contacts: "Brother via relay" } });
  mk({ id: "HO-2372", ward: "w4", createdAt: t0 - 6 * HOUR - 18 * MIN, reporter: "Nephew",
       dep: { name: "Mrs Rao", age: "65plus", needs: ["bedbound"], adultPresent: "no", lastContact: "lt6" },
       address: "Old Market Lane 5 (fictional)", standIn: { name: "Mrs Joseph", relation: "Friend", phone: "00000 55555", code: "7788" },
       care: { meds: "Blood pressure tablet at 8 am", routine: "Turn her every 3 hours. Likes tea at 4.", allergies: "None", contacts: "Nephew via relay" },
       careOriginal: { lang: "Hindi", routine: "हर 3 घंटे में करवट बदलनी है। शाम 4 बजे चाय पसंद है।", meds: "सुबह 8 बजे बीपी की गोली" } });
  mk({ id: "HO-2388", ward: "w12", createdAt: t0 - 40 * MIN, reporter: "Son-in-law’s sister",
       dep: { name: "Mrs D’Souza", age: "65plus", needs: [], adultPresent: "yes", lastContact: "lt6" },
       address: "Lakeview Colony, block A (fictional)", phone: "00000 66666",
       care: { meds: "Thyroid tablet, morning", routine: "Son-in-law staying with her", allergies: "None known", contacts: "Son-in-law: 00000 66666 (fictional)" } });
  const ishaan = mk({ id: "HO-2394", ward: "w4", createdAt: t0 - 95 * MIN, reporter: "Grandfather, other city",
       dep: { name: "Ishaan", age: "u5", needs: [], adultPresent: "no", lastContact: "lt6" },
       address: "Old Market, Gali 2, house 7 (fictional)", standIn: { name: "Mrs Ali", relation: "Neighbour", phone: "00000 77777", code: "2650" },
       care: { meds: "None", routine: "Drinks milk at 7 and 7", allergies: "None known", contacts: "Grandfather via relay" } });
  ishaan.status = "atdoor"; ishaan.responder = "r4"; ishaan.partner = "r5";
  ishaan.timeline.push({ k: "accepted", t: t0 - 70 * MIN }, { k: "atdoor", t: t0 - 12 * MIN });
  events.push({ t: t0 - 70 * MIN, who: "Joseph M. (responder)", act: "Accepted, paired with Farah K.", id: "HO-2394", note: "" },
              { t: t0 - 70 * MIN, who: "Joseph M. (responder)", act: "Address viewed", id: "HO-2394", note: "Accepted responder" },
              { t: t0 - 12 * MIN, who: "Joseph M. (responder)", act: "At the door", id: "HO-2394", note: "" });
  // two cases already closed today (fictional history)
  const meena = mk({ id: "HO-2361", ward: "w7", createdAt: t0 - 5 * HOUR, reporter: "Aunt, other city",
       dep: { name: "Meena", age: "u5", needs: [], adultPresent: "no", lastContact: "lt6" }, address: "Riverside Road 22 (fictional)",
       standIn: { name: "Mrs Thomas", relation: "Aunt’s friend", phone: "00000 88888", code: "4417" } });
  Object.assign(meena, { status: "closed", outcome: "standin", responder: "r2", partner: "r3", handedTo: "Mrs Thomas", closedAt: t0 - 4 * HOUR, checkin: { due: t0 - 4 * HOUR + 72 * HOUR } });
  meena.timeline.push({ k: "accepted", t: t0 - 4.8 * HOUR }, { k: "atdoor", t: t0 - 4.3 * HOUR }, { k: "outcome", t: t0 - 4 * HOUR });
  const gill = mk({ id: "HO-2356", ward: "w12", createdAt: t0 - 5.5 * HOUR, reporter: "Friend from work",
       dep: { name: "Mr Gill", age: "65plus", needs: ["meds"], adultPresent: "no", lastContact: "6to12" }, address: "Lakeview Main Road 9 (fictional)" });
  Object.assign(gill, { status: "closed", outcome: "notfound", responder: "r6", closedAt: t0 - 4.2 * HOUR, neighbourNote: "the evening before the Snap" });
  gill.timeline.push({ k: "accepted", t: t0 - 5.2 * HOUR }, { k: "atdoor", t: t0 - 4.4 * HOUR }, { k: "outcome", t: t0 - 4.2 * HOUR });
  events.push({ t: t0 - 4 * HOUR, who: "Imran S. (responder)", act: "Handed over to stand-in (code checked)", id: "HO-2361", note: "Mrs Thomas" },
              { t: t0 - 4.2 * HOUR, who: "Vikram D. (responder)", act: "Closed as not found; passed to police", id: "HO-2356", note: "Two neighbours asked" });
  // texts the family and stand-ins would already have received
  for (const c of cases) {
    const due = new Date(c.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    messages.push({ t: c.createdAt + MIN, to: "family", id: c.id, text: `Handover: we have your request ${c.id} for ${c.dep.name}. ${c.prio === "PC" ? "We will phone to confirm within 24 hours." : `Priority ${c.prio}: a verified responder should visit by ${due}.`} Reply STATUS for an update.` });
    if (c.standIn) messages.push({ t: c.createdAt + 2 * MIN, to: "standin", id: c.id, text: `Handover: you have been named to take over care of ${c.dep.name} (${AGE_TEXT[c.dep.age]}). Your code is ${c.standIn.code}. Show it only to the verified responder at the door.` });
  }
  messages.push({ t: t0 - 70 * MIN, to: "family", id: "HO-2394", text: "Handover: Joseph M., a verified responder from Partner NGO, has accepted the check on Ishaan. Farah K. is going too." },
                { t: t0 - 12 * MIN, to: "family", id: "HO-2394", text: "Handover: the responder is at the door for Ishaan." },
                { t: t0 - 4 * HOUR, to: "family", id: "HO-2361", text: "Handover: Meena is now in the care of Mrs Thomas. We will check in again in 72 hours." },
                { t: t0 - 4 * HOUR, to: "standin", id: "HO-2361", text: "Handover: thank you. You are now caring for Meena. The care card is open to you." },
                { t: t0 - 4.2 * HOUR, to: "family", id: "HO-2356", text: "Handover: the responder found nobody at the address for Mr Gill. We have passed everything you told us to the police missing-persons desk." });
  messages.sort((a, b) => a.t - b.t);
  events.sort((a, b) => a.t - b.t);
  return {
    v: 2, seededAt: t0, clock: 0, nextId: 2417, queued: null, myCases: [], sms: null,
    responders: seedResponders(), cases, events, messages,
    // earlier cases today, closed before this demo starts (fictional)
    stats: { due: 14, safe: 12, reports: 61, careAnswered: 55, doorMinutes: [38, 52, 41, 75, 33, 64, 47, 58, 90, 29, 44, 36], wrongCodes: 0,
             hourly: [[4, 0], [9, 1], [12, 2], [10, 3], [8, 2], [7, 2], [6, 1], [5, 1]] },
    surgeN: 0,
  };
}

// ---------- events, messages, timeline ----------
function log(id, who, act, note = "") { db.events.push({ t: now(), who, act, id, note }); }
function text(id, to, body) { db.messages.push({ t: now(), to, id, text: body }); }
function stamp(c, k) { c.timeline.push({ k, t: now() }); }
const isSafe = (c) => ["standin", "adult", "facility"].includes(c.outcome);
const dueBy = (c) => new Date(c.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ---------- case lifecycle ----------
function createCase(d, channel = "web", mine = true) {
  const t = now(), tr = triage(d.dep);
  db.stats.reports += 1; db.stats.careAnswered += 1;
  // merge with an open case for the same person at the same address: duplicate reports add confidence
  const key = (s) => String(s || "").trim().toLowerCase();
  const dup = db.cases.find((c) => c.status !== "closed" && c.ward === d.ward && key(c.dep.name) === key(d.dep.name) && key(c.address) === key(d.address));
  if (dup) {
    dup.reports += 1; dup.timeline.push({ k: "merged", t });
    log(dup.id, channel === "sms" ? "Reporter (SMS)" : "Reporter (web)", "Duplicate report merged", `Now ${dup.reports} reports`);
    if (mine && !db.myCases.includes(dup.id)) db.myCases.push(dup.id);
    save(); return dup;
  }
  const c = {
    id: "HO-" + db.nextId++, ward: d.ward, createdAt: t, prio: tr.prio, autoPrio: tr.prio, reasons: tr.reasons, deadline: t + WINDOW_H[tr.prio] * HOUR,
    status: "open", outcome: null, reports: 1, channel, reporterVerified: d.verified !== false, override: null, flags: [], checkin: null,
    reporter: d.reporter || `${RELATION[d.relation] || "Someone who knows"} ${d.vanished ? "of " + d.vanished : ""}`.trim(), phone: d.phone,
    dep: d.dep, address: d.address, care: d.care || {}, careOriginal: null, responder: null, partner: null, offeredTo: null,
    bumped: d.dep.lastContact === "12plus", lastContactAt: t - CONTACT_H[d.dep.lastContact || "lt6"] * HOUR,
    standIn: null, timeline: [{ k: "received", t }, { k: "triaged", t: t + 1000 }],
  };
  db.cases.push(c); if (mine) db.myCases.push(c.id);
  log(c.id, channel === "sms" ? "Reporter (SMS)" : "Reporter (web)", "Report received", c.reporter + (c.reporterVerified ? ", phone verified" : ", phone not yet verified"));
  log(c.id, "Rules", `Triaged ${TAG_TEXT[c.prio]}`, c.reasons.join("; "));
  text(c.id, "family", `Handover: we have your request ${c.id} for ${c.dep.name}. ${c.prio === "PC" ? "We will phone to confirm within 24 hours." : `Priority ${c.prio}: a verified responder should visit by ${dueBy(c)}.`} Reply STATUS for an update.`);
  if (d.standIn && d.standIn.name && d.standIn.name.trim()) setStandIn(c, d.standIn);
  save(); return c;
}

function setStandIn(c, s) {
  c.standIn = { name: s.name.trim(), relation: (s.relation || "").trim(), phone: (s.phone || "").trim(), code: code4() };
  stamp(c, "standin");
  log(c.id, "Family", "Stand-in named", c.standIn.name);
  text(c.id, "standin", `Handover: you have been named to take over care of ${c.dep.name} (${AGE_TEXT[c.dep.age] || "age unknown"}). Your code is ${c.standIn.code}. Show it only to the verified responder at the door.`);
  save();
}

function accept(c, partnerId) {
  c.status = "accepted"; c.responder = ME; c.partner = partnerId || null; c.offeredTo = null; stamp(c, "accepted");
  const me = responder(ME);
  log(c.id, `${me.name} (responder)`, partnerId ? `Accepted, paired with ${responder(partnerId).name}` : "Accepted", "");
  log(c.id, `${me.name} (responder)`, "Address viewed", "Accepted responder");
  text(c.id, "family", `Handover: ${me.name}, a verified responder from ${ORG[me.org]}, has accepted the check on ${c.dep.name}.`);
  save();
}

function atDoor(c) {
  c.status = "atdoor"; stamp(c, "atdoor");
  log(c.id, `${responder(ME).name} (responder)`, "At the door");
  text(c.id, "family", `Handover: the responder is at the door for ${c.dep.name}.`);
  save();
}

function closeCase(c, r) {
  c.status = "closed"; c.closedAt = now(); stamp(c, "outcome");
  const who = `${responder(c.responder || ME).name} (responder)`;
  if (r.found) {
    c.outcome = r.to;
    c.handedTo = r.to === "standin" ? c.standIn.name : r.to === "adult" ? r.aname : r.place;
    c.condition = { ok: "", supplies: "They needed supplies; the responder flagged this to the ward.", medical: "They needed medical care." }[r.condition];
    c.checkin = { due: c.closedAt + 72 * HOUR };
    log(c.id, who, { standin: "Handed over to stand-in (code checked)", adult: "Handed over to an adult present", facility: "Handed over to hospital or shelter" }[r.to], c.handedTo);
    text(c.id, "family", `Handover: ${c.dep.name} is now in the care of ${c.handedTo}. We will check in again in 72 hours.`);
    if (r.to === "standin") text(c.id, "standin", `Handover: thank you. You are now caring for ${c.dep.name}. The care card is open to you. We will check in on ${new Date(c.checkin.due).toLocaleDateString([], { weekday: "long" })}.`);
  } else {
    c.outcome = "notfound"; c.neighbourNote = r.nnote || "";
    log(c.id, who, "Closed as not found; passed to police", "Two neighbours asked");
    text(c.id, "family", `Handover: the responder found nobody at the address for ${c.dep.name}. We have passed everything you told us to the police missing-persons desk.`);
  }
  save();
}

function wrongCode(c) {
  db.stats.wrongCodes += 1;
  log(c.id, `${responder(ME).name} (responder)`, "Wrong stand-in code entered: handover blocked", "Coordinator alerted");
  save();
}

// coordinator: override the rule result, with a reason
function overridePrio(c, prio, reason) {
  const from = c.prio, t = now();
  c.override = { from, to: prio, reason, t };
  c.prio = prio;
  c.deadline = RANK[prio] < RANK[from] ? Math.min(c.deadline, t + WINDOW_H[prio] * HOUR) : c.createdAt + WINDOW_H[prio] * HOUR;
  stamp(c, "override");
  log(c.id, COORD, `Priority changed ${TAG_TEXT[from]} to ${TAG_TEXT[prio]}`, reason);
  text(c.id, "family", `Handover: the ward coordinator changed the priority for ${c.dep.name} to ${TAG_TEXT[prio]}. ${prio === "PC" ? "We will phone first." : `Visit due by ${dueBy(c)}.`}`);
  save();
}

function offer(c, rid) {
  c.offeredTo = rid;
  log(c.id, COORD, `Asked ${responder(rid).name} to take the case`);
  save();
}

// coordinator: record the result of a phone check
function phoneCheck(c, result, name) {
  if (result === "confirmed") {
    c.status = "closed"; c.closedAt = now(); c.outcome = "adult"; c.handedTo = name; c.checkin = { due: c.closedAt + 72 * HOUR };
    stamp(c, "outcome");
    log(c.id, COORD, "Phone check: adult confirmed and taking over", name);
    text(c.id, "family", `Handover: we phoned and confirmed that ${name} is with ${c.dep.name} and taking over care. We will check in again in 72 hours.`);
  } else {
    const t = triage({ ...c.dep, adultPresent: "no" });
    const to = t.prio === "PC" ? "P3" : t.prio;
    c.reasons = t.prio === "PC" ? ["Phone check failed: visit needed"] : t.reasons.concat("Phone check failed: visit needed");
    c.prio = to; c.deadline = now() + WINDOW_H[to] * HOUR; stamp(c, "tovisit");
    log(c.id, COORD, `Phone check failed: converted to a ${TAG_TEXT[to]} visit`, "No adult confirmed");
    text(c.id, "family", `Handover: we couldn’t confirm an adult with ${c.dep.name} by phone, so a responder will visit by ${dueBy(c)}.`);
  }
  save();
}

function checkinReply(c, reply) {
  c.checkin.reply = reply; c.checkin.t = now();
  const note = { ok: "Still in place and OK", help: "Stand-in needs support", stop: "Stand-in can’t continue: new handover needed" }[reply];
  if (reply !== "ok") c.flags.push(note);
  log(c.id, `${c.standIn ? c.standIn.name : "Carer"} (stand-in)`, "72-hour check-in reply", note);
  save();
}

// family update: an adult is with them now, so the visit becomes a phone check
function familyAdult(c, name) {
  c.dep.adultPresent = "yes";
  c.prio = "PC"; c.reasons = [`Family says ${name} is with them now`, "We confirm by phone before closing"];
  c.deadline = now() + WINDOW_H.PC * HOUR; c.offeredTo = null; stamp(c, "familyupdate");
  log(c.id, "Family", "Update: an adult is with them now", name);
  log(c.id, "Rules", "Changed to a phone check", "Adult reported present");
  text(c.id, "family", `Handover: thank you. The ward coordinator will phone ${name} to confirm, so no responder needs to visit ${c.dep.name} for now.`);
  save();
}

// responder can't go after all: the case goes back to the queue with a reason
function releaseCase(c, reason) {
  const me = responder(ME);
  c.status = "open"; c.responder = null; c.partner = null; stamp(c, "released");
  log(c.id, `${me.name} (responder)`, "Released the case", reason);
  text(c.id, "family", `Handover: the responder can no longer reach ${c.dep.name}, so we are finding another one now. The deadline hasn't changed: ${dueBy(c)}.`);
  save();
}

// stand-in says no from their phone
function standinDecline(c) {
  const s = c.standIn;
  c.declinedStandIn = s; c.standIn = null; c.flags.push("Stand-in declined");
  stamp(c, "declined");
  db.messages.push({ t: now(), to: "from-standin", id: c.id, text: "I can’t take this on" });
  text(c.id, "standin", `Thank you for telling us. Your code for ${c.dep.name} no longer works, and nobody will ask you to take over.`);
  log(c.id, `${s.name} (stand-in)`, "Declined to take over", "Code cancelled");
  text(c.id, "family", `Handover: ${s.name} can’t take over care of ${c.dep.name}. Please name someone else on the tracking page. Until then the responder will choose a safe option, such as a hospital or shelter.`);
  save();
}

// re-handover after a stand-in can't continue (planned after day one; shown as a preview)
function rehandover(c) {
  const inTime = isSafe(c) && c.closedAt <= c.deadline, carer = c.handedTo || "The carer";
  db.stats.due += 1; if (inTime) db.stats.safe += 1;           // keep the first handover in today's numbers
  const t = triage({ ...c.dep, adultPresent: "no" }), to = t.prio === "PC" ? "P3" : t.prio;
  if (c.standIn) c.previousStandIns = (c.previousStandIns || []).concat(c.standIn.name);
  Object.assign(c, { status: "open", outcome: null, handedTo: null, closedAt: null, checkin: null, responder: null, partner: null, standIn: null,
    prio: to, reasons: t.prio === "PC" ? ["New handover needed"] : t.reasons.concat("New handover needed"), deadline: now() + WINDOW_H[to] * HOUR, flags: [] });
  stamp(c, "rehandover");
  log(c.id, COORD, `New handover started (${to})`, "Previous carer can’t continue");
  text(c.id, "family", `Handover: ${carer} can’t keep caring for ${c.dep.name}, so we have started a new handover. A responder should visit by ${dueBy(c)}.`);
  save();
}

// demo: a burst of new reports from all channels
const SURGE = [
  { name: "Zoya", age: "u5", needs: [], contact: "6to12", by: "Aunt, other city", ch: "web" },
  { name: "Mr Bose", age: "65plus", needs: ["meds"], contact: "lt6", by: "Pharmacist", ch: "helpline" },
  { name: "Tara", age: "5to12", needs: [], contact: "12plus", by: "Class teacher", ch: "sms" },
  { name: "Mrs Gupta", age: "65plus", needs: ["dementia"], contact: "6to12", by: "Neighbour", ch: "web" },
  { name: "Arjun", age: "13to17", needs: [], contact: "lt6", by: "Football coach", ch: "sms" },
  { name: "Mr Ahmed", age: "18to64", needs: ["water"], contact: "6to12", by: "Brother, other city", ch: "helpline" },
  { name: "Mrs Lal", age: "65plus", needs: [], contact: "lt6", by: "Daughter-in-law", ch: "web", adult: "yes" },
  { name: "Noor", age: "u5", needs: [], contact: "lt6", by: "Grandmother, other city", ch: "web" },
  { name: "Mr Sen", age: "65plus", needs: ["bedbound"], contact: "12plus", by: "Nephew", ch: "sms" },
  { name: "Kiran", age: "13to17", needs: ["daily"], contact: "6to12", by: "Social worker", ch: "helpline" },
];
const SURGE_WARDS = ["w7", "w4", "w12", "w15", "w4", "w7", "w12", "w15", "w7", "w4"];
function surge(n = 5) {
  const made = [];
  for (let i = 0; i < n; i++) {
    const k = db.surgeN++ % SURGE.length, x = SURGE[k], w = SURGE_WARDS[k];
    const round = Math.floor((db.surgeN - 1) / SURGE.length);
    made.push(createCase({ vanished: "", reporter: x.by, verified: true, caredFor: "yes", ward: w,
      dep: { name: x.name + (round ? ` (${round + 1})` : ""), age: x.age, needs: x.needs.slice(), adultPresent: x.adult || "no", lastContact: x.contact },
      address: `${WARDS[w].name.split(", ")[1]}, house ${10 + db.surgeN} (fictional)`, care: {} }, x.ch, false));
  }
  return made;
}

// 12 hours without contact moves an open case up one level (same rule as triage)
function escalateAll() {
  const t = now(), changed = [];
  for (const c of db.cases) {
    if (c.status === "closed" || c.bumped || c.override || c.prio === "PC") continue;
    if (t - c.lastContactAt < 12 * HOUR) continue;
    c.bumped = true;
    const r = triage({ ...c.dep, lastContact: "12plus" });
    if (RANK[r.prio] >= RANK[c.prio]) continue;
    c.prio = r.prio; c.reasons = r.reasons;
    c.deadline = Math.min(c.deadline, t + WINDOW_H[r.prio] * HOUR);
    stamp(c, "escalated");
    log(c.id, "Rules", `Escalated to ${r.prio}: no contact for 12 hours`, "");
    text(c.id, "family", `Handover: it has now been 12 hours since anyone heard from ${c.dep.name}, so we raised the priority to ${r.prio}. Visit due by ${dueBy(c)}.`);
    changed.push(c);
  }
  if (changed.length) save();
  return changed;
}

// ---------- metrics: definitions match section 4 of the written case ----------
// reports received and handovers in time, hour by hour, for the last 8 hours (fictional history + live data)
function hourly() {
  const t = now(), start = new Date(t); start.setMinutes(0, 0, 0);
  const rows = [];
  for (let i = 7; i >= 0; i--) {
    const from = start.getTime() - i * HOUR, to = from + HOUR;
    const hist = db.stats.hourly[7 - i] || [0, 0];
    const rep = db.events.filter((e) => e.act === "Report received" && e.t >= from && e.t < to && e.t > db.seededAt).length;
    const ok = db.cases.filter((c) => c.status === "closed" && isSafe(c) && c.closedAt >= from && c.closedAt < to && c.closedAt <= c.deadline && c.closedAt > db.seededAt).length;
    rows.push({ label: new Date(from).toLocaleTimeString([], { hour: "numeric" }), reports: hist[0] + rep, safe: hist[1] + ok });
  }
  return rows;
}

function metric() {
  const t = now();
  let due = db.stats.due, safe = db.stats.safe, open = 0, late = 0;
  const byPrio = { P1: [0, 0], P2: [0, 0], P3: [0, 0], PC: [0, 0] }, byWard = {};
  for (const w in WARDS) byWard[w] = [0, 0];
  for (const c of db.cases) {
    let isDue = false, ok = false;
    if (c.status === "closed") { isDue = true; ok = isSafe(c) && c.closedAt <= c.deadline; }
    else { open++; if (c.deadline < t) { late++; isDue = true; } }
    if (!isDue) continue;
    due++; if (ok) safe++;
    byPrio[c.prio][0]++; if (ok) byPrio[c.prio][1]++;
    byWard[c.ward][0]++; if (ok) byWard[c.ward][1]++;
  }
  const door = db.stats.doorMinutes.slice();
  for (const c of db.cases) {
    const a = c.timeline.find((e) => e.k === "atdoor");
    if (a) door.push(Math.round((a.t - c.createdAt) / MIN));
  }
  door.sort((a, b) => a - b);
  const median = door.length ? (door.length % 2 ? door[(door.length - 1) / 2] : Math.round((door[door.length / 2 - 1] + door[door.length / 2]) / 2)) : 0;
  const checkins = db.cases.filter((c) => c.checkin && c.checkin.reply);
  const addressUnaccepted = db.events.filter((e) => e.act === "Address viewed" && !/Accepted responder|Ward coordinator/.test(e.note)).length;
  return {
    due, safe, open, late, pct: due ? Math.round((safe / due) * 100) : 0, byPrio, byWard,
    detection: Math.round((db.stats.careAnswered / db.stats.reports) * 100), reports: db.stats.reports, careAnswered: db.stats.careAnswered,
    medianDoor: median, doorN: door.length,
    checkinReplies: checkins.length, checkinOk: checkins.filter((c) => c.checkin.reply === "ok").length,
    addressUnaccepted, wrongCodes: db.stats.wrongCodes,
  };
}
