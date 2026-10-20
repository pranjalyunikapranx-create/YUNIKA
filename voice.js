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
if (topLang) topLang.style.color = "#2a1a40";
micLang = "hi-IN"; lsSet("yunika.mlang", "hi-IN");
if (topLang) topLang.style.display = "none";
/* ---------- show my spoken Hindi in English letters ---------- */
var ROM_C = { 0x15:"k",0x16:"kh",0x17:"g",0x18:"gh",0x19:"n",0x1A:"ch",0x1B:"chh",0x1C:"j",0x1D:"jh",0x1E:"n",0x1F:"t",0x20:"th",0x21:"d",0x22:"dh",0x23:"n",
  0x24:"t",0x25:"th",0x26:"d",0x27:"dh",0x28:"n",0x2A:"p",0x2B:"f",0x2C:"b",0x2D:"bh",0x2E:"m",0x2F:"y",0x30:"r",0x32:"l",0x35:"v",0x36:"sh",0x37:"sh",0x38:"s",0x39:"h" };
var ROM_V = { 0x05:"a",0x06:"aa",0x07:"i",0x08:"ee",0x09:"u",0x0A:"oo",0x0B:"ri",0x0F:"e",0x10:"ai",0x13:"o",0x14:"au",0x11:"o",0x04:"a" };
var ROM_M = { 0x3E:"aa",0x3F:"i",0x40:"ee",0x41:"u",0x42:"oo",0x43:"ri",0x47:"e",0x48:"ai",0x4B:"o",0x4C:"au",0x49:"o",0x45:"e" };
function romanWord(w) {
  var sy = [], i, c, s, o, p, n;
  for (i = 0; i < w.length; i++) {
    c = w.charCodeAt(i) - 0x900;
    if (ROM_C[c] !== undefined) {
      s = { t: ROM_C[c], cons: true, v: null };
      if (c === 0x1C && w.charCodeAt(i + 1) === 0x93C) { s.t = "z"; i++; }
      else if (c === 0x21 && w.charCodeAt(i + 1) === 0x93C) { s.t = "r"; i++; }
      else if (c === 0x22 && w.charCodeAt(i + 1) === 0x93C) { s.t = "rh"; i++; }
      else if (w.charCodeAt(i + 1) === 0x93C) i++;
      sy.push(s);
    } else if (ROM_M[c] !== undefined) {
      if (sy.length && sy[sy.length - 1].cons && sy[sy.length - 1].v === null) sy[sy.length - 1].v = ROM_M[c];
      else sy.push({ t: ROM_M[c], cons: false });
    } else if (c === 0x4D) {
      if (sy.length && sy[sy.length - 1].cons) sy[sy.length - 1].v = "";
    } else if (c === 0x02 || c === 0x01) {
      sy.push({ t: "n", cons: false });
    } else if (c === 0x03) {
      sy.push({ t: "h", cons: false });
    } else if (ROM_V[c] !== undefined) {
      sy.push({ t: ROM_V[c], cons: false });
    } else if (c === 0x64) {
      sy.push({ t: ".", cons: false });
    } else if (c !== 0x3C) {
      sy.push({ t: w.charAt(i), cons: false });
    }
  }
  o = "";
  for (i = 0; i < sy.length; i++) {
    s = sy[i]; o += s.t;
    if (!s.cons) continue;
    if (s.v !== null) { o += s.v; continue; }
    if (i === sy.length - 1) continue;
    p = sy[i - 1]; n = sy[i + 1];
    if (i > 0 && p && (!p.cons || p.v !== "") && n && n.cons && n.v !== null && n.v !== "") continue;
    o += "a";
  }
  return o.replace(/([a-z])aa/g, "$1a").replace(/ee/g, "i");
}
var LOAN = {
  "\u092F\u0942\u0928\u093F\u0915\u093E": "YUNIKA",
  "\u092A\u0930\u094D\u0938\u0928\u0932": "personal",
  "\u0905\u0938\u093F\u0938\u094D\u091F\u0947\u0902\u091F": "assistant",
  "\u0921\u0949\u0915\u094D\u091F\u0930": "doctor",
  "\u092E\u094B\u092C\u093E\u0907\u0932": "mobile",
  "\u092B\u094B\u0928": "phone",
  "\u0910\u092A": "app",
  "\u092E\u0948\u0938\u0947\u091C": "message",
  "\u0939\u0947\u0932\u094B": "hello",
  "\u0913\u0915\u0947": "okay",
  "\u0938\u0949\u0930\u0940": "sorry",
  "\u092A\u094D\u0932\u0940\u091C": "please",
  "\u0905\u0932\u093E\u0930\u094D\u092E": "alarm",
  "\u0928\u094B\u091F\u094D\u0938": "notes",
  "\u0917\u0947\u092E": "game",
  "\u092E\u0942\u0935\u0940": "movie",
  "\u0935\u0940\u0921\u093F\u092F\u094B": "video",
  "\u091F\u093E\u0907\u092E": "time",
  "\u092B\u094D\u0930\u0947\u0902\u0921": "friend"
};
function toRoman(t) {
  if (!/[\u0900-\u097F]/.test(t)) return t;
  return t.replace(/[\u0900-\u097F]+/g, function (w) {
    var m = w.match(/^(.*?)([\u0964\u0965]*)$/);
    return (LOAN[m[1]] || romanWord(m[1])) + (m[2] ? "." : "");
  });
  }
