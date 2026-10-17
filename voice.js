// YUNIKA AI - voice part (Mic + Speaker). Loads after home.js.
// Mic ON = keeps listening on every screen until you press it again. Speaker ON = replies are read aloud.

var K_SPK = "yunika.speaker";
var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
var micOn = false, spkOn = lsGet(K_SPK) === "1";
var speaking = false, rec = null, recRunning = false, wakeLock = null, restartTimer = 0, capTimer = 0;

(function addStyle() {
  var s = document.createElement("style");
  s.textContent =
    ".tile.on .orb{border-color:#7dffb0;box-shadow:0 0 22px 4px #5dffa0aa,inset 0 0 14px #5dffa066}" +
    ".tile.on .lbl::after{content:' \\25CF';color:#7dffb0}" +
    ".vbtns{display:flex;gap:6px}" +
    ".vbtn{width:34px;height:34px;border:none;border-radius:50%;background:var(--surface);font-size:16px;opacity:.5;cursor:pointer}" +
    ".vbtn.on{opacity:1;box-shadow:0 0 0 2px #7dffb0}" +
    ".vcap{position:absolute;left:18px;right:18px;top:34%;text-align:center;color:#efe6ff;font-size:19px;line-height:1.5;" +
    "pointer-events:none;opacity:0;transition:opacity .4s;text-shadow:0 2px 10px #000a}" +
    ".vcap.on{opacity:1}";
  document.head.appendChild(s);
})();

var vcap = document.createElement("div");
vcap.className = "vcap";
home.appendChild(vcap);
function showCap(text) {
  vcap.textContent = text; vcap.classList.add("on");
  clearTimeout(capTimer);
  capTimer = setTimeout(function () { vcap.classList.remove("on"); }, 9000);
}
function say(msg) { if (typeof toast === "function") toast(msg); }

/* ---------- buttons: keep their ON look on every screen ---------- */
var topMic = null, topSpk = null;
function paint() {
  if (tiles.mic) tiles.mic.classList.toggle("on", micOn);
  if (tiles.speaker) tiles.speaker.classList.toggle("on", spkOn);
  if (topMic) topMic.classList.toggle("on", micOn);
  if (topSpk) topSpk.classList.toggle("on", spkOn);
}
var _buildTile = buildTile;
buildTile = function (c, i) {
  var el = _buildTile(c, i);
  if ((c.id === "mic" && micOn) || (c.id === "speaker" && spkOn)) el.classList.add("on");
  return el;
};
var _act = act;
act = function (id) {
  if (id === "mic") { toggleMic(); return; }
  if (id === "speaker") { toggleSpk(); return; }
  _act(id);
};
(function addTopButtons() {
  var bar = document.querySelector(".topbar");
  if (!bar) return;
  var w = document.createElement("div");
  w.className = "vbtns";
  topMic = document.createElement("button"); topMic.type = "button"; topMic.className = "vbtn"; topMic.textContent = "\uD83C\uDFA4";
  topSpk = document.createElement("button"); topSpk.type = "button"; topSpk.className = "vbtn"; topSpk.textContent = "\uD83D\uDD0A";
  topMic.setAttribute("aria-label", "Mic on/off"); topSpk.setAttribute("aria-label", "Speaker on/off");
  topMic.addEventListener("click", toggleMic); topSpk.addEventListener("click", toggleSpk);
  w.appendChild(topMic); w.appendChild(topSpk);
  bar.replaceChild(w, bar.lastElementChild);
})();

/* ---------- mic ---------- */
function keepAwake(on) {
  try {
    if (on && navigator.wakeLock) navigator.wakeLock.request("screen").then(function (l) { wakeLock = l; }).catch(function () {});
    else if (!on && wakeLock) { wakeLock.release(); wakeLock = null; }
  } catch (e) {}
}
function toggleMic() {
  if (micOn) { stopMic(); say("Mic off"); return; }
  if (!SR) { say("This browser can't listen. Please use Chrome."); return; }
  micOn = true; paint(); keepAwake(true); startRec(); say("Mic on - I'm listening");
}
function stopMic() {
  micOn = false; clearTimeout(restartTimer);
  try { if (rec) rec.abort(); } catch (e) {}
  recRunning = false; keepAwake(false); paint();
}
function startRec() {
  if (!micOn || speaking || recRunning) return;
  rec = new SR();
  rec.lang = "hi-IN"; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1;
  rec.onstart = function () { recRunning = true; };
  rec.onresult = function (e) {
    var t = "";
    for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript;
    t = t.trim();
    if (t) heard(t);
  };
  rec.onerror = function (e) {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") { say("Mic is blocked. Allow the microphone for this site."); stopMic(); }
  };
  rec.onend = function () {
    recRunning = false;
    if (micOn && !speaking) { clearTimeout(restartTimer); restartTimer = setTimeout(startRec, 350); }
  };
  try { rec.start(); } catch (e) { recRunning = false; }
}
function heard(t) {
  if (busy) return;
  showCap("You: " + t);
  input.value = t;
  form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
}

/* ---------- speaker ---------- */
function pickVoice() {
  var vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  var i;
  for (i = 0; i < vs.length; i++) if (/^hi/i.test(vs[i].lang)) return vs[i];
  for (i = 0; i < vs.length; i++) if (/^en-IN/i.test(vs[i].lang)) return vs[i];
  return null;
}
function resumeListening() {
  speaking = false;
  if (micOn) { clearTimeout(restartTimer); restartTimer = setTimeout(startRec, 400); }
}
function speak(text) {
  if (!spkOn || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "hi-IN"; u.rate = 1; u.pitch = 1.1;
    var v = pickVoice(); if (v) u.voice = v;
    u.onend = resumeListening; u.onerror = resumeListening;
    speaking = true;                                   // do not listen to my own voice
    try { if (rec) rec.abort(); } catch (e) {}
    recRunning = false;
    speechSynthesis.speak(u);
    setTimeout(function () { if (speaking && !speechSynthesis.speaking && !speechSynthesis.pending) resumeListening(); }, 3000);
  } catch (e) { resumeListening(); }
}
function toggleSpk() {
  spkOn = !spkOn; lsSet(K_SPK, spkOn ? "1" : "0"); paint();
  if (spkOn) { say("Speaker on"); speak("Speaker on"); }
  else { try { speechSynthesis.cancel(); } catch (e) {} resumeListening(); say("Speaker off"); }
}

/* ---------- show and read every new AI reply, on any screen ---------- */
new MutationObserver(function (muts) {
  muts.forEach(function (m) {
    Array.prototype.forEach.call(m.addedNodes, function (n) {
      if (n.nodeType !== 1 || !n.classList.contains("msg") || !n.classList.contains("ai") || n.classList.contains("typing")) return;
      var text = n.firstChild ? n.firstChild.textContent : "";
      if (!text) return;
      showCap(text);
      speak(text);
    });
  });
}).observe(chat, { childList: true });

document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible" && micOn) { keepAwake(true); startRec(); }
});
paint();
