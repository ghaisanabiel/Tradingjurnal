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

    if (el.dataset.view === "journal") loadJournalFull({ reset: true });
    if (el.dataset.view === "statistics") loadStatistics();
    if (el.dataset.view === "calendar") loadCalendar();
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

  const card = node.querySelector(".trade-card");
  card.dataset.id = trade.id;
  card.addEventListener("click", () => openTradeEdit(trade));
  return node;
}

// ---- Trading plans (create/list, attach to trade) ----
let tradingPlansCache = [];

async function loadTradingPlans() {
  tradingPlansCache = await api("/trading-plans");
  return tradingPlansCache;
}

function populatePlanSelect(selectEl, selectedId) {
  selectEl.innerHTML = `<option value="">— No plan —</option>` +
    tradingPlansCache.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  selectEl.value = selectedId || "";
}

// ---- Trade edit modal ----
const tradeEditOverlay = document.getElementById("tradeEditOverlay");
const tradeEditForm = document.getElementById("tradeEditForm");
const tradeEditError = document.getElementById("tradeEditError");
const tradeEditSaveBtn = document.getElementById("tradeEditSaveBtn");
const tradePlanSelect = document.getElementById("tradePlanSelect");
let editingTradeId = null;

async function openTradeEdit(trade) {
  editingTradeId = trade.id;
  tradeEditError.textContent = "";
  document.getElementById("tradePlannedTp").value = trade.planned_tp ?? "";
  document.getElementById("tradePlannedSl").value = trade.planned_sl ?? "";
  document.getElementById("tradeNoteInput").value = trade.note ?? "";
  if (tradingPlansCache.length === 0) await loadTradingPlans().catch(() => {});
  populatePlanSelect(tradePlanSelect, trade.trading_plan_id);
  tradeEditOverlay.classList.add("open");
}

document.getElementById("tradeEditClose").addEventListener("click", () => tradeEditOverlay.classList.remove("open"));
tradeEditOverlay.addEventListener("click", (e) => { if (e.target === tradeEditOverlay) tradeEditOverlay.classList.remove("open"); });

document.getElementById("newPlanBtn").addEventListener("click", async () => {
  const name = prompt("Nama trading plan baru (misal: Support Resistance)");
  if (!name) return;
  try {
    const plan = await api("/trading-plans", { method: "POST", body: JSON.stringify({ name }) });
    await loadTradingPlans();
    populatePlanSelect(tradePlanSelect, plan.id);
  } catch (err) {
    alert(`Gagal bikin plan: ${err.message}`);
  }
});

tradeEditForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  tradeEditError.textContent = "";
  tradeEditSaveBtn.classList.add("is-loading");
  tradeEditSaveBtn.disabled = true;
  try {
    const tpVal = document.getElementById("tradePlannedTp").value;
    const slVal = document.getElementById("tradePlannedSl").value;
    await api(`/trades/${editingTradeId}`, {
      method: "PATCH",
      body: JSON.stringify({
        note: document.getElementById("tradeNoteInput").value || null,
        trading_plan_id: tradePlanSelect.value || null,
        planned_tp: tpVal === "" ? null : parseFloat(tpVal),
        planned_sl: slVal === "" ? null : parseFloat(slVal),
      }),
    });
    tradeEditOverlay.classList.remove("open");
    loadJournal();
    if (document.getElementById("view-journal").classList.contains("active")) loadJournalFull({ reset: true });
  } catch (err) {
    tradeEditError.textContent = `Gagal simpan: ${err.message}`;
  } finally {
    tradeEditSaveBtn.classList.remove("is-loading");
    tradeEditSaveBtn.disabled = false;
  }
});

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

// ---- Full Journal view (Journal tab) ----
let journalFullCursor = null;
async function loadJournalFull({ reset = true } = {}) {
  const list = document.getElementById("journalFullList");
  if (reset) { journalFullCursor = null; list.innerHTML = ""; }

  const params = new URLSearchParams({ limit: "30" });
  const q = document.getElementById("journalFullSearch").value;
  const exchange = document.getElementById("journalFilterExchange").value;
  const status = document.getElementById("journalFilterStatus").value;
  if (q) params.set("q", q);
  if (exchange) params.set("exchange", exchange);
  if (status) params.set("status", status);
  if (journalFullCursor) params.set("cursor", journalFullCursor);

  try {
    const trades = await api(`/trades?${params}`);
    if (reset && trades.length === 0) {
      list.innerHTML = `<p class="placeholder">Gak ada trade yang cocok sama filter ini.</p>`;
      return;
    }
    trades.forEach((t) => list.appendChild(renderTradeCard(t)));
    if (trades.length) journalFullCursor = trades[trades.length - 1].id;
  } catch (e) {
    list.innerHTML = `<p class="placeholder">Gagal muat journal. (${e.message})</p>`;
  }
}
["journalFullSearch"].forEach((id) => {
  document.getElementById(id).addEventListener("input", () => {
    clearTimeout(window._journalFullDebounce);
    window._journalFullDebounce = setTimeout(() => loadJournalFull({ reset: true }), 300);
  });
});
["journalFilterExchange", "journalFilterStatus"].forEach((id) => {
  document.getElementById(id).addEventListener("change", () => loadJournalFull({ reset: true }));
});
document.getElementById("view-journal").addEventListener("scroll", () => {}); // container itself doesn't scroll; page-level handles it
window.addEventListener("scroll", () => {
  if (!document.getElementById("view-journal").classList.contains("active")) return;
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 400) loadJournalFull({ reset: false });
});

