"use strict";
/* Event wiring, demo controls, guided tour and boot. */

ui.offline = false;
let lastRoute = location.hash;

document.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-act]");
  if (!b || !ACT[b.dataset.act]) return;
  if (b.tagName !== "A") ev.preventDefault();
  ACT[b.dataset.act](b, ev);
});

document.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const f = ev.target;
  if (SUBMIT[f.id]) SUBMIT[f.id](f);
});

const LIVE_RADIOS = ["found", "condition", "to", "newprio", "pcresult"];
function onField(ev) {
  const el = ev.target;
  if (el.id === "offline" || el.id === "near") {          // checkboxes fire input and change: act once
    if (ev.type !== "change") return;
    if (el.id === "offline") return onNetwork(el.checked);
    ui.near = el.checked; render(false); $("#near").focus(); return;
  }
  if (el.id === "logq") { ui.logFilter = el.value; filterLog(); return; }
  if (el.dataset.check) { ui.check[el.dataset.check] = el.type === "checkbox" ? el.checked : el.value; return; }
  if (el.type === "radio" && !el.dataset.bind && LIVE_RADIOS.includes(el.name)) {
    if (ev.type !== "change") return;
    ui.check[el.name] = el.value; delete ui.errors[el.name];
    render(false); $(`input[name="${el.name}"][value="${el.value}"]`)?.focus(); return;
  }
  const path = el.dataset.bind; if (!path || !ui.draft) return;
  const keys = path.split("."), last = keys.pop(), obj = keys.reduce((o, k) => o[k], ui.draft);
  if (el.type === "checkbox") {
    const arr = obj[last];
    if (el.checked && !arr.includes(el.value)) arr.push(el.value);
    if (!el.checked && arr.includes(el.value)) arr.splice(arr.indexOf(el.value), 1);
  } else obj[last] = el.value;
  if (path.startsWith("dep.") && $("#triage-preview")) $("#triage-preview").innerHTML = triagePreview();
}
document.addEventListener("input", onField);
document.addEventListener("change", onField);

window.addEventListener("hashchange", () => {
  const p = parts();
  ui.errors = {}; ui.check = {}; ui.standinScreen = "inbox";
  if (p[0] === "report" && lastRoute !== location.hash && (ui.reportState === "nocare" || (ui.reportState === "queued" && !db.queued))) { ui.reportState = "form"; ui.step = 1; }
  lastRoute = location.hash;
  render();
});

// ---------- demo controls (not part of the product) ----------
function onNetwork(off) {
  ui.offline = off;
  if (off) { toast("Network off (simulated). Web reports will be saved on the device."); render(false); return; }
  if (db.queued) {
    const d = db.queued; db.queued = null;
    const c = createCase(d);
    ui.draft = emptyDraft(); ui.step = 1; ui.otp = null; ui.reportState = "form";
    go(`#/track/${c.id}`); toast(`Back online. Your saved request was sent as ${c.id}.`);
  } else { toast("Back online."); render(false); }
}

function advance(hours) {
  db.clock += hours * HOUR;
  const changed = escalateAll(); save(); render(false);
  toast(`Clock moved forward ${hours} hour${hours > 1 ? "s" : ""}. ${changed.length ? `${changed.length} case${changed.length > 1 ? "s" : ""} escalated after 12 hours without contact: ${changed.map((c) => c.dep.name).join(", ")}.` : "No case crossed 12 hours without contact."}`);
}

$("#plus1h").addEventListener("click", () => advance(1));
$("#reset").addEventListener("click", () => {
  try { localStorage.removeItem(KEY); } catch (e) {}
  db = seed();
  Object.assign(ui, { step: 1, errors: {}, draft: emptyDraft(), otp: null, reportState: "form", filter: "all", near: false, check: {}, wardFilter: "", caseFilter: "open", showAddress: {}, logFilter: "", translated: {}, standinScreen: "inbox", offline: false, pcActive: null, consoleView: "table", respView: "list" });
  render(false); toast("Demo data reset.");
});

const guide = $("#guide");
ACT["open-guide"] = () => guide.showModal();
$("#guide-open").addEventListener("click", () => guide.showModal());
$("#guide-close").addEventListener("click", () => guide.close());
guide.addEventListener("click", (ev) => { if (ev.target === guide) guide.close(); });

const TOUR = {
  report() { ACT["new-report"](); ui.draft = JSON.parse(JSON.stringify(EXAMPLE)); go("#/report"); toast("Example filled in. Press Continue on each step."); },
  sms() { db.sms = null; save(); go("#/sms"); },
  responder() { go("#/responder"); },
  standin() { go("#/standin"); },
  override() { go("#/coordinator/case/HO-2385"); },
  phone() { go("#/coordinator/phone"); },
  escalate() { go("#/coordinator"); setTimeout(() => advance(2), 50); },
  offline() { ui.offline = true; ACT["new-report"](); ui.draft = JSON.parse(JSON.stringify(EXAMPLE)); ui.step = 3; go("#/report"); toast("Network off (simulated). Press Send request."); },
  metrics() { go("#/coordinator/metrics"); },
  map() { ui.consoleView = "map"; go("#/coordinator"); },
  surge() { ui.consoleView = "table"; go("#/coordinator"); setTimeout(() => ACT.surge(), 50); },
  decline() { const c = db.cases.find((x) => x.standIn && x.status !== "closed"); go(c ? `#/standin/${c.id}` : "#/standin"); },
  release() {
    const c = byId("HO-2398");
    if (c.status === "open") accept(c, "r2");
    go(`#/responder/case/${c.id}`); toast("Riya’s case is accepted for you. Open “I can’t go after all” at the bottom.");
  },
};
ACT.tour = (b) => { guide.close(); TOUR[b.dataset.t](); };

// ---------- boot ----------
try { if (localStorage.getItem("handover-text") === "large") document.documentElement.classList.add("large"); } catch (e) {}
setInterval(() => { if (escalateAll().length) render(false); else tick(); }, 15000);
escalateAll();
render(false);
window.__handover = { triage, metric, escalateAll, db: () => db };   // exposed for the automated tests only
