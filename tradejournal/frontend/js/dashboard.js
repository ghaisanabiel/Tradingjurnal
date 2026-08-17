const API_BASE = window.API_BASE || "https://tradingjurnal-production.up.railway.app";

function authHeaders() {
  const token = localStorage.getItem("access_token"); // set by auth.js on auth.html, read here
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts.headers || {}) },
  });
  if (res.status === 401) {
    logout(); // token invalid/expired — bounce back to auth.html instead of surfacing a raw 401
    throw new Error("Session expired, silakan login lagi");
  }
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

function logout() {
  localStorage.removeItem("access_token");
  window.location.href = "auth.html";
}

document.getElementById("logoutBtn").addEventListener("click", logout);

// ---- Theme toggle (light/dark) ----
const SUN_PATH = '<path d="M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5L19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5L19 5"/><circle cx="12" cy="12" r="4"/>';
const MOON_PATH = '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>';

function applyThemeUI(theme) {
  const icon = document.getElementById("themeIcon");
  const label = document.getElementById("themeLabel");
  if (theme === "light") {
    icon.innerHTML = SUN_PATH;
    label.textContent = "Switch to Dark Mode";
  } else {
    icon.innerHTML = MOON_PATH;
    label.textContent = "Switch to Light Mode";
  }
}
applyThemeUI(document.documentElement.getAttribute("data-theme") || "dark");

document.getElementById("themeToggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  applyThemeUI(next);
});

// ---- Profile dropdown ----
const profileTrigger = document.getElementById("profileTrigger");
const profileDropdown = document.getElementById("profileDropdown");

function closeDropdown() {
  profileDropdown.classList.remove("open");
  profileTrigger.setAttribute("aria-expanded", "false");
}

profileTrigger.addEventListener("click", (e) => {
  e.stopPropagation();
  const willOpen = !profileDropdown.classList.contains("open");
  profileDropdown.classList.toggle("open", willOpen);
  profileTrigger.setAttribute("aria-expanded", String(willOpen));
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".profile-menu")) closeDropdown();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDropdown(); });

// ---- Exchange modal ----
const exchangeOverlay = document.getElementById("exchangeModalOverlay");
const exchangeList = document.getElementById("exchangeList");
const exchangeForm = document.getElementById("exchangeForm");
const exchangeConnectBtn = document.getElementById("exchangeConnectBtn");
const exchangeError = document.getElementById("exchangeError");

function exchangeIconLabel(exchange) {
  return { binance: "BIN", bybit: "BYB", bitget: "BTG" }[exchange] || exchange.slice(0, 3).toUpperCase();
}

async function loadExchangeList() {
  exchangeList.innerHTML = `<p class="placeholder">Loading...</p>`;
  try {
    const connections = await api("/exchanges");
    if (connections.length === 0) {
      exchangeList.innerHTML = `<p class="placeholder">Belum ada exchange yang terhubung.</p>`;
      return;
    }
    exchangeList.innerHTML = "";
    connections.forEach((c) => {
      const row = document.createElement("div");
      row.className = "exchange-row";
      row.innerHTML = `
        <div class="ex-icon">${exchangeIconLabel(c.exchange)}</div>
        <div class="ex-info">
          <div class="ex-name">${c.exchange} <span class="exchange-status ${c.status}">${c.status}</span></div>
          <div class="ex-meta">${c.label} · last sync: ${c.last_sync_at ? fmtTime(c.last_sync_at) : "belum pernah"}</div>
        </div>
        <div class="ex-actions">
          <button class="ex-sync" data-id="${c.id}">Sync</button>
          <button class="ex-disconnect" data-id="${c.id}">Disconnect</button>
        </div>`;
      exchangeList.appendChild(row);
    });
  } catch (e) {
    exchangeList.innerHTML = `<p class="placeholder">Gagal muat daftar exchange. (${e.message})</p>`;
  }
}

exchangeList.addEventListener("click", async (e) => {
  const syncBtn = e.target.closest(".ex-sync");
  const disconnectBtn = e.target.closest(".ex-disconnect");
  if (syncBtn) {
    syncBtn.textContent = "Syncing...";
    syncBtn.disabled = true;
    try {
      await api(`/exchanges/${syncBtn.dataset.id}/sync`, { method: "POST" });
      await loadExchangeList();
      loadOverview();
      loadJournal();
    } catch (err) {
      syncBtn.textContent = "Sync";
      syncBtn.disabled = false;
    }
  }
  if (disconnectBtn) {
    if (!confirm("Putuskan koneksi exchange ini?")) return;
    try {
      await api(`/exchanges/${disconnectBtn.dataset.id}`, { method: "DELETE" });
      await loadExchangeList();
    } catch (err) {
      alert(`Gagal disconnect: ${err.message}`);
    }
  }
});

