import { clinicNameOf, purposeOptions } from "./reducer";
import type { QueueState } from "./types";

// The patients' QR pages (check-in and the queue number), as small self-contained pages: one HTML file with its style and
// script inside, about 20 KB, so they open at once on every phone (older iPhones too) without the app's JavaScript.

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

const STYLE = `
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:#f7f4ed;color:#2e291f;font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
header{background:#2f281c;color:#fff;padding:14px 20px}
.hd{max-width:28rem;margin:0 auto;display:flex;align-items:center;gap:12px}
.hd img{width:30px;height:40px;object-fit:contain}
.hd small{display:block;color:#f0c864;font-size:12px;font-weight:600;letter-spacing:.08em}
.hd b{font-size:18px}
main{max-width:28rem;margin:0 auto;padding:22px 20px 40px}
h1{font-size:24px;line-height:1.2;margin:0;letter-spacing:-.01em}
.lead{margin:6px 0 0;color:#6a604f}
.tabs{display:flex;gap:4px;margin-top:18px;padding:4px;border-radius:12px;background:#ece4d3}
.tabs button{flex:1;height:44px;border:0;border-radius:9px;background:transparent;color:#756b59;font:inherit;font-size:14px;font-weight:700}
.tabs button[aria-selected=true]{background:#fff;color:#2f281c;box-shadow:0 1px 2px rgba(0,0,0,.08)}
form{display:grid;gap:18px;margin-top:22px}
label{display:grid;gap:6px;font-size:14px;font-weight:600;color:#514838}
label em,legend em{font-style:normal;font-weight:400;color:#857967}
input{height:48px;border:1px solid #d8c79f;border-radius:12px;background:#fff;padding:0 12px;font:inherit;font-size:16px;color:#2e291f;width:100%}
input.mono{font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.03em}
fieldset{border:0;margin:0;padding:0}legend{font-size:14px;font-weight:600;color:#514838;margin-bottom:8px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips button{min-height:44px;border:1px solid #d8c79f;border-radius:999px;background:#fff;color:#514838;padding:8px 16px;font:inherit;font-size:14px;font-weight:600}
.chips button[aria-pressed=true]{border-color:#8b6512;background:#8b6512;color:#fff}
.go{height:56px;border:0;border-radius:12px;background:#8b6512;color:#fff;font:inherit;font-size:18px;font-weight:600}
.go.teal{background:#1f7a70}.go:disabled{opacity:.6}
.err{margin:0;color:#b4233c;font-size:14px;font-weight:600}
.fine{margin:0;color:#857967;font-size:12px;line-height:1.6}
.hidden{display:none!important}
.mine{display:flex;align-items:center;gap:14px;margin-top:22px;padding:18px;border-radius:18px;background:#2f281c;color:#fff;text-decoration:none}
.mine span{flex:1}.mine small{display:block;color:#e8dec7;font-size:13px}.mine b{font:800 30px ui-monospace,Menlo,Consolas,monospace}
.num{border-radius:18px;background:#2f281c;color:#fff;text-align:center;padding:24px}
.num small{display:block;color:#f0c864;font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase}
.num b{display:block;margin-top:8px;font:800 46px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.03em}
.num span{display:block;margin-top:8px;color:#e8dec7;font-size:14px}
.msg{margin-top:16px;border-radius:18px;padding:16px}
.msg p{margin:0}.msg .t{font-size:18px;font-weight:700}.msg .x{font-size:14px;margin-top:2px}
.msg.turn{background:#d8a321;color:#2f281c;box-shadow:0 0 0 4px rgba(216,163,33,.4)}
.msg.waiting{background:#fff2c8;color:#5f4307}.msg.missed{background:#fde8eb;color:#9b1f35}
.msg.expected{background:#dff1ef;color:#1d5a56}.msg.done{background:#edf5e8;color:#41612c}
.place{display:inline-block;margin-left:4px;border-radius:6px;background:#2f281c;color:#f0c864;padding:1px 8px;font-weight:700}
.ok{margin-top:12px;width:100%;height:48px;border:0;border-radius:12px;background:#2f281c;color:#f0c864;font:inherit;font-weight:700}
.card{margin-top:12px;border:1px solid #e2d7c2;border-radius:18px;background:#fff;padding:16px}
.card .k{margin:0;color:#756b59;font-size:14px;font-weight:600}.card .v{margin:2px 0 0;font-size:24px;font-weight:800}.card .n{margin:4px 0 0;color:#857967;font-size:12px}
.snd{margin-top:12px;display:flex;gap:12px;width:100%;border:2px dashed #c9962b;border-radius:18px;background:#fff;padding:14px;text-align:left;font:inherit;color:#2f281c}
.snd b{display:block}.snd span{display:block;font-size:14px;color:#6a604f}
.sndon{margin-top:12px;text-align:center;font-size:14px;color:#41612c}.sndon button{border:0;background:none;color:#8b6512;font:inherit;font-weight:600;text-decoration:underline}
ol{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:8px}
ol li{display:flex;align-items:center;gap:12px;border:1px solid #e2d7c2;border-radius:12px;background:#fff;padding:12px 14px}
ol i{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#f2ecdf;color:#857967;font-style:normal;font-weight:700;font-size:14px}
ol li.current i{background:#2f281c;color:#f0c864}ol li.done i{background:#edf5e8;color:#41612c}
ol span{flex:1}ol code{color:#756b59;font-size:13px}
.foot{margin-top:24px;text-align:center;color:#857967;font-size:12px}
`;