var _heardDev = heard;
heard = function (t) { _heardDev(toRoman(t)); };/* ---------- show YUNIKA's replies in English letters, but speak them in Hindi ---------- */
var lastAiOrig = "";
var _addMsg = addMessage;
addMessage = function (text, who, emo) {
  if (who === "ai") lastAiOrig = text;
  return _addMsg(toRoman(text), who, emo);
};
var _speakRom = speak;
speak = function (text) {
  _speakRom(lastAiOrig && toRoman(lastAiOrig) === text ? lastAiOrig : text);
};
Array.prototype.forEach.call(chat.querySelectorAll(".msg > div:first-child"), function (d) {
  d.textContent = toRoman(d.textContent);
});
/* ---------- say the name YUNIKA as a word, not letter by letter ---------- */
if (window.speechSynthesis) {
  var _ssSpeak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = function (u) {
    try { u.text = u.text.replace(/yunika/gi, "\u092F\u0942\u0928\u093F\u0915\u093E"); } catch (e) {}
    _ssSpeak(u);
  };
}
/* ---------- better spelling for English words written in Hindi ---------- */
function canonW(s) {
  return s.replace(/[\u0901\u0902]/g, "\u0928").replace(/\u094D/g, "").replace(/\u093C/g, "")
    .replace(/\u0942/g, "\u0941").replace(/\u0940/g, "\u093F").replace(/\u0948/g, "\u0947").replace(/\u094C/g, "\u094B");
}
var LOAN2 = {};
(function () {
  var L = {
    "\u092F\u0942\u0928\u093F\u0915\u093E": "YUNIKA", "\u092A\u0930\u094D\u0938\u0928\u0932": "personal",
    "\u0905\u0938\u093F\u0938\u094D\u091F\u0947\u0902\u091F": "assistant", "\u0921\u0949\u0915\u094D\u091F\u0930": "doctor",
    "\u092E\u094B\u092C\u093E\u0907\u0932": "mobile", "\u092B\u094B\u0928": "phone", "\u0910\u092A": "app",
    "\u092E\u0948\u0938\u0947\u091C": "message", "\u0939\u0947\u0932\u094B": "hello", "\u0913\u0915\u0947": "okay",
    "\u0938\u0949\u0930\u0940": "sorry", "\u092A\u094D\u0932\u0940\u091C": "please", "\u0905\u0932\u093E\u0930\u094D\u092E": "alarm",
    "\u0928\u094B\u091F\u094D\u0938": "notes", "\u0917\u0947\u092E": "game", "\u092E\u0942\u0935\u0940": "movie",
    "\u0935\u0940\u0921\u093F\u092F\u094B": "video", "\u091F\u093E\u0907\u092E": "time", "\u092B\u094D\u0930\u0947\u0902\u0921": "friend"
  };
  for (var k in L) LOAN2[canonW(k)] = L[k];
})();
toRoman = function (t) {
  if (!/[\u0900-\u097F]/.test(t)) return t;
  return t.replace(/[\u0900-\u097F]+/g, function (w) {
    var m = w.match(/^(.*?)([\u0964\u0965]*)$/);
    return (LOAN2[canonW(m[1])] || romanWord(m[1])) + (m[2] ? "." : "");
  });
};
/* ---------- fix letters like z, r, f, q written as one Hindi character ---------- */
ROM_C[0x58] = "q"; ROM_C[0x59] = "kh"; ROM_C[0x5A] = "g"; ROM_C[0x5B] = "z";
ROM_C[0x5C] = "r"; ROM_C[0x5D] = "rh"; ROM_C[0x5E] = "f"; ROM_C[0x5F] = "y";
/* ---------- never show any Hindi letters on screen ---------- */
var _toRomanB = toRoman;
toRoman = function (t) {
  t = String(t);
  if (!/[\u0900-\u097F]/.test(t)) return t;
  return _toRomanB(t.normalize("NFD")).replace(/[\u0900-\u097F]/g, "");
};
Array.prototype.forEach.call(chat.querySelectorAll(".msg > div:first-child"), function (d) {
  d.textContent = toRoman(d.textContent);
});
LOAN2[canonW("\u0915\u094D\u0930\u093F\u090F\u091F\u0930")] = "creator";
LOAN2[canonW("\u0906\u0908\u0921\u0940")] = "ID";
LOAN2[canonW("\u0907\u0902\u0938\u094D\u091F\u093E\u0917\u094D\u0930\u093E\u092E")] = "Instagram";
LOAN2[canonW("\u091C\u0941\u0921\u093C\u0928\u093E")] = "judna";
LOAN2[canonW("\u091C\u0941\u0921\u093C\u0928\u0947")] = "judne";
LOAN2[canonW("\u091C\u0941\u0921\u093C")] = "jud";
/* ---------- a Play button under every YUNIKA message ---------- */
(function () {
  var st = document.createElement("style");
  st.textContent = ".rp{margin-top:6px}.rpbtn{border:0;border-radius:12px;padding:4px 12px;background:rgba(181,140,246,.28);font-size:13px;color:inherit;cursor:pointer}";
  document.head.appendChild(st);
  function norm(s) { return String(s).replace(/\s+/g, " ").trim(); }
  var _sp2 = speak;
  speak = function (text) {
    if (lastAiOrig && norm(toRoman(lastAiOrig)) === norm(text)) text = lastAiOrig;
    _sp2(text);
  };
  function addBtn(el) {
    if (el.querySelector(".rp")) return;
    var row = document.createElement("div"); row.className = "rp";
    var b = document.createElement("button"); b.type = "button"; b.className = "rpbtn";
    b.textContent = "\u25B6 Play";
    row.appendChild(b); el.appendChild(row);
  }
  var _addKeep = addMessage;
  addMessage = function (text, who, emo) {
    var el = _addKeep(text, who, emo);
    if (who === "ai" && el && text !== "\u2026") { el.dataset.orig = text; addBtn(el); }
    return el;
  };
  try {
    var h = JSON.parse(lsGet("yunika.chat") || "[]"), ai = [], i, nodes;
    for (i = 0; i < h.length; i++) if (h[i] && h[i].role === "ai" && typeof h[i].text === "string") ai.push(h[i].text);
    nodes = chat.querySelectorAll(".msg.ai");
    if (nodes.length === ai.length) for (i = 0; i < nodes.length; i++) { nodes[i].dataset.orig = ai[i]; addBtn(nodes[i]); }
  } catch (e) {}
  chat.addEventListener("click", function (e) {
    var t = e.target, n = t.closest ? t.closest(".msg.ai") : null;
    if (!n) return;
    e.stopPropagation();
    if (!t.closest(".rpbtn")) return;
    if (window.speechSynthesis && speechSynthesis.speaking) {
      speechSynthesis.cancel(); speaking = false;
      if (typeof resumeListening === "function") resumeListening();
      return;
    }
    var was = spkOn; spkOn = true; speak(n.dataset.orig || ""); spkOn = was;
  }, true);
})();
