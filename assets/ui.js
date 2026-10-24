"use strict";
/* Shared UI helpers, components and the hash router. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const digits = (s) => String(s || "").replace(/\D/g, "");
function fmtLeft(deadline) {
  const ms = deadline - now(), m = Math.round(Math.abs(ms) / MIN);
  const txt = m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
  return ms >= 0 ? `${txt} left` : `${txt} overdue`;
}
function ago(t) { const m = Math.round((now() - t) / MIN); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`; }

// transient UI state (not saved)
const ui = {
  step: 1, errors: {}, draft: null, otp: null,
  filter: "all", near: false, check: {}, wardFilter: "", showAddress: {}, logFilter: "",
  translated: {}, standinScreen: "inbox", smsDraft: "",
};

// ---------- components ----------
const LOGO = `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="6" fill="#1a4fa3"/><path d="M10 8h11.5A1.5 1.5 0 0 1 23 9.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-5-6z" fill="#fff"/><circle cx="10.5" cy="14" r="1.9" fill="#ffc72c"/></svg>`;
const tag = (p, cls = "") => `<span class="tag ${p} ${cls}"><span class="sr">Priority </span>${TAG_TEXT[p] || p}</span>`;
const left = (c) => c.status === "closed" ? `<span class="pill">Closed ${fmtTime(c.closedAt)}</span>` : `<span class="left" data-deadline="${c.deadline}">${fmtLeft(c.deadline)}</span>`;
const depLine = (d) => `${esc(d.name || "Unnamed")}, ${AGE_TEXT[d.age] || "age unknown"}`;
const note = (kind, html, role = "") => `<div class="note ${kind}" ${role ? `role="${role}"` : ""}>${html}</div>`;
const errText = (id) => (ui.errors[id] ? `<div class="err" id="${id}-err">${esc(ui.errors[id])}</div>` : "");
const invalid = (id) => (ui.errors[id] ? `aria-invalid="true" aria-describedby="${id}-err"` : "");
function field(id, label, control, hint = "") {
  return `<div class="field"><label class="lbl" for="${id}">${label}</label>${hint ? `<p class="hint">${hint}</p>` : ""}${control}${errText(id)}</div>`;
}
function input(id, bind, value, extra = "") {
  return `<input type="text" id="${id}" ${bind ? `data-bind="${bind}"` : ""} value="${esc(value)}" autocomplete="off" ${invalid(id)} ${extra}>`;
}
function radios(name, options, current, { cols = false, bind = "", legend = "", hint = "" } = {}) {
  return `<fieldset ${ui.errors[name] ? `aria-describedby="${name}-err"` : ""}>${legend ? `<legend>${legend}</legend>` : ""}${hint ? `<p class="hint">${hint}</p>` : ""}
    <div class="choices ${cols ? "cols" : ""}">${options.map(([v, t]) =>
      `<label class="choice"><input type="radio" name="${name}" value="${v}" ${bind ? `data-bind="${bind}"` : ""} ${current === v ? "checked" : ""}><span>${t}</span></label>`).join("")}</div>${errText(name)}</fieldset>`;
}
function select(id, bind, options, current, placeholder = "Choose…") {
  return `<select id="${id}" ${bind ? `data-bind="${bind}"` : ""} ${invalid(id)}><option value="">${placeholder}</option>${options.map(([v, t]) => `<option value="${v}" ${current === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
}
function errSummary() {
  const n = Object.keys(ui.errors).length;
  return n ? note("bad", `<b>Please fix ${n} thing${n > 1 ? "s" : ""} below.</b>`, "alert") : "";
}
function statusText(c) {
  if (c.status === "closed") return c.outcome === "notfound" ? "Not found: with police" : `Handed over to ${c.handedTo}`;
  if (c.status === "atdoor") return "Responder at the door";
  if (c.status === "accepted") return "Responder on the way";
  if (c.prio === "PC") return "Waiting for phone check";
  return c.offeredTo ? `Offered to ${responder(c.offeredTo).name}` : "Waiting for a responder";
}

let toastTimer;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 4200); }

// ---------- router ----------
const parts = () => location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
const roleOf = (p) => (["responder", "coordinator", "standin", "sms"].includes(p[0]) ? p[0] : "family");
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

const VIEW = {};       // role -> (parts) => html for <main>
const HEADER = {};     // role -> (parts) => html for the product header
const ACT = {};        // data-act handlers
const SUBMIT = {};     // form id -> handler(form)

function render(focus = true) {
  const p = parts(), role = roleOf(p);
  document.body.dataset.role = role;
  $$(".roles a").forEach((a) => a.setAttribute("aria-current", String(a.dataset.role === role)));
  $("#product-head").innerHTML = HEADER[role](p);
  $("#app").innerHTML = VIEW[role](p);
  $("#site-foot").hidden = role !== "family";
  $("#clock").textContent = fmtTime(now()) + (db.clock ? ` (+${Math.round(db.clock / HOUR)} h)` : "");
  $("#offline").checked = !!ui.offline;
  if (focus) {
    const h = $("#app h1");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
  }
  const th = $(".thread"); if (th) th.scrollTop = th.scrollHeight;
  tick();
}

// refresh countdowns without re-rendering forms
function tick() {
  $$("[data-deadline]").forEach((el) => {
    const d = +el.dataset.deadline, l = d - now();
    el.textContent = fmtLeft(d);
    el.classList.toggle("late", l < 0);
    el.classList.toggle("soon", l >= 0 && l < 30 * MIN);
  });
  $$("[data-since]").forEach((el) => { el.textContent = "updated " + ago(+el.dataset.since); });
}

// ---------- schematic ward map: pins show the ward, never the address ----------
const MAP = {
  w15: { pts: "16,16 384,16 362,140 200,160 16,128", c: [200, 78], lx: 30, ly: 40 },
  w7:  { pts: "16,128 200,160 232,384 16,384", c: [118, 272], lx: 30, ly: 366 },
  w4:  { pts: "200,160 362,140 404,262 336,384 232,384", c: [298, 268], lx: 250, ly: 366 },
  w12: { pts: "384,16 584,16 584,384 336,384 404,262 362,140", c: [484, 118], lx: 470, ly: 40 },
};
const PIN_FILL = { P1: "#b3261e", P2: "#a35400", P3: "#2b6e35", PC: "#505c69" };
function hashN(s) { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
function pinXY(id, ward, spread = 46) {
  const [x, y] = MAP[ward].c, h = hashN(id), a = (h % 360) * Math.PI / 180, r = 12 + ((h >>> 9) % spread);
  return [Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.75)];
}
// spread pins so none overlap: try the hashed spot, then walk outwards around the ward centre
function placer() {
  const placed = [];
  return (id, ward, gap) => {
    let [x, y] = pinXY(id, ward);
    const h = hashN(id), [cx, cy] = MAP[ward].c;
    for (let k = 0; k < 14 && placed.some(([a, b]) => Math.hypot(a - x, b - y) < gap); k++) {
      const ang = ((h % 360) + k * 51) * Math.PI / 180, r = 16 + k * 6;
      x = Math.round(cx + Math.cos(ang) * r); y = Math.round(cy + Math.sin(ang) * r * 0.75);
    }
    placed.push([x, y]); return [x, y];
  };
}
function mapSVG(cases, hrefFor, { selected = null, me = null, responders = false } = {}) {
  const place = placer();
  const pinAt = Object.fromEntries(cases.map((c) => [c.id, place(c.id, c.ward, 30)]));
  const wards = Object.entries(MAP).map(([k, m]) => `<polygon points="${m.pts}" fill="${ui.wardFilter === k ? "#dbe6f6" : "#f7f9fb"}" stroke="#b9c3ce" stroke-width="1.5"/>
    <text x="${m.lx}" y="${m.ly}" font-size="13" font-weight="600" fill="#4a5866" font-family="Bahnschrift, DIN Alternate, Arial Narrow, sans-serif">${esc(WARDS[k].name)}</text>`).join("");
  const scenery = `<path d="M 70 130 C 110 190, 60 250, 120 300 S 170 360, 150 384" fill="none" stroke="#a9c7ea" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="496" cy="262" rx="60" ry="36" fill="#cfe0f4"/><text x="472" y="266" font-size="11" fill="#4a5866">Lake</text>
    <path d="M 120 70 q 40 -26 80 0 M 240 60 q 40 -26 80 0 M 170 110 q 40 -22 80 0" fill="none" stroke="#c8cfd6" stroke-width="1.5"/>
    <path d="M 200 160 L 336 384 M 16 220 L 584 200" stroke="#e1e6ec" stroke-width="5"/>`;
  const crew = responders ? db.responders.filter((r) => r.status !== "offline").map((r) => {
    const [x, y] = place(r.id + "r", r.ward, 22);
    return `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" rx="2" fill="#1a4fa3" stroke="#fff" stroke-width="1.5"><title>${esc(r.name)}, responder${r.status === "busy" ? ", on a case" : ""}</title></rect>`;
  }).join("") : "";
  const you = me ? (() => { const [x, y] = pinXY("me", me, 10); return `<g><circle cx="${x}" cy="${y}" r="13" fill="#1a4fa3" opacity=".18"/><circle cx="${x}" cy="${y}" r="6" fill="#1a4fa3" stroke="#fff" stroke-width="2"/><text x="${x + 10}" y="${y - 9}" font-size="11" font-weight="600" fill="#1a4fa3">You</text></g>`; })() : "";
  const pins = cases.map((c) => {
    const [x, y] = pinAt[c.id], sel = selected === c.id, late = c.deadline < now();
    return `<a href="${hrefFor(c)}" aria-label="${esc(`${TAG_TEXT[c.prio]}, ${c.dep.name}, ${WARDS[c.ward].name}, ${fmtLeft(c.deadline)}`)}">
      ${sel ? `<circle cx="${x}" cy="${y}" r="20" fill="none" stroke="#15212c" stroke-width="2.5"/>` : ""}
      ${late ? `<circle cx="${x}" cy="${y}" r="18" fill="none" stroke="#b3261e" stroke-width="2" stroke-dasharray="3 3"/>` : ""}
      <circle cx="${x}" cy="${y}" r="14" fill="${PIN_FILL[c.prio]}" stroke="#fff" stroke-width="2.5"/>
      <text x="${x}" y="${y + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">${c.prio === "PC" ? "" : c.prio[1]}</text>
      <title>${esc(`${TAG_TEXT[c.prio]}: ${c.dep.name}, ${fmtLeft(c.deadline)}`)}</title></a>`;
  }).join("");
  return `<div class="map"><svg viewBox="0 0 600 400" role="group" aria-label="Map of wards with ${cases.length} case${cases.length === 1 ? "" : "s"}">${wards}${scenery}${crew}${you}${pins}</svg>
    <div class="legend small"><span><i style="background:${PIN_FILL.P1}"></i>P1</span><span><i style="background:${PIN_FILL.P2}"></i>P2</span><span><i style="background:${PIN_FILL.P3}"></i>P3</span><span><i style="background:${PIN_FILL.PC}"></i>Phone check</span>${responders ? `<span><i class="sq"></i>Responder</span>` : ""}<span><i class="late"></i>Past its window</span></div>
    <p class="small muted" style="margin:.4rem 0 0">Pins show the ward only, placed at random inside it. Exact addresses never appear on the map.</p></div>`;
}