const shell = (title: string, clinic: string, body: string, script: string) => `<!doctype html>
<html lang="en-PH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#2f281c"><title>${esc(title)} · ${esc(clinic)}</title><link rel="icon" href="/favicon.svg">
<style>${STYLE}</style></head><body>
<header><div class="hd"><img src="/logo-small.png" alt="" width="30" height="40"><div><small>${esc(clinic.toUpperCase())}</small><b>Queue</b></div></div></header>
<main>${body}</main>
<script>${script}</script></body></html>`;

// Shared by both pages: the ticket saved on the phone (same key as before), and a small fetch helper with a timeout.
const COMMON = `
var TICKET_KEY = "thsc-queue-ticket";
function readTicket() { try { return JSON.parse(localStorage.getItem(TICKET_KEY) || "null"); } catch (e) { return null; } }
function saveTicket(id, day) { try { localStorage.setItem(TICKET_KEY, JSON.stringify({ id: id, day: day })); } catch (e) {} }
function getJson(url, options) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; reject(new Error("timeout")); } }, 12000);
    fetch(url, options).then(function (r) { return r.json().then(function (body) { return { status: r.status, body: body }; }); })
      .then(function (x) { if (!done) { done = true; clearTimeout(timer); resolve(x); } }, function (e) { if (!done) { done = true; clearTimeout(timer); reject(e); } });
  });
}
function escHtml(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
`;

