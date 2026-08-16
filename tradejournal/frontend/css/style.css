:root{
  --bg:#0b0e14;
  --surface:#121722;
  --surface-2:#171e2c;
  --border:#232b3a;
  --text:#eef1f6;
  --text-dim:#8b93a7;
  --accent:#6c5ce7;
  --accent-2:#4f8cff;
  --green:#22c55e;
  --red:#ef4444;
  --amber:#f5a623;
  --radius:16px;
  --radius-sm:10px;
}

html[data-theme="light"]{
  --bg:#f4f5f8;
  --surface:#ffffff;
  --surface-2:#f0f1f5;
  --border:#e2e4ea;
  --text:#14161c;
  --text-dim:#6b7280;
}

html{ transition:color-scheme .2s; }
html[data-theme="light"] body::before{
  background:
    radial-gradient(ellipse 900px 500px at 15% -5%, rgba(108,92,231,.10), transparent 60%),
    radial-gradient(ellipse 700px 500px at 100% 10%, rgba(79,140,255,.07), transparent 55%),
    radial-gradient(ellipse 800px 600px at 50% 120%, rgba(34,197,94,.05), transparent 60%);
}
html[data-theme="light"] body::after{
  opacity:1;
  background-image:
    linear-gradient(rgba(15,18,25,.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15,18,25,.035) 1px, transparent 1px);
}

*{box-sizing:border-box;}
body{
  margin:0;
  background:var(--bg);
  color:var(--text);
  font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  -webkit-font-smoothing:antialiased;
  min-height:100vh;
  position:relative;
}
svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}

/* ---- Ambient background — subtle glow + grid texture, echoes the auth page ---- */
body::before{
  content:""; position:fixed; inset:0; z-index:-2; pointer-events:none;
  background:
    radial-gradient(ellipse 900px 500px at 15% -5%, rgba(108,92,231,.16), transparent 60%),
    radial-gradient(ellipse 700px 500px at 100% 10%, rgba(79,140,255,.10), transparent 55%),
    radial-gradient(ellipse 800px 600px at 50% 120%, rgba(34,197,94,.06), transparent 60%);
}
body::after{
  content:""; position:fixed; inset:0; z-index:-1; pointer-events:none; opacity:.5;
  background-image:
    linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
  background-size:48px 48px;
  mask-image:radial-gradient(ellipse 1000px 700px at 30% 0%, black 0%, transparent 70%);
}

/* ---- Sidebar (desktop) / bottom nav (mobile) ---- */
.sidenav{
  position:fixed; left:0; top:0; bottom:0; width:76px; overflow:visible;
  background:var(--surface); border-right:1px solid var(--border);
  display:flex; flex-direction:column; align-items:center; padding:20px 0; gap:8px; z-index:20;
}
.brand{
  width:40px;height:40px;border-radius:12px;
  background:linear-gradient(135deg,var(--accent),var(--accent-2));
  display:flex;align-items:center;justify-content:center;
  font-weight:700;font-size:14px;margin-bottom:24px;
}
.nav-item{
  position:relative;
  width:48px;height:48px;border-radius:var(--radius-sm);
  display:flex;align-items:center;justify-content:center;
  color:var(--text-dim); text-decoration:none;
}
.nav-item.active,.nav-item:hover{ background:var(--surface-2); color:var(--accent-2); }
.nav-item svg{ transition:transform .18s cubic-bezier(.34,1.56,.64,1); }
.nav-item:hover svg{ transform:scale(1.18); }

.nav-label{
  position:absolute; left:calc(100% + 12px); top:50%; transform:translateY(-50%) translateX(-8px);
  background:var(--surface-2); border:1px solid var(--border); color:var(--text);
  padding:6px 12px; border-radius:8px; font-size:12.5px; font-weight:600; white-space:nowrap;
  opacity:0; pointer-events:none; z-index:25;
  box-shadow:0 12px 28px -10px rgba(0,0,0,.5);
  transition:opacity .15s ease, transform .15s ease;
}
.nav-item:hover .nav-label{ opacity:1; transform:translateY(-50%) translateX(0); }
@media (max-width:720px){ .nav-label{ display:none; } }

