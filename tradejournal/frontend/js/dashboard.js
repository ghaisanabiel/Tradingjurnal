const API_BASE =
  window.API_BASE || "https://tradingjournal-production.up.railway.app";

function authHeaders() {
  const token = localStorage.getItem("access_token"); // swap for httpOnly cookie session before shipping to real users
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isLoggedIn() {
  return !!localStorage.getItem("access_token");
}

async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    logout(); // token invalid/expired — drop back to login instead of surfacing a raw 401
    throw new Error("Session expired, silakan login lagi");
  }
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

// ---- Auth screen ----
const authScreenEl = document.getElementById("authScreen");
const appShellEl = document.getElementById("appShell");
const authErrorEl = document.getElementById("authError");

function showAuthScreen() {
  authScreenEl.classList.remove("hidden");
  appShellEl.classList.remove("visible");
}

function showApp() {
  authScreenEl.classList.add("hidden");
  appShellEl.classList.add("visible");
}

function setAuthError(msg) {
  authErrorEl.textContent = msg || "";
}

document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".auth-tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".auth-form")
      .forEach((f) => f.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`${tab.dataset.tab}Form`).classList.add("active");
    setAuthError("");
  });
});

// POST /auth/login expects x-www-form-urlencoded (OAuth2PasswordRequestForm), not JSON.
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
  localStorage.setItem("access_token", data.access_token);
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthError("");
  const submitBtn = e.target.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  try {
    await loginRequest(
      document.getElementById("loginEmail").value,
      document.getElementById("loginPassword").value,
    );
    await bootApp();
  } catch (err) {
    setAuthError(err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// POST /auth/register expects JSON {email, password} (schemas.UserCreate).
document
  .getElementById("registerForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    setAuthError("");
    const submitBtn = e.target.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Gagal mendaftar");
      }
      await loginRequest(email, password); // auto-login right after successful register
      await bootApp();
    } catch (err) {
      setAuthError(err.message);
    } finally {
      submitBtn.disabled = false;
    }
  });

function logout() {
  localStorage.removeItem("access_token");
  document.getElementById("journalList").innerHTML = "";
  document.getElementById("perfCards").innerHTML = "";
  document.getElementById("loginForm").reset();
  document.getElementById("registerForm").reset();
  showAuthScreen();
}

document.getElementById("logoutBtn").addEventListener("click", logout);

