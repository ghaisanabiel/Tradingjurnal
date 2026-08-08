# Trade Journal — scaffold

## Apa yang udah jalan (real code, bukan mock)
- **Schema**: `users`, `exchange_connections`, `trades` (satu table universal, semua statistik turunan query dari sini).
- **Auth**: email/password + Google Sign-In (verifikasi ID token server-side) + JWT session. Forgot-password di-outline tapi belum ada mailer — tinggal plug Resend/SES.
- **Exchange connectors**: Binance (fapi), Bybit (v5 unified), Bitget (v2 mix) — validate key, fetch open positions, fetch closed trades, encrypted key storage (Fernet).
- **Sync service**: satu fungsi dipanggil dari tombol "Sync" manual maupun cron auto-sync, upsert by `(connection_id, exchange_trade_id)` jadi aman di-run berkali-kali.
- **Trades API**: list dengan search/filter/cursor pagination (infinite scroll), get detail, patch note/screenshot, manual create.
- **Stats API**: overview (win rate, PF, expectancy, avg RR proxy, largest win/loss, avg holding time), by-pair, by-hour, by-day-of-week, streaks, profit history (daily/weekly/monthly), notable trades (biggest win/loss), calendar month rollup.
- **Frontend**: dashboard responsive (sidebar di desktop, bottom nav di mobile — sama persis kayak referensi lo), summary card, performance card horizontal scroll, journal list infinite scroll + search, konsumsi API di atas.

## Yang sengaja distub / butuh keputusan lo
- **Binance entry/exit reconstruction**: `income` endpoint kasih PnL akurat tapi gak kasih entry/exit price granular — untuk itu perlu join ke `/fapi/v1/userTrades` per symbol+orderId. Ditinggal sebagai refinement karena butuh keputusan soal berapa detail per-fill yang lo mau tampilin (agregat per posisi vs per fill).
- **View journal/statistics/calendar di frontend**: masih placeholder div. Struktur data dari API udah lengkap (lihat `/stats/*` di atas), tinggal bikin render function kayak `renderTradeCard` tapi untuk table/grid.
- **Apple Sign In**: gak dimasukin karena lo pilih PWA — kalau nanti mau ditambah, web-based Sign in with Apple pakai flow OAuth mirip Google, beda dikit di endpoint token verification.
- **DB migration tool**: `Base.metadata.create_all()` di `main.py` cukup buat dev, tapi begitu ada perubahan schema pertama kali setelah ada data asli, ganti ke Alembic — jangan andalkan auto-create di production.

## Setup
```bash
cd backend
pip install -r requirements.txt

export DATABASE_URL="postgresql://..."      # dari Railway Postgres addon
export FERNET_KEY="$(python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"
export JWT_SECRET="$(openssl rand -hex 32)"
export GOOGLE_CLIENT_ID="..."                 # dari Google Cloud Console OAuth client

uvicorn app.main:app --reload
```

Frontend: buka `frontend/index.html` langsung, atau serve statis dari FastAPI/Railway. Set `window.API_BASE` di HTML kalau backend gak di `localhost:8000`.

## Belum termasuk (fase auth/UI lanjutan, sesuai urutan yang udah kita sepakatin)
Notes section (biggest win/loss card di UI — endpoint-nya udah ada, `/stats/notable`), Profile page, screenshot upload endpoint (perlu S3/R2 client, belum ditulis).