// ---- Statistics view ----
function statCardHTML(label, value, positive) {
  const cls = positive === true ? "positive" : positive === false ? "negative" : "";
  return `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value ${cls}">${value}</div></div>`;
}

async function loadStatistics() {
  try {
    const [overview, byPair, byHour, byDay, streaks, notable, byPlan] = await Promise.all([
      api("/stats/overview"),
      api("/stats/by-pair"),
      api("/stats/by-hour"),
      api("/stats/by-day-of-week"),
      api("/stats/streaks"),
      api("/stats/notable"),
      api("/trading-plans").then(() => api("/stats/by-plan")).catch(() => []),
    ]);

    document.getElementById("statsOverviewGrid").innerHTML =
      statCardHTML("Win Rate", `${overview.win_rate}%`) +
      statCardHTML("Total PnL", fmtUSD(overview.total_pnl), overview.total_pnl >= 0) +
      statCardHTML("Total Trades", overview.total_trades);

    const bestPair = byPair[0], worstPair = byPair[byPair.length - 1];
    const bestHour = byHour[0], worstHour = byHour[byHour.length - 1];
    const bestDay = byDay[0], worstDay = byDay[byDay.length - 1];
    document.getElementById("statsPerformanceGrid").innerHTML = [
      bestPair && statCardHTML("Best Pair", `${bestPair.pair} · ${fmtUSD(bestPair.pnl)}`, true),
      worstPair && statCardHTML("Worst Pair", `${worstPair.pair} · ${fmtUSD(worstPair.pnl)}`, false),
      bestHour && statCardHTML("Best Hour", `${bestHour.bucket}:00 · ${fmtUSD(bestHour.pnl)}`, true),
      worstHour && statCardHTML("Worst Hour", `${worstHour.bucket}:00 · ${fmtUSD(worstHour.pnl)}`, false),
      bestDay && statCardHTML("Best Day", `${bestDay.bucket} · ${fmtUSD(bestDay.pnl)}`, true),
      worstDay && statCardHTML("Worst Day", `${worstDay.bucket} · ${fmtUSD(worstDay.pnl)}`, false),
    ].filter(Boolean).join("");

    document.getElementById("statsRiskGrid").innerHTML =
      statCardHTML("Largest Win", fmtUSD(overview.largest_win), true) +
      statCardHTML("Largest Loss", fmtUSD(overview.largest_loss), false) +
      statCardHTML("Avg Win", fmtUSD(overview.avg_win), true) +
      statCardHTML("Avg Loss", fmtUSD(overview.avg_loss), false) +
      statCardHTML("Avg Holding", `${overview.avg_holding_hours}h`) +
      statCardHTML("Expectancy", fmtUSD(overview.expectancy), overview.expectancy >= 0);

    document.getElementById("statsConsistencyGrid").innerHTML =
      statCardHTML("Longest Win Streak", streaks.longest_win_streak, true) +
      statCardHTML("Longest Loss Streak", streaks.longest_loss_streak, false);

    const notes = document.getElementById("statsNotableGrid");
    notes.innerHTML = "";
    if (notable.biggest_win) {
      notes.innerHTML += `<div class="notable-card">
        <div class="notable-label">Biggest Win</div>
        <div class="notable-pair">${notable.biggest_win.pair}</div>
        <div class="notable-pnl positive">${fmtUSD(notable.biggest_win.pnl)}</div>
        ${notable.biggest_win.screenshot_url ? `<div class="notable-shot" style="background-image:url(${notable.biggest_win.screenshot_url})"></div>` : ""}
        <div class="notable-note">${notable.biggest_win.note || "Belum ada catatan."}</div>
      </div>`;
    }
    if (notable.biggest_loss) {
      notes.innerHTML += `<div class="notable-card">
        <div class="notable-label">Biggest Loss</div>
        <div class="notable-pair">${notable.biggest_loss.pair}</div>
        <div class="notable-pnl negative">${fmtUSD(notable.biggest_loss.pnl)}</div>
        ${notable.biggest_loss.screenshot_url ? `<div class="notable-shot" style="background-image:url(${notable.biggest_loss.screenshot_url})"></div>` : ""}
        <div class="notable-note">${notable.biggest_loss.note || "Belum ada catatan."}</div>
      </div>`;
    }

    const planGrid = document.getElementById("statsPlanGrid");
    if (planGrid) {
      planGrid.innerHTML = byPlan.length
        ? byPlan.map((p) => `
          <div class="plan-card">
            <div class="plan-name">${p.name}</div>
            <div class="plan-stats">
              <div><span class="k">Trades</span><span class="v">${p.trades}</span></div>
              <div><span class="k">Win Rate</span><span class="v">${p.win_rate}%</span></div>
              <div><span class="k">TP Hits</span><span class="v">${p.tp_hits}</span></div>
              <div><span class="k">SL Hits</span><span class="v">${p.sl_hits}</span></div>
              <div><span class="k">Total PnL</span><span class="v ${p.total_pnl >= 0 ? "positive" : "negative"}">${fmtUSD(p.total_pnl)}</span></div>
            </div>
          </div>`).join("")
        : `<p class="placeholder">Belum ada trading plan. Bikin lewat trade detail (klik trade mana aja di Journal).</p>`;
    }

    loadHistoryChart("daily");
  } catch (e) {
    console.error("Failed to load statistics:", e);
  }
}