.app{ margin-left:76px; padding:24px 32px 100px; max-width:1400px; }
@media (min-width:1550px){
  .app{ margin-left:calc(76px + (100vw - 76px - 1400px) / 2); margin-right:calc((100vw - 76px - 1400px) / 2); }
}

.topbar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
.topbar h1{ font-size:22px; margin:0; }
.topbar-actions{ display:flex; align-items:center; gap:12px; }
.period-select,.btn-ghost{
  background:var(--surface-2); border:1px solid var(--border); color:var(--text);
  padding:9px 14px; border-radius:var(--radius-sm); font-size:13px; cursor:pointer;
}
.avatar{
  width:36px;height:36px;border-radius:50%; background:linear-gradient(135deg,var(--accent),var(--accent-2));
  border:1px solid var(--border); cursor:pointer; padding:0; transition:box-shadow .15s ease, transform .15s ease;
}
.avatar:hover{ box-shadow:0 0 0 3px rgba(108,92,231,.22); }
.avatar:active{ transform:scale(.94); }

.profile-menu{ position:relative; }
.profile-dropdown{
  position:absolute; top:calc(100% + 10px); right:0; width:240px; z-index:30;
  background:var(--surface-2); border:1px solid var(--border); border-radius:14px;
  box-shadow:0 20px 45px -12px rgba(0,0,0,.55);
  padding:8px; opacity:0; visibility:hidden; transform:translateY(-6px) scale(.98);
  transition:opacity .16s ease, transform .16s ease, visibility .16s;
}
.profile-dropdown.open{ opacity:1; visibility:visible; transform:translateY(0) scale(1); }
.profile-dropdown-header{ display:flex; align-items:center; gap:10px; padding:10px 8px 12px; }
.avatar-lg{ width:34px;height:34px;border-radius:50%; background:linear-gradient(135deg,var(--accent),var(--accent-2)); flex-shrink:0; }
.profile-name{ font-size:13px; font-weight:600; }
.profile-sub{ font-size:11px; color:var(--text-dim); }
.dropdown-divider{ height:1px; background:var(--border); margin:6px 4px; }
.dropdown-item{
  width:100%; display:flex; align-items:center; gap:10px; text-align:left;
  background:none; border:none; color:var(--text); font-size:13px; font-family:inherit;
  padding:9px 10px; border-radius:9px; cursor:pointer;
}
.dropdown-item svg{ width:16px; height:16px; color:var(--text-dim); flex-shrink:0; }
.dropdown-item:hover{ background:rgba(255,255,255,.05); }
.dropdown-item-danger{ color:var(--red); }
.dropdown-item-danger svg{ color:var(--red); }
.dropdown-item-danger:hover{ background:rgba(239,68,68,.1); }

.view{ display:none; } .view.active{ display:block; }
.placeholder{ color:var(--text-dim); }

/* ---- Summary card ---- */
.summary-card{
  background:linear-gradient(160deg, var(--surface), var(--surface-2));
  border:1px solid var(--border); border-radius:var(--radius);
  display:grid; grid-template-columns:repeat(3,1fr); padding:24px; gap:24px; margin-bottom:20px;
  box-shadow:0 20px 50px -20px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.03);
}
.summary-item{ display:flex; flex-direction:column; gap:6px; }
.summary-icon{ width:36px;height:36px;border-radius:10px; margin-bottom:6px; }
.summary-icon.wallet{ background:rgba(108,92,231,.18); }
.summary-icon.trend,.summary-icon.dollar{ background:rgba(34,197,94,.16); }
.summary-label{ color:var(--text-dim); font-size:13px; }
.summary-value{ font-size:26px; font-weight:700; }
.summary-value.positive{ color:var(--green); }
.summary-sub{ font-size:12px; color:var(--text-dim); }
.summary-sub.positive{ color:var(--green); }

