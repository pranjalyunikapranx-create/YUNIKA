// YUNIKA AI - home screen part (buttons, sheets, settings)

/* ---------- home screen buttons ---------- */
var stage = $("stage"), arrow = $("arrow"), toastEl = $("toast"), editBar = $("editBar");
var scrim = $("scrim"), sheet = $("sheet"), setSheet = $("setSheet");
var TW = 68, TH = 84, PAD = 10;
var K_BTN = "yunika.buttons";
var DEFAULTS = [
  { id: "chat", name: "Chat", icon: "💬", fx: 0, fy: .72 },
  { id: "emotions", name: "Emotions", icon: "😊", fx: .25, fy: .72 },
  { id: "speaker", name: "Speaker", icon: "🔊", fx: .5, fy: .72 },
  { id: "mic", name: "Mic", icon: "🎤", fx: .75, fy: .72 },
  { id: "avatar", name: "Avatar", icon: "👧", fx: 1, fy: .72 },
  { id: "outfit", name: "Outfit", icon: "👗", fx: 0, fy: .86 },
  { id: "notes", name: "Notes", icon: "📝", fx: .25, fy: .86 },
  { id: "todo", name: "To-do", icon: "✅", fx: .5, fy: .86 },
  { id: "alarm", name: "Alarm", icon: "⏰", fx: .75, fy: .86 },
  { id: "settings", name: "Settings", icon: "⚙️", fx: 1, fy: .86 }
];
var saved = {};
try { saved = JSON.parse(localStorage.getItem(K_BTN)) || {}; } catch (e) { saved = {}; }
var editing = false, tiles = {};

function persist() {
  try { localStorage.setItem(K_BTN, JSON.stringify(saved)); return true; }
  catch (e) { toast("Not enough storage. Try a smaller photo."); return false; }
}
function cfg(id) {
  var d = DEFAULTS.filter(function (x) { return x.id === id; })[0];
  return Object.assign({}, d, saved[id] || {});
}
function patch(id, obj) { saved[id] = Object.assign(saved[id] || {}, obj); return persist(); }
var toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg; toastEl.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove("on"); }, 1800);
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function place(el, fx, fy) {
  var W = stage.clientWidth, H = stage.clientHeight;
  el.style.left = (PAD + fx * Math.max(0, W - 2 * PAD - TW)) + "px";
  el.style.top = (fy * Math.max(0, H - TH)) + "px";
}
function fill(orb, c) {
  orb.textContent = "";
  if (c.img) { var im = document.createElement("img"); im.alt = ""; im.src = c.img; orb.appendChild(im); }
  else { orb.textContent = c.icon; }
}
function buildTile(c, i) {
  var el = document.createElement("div");
  el.className = "tile"; el.style.setProperty("--i", i); el.dataset.id = c.id;
  var orb = document.createElement("div"); orb.className = "orb"; fill(orb, c);
  var badge = document.createElement("div"); badge.className = "num";
  if (c.num) { badge.textContent = c.num; orb.appendChild(badge); }
  var lbl = document.createElement("div"); lbl.className = "lbl"; lbl.textContent = c.name;
  el.appendChild(orb); el.appendChild(lbl);
  place(el, c.fx, c.fy);
  wire(el);
  return el;
}
function refreshTile(id) {
  var old = tiles[id], c = cfg(id);
  var n = buildTile(c, DEFAULTS.map(function (d) { return d.id; }).indexOf(id));
  stage.replaceChild(n, old); tiles[id] = n;
  n.style.transition = "none";
  refreshEmoTile();
}
function refreshEmoTile() {
  var t = tiles && tiles.emotions;
  if (!t || (saved.emotions && saved.emotions.img)) return;
  var o = t.querySelector(".orb");
  if (o && o.firstChild && o.firstChild.nodeType === 3) o.firstChild.nodeValue = EMO_ICON[lastEmotion] || EMO_ICON.Neutral;
}
function renderAll() {
  stage.textContent = ""; tiles = {};
  DEFAULTS.forEach(function (d, i) { var c = cfg(d.id); var el = buildTile(c, i); stage.appendChild(el); tiles[d.id] = el; });
  refreshEmoTile();
}

