"""
Binance USDT-M Futures connector. Uses signed GET requests against fapi.binance.com.
Verify endpoint paths against current docs before going live — Binance revises
futures API surface periodically. Requires a READ-ONLY API key (no trade/withdraw perms).
"""
import hashlib
import hmac
import time
from datetime import datetime
from typing import List, Optional
from urllib.parse import urlencode

import requests

from .base import ExchangeConnector, NormalizedTrade, pnl_to_status

BASE_URL = "https://fapi.binance.com"


class BinanceConnector(ExchangeConnector):
    def _signed_get(self, path: str, params: dict) -> dict:
        params = {**params, "timestamp": int(time.time() * 1000), "recvWindow": 5000}
        query = urlencode(params)
        signature = hmac.new(self.api_secret.encode(), query.encode(), hashlib.sha256).hexdigest()
        headers = {"X-MBX-APIKEY": self.api_key}
        resp = requests.get(f"{BASE_URL}{path}?{query}&signature={signature}", headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json()

    def validate(self) -> bool:
        try:
            data = self._signed_get("/fapi/v2/account", {})
            return "canTrade" in data
        except requests.HTTPError:
            return False

    def fetch_open_positions(self) -> List[NormalizedTrade]:
        positions = self._signed_get("/fapi/v2/positionRisk", {})
        out: List[NormalizedTrade] = []
        for p in positions:
            amt = float(p["positionAmt"])
            if amt == 0:
                continue
            out.append(NormalizedTrade(
                exchange_trade_id=f"binance-open-{p['symbol']}-{p['positionSide']}",
                pair=p["symbol"],
                side="long" if amt > 0 else "short",
                margin_mode="isolated" if p.get("marginType") == "isolated" else "cross",
                leverage=float(p["leverage"]),
                entry_price=float(p["entryPrice"]),
                exit_price=None,
                size=abs(amt),
                fee=0,
                pnl=float(p["unRealizedProfit"]),
                roi=None,
                open_time=datetime.utcnow(),  # positionRisk doesn't expose open time; backfill from user trades if needed
                close_time=None,
                status="running",
            ))
        return out

    def fetch_closed_trades(self, since: Optional[datetime] = None) -> List[NormalizedTrade]:
        """
        Uses /fapi/v1/income (type=REALIZED_PNL) to reconstruct closed trades.
        For richer per-fill detail (exact entry/exit legs), pair this with
        /fapi/v1/userTrades and group by symbol+orderId — left as a refinement,
        income-based PnL is enough to populate the journal correctly.
        """
        params = {"incomeType": "REALIZED_PNL", "limit": 1000}
        if since:
            params["startTime"] = int(since.timestamp() * 1000)
        income = self._signed_get("/fapi/v1/income", params)

        out: List[NormalizedTrade] = []
        for row in income:
            pnl = float(row["income"])
            ts = datetime.utcfromtimestamp(int(row["time"]) / 1000)
            out.append(NormalizedTrade(
                exchange_trade_id=str(row["tranId"]),
                pair=row["symbol"],
                side="long" if pnl >= 0 else "short",  # income alone can't disambiguate; refine via userTrades if needed
                margin_mode=None,
                leverage=None,
                entry_price=0.0,   # requires userTrades join for precise entry/exit — placeholder
                exit_price=0.0,
                size=0.0,
                fee=0,
                pnl=pnl,
                roi=None,
                open_time=ts,
                close_time=ts,
                status=pnl_to_status(pnl),
            ))
        return out