document.getElementById("exchangeSelect").addEventListener("change", (e) => {
  document.getElementById("passphraseField").style.display = e.target.value === "bitget" ? "block" : "none";
});

exchangeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  exchangeError.textContent = "";
  exchangeConnectBtn.classList.add("is-loading");
  exchangeConnectBtn.disabled = true;
  try {
    await api("/exchanges/connect", {
      method: "POST",
      body: JSON.stringify({
        exchange: document.getElementById("exchangeSelect").value,
        label: document.getElementById("exchangeLabel").value || "default",
        api_key: document.getElementById("exchangeApiKey").value,
        api_secret: document.getElementById("exchangeApiSecret").value,
        passphrase: document.getElementById("exchangePassphrase").value || null,
      }),
    });
    exchangeForm.reset();
    document.getElementById("passphraseField").style.display = "none";
    await loadExchangeList();
    loadOverview();
    loadJournal();
  } catch (err) {
    exchangeError.textContent = `Gagal connect: ${err.message}`;
  } finally {
    exchangeConnectBtn.classList.remove("is-loading");
    exchangeConnectBtn.disabled = false;
  }
});

document.getElementById("openExchangeModal").addEventListener("click", () => {
  closeDropdown();
  exchangeOverlay.classList.add("open");
  loadExchangeList();
});
document.getElementById("exchangeModalClose").addEventListener("click", () => exchangeOverlay.classList.remove("open"));
exchangeOverlay.addEventListener("click", (e) => { if (e.target === exchangeOverlay) exchangeOverlay.classList.remove("open"); });
document.querySelectorAll(".dropdown-item[data-soon]").forEach((item) => {
  item.addEventListener("click", () => {
    const label = item.dataset.soon;
    showLoadError(`${label} belum tersedia — segera hadir.`);
    setTimeout(() => document.querySelector(".load-error-banner")?.remove(), 3000);
    closeDropdown();
  });
});

const fmtUSD = (n) => `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n) => `${n >= 0 ? "+" : ""}${Number(n ?? 0).toFixed(2)}%`;
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";

// ---- Nav switching ----
document.querySelectorAll(".nav-item").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
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
    { label: "Profit Factor", value: stats.profit_factor ?? "—", color: "#22c55e" },
    { label: "Expectancy", value: fmtUSD(stats.expectancy), color: "#f5a623" },
    { label: "Avg Holding", value: `${stats.avg_holding_hours}h`, color: "#6c5ce7" },
    { label: "Largest Win", value: fmtUSD(stats.largest_win), color: "#22c55e" },
    { label: "Largest Loss", value: fmtUSD(stats.largest_loss), color: "#ef4444" },
  ];

  const container = document.getElementById("perfCards");
  container.innerHTML = perf.map((p) => `
    <div class="perf-card">
      <div class="icon" style="background:${p.color}2a"></div>
      <div class="label">${p.label}</div>
      <div class="value">${p.value}</div>
    </div>
  `).join("");
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
    node.querySelector(".trade-chart").style.backgroundImage = `url(${trade.screenshot_url})`;
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
  window._searchDebounce = setTimeout(() => loadJournal({ reset: true, q: e.target.value }), 300);
});

// infinite scroll
window.addEventListener("scroll", () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 400) {
    loadJournal({ reset: false });
  }
});

document.getElementById("syncAllBtn").addEventListener("click", async () => {
  const connections = await api("/exchanges");
  await Promise.all(connections.map((c) => api(`/exchanges/${c.id}/sync`, { method: "POST" })));
  loadOverview();
  loadJournal();
});

// ---- Init ----
// The inline script at the top of index.html already redirects to auth.html
// if there's no token, so by the time this file runs we're authenticated.
function showLoadError(message) {
  const existing = document.querySelector(".load-error-banner");
  if (existing) existing.remove();
  const banner = document.createElement("div");
  banner.className = "load-error-banner";
  banner.style.cssText = "background:#2a1414;border:1px solid #ef4444;color:#ef4444;padding:12px 16px;border-radius:10px;margin-bottom:20px;font-size:13px;";
  banner.textContent = message;
  document.querySelector(".topbar").insertAdjacentElement("afterend", banner);
}

(async function init() {
  try {
    await Promise.all([loadOverview(), loadJournal()]);
  } catch (e) {
    console.error("Failed to load dashboard:", e);
    showLoadError(`Gagal fetch dari ${API_BASE} — cek backend jalan dan CORS mengizinkan origin ini. (${e.message})`);
  }
})();