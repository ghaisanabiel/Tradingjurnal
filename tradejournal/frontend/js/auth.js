/* Fully isolated from dashboard.js — this file only knows about auth.html's DOM. */
const API_BASE = window.API_BASE || "https://tradingjurnal-production.up.railway.app";

/* ================= Candlestick tape background ================= */
(function candleTape() {
  const canvas = document.getElementById("candleCanvas");
  const ctx = canvas.getContext("2d");
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w, h;

  const CANDLE_W = 14, GAP = 6, STEP = CANDLE_W + GAP, SPEED = 0.35;
  let offset = 0;
  let candles = [];
  let lastClose = 100;

  function nextCandle() {
    const open = lastClose;
    const drift = (Math.random() - 0.48) * 6;
    const close = Math.max(20, open + drift);
    const high = Math.max(open, close) + Math.random() * 3;
    const low = Math.min(open, close) - Math.random() * 3;
    lastClose = close;
    return { open, close, high, low };
  }

  function resize() {
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const needed = Math.ceil(w / STEP) + 4;
    candles = Array.from({ length: needed }, nextCandle);
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const midY = h * 0.58;
    const scale = Math.min(28, h * 0.045);

    candles.forEach((c, i) => {
      const x = i * STEP - offset;
      if (x < -STEP || x > w + STEP) return;
      const up = c.close >= c.open;
      ctx.strokeStyle = ctx.fillStyle = up ? "#22c55e" : "#ef4444";
      ctx.globalAlpha = 0.85;

      ctx.beginPath();
      ctx.moveTo(x + CANDLE_W / 2, midY - c.high * (scale / 100));
      ctx.lineTo(x + CANDLE_W / 2, midY - c.low * (scale / 100));
      ctx.lineWidth = 1;
      ctx.stroke();

      const bodyTop = midY - Math.max(c.open, c.close) * (scale / 100);
      const bodyBottom = midY - Math.min(c.open, c.close) * (scale / 100);
      ctx.fillRect(x, bodyTop, CANDLE_W, Math.max(2, bodyBottom - bodyTop));
    });
    ctx.globalAlpha = 1;
  }

  function tick() {
    offset += SPEED;
    if (offset >= STEP) {
      offset -= STEP;
      candles.shift();
      candles.push(nextCandle());
    }
    draw();
    requestAnimationFrame(tick);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(tick);
})();

/* ================= Custom cursor ================= */
(function customCursor() {
  const dot = document.getElementById("cursorDot");
  const ring = document.getElementById("cursorRing");
  let mx = -100, my = -100, rx = -100, ry = -100;

  window.addEventListener("mousemove", (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
  });

  function loop() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  document.querySelectorAll("a, button, input").forEach((el) => {
    el.addEventListener("mouseenter", () => ring.classList.add("hover"));
    el.addEventListener("mouseleave", () => ring.classList.remove("hover"));
  });
})();

/* ================= Slide switching (Login <-> Register) ================= */
const authTrack = document.getElementById("authTrack");
const loginSlide = document.getElementById("loginSlide");
const registerSlide = document.getElementById("registerSlide");

function switchTo(target) {
  const toRegister = target === "register";
  authTrack.classList.toggle("show-register", toRegister);
  loginSlide.setAttribute("aria-hidden", String(toRegister));
  registerSlide.setAttribute("aria-hidden", String(!toRegister));
  setAuthError("");
}

document.querySelectorAll("[data-switch]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    switchTo(el.dataset.switch);
  });
});

/* ================= Error / toast helpers ================= */
const authErrorEl = document.getElementById("authError");
const authToastEl = document.getElementById("authToast");
function setAuthError(msg) { authErrorEl.textContent = msg || ""; }
function setAuthToast(msg) {
  authToastEl.textContent = msg || "";
  if (msg) setTimeout(() => { if (authToastEl.textContent === msg) authToastEl.textContent = ""; }, 4000);
}

/* ================= Button press "grow" feedback ================= */
function pressButton(btn) {
  btn.classList.add("pressed");
  setTimeout(() => btn.classList.remove("pressed"), 160);
}

/* ================= Auth requests ================= */
// POST /auth/login expects x-www-form-urlencoded (OAuth2PasswordRequestForm) — same contract as before.
async function loginRequest(email, password) {
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || "Email atau password salah");
  }
  const data = await res.json();
  localStorage.setItem("access_token", data.access_token); // same key dashboard.js reads
}

// POST /auth/register expects JSON {email, password} — same contract as before.
async function registerRequest(email, password) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || "Gagal membuat akun");
  }
}

function goToDashboard() {
  window.location.href = "index.html";
}

/* ================= Login form ================= */
const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthError("");
  pressButton(loginBtn);
  loginBtn.classList.add("is-loading");
  loginBtn.disabled = true;
  try {
    await loginRequest(
      document.getElementById("loginEmail").value.trim(),
      document.getElementById("loginPassword").value
    );
    goToDashboard();
  } catch (err) {
    setAuthError(err.message);
    loginBtn.classList.remove("is-loading");
    loginBtn.disabled = false;
  }
});

document.getElementById("forgotLink").addEventListener("click", (e) => {
  e.preventDefault();
  setAuthToast("Reset password lewat email belum aktif — nyusul di update berikutnya.");
});

/* ================= Register form ================= */
const registerForm = document.getElementById("registerForm");
const registerBtn = document.getElementById("registerBtn");

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthError("");
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirm = document.getElementById("registerConfirm").value;

  if (password !== confirm) {
    setAuthError("Konfirmasi password gak cocok.");
    return;
  }

  pressButton(registerBtn);
  registerBtn.classList.add("is-loading");
  registerBtn.disabled = true;
  try {
    await registerRequest(email, password);
    await loginRequest(email, password); // auto-login right after successful register
    goToDashboard();
  } catch (err) {
    setAuthError(err.message);
    registerBtn.classList.remove("is-loading");
    registerBtn.disabled = false;
  }
});