/** The QR check-in page: new visit (name, cellphone, purpose) or appointment (name and cellphone). */
export function checkinPage(state: QueueState): string {
  const clinic = clinicNameOf(state.settings);
  const chips = purposeOptions(state.settings).map((option) => `<button type="button" aria-pressed="false" data-purpose="${esc(option.label)}">${esc(option.label)}</button>`).join("");
  const body = `
<h1 id="h">Get your queue number</h1>
<p class="lead" id="lead">Tell us your name and why you are here. The Concierge sees it when calling your number to register you.</p>
<a class="mine hidden" id="mine" href="#"><span><small>Your queue number today</small><b id="mine-n"></b></span><strong>View →</strong></a>
<div id="forms">
<div class="tabs" role="tablist" aria-label="Type of visit"><button type="button" role="tab" aria-selected="true" data-tab="new">🎫 New visit</button><button type="button" role="tab" aria-selected="false" data-tab="appt">📅 Appointment</button></div>
<form id="f-new" novalidate>
<label>Your full name<input id="n-name" autocomplete="name" maxlength="80" placeholder="e.g. Juan Dela Cruz"></label>
<label><span>Cellphone number <em>(optional, so the Concierge does not need to ask)</em></span><input id="n-mobile" class="mono" type="tel" inputmode="numeric" autocomplete="tel" maxlength="16" placeholder="09XX XXX XXXX"></label>
<fieldset><legend>Purpose of your visit <em>(choose all that apply)</em></legend><div class="chips" id="chips">${chips}</div>
<input id="n-other" class="hidden" maxlength="60" placeholder="Please tell us (optional)" aria-label="Other purpose" style="margin-top:8px"></fieldset>
<p class="err" id="n-err" role="alert"></p>
<button class="go" id="n-go" type="submit">Get my queue number</button>
<p class="fine">One number per person. Your name and cellphone are seen only by the clinic staff, never on the TV. Watch the lobby TV for your number.</p>
</form>
<form id="f-appt" class="hidden" novalidate>
<label>Your full name<input id="a-name" autocomplete="name" maxlength="80" placeholder="e.g. Juan Dela Cruz"></label>
<label>Cellphone number<input id="a-mobile" class="mono" type="tel" inputmode="numeric" autocomplete="tel" maxlength="16" placeholder="09XX XXX XXXX"></label>
<p class="err" id="a-err" role="alert"></p>
<button class="go teal" id="a-go" type="submit">✓ Check in</button>
<p class="fine">No appointment found? Choose <b>New visit</b> above, or ask the Concierge.</p>
</form>
</div>`;
  const script = `${COMMON}
var DAY = ${JSON.stringify(state.day)};
function $(id) { return document.getElementById(id); }
function phMobile(value) { var d = String(value || "").replace(/[\\s().-]/g, ""); if (!d) return ""; var m = /^(?:\\+?63|0)?(9\\d{9})$/.exec(d); return m ? "0" + m[1] : null; }
// A phone that already has today's number sees it again instead of taking another.
var saved = readTicket();
if (saved && saved.day === DAY && saved.id) {
  getJson("/api/ticket?id=" + encodeURIComponent(saved.id), { cache: "no-store" }).then(function (x) {
    if (x.body && x.body.found && x.body.status !== "completed") {
      $("mine-n").textContent = x.body.label; $("mine").href = "/queue/ticket?id=" + encodeURIComponent(saved.id);
      $("mine").classList.remove("hidden"); $("forms").classList.add("hidden");
      $("lead").textContent = "Please wait in the lobby and watch the TV for your number.";
    }
  }, function () {});
}
var tabs = document.querySelectorAll("[data-tab]");
for (var i = 0; i < tabs.length; i++) tabs[i].addEventListener("click", function (e) {
  var appt = e.currentTarget.getAttribute("data-tab") === "appt";
  for (var j = 0; j < tabs.length; j++) tabs[j].setAttribute("aria-selected", String((tabs[j].getAttribute("data-tab") === "appt") === appt));
  $("f-new").classList.toggle("hidden", appt); $("f-appt").classList.toggle("hidden", !appt);
  $("h").textContent = appt ? "Check in for your appointment" : "Get your queue number";
  $("lead").textContent = appt ? "Type the name and cellphone number you gave when your appointment was made. You are marked as arrived and get your queue number." : "Tell us your name and why you are here. The Concierge sees it when calling your number to register you.";
});
var chips = document.querySelectorAll("#chips button");
for (var k = 0; k < chips.length; k++) chips[k].addEventListener("click", function (e) {
  var b = e.currentTarget, on = b.getAttribute("aria-pressed") !== "true";
  b.setAttribute("aria-pressed", String(on)); b.textContent = (on ? "✓ " : "") + b.getAttribute("data-purpose");
  if (b.getAttribute("data-purpose") === "Other") $("n-other").classList.toggle("hidden", !on);
  $("n-err").textContent = "";
});
function send(action, err, btn, busyText) {
  var label = btn.textContent; btn.disabled = true; btn.textContent = busyText;
  getJson("/api/queue", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: action }) }).then(function (x) {
    var r = x.body && x.body.result;
    if (r && r.ok) { saveTicket(r.visitId, (x.body.state && x.body.state.day) || DAY); location.href = "/queue/ticket?id=" + encodeURIComponent(r.visitId); return; }
    btn.disabled = false; btn.textContent = label; err.textContent = (r && r.error) || (x.body && x.body.error) || "Something went wrong. Please try again.";
  }, function () { btn.disabled = false; btn.textContent = label; err.textContent = "No connection to the clinic. Make sure you are on the clinic Wi-Fi, then try again."; });
}
$("f-new").addEventListener("submit", function (e) {
  e.preventDefault();
  var name = $("n-name").value.replace(/\\s+/g, " ").trim(), phone = phMobile($("n-mobile").value), err = $("n-err");
  var purposes = []; var on = document.querySelectorAll('#chips button[aria-pressed="true"]');
  for (var i = 0; i < on.length; i++) { var p = on[i].getAttribute("data-purpose"); purposes.push(p === "Other" && $("n-other").value.trim() ? "Other: " + $("n-other").value.trim() : p); }
  if (name.length < 2) { err.textContent = "Please type your full name."; return; }
  if (phone === null) { err.textContent = "Please check your cellphone number (11 digits, e.g. 0917 123 4567), or leave it empty."; return; }
  if (!purposes.length) { err.textContent = "Please choose the purpose of your visit."; return; }
  send({ type: "qrArrive", name: name, mobile: phone, purposes: purposes }, err, $("n-go"), "Getting your number…");
});
$("f-appt").addEventListener("submit", function (e) {
  e.preventDefault();
  var name = $("a-name").value.replace(/\\s+/g, " ").trim(), phone = phMobile($("a-mobile").value), err = $("a-err");
  if (name.length < 2) { err.textContent = "Please type your full name."; return; }
  if (!phone) { err.textContent = "Please type the cellphone number you gave for your appointment (11 digits, e.g. 0917 123 4567)."; return; }
  send({ type: "selfCheckIn", name: name, mobile: phone }, err, $("a-go"), "Finding your appointment…");
});
document.addEventListener("input", function () { $("n-err").textContent = ""; $("a-err").textContent = ""; });
`;
  return shell("Check-in", clinic, body, script);
}

