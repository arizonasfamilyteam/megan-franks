(() => {
"use strict";
const CFG = window.SITE_CONFIG || {};
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const data = f => Object.fromEntries(new FormData(f));
let uid = 0;

/* Build chip radio groups from data-opts */
$$("[data-opts]").forEach(fs => {
  const box = $(".chips", fs);
  fs.dataset.opts.split("|").forEach(o => {
    const id = "c" + (++uid);
    box.insertAdjacentHTML("beforeend", `<label class="chip" for="${id}"><input type="radio" id="${id}" name="${fs.dataset.name}" value="${esc(o)}"><span>${esc(o)}</span></label>`);
  });
});

/* Validation */
function check(root) {
  let ok = true, first = null;
  $$("[data-req]", root).forEach(f => {
    let msg = "";
    if (f.matches("fieldset")) { if (!$("input:checked", f)) msg = f.dataset.req; }
    else {
      const v = f.type === "checkbox" ? (f.checked ? "1" : "") : f.value.trim();
      if (!v) msg = f.dataset.req;
      else if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = "Enter a valid email address, like name@example.com.";
      else if (f.type === "tel" && v.replace(/\D/g, "").length < 10) msg = "Enter a phone number with at least 10 digits.";
      else if (f.hasAttribute("data-zip") && !/^\d{5}$/.test(v)) msg = "Enter a 5-digit ZIP code.";
      f.setAttribute("aria-invalid", !!msg);
    }
    const err = (f.closest(".field") || {querySelector: () => null}).querySelector(".err");
    if (err) err.textContent = msg;
    if (msg) { ok = false; first = first || f; }
  });
  if (first) (first.matches("fieldset") ? $("input", first) : first.type === "hidden" ? $("#cal button:not(:disabled)") : first).focus();
  return ok;
}

/* Submission (single centralized function) */
const ids = {}, busy = {};
const newId = k => ids[k] = "MF-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
["lead", "val", "sched"].forEach(newId);

async function submitLead(kind, form, payload, btn) {
  const out = $(".formerr", form); out.textContent = "";
  if (busy[kind]) return false;                       // prevent duplicate submissions
  busy[kind] = true; btn.disabled = true; btn.classList.add("loading");
  const label = btn.textContent; btn.textContent = "Sending";
  try {
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(CFG.APPS_SCRIPT_URL || ""))
      throw new Error("This form is not connected to Google Sheets yet (add the Web App URL in js/config.js).");
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 60000);
    let res;
    try {
      res = await fetch(CFG.APPS_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ ...payload, leadId: ids[kind], pageUrl: location.href }), signal: ctrl.signal });
    } finally { clearTimeout(t); }
    if (!res.ok) throw new Error("The server returned an error (" + res.status + ").");
    const j = await res.json().catch(() => null);
    if (!j || !j.ok) throw new Error((j && j.error) || "The server did not confirm your request.");
    return true;
  } catch (e) {
    out.textContent = "We could not send your request. " + (e.name === "AbortError" ? "The request timed out. " : e.message + " ") + "Check your connection and try again.";
    out.scrollIntoView({ block: "center" });
    return false;                                      // never show success on failure
  } finally { busy[kind] = false; btn.disabled = false; btn.classList.remove("loading"); btn.textContent = label; }
}

/* Success dialog */
const dlg = $("#success");
function done(rows, note) {
  $("#sumList").innerHTML = rows.filter(r => r[1]).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  $("#sumNote").textContent = note || "";
  dlg.showModal();
}
$("#homeBtn").onclick = () => { dlg.close(); scrollTo({ top: 0, behavior: "smooth" }); };
$("#communities").href = CFG.COMMUNITIES_URL || "https://www.visitarizona.com/";

const base = (d, o) => ({ name: d.name, email: d.email, phone: d.phone, contactMethod: d.contactMethod || "", goal: "", address: "", city: "", zip: "",
  propertyType: "", bedrooms: "", bathrooms: "", sqft: "", condition: "", timeline: "", notes: "", consultDate: "", consultTime: "", meetingPref: "", photos: [], website: d.website || "", ...o });

/* ---------- Multi-step seller form ---------- */
const lead = $("#leadForm"), panes = $$(".step", lead);
let step = 1; const photos = [];
const sumRows = d => [["Goal", d.goal], ["Property", [d.address, d.city, d.zip].filter(Boolean).join(", ")], ["Type", d.propertyType],
  ["Bedrooms", d.bedrooms], ["Bathrooms", d.bathrooms], ["Square feet", d.sqft], ["Condition", d.condition],
  ["Photos", photos.length ? photos.length + " attached" : ""], ["Timeline", d.timeline], ["Notes", d.notes],
  ["Name", d.name], ["Email", d.email], ["Phone", d.phone], ["Preferred contact", d.contactMethod]];
const renderSum = () => { $("#liveSum").innerHTML = sumRows(data(lead)).filter(r => r[1]).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join(""); };