document.getElementById("historyTabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".history-tab");
  if (!tab) return;
  document.querySelectorAll(".history-tab").forEach((t) => t.classList.remove("active"));
  tab.classList.add("active");
  loadHistoryChart(tab.dataset.granularity);
});

async function loadHistoryChart(granularity) {
  const bars = document.getElementById("statsHistoryBars");
  try {
    const history = await api(`/stats/history?granularity=${granularity}`);
    if (history.length === 0) { bars.innerHTML = `<p class="placeholder">Belum ada data.</p>`; return; }
    const maxAbs = Math.max(...history.map((h) => Math.abs(h.pnl)), 1);
    bars.innerHTML = history.map((h) => {
      const heightPct = Math.max(4, (Math.abs(h.pnl) / maxAbs) * 100);
      return `<div class="history-bar ${h.pnl >= 0 ? "positive" : "negative"}" style="height:${heightPct}%" title="${h.period}: ${fmtUSD(h.pnl)}"></div>`;
    }).join("");
  } catch (e) {
    bars.innerHTML = `<p class="placeholder">Gagal muat history.</p>`;
  }
}

// ---- Calendar view ----
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth() + 1; // 1-12

async function loadCalendar() {
  const grid = document.getElementById("calendarGrid");
  document.getElementById("calMonthLabel").textContent =
    new Date(calYear, calMonth - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  document.getElementById("calendarDayTrades").innerHTML = "";

  let days;
  try {
    days = await api(`/stats/calendar?year=${calYear}&month=${calMonth}`);
  } catch (e) {
    grid.innerHTML = `<p class="placeholder">Gagal muat calendar. (${e.message})</p>`;
    return;
  }

  const firstDow = new Date(calYear, calMonth - 1, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const dowLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let html = dowLabels.map((d) => `<div class="cal-dow">${d}</div>`).join("");
  for (let i = 0; i < firstDow; i++) html += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const info = days[dateStr];
    const pnlHTML = info ? `<div class="cal-pnl ${info.pnl >= 0 ? "positive" : "negative"}">${fmtUSD(info.pnl)}</div>` : "";
    html += `<div class="cal-day" data-date="${dateStr}"><div class="cal-num">${d}</div>${pnlHTML}</div>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll(".cal-day:not(.empty)").forEach((el) => {
    el.addEventListener("click", () => selectCalendarDay(el.dataset.date, el));
  });
}

async function selectCalendarDay(dateStr, el) {
  document.querySelectorAll(".cal-day").forEach((d) => d.classList.remove("selected"));
  el.classList.add("selected");
  const container = document.getElementById("calendarDayTrades");
  container.innerHTML = `<p class="placeholder">Loading...</p>`;
  try {
    const trades = await api(`/trades?date_from=${dateStr}&date_to=${dateStr}&limit=50`);
    container.innerHTML = "";
    if (trades.length === 0) { container.innerHTML = `<p class="placeholder">Gak ada trade di tanggal ini.</p>`; return; }
    trades.forEach((t) => container.appendChild(renderTradeCard(t)));
  } catch (e) {
    container.innerHTML = `<p class="placeholder">Gagal muat trade. (${e.message})</p>`;
  }
}

document.getElementById("calPrevMonth").addEventListener("click", () => {
  calMonth--; if (calMonth < 1) { calMonth = 12; calYear--; }
  loadCalendar();
});
document.getElementById("calNextMonth").addEventListener("click", () => {
  calMonth++; if (calMonth > 12) { calMonth = 1; calYear++; }
  loadCalendar();
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