function act(id) {
  if (id === "chat") { only(app); return; }
  if (id === "settings") { openSettings(); return; }
  if (id === "emotions") { toast("Emotion: " + lastEmotion + " (automatic)"); return; }
  toast(cfg(id).name + " – coming soon");
}

function wire(el) {
  var id = el.dataset.id, timer = 0, down = false, moved = false, long = false;
  var sx = 0, sy = 0, ox = 0, oy = 0, lx = 0, ly = 0;
  function startDrag() { el.classList.add("drag"); ox = el.offsetLeft; oy = el.offsetTop; sx = lx; sy = ly; }
  el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  el.addEventListener("pointerdown", function (e) {
    down = true; moved = false; long = false; sx = lx = e.clientX; sy = ly = e.clientY;
    try { el.setPointerCapture(e.pointerId); } catch (x) {}
    if (editing) { startDrag(); }
    else {
      timer = setTimeout(function () {
        if (!down) return;
        long = true; setEdit(true);
        if (navigator.vibrate) try { navigator.vibrate(30); } catch (x) {}
        startDrag();
      }, 650);
    }
  });
  el.addEventListener("pointermove", function (e) {
    if (!down) return;
    lx = e.clientX; ly = e.clientY;
    var dx = lx - sx, dy = ly - sy;
    if (!editing) { if (Math.abs(dx) > 10 || Math.abs(dy) > 10) { clearTimeout(timer); moved = true; } return; }
    if (!el.classList.contains("drag")) return;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
    var W = stage.clientWidth, H = stage.clientHeight;
    el.style.left = clamp(ox + dx, PAD, W - PAD - TW) + "px";
    el.style.top = clamp(oy + dy, 0, H - TH) + "px";
  });
  function end(cancel) {
    if (!down) return; down = false; clearTimeout(timer);
    var wasDrag = el.classList.contains("drag");
    el.classList.remove("drag");
    if (cancel) return;
    if (editing) {
      if (moved && wasDrag) {
        var W = stage.clientWidth, H = stage.clientHeight;
        var fx = (el.offsetLeft - PAD) / Math.max(1, W - 2 * PAD - TW);
        var fy = el.offsetTop / Math.max(1, H - TH);
        patch(id, { fx: clamp(fx, 0, 1), fy: clamp(fy, 0, 1) });
      } else if (!moved && !long) { openSheet(id); }
    } else if (!moved && !long) { act(id); }
  }
  el.addEventListener("pointerup", function () { end(false); });
  el.addEventListener("pointercancel", function () { end(true); });
}

function setEdit(on) {
  editing = on;
  stage.classList.toggle("edit", on);
  editBar.classList.toggle("hidden", !on);
  if (on) stage.classList.add("show");
}
$("editDone").addEventListener("click", function () { setEdit(false); closeSheets(); });

arrow.addEventListener("click", function () {
  if (editing) { setEdit(false); }
  stage.classList.toggle("show");
});

function showHome() {
  renderAll(); setEdit(false); closeSheets();
  stage.classList.remove("show");   // buttons start hidden; tap the arrow
}
window.addEventListener("resize", function () {
  DEFAULTS.forEach(function (d) { var c = cfg(d.id); if (tiles[d.id]) place(tiles[d.id], c.fx, c.fy); });
});

/* ---------- sheets ---------- */
var curId = null;
function closeSheets() {
  sheet.classList.add("hidden"); setSheet.classList.add("hidden"); scrim.classList.add("hidden"); curId = null;
}
scrim.addEventListener("click", closeSheets);
$("shClose").addEventListener("click", closeSheets);
$("setClose").addEventListener("click", closeSheets);

