"""
Bybit V5 Unified Trading API connector. Verify endpoint paths/params against
current docs before going live. Requires a READ-ONLY API key.
"""
import hashlib
import hmac
import time
from datetime import datetime
from typing import List, Optional

import requests

from .base import ExchangeConnector, NormalizedTrade, pnl_to_status

BASE_URL = "https://api.bybit.com"


class BybitConnector(ExchangeConnector):
    def _signed_get(self, path: str, params: dict) -> dict:
        timestamp = str(int(time.time() * 1000))
        recv_window = "5000"
        query = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
        sign_payload = timestamp + self.api_key + recv_window + query
        signature = hmac.new(self.api_secret.encode(), sign_payload.encode(), hashlib.sha256).hexdigest()
        headers = {
            "X-BAPI-API-KEY": self.api_key,
            "X-BAPI-SIGN": signature,
            "X-BAPI-TIMESTAMP": timestamp,
            "X-BAPI-RECV-WINDOW": recv_window,
        }
        resp = requests.get(f"{BASE_URL}{path}?{query}", headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json()

    def validate(self) -> bool:
        data = self._signed_get("/v5/account/wallet-balance", {"accountType": "UNIFIED"})
        return data.get("retCode") == 0

    def fetch_open_positions(self) -> List[NormalizedTrade]:
        data = self._signed_get("/v5/position/list", {"category": "linear", "settleCoin": "USDT"})
        out: List[NormalizedTrade] = []
        for p in data.get("result", {}).get("list", []):
            size = float(p["size"])
            if size == 0:
                continue
            out.append(NormalizedTrade(
                exchange_trade_id=f"bybit-open-{p['symbol']}-{p['side']}",
                pair=p["symbol"],
                side="long" if p["side"] == "Buy" else "short",
                margin_mode="isolated" if p.get("tradeMode") == 1 else "cross",
                leverage=float(p["leverage"]) if p.get("leverage") else None,
                entry_price=float(p["avgPrice"]),
                exit_price=None,
                size=size,
                fee=0,
                pnl=float(p["unrealisedPnl"]),
                roi=None,
                open_time=datetime.utcfromtimestamp(int(p["createdTime"]) / 1000),
                close_time=None,
                status="running",
            ))
        return out

    def fetch_closed_trades(self, since: Optional[datetime] = None) -> List[NormalizedTrade]:
        params = {"category": "linear", "limit": "200"}
        if since:
            params["startTime"] = str(int(since.timestamp() * 1000))
        data = self._signed_get("/v5/position/closed-pnl", params)

        out: List[NormalizedTrade] = []
        for row in data.get("result", {}).get("list", []):
            pnl = float(row["closedPnl"])
            out.append(NormalizedTrade(
                exchange_trade_id=row["orderId"],
                pair=row["symbol"],
                side="long" if row["side"] == "Sell" else "short",  # closing side is opposite of position side
                margin_mode=None,
                leverage=float(row["leverage"]) if row.get("leverage") else None,
                entry_price=float(row["avgEntryPrice"]),
                exit_price=float(row["avgExitPrice"]),
                size=float(row["qty"]),
                fee=0,
                pnl=pnl,
                roi=None,
                open_time=datetime.utcfromtimestamp(int(row["createdTime"]) / 1000),
                close_time=datetime.utcfromtimestamp(int(row["updatedTime"]) / 1000),
                status=pnl_to_status(pnl),
            ))
        return out
