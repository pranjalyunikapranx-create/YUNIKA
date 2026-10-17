// YUNIKA AI - chat part (uses helpers from app.js)

/* ---------- chat (connected to your private AI link) ---------- */
var chat = $("chat"), empty = $("empty"), emptyNode = empty, form = $("composer"), input = $("input");
var sendBtn = form.querySelector(".send");
var K_RELAY = "yunika.relay", K_CHAT = "yunika.chat", K_EMO = "yunika.emotion";
var RELAY_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
var EMO_ICON = {
  "Neutral": "😐", "Happy": "😊", "Sad": "😢", "Angry": "😠", "Scared": "😨",
  "Surprised": "😲", "Shy": "🙈", "Loving": "🥰", "Worried": "😟", "Calm": "😌",
  "Excited": "🤩", "Bored": "😑", "Playful": "😜", "Laughing": "😂", "Relieved": "😮",
  "Regretful": "😔", "Lonely": "🥺", "Admiring": "🤗", "Adoring": "😍", "Appreciative": "🙏",
  "Confused": "😕", "Awkward": "😅", "Craving": "🤤", "Disgusted": "🤢", "Empathic pain": "😣",
  "Entranced": "😵", "Awestruck": "😯", "Horrified": "😱", "Interested": "🧐", "Nostalgic": "🕰️",
  "Romantic": "💕", "Satisfied": "😋", "Attracted": "😘", "Proud": "😎", "Jealous": "😒",
  "Disappointed": "😞", "Embarrassed": "😳", "Guilty": "😬", "Hopeful": "🤞", "Grateful": "💜",
  "Compassionate": "💗", "Sympathetic": "🤝", "Triumphant": "🏆", "Trusting": "🤲", "Anticipating": "👀"
};
var hist = [], busy = false, lastEmotion = "Neutral";

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function getRelay() { var r = (lsGet(K_RELAY) || "").trim(); return RELAY_RE.test(r) ? r : ""; }
function saveHist() { lsSet(K_CHAT, JSON.stringify(hist.slice(-40))); }
function setEmotion(emo) {
  if (!EMO_ICON[emo]) emo = "Neutral";
  lastEmotion = emo; lsSet(K_EMO, emo);
  if (typeof refreshEmoTile === "function") refreshEmoTile();
}

function addMessage(text, who, emo) {
  if (empty) { empty.remove(); empty = null; }
  var el = document.createElement("div");
  el.className = "msg " + who;
  var t = document.createElement("div");
  t.textContent = text; // textContent keeps it safe
  el.appendChild(t);
  if (who === "ai" && emo) {
    var e = document.createElement("div");
    e.className = "emo";
    e.textContent = (EMO_ICON[emo] || "") + " " + emo;
    el.appendChild(e);
  }
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

function resetChat() {
  hist = []; lastEmotion = "Neutral";
  Array.prototype.slice.call(chat.querySelectorAll(".msg")).forEach(function (n) { n.remove(); });
  if (!emptyNode.parentNode) chat.appendChild(emptyNode);
  empty = emptyNode;
  if (typeof refreshEmoTile === "function") refreshEmoTile();
}

(function loadChat() {
  try {
    var h = JSON.parse(lsGet(K_CHAT) || "[]");
    if (Array.isArray(h)) h.forEach(function (m) {
      if (m && (m.role === "user" || m.role === "ai") && typeof m.text === "string") {
        hist.push({ role: m.role, text: m.text, emo: m.emo });
        addMessage(m.text, m.role, m.emo);
      }
    });
  } catch (e) {}
  var le = lsGet(K_EMO); if (le && EMO_ICON[le]) lastEmotion = le;
})();

form.addEventListener("submit", function (e) {
  e.preventDefault();
  var text = input.value.trim();
  if (!text || busy) return;
  addMessage(text, "user");
  hist.push({ role: "user", text: text }); saveHist();
  input.value = "";
  var relay = getRelay();
  if (!relay) {
    addMessage("My brain isn't connected yet. Open Settings on the home screen and paste your AI link.", "ai");
    return;
  }
  busy = true; sendBtn.disabled = true;
  var wait = addMessage("…", "ai"); wait.classList.add("typing");
  fetch(relay, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ messages: hist.slice(-20).map(function (m) { return { role: m.role, text: m.text }; }) })
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      wait.remove();
      if (!d || d.error || !d.reply) throw new Error("bad reply");
      addMessage(d.reply, "ai", d.emotion);
      hist.push({ role: "ai", text: d.reply, emo: d.emotion }); saveHist();
      setEmotion(d.emotion);
    })
    .catch(function () {
      wait.remove();
      addMessage("Sorry, I couldn't reach my brain. Check your internet and your AI link, then try again.", "ai");
    })
    .then(function () { busy = false; sendBtn.disabled = false; });
});

// end of chat.js
// end of chat.js
// end of chat.js
