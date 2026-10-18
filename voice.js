// YUNIKA AI - voice part (Mic + Speaker). Loads after home.js.
// Mic ON = keeps listening on every screen until you press it again. Speaker ON = replies are read aloud.

var K_SPK = "yunika.speaker";
var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
var micOn = false, spkOn = lsGet(K_SPK) === "1";
var micLang = lsGet("yunika.mlang") || "hi-IN";
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
var topMic = null, topSpk = null, topLang = null;
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
  topMic = document.createElement("button"); topMic.type = "button"; topMic.className = "vbtn"; topMic.textContent = "🎤";
  topSpk = document.createElement("button"); topSpk.type = "button"; topSpk.className = "vbtn"; topSpk.textContent = "🔊";
  topMic.setAttribute("aria-label", "Mic on/off"); topSpk.setAttribute("aria-label", "Speaker on/off");
  topMic.addEventListener("click", toggleMic); topSpk.addEventListener("click", toggleSpk);
  topLang = document.createElement("button"); topLang.type = "button"; topLang.className = "vbtn on";
  topLang.style.fontSize = "12px"; topLang.style.color = "#fff"; topLang.setAttribute("aria-label", "Mic language");
  topLang.textContent = micLang === "hi-IN" ? "हि" : "EN";
  topLang.addEventListener("click", function () {
    micLang = micLang === "hi-IN" ? "en-IN" : "hi-IN"; lsSet("yunika.mlang", micLang);
    topLang.textContent = micLang === "hi-IN" ? "हि" : "EN";
    say(micLang === "hi-IN" ? "Listening in Hindi" : "Listening in English");
    if (micOn) { try { if (rec) rec.abort(); } catch (e) {} recRunning = false; }
  });
  w.appendChild(topLang); w.appendChild(topMic); w.appendChild(topSpk);
  bar.replaceChild(w, bar.lastElementChild);
})();

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
  rec.lang = micLang; rec.continuous = true; rec.interimResults = false; rec.maxAlternatives = 1;
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
function pickVoice(text) {
  var vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  var hindi = /[\u0900-\u097F]/.test(text || "");
  var want = hindi ? /^hi/i : /^en-IN/i;
  var best = null, bestScore = -1, i, sc;
  for (i = 0; i < vs.length; i++) {
    if (!want.test(vs[i].lang.replace("_", "-"))) continue;
    sc = 1 + (/google/i.test(vs[i].name) ? 2 : 0) + (vs[i].localService ? 0 : 1);
    if (sc > bestScore) { best = vs[i]; bestScore = sc; }
  }
  if (best) return best;
  for (i = 0; i < vs.length; i++) if (/^en/i.test(vs[i].lang)) return vs[i];
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
    var hin = /[\u0900-\u097F]/.test(text);
    u.lang = hin ? "hi-IN" : "en-IN"; u.rate = 0.95; u.pitch = 1;
    var v = pickVoice(text); if (v) { u.voice = v; u.lang = v.lang; }
    u.onend = resumeListening; u.onerror = resumeListening;
    speaking = true;
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
// end of voice.js
// end of voice.js
// end of voice.js