const fmtUSD = (n) =>
  `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n) => `${n >= 0 ? "+" : ""}${Number(n ?? 0).toFixed(2)}%`;
const fmtTime = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

// ---- Nav switching ----
document.querySelectorAll(".nav-item").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    document
      .querySelectorAll(".nav-item")
      .forEach((n) => n.classList.remove("active"));
    document
      .querySelectorAll(".view")
      .forEach((v) => v.classList.remove("active"));
    el.classList.add("active");
    document.getElementById(`view-${el.dataset.view}`).classList.add("active");
    document.getElementById("pageTitle").textContent = el.title;
  });
});

// ---- Overview / summary + performance cards ----
async function loadOverview() {
  const stats = await api("/stats/overview");

  document.getElementById("statTotalPnl").textContent = fmtUSD(stats.total_pnl);
  document.getElementById("statTotalPnlPct").textContent = "";

  const perf = [
    { label: "Win Rate", value: `${stats.win_rate}%`, color: "#6c5ce7" },
    { label: "Total Trades", value: stats.total_trades, color: "#4f8cff" },
    {
      label: "Profit Factor",
      value: stats.profit_factor ?? "—",
      color: "#22c55e",
    },
    { label: "Expectancy", value: fmtUSD(stats.expectancy), color: "#f5a623" },
    {
      label: "Avg Holding",
      value: `${stats.avg_holding_hours}h`,
      color: "#6c5ce7",
    },
    {
      label: "Largest Win",
      value: fmtUSD(stats.largest_win),
      color: "#22c55e",
    },
    {
      label: "Largest Loss",
      value: fmtUSD(stats.largest_loss),
      color: "#ef4444",
    },
  ];

  const container = document.getElementById("perfCards");
  container.innerHTML = perf
    .map(
      (p) => `
    <div class="perf-card">
      <div class="icon" style="background:${p.color}2a"></div>
      <div class="label">${p.label}</div>
      <div class="value">${p.value}</div>
    </div>
  `,
    )
    .join("");
}

// ---- Journal list ----
const cardTpl = document.getElementById("tradeCardTemplate");

function renderTradeCard(trade) {
  const node = cardTpl.content.cloneNode(true);
  node.querySelector(".badge").textContent = trade.side.toUpperCase();
  node.querySelector(".badge").classList.add(trade.side);
  node.querySelector(".pair").textContent = trade.pair;
  node.querySelector(".trade-meta").textContent =
    `${trade.margin_mode ?? ""}${trade.margin_mode ? " · " : ""}${trade.leverage ? trade.leverage + "x" : ""}`;
  node.querySelector(".entry").textContent = trade.entry_price;
  node.querySelector(".exit").textContent = trade.exit_price ?? "-";
  node.querySelector(".open").textContent = fmtTime(trade.open_time);
  node.querySelector(".close").textContent = fmtTime(trade.close_time);

  const pnlEl = node.querySelector(".pnl");
  pnlEl.textContent = fmtUSD(trade.pnl);
  pnlEl.classList.add(trade.pnl >= 0 ? "positive" : "negative");

  const roiEl = node.querySelector(".roi");
  roiEl.textContent = trade.roi != null ? fmtPct(trade.roi) : "";
  roiEl.classList.add(trade.roi >= 0 ? "positive" : "negative");

  const statusEl = node.querySelector(".status-badge");
  statusEl.textContent = trade.status.toUpperCase();
  statusEl.classList.add(trade.status);

  if (trade.screenshot_url) {
    node.querySelector(".trade-chart").style.backgroundImage =
      `url(${trade.screenshot_url})`;
    node.querySelector(".trade-chart").style.backgroundSize = "cover";
  }
  return node;
}

let journalCursor = null;
async function loadJournal({ reset = true, q = "" } = {}) {
  if (reset) {
    journalCursor = null;
    document.getElementById("journalList").innerHTML = "";
  }
  const params = new URLSearchParams({ limit: "20" });
  if (q) params.set("q", q);
  if (journalCursor) params.set("cursor", journalCursor);

  const trades = await api(`/trades?${params}`);
  const list = document.getElementById("journalList");
  if (reset && trades.length === 0) {
    list.innerHTML = `<p class="placeholder">Belum ada trade. Connect exchange lalu klik "Sync All", atau tambah manual lewat POST /trades.</p>`;
    return;
  }
  trades.forEach((t) => list.appendChild(renderTradeCard(t)));
  if (trades.length) journalCursor = trades[trades.length - 1].id;
}

document.getElementById("journalSearch").addEventListener("input", (e) => {
  clearTimeout(window._searchDebounce);
  window._searchDebounce = setTimeout(
    () => loadJournal({ reset: true, q: e.target.value }),
    300,
  );
});

// infinite scroll
window.addEventListener("scroll", () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 400) {
    loadJournal({ reset: false });
  }
});

document.getElementById("syncAllBtn").addEventListener("click", async () => {
  const connections = await api("/exchanges");
  await Promise.all(
    connections.map((c) => api(`/exchanges/${c.id}/sync`, { method: "POST" })),
  );
  loadOverview();
  loadJournal();
});

// ---- Init ----
function showLoadError(message) {
  const existing = document.querySelector(".load-error-banner");
  if (existing) existing.remove();
  const banner = document.createElement("div");
  banner.className = "load-error-banner";
  banner.style.cssText =
    "background:#2a1414;border:1px solid #ef4444;color:#ef4444;padding:12px 16px;border-radius:10px;margin-bottom:20px;font-size:13px;";
  banner.textContent = message;
  document.querySelector(".topbar").insertAdjacentElement("afterend", banner);
}

// Called after a successful login/register, and on page load if a token already exists.
// Only hits protected endpoints (/stats/overview, /trades, /exchanges) once we actually have a token.
async function bootApp() {
  showApp();
  try {
    await Promise.all([loadOverview(), loadJournal()]);
  } catch (e) {
    console.error("Failed to load dashboard:", e);
    if (isLoggedIn()) {
      showLoadError(
        `Gagal fetch dari ${API_BASE} — cek backend jalan dan CORS mengizinkan origin ini. (${e.message})`,
      );
    }
  }
}

(function init() {
  if (isLoggedIn()) {
    bootApp();
  } else {
    showAuthScreen(); // no /stats or /trades request happens until login succeeds
  }
})();