function relayState() {
  $("setRelayState").textContent = getRelay() ? "AI link: saved. Your chat will use it." : "AI link: not set yet.";
}
function openSettings() {
  $("setRelay").value = getRelay();
  relayState();
  scrim.classList.remove("hidden"); setSheet.classList.remove("hidden");
}
$("setSaveRelay").addEventListener("click", function () {
  var v = $("setRelay").value.trim();
  if (!RELAY_RE.test(v)) { toast("That doesn't look like a valid AI link."); return; }
  lsSet(K_RELAY, v); relayState(); toast("AI link saved");
});
$("setClearChat").addEventListener("click", function () {
  if (!window.confirm("Clear the whole chat on this device?")) return;
  resetChat(); lsSet(K_CHAT, "[]"); lsSet(K_EMO, "Neutral"); toast("Chat cleared");
});
$("setEdit").addEventListener("click", function () { closeSheets(); setEdit(true); });
$("setResetAll").addEventListener("click", function () {
  if (!window.confirm("Reset all buttons to the default look and place?")) return;
  saved = {}; persist(); closeSheets(); showHome(); toast("Buttons reset");
});

function syncSheet() {
  var c = cfg(curId);
  fill($("shPreview"), c);
  $("shName").value = c.name; $("shNum").value = c.num || "";
  $("shX").value = Math.round(c.fx * 100); $("shY").value = Math.round(c.fy * 100);
}
function openSheet(id) {
  curId = id; syncSheet();
  scrim.classList.remove("hidden"); sheet.classList.remove("hidden");
}
function reTile() { refreshTile(curId); tiles[curId].style.transition = ""; if (stage.classList.contains("show")) tiles[curId].style.transition = "none"; }
$("shName").addEventListener("input", function () { patch(curId, { name: this.value.trim() || cfg(curId).name }); reTile(); });
$("shNum").addEventListener("input", function () { patch(curId, { num: this.value.trim() }); reTile(); });
function posInput() {
  var x = clamp(parseFloat($("shX").value) || 0, 0, 100), y = clamp(parseFloat($("shY").value) || 0, 0, 100);
  patch(curId, { fx: x / 100, fy: y / 100 }); place(tiles[curId], x / 100, y / 100);
}
$("shX").addEventListener("input", posInput); $("shY").addEventListener("input", posInput);
$("shReset").addEventListener("click", function () { delete saved[curId]; persist(); reTile(); syncSheet(); });
$("shPick").addEventListener("click", function () { $("shFile").click(); });
$("shUnpick").addEventListener("click", function () { patch(curId, { img: "" }); reTile(); syncSheet(); });
$("shFile").addEventListener("change", function () {
  var f = this.files && this.files[0]; this.value = "";
  if (!f) return;
  var url = URL.createObjectURL(f), im = new Image();
  im.onload = function () {
    var S = 160, cv = document.createElement("canvas"); cv.width = cv.height = S;
    var ctx = cv.getContext("2d"), k = Math.min(S / im.width, S / im.height);
    var w = im.width * k, h = im.height * k;
    ctx.drawImage(im, (S - w) / 2, (S - h) / 2, w, h);   // PNG keeps transparency
    URL.revokeObjectURL(url);
    if (patch(curId, { img: cv.toDataURL("image/png") })) { reTile(); syncSheet(); }
  };
  im.onerror = function () { URL.revokeObjectURL(url); toast("Couldn't read that image."); };
  im.src = url;
});

/* ---------- back to home from chat ---------- */
$("backBtn").addEventListener("click", function () { only(home); });

/* ---------- PWA (works offline) ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  });
}
/* ---------- keep buttons in place after chat / keyboard ---------- */
function relayout() {
  if (!stage.clientWidth) return;
  DEFAULTS.forEach(function (d) { var c = cfg(d.id); if (tiles[d.id]) place(tiles[d.id], c.fx, c.fy); });
}
window.addEventListener("resize", relayout);
$("backBtn").addEventListener("click", function () { relayout(); });