/** The patient's queue number page: live status every 3 seconds, and the phone rings when their number is called. */
export function ticketPage(state: QueueState): string {
  const clinic = clinicNameOf(state.settings);
  const body = `<div id="view"><p style="padding:60px 0;text-align:center;color:#756b59">Loading…</p></div>
<div id="sound"></div>
<p class="foot" id="foot">This page updates automatically.</p>`;
  const script = `${COMMON}
var ID = new URLSearchParams(location.search).get("id") || "";
var ACK_KEY = "thsc-queue-call-ack", REPEAT_MS = 8000, MAX_RINGS = 8;
var ctx = null, soundOn = false, rings = 0, ringTimer = null, blinkTimer = null, ringingKey = null, last = null, baseTitle = document.title;
var acked = ""; try { acked = sessionStorage.getItem(ACK_KEY) || ""; } catch (e) {}
function $(id) { return document.getElementById(id); }
// ---- Sound: a chime made with Web Audio; phones allow it after one tap on the page ----
function context() {
  if (ctx) return ctx;
  var C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
  ctx = new C(); return ctx;
}
function chime(c) {
  var start = c.currentTime + 0.05, notes = [[1046.5, 0], [784, 0.42], [1046.5, 0.84], [784, 1.6], [1046.5, 2.02], [1318.5, 2.44]];
  notes.forEach(function (n) { [["sine", 0.55], ["triangle", 0.25]].forEach(function (t) {
    var o = c.createOscillator(), g = c.createGain(); o.type = t[0]; o.frequency.value = n[0];
    g.gain.setValueAtTime(0.0001, start + n[1]); g.gain.exponentialRampToValueAtTime(t[1], start + n[1] + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, start + n[1] + 0.9);
    o.connect(g); g.connect(c.destination); o.start(start + n[1]); o.stop(start + n[1] + 0.95);
  }); });
}
function ring() { if (ctx) { if (ctx.state === "suspended") ctx.resume(); chime(ctx); } try { if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 800]); } catch (e) {} }
function turnOn() {
  var c = context(); if (!c) return false; c.resume();
  var o = c.createOscillator(), g = c.createGain(); g.gain.value = 0.0001; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.05);
  soundOn = true; renderSound(); return true;
}
function unlock(e) { if (!soundOn && !(e.target && e.target.closest && e.target.closest("[data-sound]"))) turnOn(); }
["pointerdown", "touchend", "keydown"].forEach(function (n) { document.addEventListener(n, unlock, { passive: true }); });
function renderSound() {
  var box = $("sound");
  if (last && last.found && last.status === "completed") { box.innerHTML = ""; return; }
  box.innerHTML = soundOn
    ? '<p class="sndon">🔊 Sound on: your phone rings when it\\'s your turn. <button type="button" data-sound id="test">Test</button></p>'
    : '<button type="button" class="snd" data-sound id="test"><span style="font-size:22px">🔊</span><span><b>Tap here to turn on the call sound</b><span>Your phone will ring and vibrate when your number is called. Keep this page open and your volume up.</span></span></button>';
  $("test").addEventListener("click", function () { if (turnOn()) ring(); });
}
// ---- Ringing until "OK, I'm on my way"; every call and Call again rings again ----
function stopRinging() { clearInterval(ringTimer); clearInterval(blinkTimer); ringTimer = blinkTimer = null; ringingKey = null; document.title = baseTitle; }
function startRinging(key, label) {
  stopRinging(); ringingKey = key; rings = 0;
  var once = function () { if (rings >= MAX_RINGS) return; rings += 1; ring(); };
  once(); ringTimer = setInterval(once, REPEAT_MS);
  var flip = false; blinkTimer = setInterval(function () { flip = !flip; document.title = flip ? "🔔 Your turn! " + label : baseTitle; }, 1000);
}
document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") { refresh(); if (ringingKey) { rings = Math.min(rings, MAX_RINGS - 1); ring(); } } });
function acknowledge() { if (!last || !last.callKey) return; acked = last.callKey; try { sessionStorage.setItem(ACK_KEY, acked); } catch (e) {} try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) {} stopRinging(); render(last); }
// ---- The view ----
function render(t) {
  last = t;
  var view = $("view");
  if (!t.found) { view.innerHTML = '<h1>Queue number not found</h1><p class="lead">It may be from a previous day. Please ask the front desk for help.</p><p><a href="/queue/checkin" style="color:#8b6512;font-weight:600">Go to check-in</a></p>'; $("sound").innerHTML = ""; stopRinging(); return; }
  var ringing = Boolean(t.callKey) && acked !== t.callKey;
  var text = escHtml(t.text).replace("{place}", t.place ? '<span class="place">' + escHtml(t.place) + "</span>" : "");
  var html = '<section class="num"><small>Your queue number</small><b>' + escHtml(t.label) + "</b><span>Keep this number for every service today.</span></section>"
    + '<div class="msg ' + t.tone + '" role="status" aria-live="polite"><p class="t">' + (t.tone === "turn" ? "🔔 " : "") + escHtml(t.title) + '</p><p class="x">' + text + "</p>"
    + (ringing ? '<button type="button" class="ok" id="ok">✓ OK, I\\'m on my way</button>' : "") + "</div>";
  if (t.wait) html += '<div class="card"><p class="k">Estimated waiting time</p><p class="v">' + escHtml(t.wait) + '</p><p class="n">' + escHtml(t.waitNote) + "</p></div>";
  if (t.steps.length) html += "<ol>" + t.steps.map(function (s, i) { return '<li class="' + s.state + '"><i>' + (s.state === "done" ? "✓" : i + 1) + "</i><span>" + escHtml(s.name) + "</span><code>" + escHtml(s.code) + "</code></li>"; }).join("") + "</ol>";
  if (!t.verified) html += '<p class="lead" style="margin-top:18px;font-size:14px">Please drop by the front desk once so staff can confirm your check-in.</p>';
  view.innerHTML = html;
  if ($("ok")) $("ok").addEventListener("click", acknowledge);
  if (ringing && ringingKey !== t.callKey) startRinging(t.callKey, t.label);
  if (!ringing && ringingKey) stopRinging();
  renderSound();
}
var failures = 0;
function refresh() {
  if (!ID) { render({ found: false }); return; }
  getJson("/api/ticket?id=" + encodeURIComponent(ID), { cache: "no-store" }).then(function (x) {
    failures = 0; $("foot").textContent = "This page updates automatically.";
    if (x.body && typeof x.body.found === "boolean") render(x.body);
  }, function () { failures += 1; if (failures > 1) $("foot").textContent = "Reconnecting… make sure you are on the clinic Wi-Fi."; });
}
refresh(); setInterval(refresh, 3000);
`;
  return shell("My Queue Number", clinic, body, script);
}
