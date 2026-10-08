// YUNIKA AI - v4
// Flow: 3-second splash -> (new user) Sign up / Log in  |  (already signed in) straight into the app.
// Accounts are stored ONLY on this device (localStorage). Passwords are never saved as plain text:
// they are turned into a salted PBKDF2 hash. The AI itself is not connected yet.

(function () {
  var $ = function (id) { return document.getElementById(id); };

  var splash = $("splash"), auth = $("auth"), app = $("app");
  var SPLASH_MS = 3000;   // how long the logo plays

  var K_USER = "yunika.user", K_SESSION = "yunika.session", K_LOCK = "yunika.lock";
  var ITERATIONS = 150000;
  var MAX_TRIES = 5, LOCK_SECONDS = 30;

  /* ---------- safe storage ---------- */
  function getUser() {
    try { var s = localStorage.getItem(K_USER); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function setUser(u) {
    try { localStorage.setItem(K_USER, JSON.stringify(u)); return true; } catch (e) { return false; }
  }
  function hasSession() {
    try { return localStorage.getItem(K_SESSION) === "1"; } catch (e) { return false; }
  }
  function setSession(on) {
    try { if (on) localStorage.setItem(K_SESSION, "1"); else localStorage.removeItem(K_SESSION); } catch (e) {}
  }
  function getLock() {
    try { return JSON.parse(localStorage.getItem(K_LOCK)) || { n: 0, until: 0 }; } catch (e) { return { n: 0, until: 0 }; }
  }
  function setLock(l) {
    try { localStorage.setItem(K_LOCK, JSON.stringify(l)); } catch (e) {}
  }
  function wipeEverything() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      keys.forEach(function (k) { if (k && k.indexOf("yunika.") === 0) localStorage.removeItem(k); });
    } catch (e) {}
  }

  /* ---------- password hashing (PBKDF2 + random salt) ---------- */
  function canHash() { return !!(window.crypto && crypto.subtle && window.TextEncoder); }
  function toB64(bytes) {
    var s = ""; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function fromB64(b64) {
    var s = atob(b64), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function hashPassword(password, saltBytes, iterations) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"])
      .then(function (key) {
        return crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBytes, iterations: iterations, hash: "SHA-256" }, key, 256);
      })
      .then(function (bits) { return toB64(new Uint8Array(bits)); });
  }
  function sameText(a, b) {              // compares without stopping at the first difference
    if (a.length !== b.length) return false;
    var diff = 0; for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  /* ---------- screens ---------- */
  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }

  function closeSplash(next) {
    splash.classList.add("out");
    setTimeout(function () { hide(splash); }, 450);
    next();
  }

  var greeting = $("greeting");
  function enterApp(user) {
    hide(auth);
    greeting.textContent = user && user.name ? "Hello, " + user.name + "!" : "Hello!";
    show(app);
  }

  /* ---------- sign up / log in screen ---------- */
  var tabSignup = $("tabSignup"), tabLogin = $("tabLogin");
  var signupForm = $("signupForm"), loginForm = $("loginForm");
  var authTitle = $("authTitle"), authSub = $("authSub");

  function switchTab(which) {
    var user = getUser();
    var isLogin = which === "login";
    tabSignup.classList.toggle("active", !isLogin);
    tabLogin.classList.toggle("active", isLogin);
    tabSignup.setAttribute("aria-selected", String(!isLogin));
    tabLogin.setAttribute("aria-selected", String(isLogin));
    signupForm.classList.toggle("hidden", isLogin);
    loginForm.classList.toggle("hidden", !isLogin);
    $("suError").textContent = ""; $("liError").textContent = "";
    if (isLogin) {
      authTitle.textContent = user && user.name ? "Welcome back, " + user.name : "Log in";
      authSub.textContent = "Log in to continue.";
      if (user && user.email) $("liEmail").value = user.email;
    } else {
      authTitle.textContent = "Create your account";
      authSub.textContent = "Sign up once to start using YUNIKA AI.";
    }
  }

  function showAuth(which) {
    hide(app);
    show(auth);
    switchTab(which);
  }

  tabSignup.addEventListener("click", function () { switchTab("signup"); });
  tabLogin.addEventListener("click", function () { switchTab("login"); });

  Array.prototype.forEach.call(document.querySelectorAll(".pw-toggle"), function (btn) {
    btn.addEventListener("click", function () {
      var input = $(btn.getAttribute("data-target"));
      var showIt = input.type === "password";
      input.type = showIt ? "text" : "password";
      btn.textContent = showIt ? "Hide" : "Show";
    });
  });

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  signupForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("suError"), btn = $("suBtn");
    err.textContent = "";
    var name = $("suName").value.trim();
    var email = $("suEmail").value.trim().toLowerCase();
    var pass = $("suPass").value, pass2 = $("suPass2").value;

    if (!name) { err.textContent = "Please enter your name."; return; }
    if (!EMAIL_RE.test(email)) { err.textContent = "Please enter a valid email address."; return; }
    if (pass.length < 8 || !pass.trim()) { err.textContent = "Password must be at least 8 characters."; return; }
    if (pass !== pass2) { err.textContent = "Passwords don't match."; return; }
    if (getUser()) {
      switchTab("login");
      $("liError").textContent = "An account already exists on this device. Please log in.";
      return;
    }
    if (!canHash()) { err.textContent = "This browser can't do secure sign-in. Please update Chrome."; return; }

    btn.disabled = true; btn.textContent = "Creating…";
    var salt = crypto.getRandomValues(new Uint8Array(16));
    hashPassword(pass, salt, ITERATIONS).then(function (hash) {
      var user = { name: name, email: email, salt: toB64(salt), hash: hash, iter: ITERATIONS, created: Date.now() };
      if (!setUser(user)) {
        err.textContent = "Couldn't save your account. Allow site data for this page and try again.";
        return;
      }
      setLock({ n: 0, until: 0 });
      setSession(true);
      signupForm.reset();
      enterApp(user);
    }).catch(function () {
      err.textContent = "Something went wrong. Please try again.";
    }).then(function () {
      btn.disabled = false; btn.textContent = "Create account";
    });
  });

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("liError"), btn = $("liBtn");
    err.textContent = "";
    var email = $("liEmail").value.trim().toLowerCase();
    var pass = $("liPass").value;
    var user = getUser();

    if (!user) {
      err.textContent = "No account found on this device. Please sign up first.";
      return;
    }
    if (!email || !pass) { err.textContent = "Please enter your email and password."; return; }

    var lock = getLock(), now = Date.now();
    if (lock.until > now) {
      err.textContent = "Too many attempts. Try again in " + Math.ceil((lock.until - now) / 1000) + " seconds.";
      return;
    }
    if (!canHash()) { err.textContent = "This browser can't do secure sign-in. Please update Chrome."; return; }

    btn.disabled = true; btn.textContent = "Checking…";
    hashPassword(pass, fromB64(user.salt), user.iter || ITERATIONS).then(function (hash) {
      var ok = sameText(hash, user.hash) && sameText(email, user.email);
      if (ok) {
        setLock({ n: 0, until: 0 });
        setSession(true);
        loginForm.reset();
        enterApp(user);
        return;
      }
      var n = (lock.n || 0) + 1;
      if (n >= MAX_TRIES) {
        setLock({ n: 0, until: Date.now() + LOCK_SECONDS * 1000 });
        err.textContent = "Too many attempts. Try again in " + LOCK_SECONDS + " seconds.";
      } else {
        setLock({ n: n, until: 0 });
        err.textContent = "Incorrect email or password.";
      }
    }).catch(function () {
      err.textContent = "Something went wrong. Please try again.";
    }).then(function () {
      btn.disabled = false; btn.textContent = "Log in";
    });
  });

  $("resetBtn").addEventListener("click", function () {
    var ok = window.confirm(
      "This will erase your account and everything saved in this app on this device. " +
      "This can't be undone. Continue?");
    if (!ok) return;
    wipeEverything();
    signupForm.reset(); loginForm.reset();
    switchTab("signup");
  });

  $("logoutBtn").addEventListener("click", function () {
    setSession(false);
    showAuth("login");
  });

  /* ---------- start: splash for 3 seconds, then decide where to go ---------- */
  setTimeout(function () {
    closeSplash(function () {
      var user = getUser();
      if (user && hasSession()) enterApp(user);          // already signed in -> straight into the app
      else showAuth(user ? "login" : "signup");          // new -> sign up / log in
    });
  }, SPLASH_MS);

  /* ---------- chat (AI not connected yet) ---------- */
  var chat = $("chat"), empty = $("empty"), form = $("composer"), input = $("input");

  function addMessage(text, who) {
    if (empty) { empty.remove(); empty = null; }
    var el = document.createElement("div");
    el.className = "msg " + who;
    el.textContent = text; // textContent keeps it safe
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    addMessage(text, "user");
    input.value = "";
    setTimeout(function () {
      addMessage("The AI isn't connected yet. I'll learn to reply in the next step.", "ai");
    }, 500);
  });

  /* ---------- PWA (works offline) ---------- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
