// YUNIKA AI - v13 (single file): dark home screen, draggable buttons, chat connected to a private AI link
// Flow: 3-second splash -> new user: choose email  |  returning user: straight into the app.
// No passwords and no app lock. Everything stays on this device (localStorage). Nothing is sent to any server.
// The AI itself is not connected yet.

var $ = function (id) { return document.getElementById(id); };

var splash = $("splash"), auth = $("auth"), app = $("app"), home = $("home");
var SPLASH_MS = 3000;   // how long the logo plays
var K_USER = "yunika.user";

/* ---------- safe storage ---------- */
function getUser() {
  try { var s = localStorage.getItem(K_USER); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function setUser(u) {
  try { localStorage.setItem(K_USER, JSON.stringify(u)); return true; } catch (e) { return false; }
}
function wipeEverything() {
  try {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    keys.forEach(function (k) { if (k && k.indexOf("yunika.") === 0) localStorage.removeItem(k); });
  } catch (e) {}
}

// Older versions kept password / lock data. Those are gone now, so clean them up. Your email stays.
(function cleanOld() {
  var u = getUser();
  if (!u) return;
  var dirty = false;
  ["salt", "hash", "iter", "rsalt", "rhash", "riter", "cred", "skipLock"].forEach(function (k) {
    if (k in u) { delete u[k]; dirty = true; }
  });
  if (dirty) setUser(u);
  try { localStorage.removeItem("yunika.session"); localStorage.removeItem("yunika.lock"); } catch (e) {}
})();

/* ---------- screens ---------- */
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }
function only(el) { [auth, home, app].forEach(function (s) { if (s === el) show(s); else hide(s); }); }

var greeting = $("greeting");
function enterApp(user) {
  greeting.textContent = "Hello!";
  $("setEmail").textContent = user && user.email ? user.email : "";
  only(home);
  showHome();
}

/* ---------- sign up (first time only) ---------- */
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
var signupForm = $("signupForm");

signupForm.addEventListener("submit", function (e) {
  e.preventDefault();
  var err = $("suError");
  err.textContent = "";
  var email = $("suEmail").value.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) { err.textContent = "Please enter a valid email address."; return; }

  var user = { email: email, created: Date.now() };
  if (!setUser(user)) {
    err.textContent = "Couldn't save your account. Allow site data for this page and try again.";
    return;
  }
  signupForm.reset();
  enterApp(user);
});

/* ---------- Continue with Google (account chooser) ---------- */
var GOOGLE_CLIENT_ID = "366800918126-8dm9ekhdkok4khdj67ndj0se615kc9lt.apps.googleusercontent.com";
var googleBtn = $("googleBtn"), gErr = $("gError"), gTokenClient = null;

function loadGoogle(cb) {
  if (window.google && google.accounts && google.accounts.oauth2) { cb(); return; }
  var sc = document.createElement("script");
  sc.src = "https://accounts.google.com/gsi/client";
  sc.async = true;
  sc.onload = cb;
  sc.onerror = function () { gErr.textContent = "Couldn't reach Google. Check your internet and try again."; googleBtn.disabled = false; };
  document.head.appendChild(sc);
}

function finishGoogle(accessToken) {
  fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: "Bearer " + accessToken } })
    .then(function (r) { return r.json(); })
    .then(function (info) {
      var email = (info && info.email || "").toLowerCase();
      if (!EMAIL_RE.test(email)) throw new Error("no email");
      var user = { email: email, created: Date.now() };
      if (!setUser(user)) { gErr.textContent = "Couldn't save your account on this device."; googleBtn.disabled = false; return; }
      googleBtn.disabled = false;
      enterApp(user);
    })
    .catch(function () { gErr.textContent = "Sign-in failed. Please try again."; googleBtn.disabled = false; });
}

googleBtn.addEventListener("click", function () {
  gErr.textContent = "";
  googleBtn.disabled = true;
  loadGoogle(function () {
    if (!gTokenClient) {
      gTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid email",
        prompt: "select_account",
        callback: function (resp) {
          if (resp && resp.access_token) finishGoogle(resp.access_token);
          else { gErr.textContent = "Sign-in was cancelled."; googleBtn.disabled = false; }
        },
        error_callback: function () { gErr.textContent = "Sign-in was cancelled."; googleBtn.disabled = false; }
      });
    }
    gTokenClient.requestAccessToken();
  });
});

/* ---------- sign out ---------- */
$("setOut").addEventListener("click", function () {
  var ok = window.confirm(
    "Sign out? This removes your email and your button layout from this device.");
  if (!ok) return;
  wipeEverything();
  saved = {};
  resetChat();
  closeSheets();
  signupForm.reset();
  only(auth);
});

/* ---------- start: splash for 3 seconds, then decide where to go ---------- */
setTimeout(function () {
  splash.classList.add("out");
  setTimeout(function () { hide(splash); }, 450);
  var user = getUser();
  if (user) enterApp(user);        // already signed up -> straight into the app
  else only(auth);                 // new -> sign up
}, SPLASH_MS);