function show(n, scroll = true) {
  step = n;
  panes.forEach(p => p.hidden = +p.dataset.step !== n);
  $("#bar").style.width = n * 25 + "%";
  $("#progress").setAttribute("aria-valuenow", n);
  $$("#steps li").forEach((li, i) => { li.classList.toggle("on", i + 1 === n); li.classList.toggle("done", i + 1 < n); li.setAttribute("aria-current", i + 1 === n ? "step" : "false"); });
  $(".back", lead).hidden = n === 1; $(".next", lead).hidden = n === 4; $(".submit", lead).hidden = n !== 4;
  if (n === 4) renderSum();
  if (scroll) $("#start").scrollIntoView({ behavior: "smooth" });
}
$(".next", lead).onclick = () => { if (check(panes[step - 1])) show(step + 1); };
$(".back", lead).onclick = () => show(step - 1);
lead.addEventListener("input", () => step === 4 && renderSum());
lead.addEventListener("change", () => step === 4 && renderSum());
lead.addEventListener("submit", async e => {
  e.preventDefault();
  if (step < 4) { $(".next", lead).click(); return; }
  if (!check(panes[3])) return;
  const d = data(lead); if (d.website) return;
  const ok = await submitLead("lead", lead, base(d, { ...d, goal: d.goal, photos: photos.map(p => p.url), source: "Website - Seller Consultation Form" }), $(".submit", lead));
  if (ok) { done(sumRows(d)); lead.reset(); photos.length = 0; renderPhotos(); show(1, false); newId("lead"); }
});

/* Photos: resize in browser, preview, remove */
async function shrink(file) {
  const bmp = await createImageBitmap(file), r = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.72);
}
function renderPhotos() {
  $("#previews").innerHTML = photos.map((p, i) => `<figure><img src="${p.url}" alt="Uploaded photo ${i + 1}"><button type="button" data-i="${i}" aria-label="Remove photo ${i + 1}">×</button></figure>`).join("");
}
$("#photoBtn").onclick = () => $("#photoInput").click();
$("#photoInput").onchange = async e => {
  const err = $("#photoErr"); err.textContent = "";
  for (const f of e.target.files) {
    if (photos.length >= 6) { err.textContent = "You can add up to 6 photos."; break; }
    if (!f.type.startsWith("image/")) { err.textContent = f.name + " is not an image."; continue; }
    try { photos.push({ url: await shrink(f) }); } catch { err.textContent = f.name + " could not be read. Try a JPG or PNG."; }
  }
  e.target.value = ""; renderPhotos();
};
$("#previews").onclick = e => { const b = e.target.closest("button"); if (b) { photos.splice(+b.dataset.i, 1); renderPhotos(); } };

/* ---------- Valuation request ---------- */
const val = $("#valForm");
val.addEventListener("submit", async e => {
  e.preventDefault(); if (!check(val)) return;
  const d = data(val); if (d.website) return;
  const rows = [["Name", d.name], ["Email", d.email], ["Phone", d.phone], ["Property", d.address], ["Type", d.propertyType], ["Bedrooms", d.bedrooms], ["Bathrooms", d.bathrooms], ["Square feet", d.sqft], ["Condition", d.condition]];
  const ok = await submitLead("val", val, base(d, { ...d, goal: "Find Out My Home's Value", source: "Website - Home Valuation Request" }), $("[type=submit]", val));
  if (ok) { done(rows, "Megan will prepare a comparative market analysis for your home."); val.reset(); newId("val"); }
});

/* ---------- Interactive calendar + schedule request ---------- */
const sched = $("#schedForm"), dateEl = $("#date");
let view = new Date(); view.setDate(1); view.setHours(0, 0, 0, 0);
const today = new Date(); today.setHours(0, 0, 0, 0);
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
function cal() {
  const y = view.getFullYear(), m = view.getMonth(), lead0 = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate();
  const atStart = y === today.getFullYear() && m === today.getMonth();
  let h = `<div class="calhead"><button type="button" data-nav="-1" aria-label="Previous month" ${atStart ? "disabled" : ""}>‹</button><strong aria-live="polite">${view.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong><button type="button" data-nav="1" aria-label="Next month">›</button></div><div class="grid">`
    + "SMTWTFS".split("").map(c => `<span class="dow" aria-hidden="true">${c}</span>`).join("") + "<span></span>".repeat(lead0);
  for (let d = 1; d <= n; d++) {
    const dt = new Date(y, m, d), v = iso(y, m, d);
    h += `<button type="button" class="day${v === dateEl.value ? " sel" : ""}" data-d="${v}" aria-pressed="${v === dateEl.value}" aria-label="${dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}" ${dt <= today ? "disabled" : ""}>${d}</button>`;
  }
  $("#cal").innerHTML = h + "</div>";
}
$("#cal").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.nav) { view.setMonth(view.getMonth() + +b.dataset.nav); cal(); return; }
  dateEl.value = b.dataset.d; dateEl.setAttribute("aria-invalid", "false"); dateEl.closest(".field").querySelector(".err").textContent = ""; cal();
};
cal();
sched.addEventListener("submit", async e => {
  e.preventDefault(); if (!check(sched)) return;
  const d = data(sched); if (d.website) return;
  const [y, m, dd] = d.consultDate.split("-").map(Number);
  const pretty = new Date(y, m - 1, dd).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const ok = await submitLead("sched", sched, base(d, { ...d, goal: "Schedule a consultation", source: "Website - Schedule Request" }), $("[type=submit]", sched));
  if (ok) {
    done([["Name", d.name], ["Email", d.email], ["Phone", d.phone], ["Requested date", pretty], ["Requested time", d.consultTime + " (Arizona time)"], ["Meeting", d.meetingPref]], "This is an appointment request. Megan will confirm the time with you.");
    sched.reset(); dateEl.value = ""; cal(); newId("sched");
  }
});
})();