/* ---- Performance cards (horizontal scroll) ---- */
.perf-scroll{
  display:flex; gap:14px; overflow-x:auto; padding-bottom:8px; margin-bottom:28px;
  scrollbar-width:none;
}
.perf-scroll::-webkit-scrollbar{ display:none; }
.perf-card{
  flex:0 0 150px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius);
  padding:16px; transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}
.perf-card:hover{
  transform:translateY(-3px); border-color:rgba(108,92,231,.35);
  box-shadow:0 14px 30px -12px rgba(108,92,231,.28);
}
.perf-card .icon{ width:32px;height:32px;border-radius:9px; margin-bottom:10px; }
.perf-card .label{ color:var(--text-dim); font-size:12px; }
.perf-card .value{ font-size:20px; font-weight:700; margin:4px 0 10px; }
.perf-card svg.spark{ width:100%; height:28px; }

/* ---- Journal ---- */
.journal-header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.journal-header h2{ font-size:18px; margin:0; }
.journal-actions{ display:flex; gap:10px; }
.journal-actions input{
  background:var(--surface-2); border:1px solid var(--border); color:var(--text);
  padding:8px 12px; border-radius:var(--radius-sm); font-size:13px;
}
.btn-icon{ background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:var(--radius-sm); padding:8px 10px; cursor:pointer; }

.journal-list{ display:flex; flex-direction:column; gap:12px; }
.trade-card{
  background:var(--surface); border:1px solid var(--border); border-radius:var(--radius);
  padding:16px; display:grid; grid-template-columns:90px 1fr auto; gap:16px; align-items:center;
  transition:transform .18s ease, border-color .18s ease;
}
.trade-card:hover{ transform:translateX(2px); border-color:rgba(255,255,255,.16); }
.trade-chart{ width:90px; height:60px; border-radius:var(--radius-sm); background:var(--surface-2); }
.trade-top{ display:flex; align-items:center; gap:8px; margin-bottom:4px; }
.badge{ font-size:11px; font-weight:700; padding:2px 8px; border-radius:6px; }
.badge.long{ background:rgba(34,197,94,.16); color:var(--green); }
.badge.short{ background:rgba(239,68,68,.16); color:var(--red); }
.pair{ font-weight:700; font-size:15px; }
.trade-meta{ color:var(--text-dim); font-size:12px; margin-bottom:8px; }
.trade-prices{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; font-size:13px; }
.trade-prices .k{ display:block; color:var(--text-dim); font-size:11px; }
.trade-result{ text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:4px; }
.trade-result .pnl{ font-weight:700; font-size:15px; }
.trade-result .pnl.positive{ color:var(--green); }
.trade-result .pnl.negative{ color:var(--red); }
.trade-result .roi{ font-size:12px; }
.trade-result .roi.positive{ color:var(--green); } .trade-result .roi.negative{ color:var(--red); }
.status-badge{ font-size:10px; font-weight:700; padding:3px 8px; border-radius:6px; margin-top:2px; }
.status-badge.win{ background:rgba(34,197,94,.16); color:var(--green); }
.status-badge.loss{ background:rgba(239,68,68,.16); color:var(--red); }
.status-badge.running{ background:rgba(245,166,35,.16); color:var(--amber); }
.status-badge.breakeven{ background:rgba(139,147,167,.16); color:var(--text-dim); }

/* ---- Responsive: mobile becomes bottom nav, single column, matches reference mockup ---- */
@media (max-width: 720px){
  .sidenav{
    top:auto; bottom:0; left:0; right:0; width:auto; height:64px;
    flex-direction:row; justify-content:space-around; border-right:none; border-top:1px solid var(--border);
    padding:0;
  }
  .brand{ display:none; }
  .app{ margin-left:0; padding:16px 16px 90px; }
  .summary-card{ grid-template-columns:1fr; gap:16px; }
  .trade-card{ grid-template-columns:70px 1fr; }
  .trade-result{ grid-column:1/-1; flex-direction:row; justify-content:space-between; align-items:center; }
  .trade-prices{ grid-template-columns:repeat(2,1fr); }
}