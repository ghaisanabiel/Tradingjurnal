"""
Bitget V2 Mix (futures) API connector. Bitget requires a passphrase in addition
to key/secret — set at connect time. Verify endpoint paths against current docs
before going live. Requires a READ-ONLY API key.
"""
import base64
import hashlib
import hmac
import time
from datetime import datetime
from typing import List, Optional

import requests

from .base import ExchangeConnector, NormalizedTrade, pnl_to_status

BASE_URL = "https://api.bitget.com"


class BitgetConnector(ExchangeConnector):
    def _signed_get(self, path: str, params: dict) -> dict:
        query = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
        full_path = f"{path}?{query}" if query else path
        timestamp = str(int(time.time() * 1000))
        prehash = timestamp + "GET" + full_path
        signature = base64.b64encode(
            hmac.new(self.api_secret.encode(), prehash.encode(), hashlib.sha256).digest()
        ).decode()
        headers = {
            "ACCESS-KEY": self.api_key,
            "ACCESS-SIGN": signature,
            "ACCESS-TIMESTAMP": timestamp,
            "ACCESS-PASSPHRASE": self.passphrase or "",
            "Content-Type": "application/json",
        }
        resp = requests.get(f"{BASE_URL}{full_path}", headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json()

    def validate(self) -> bool:
        data = self._signed_get("/api/v2/mix/account/accounts", {"productType": "USDT-FUTURES"})
        return data.get("code") == "00000"

    def fetch_open_positions(self) -> List[NormalizedTrade]:
        data = self._signed_get("/api/v2/mix/position/all-position", {"productType": "USDT-FUTURES"})
        out: List[NormalizedTrade] = []
        for p in data.get("data", []):
            size = float(p["total"])
            if size == 0:
                continue
            out.append(NormalizedTrade(
                exchange_trade_id=f"bitget-open-{p['symbol']}-{p['holdSide']}",
                pair=p["symbol"],
                side="long" if p["holdSide"] == "long" else "short",
                margin_mode="isolated" if p.get("marginMode") == "isolated" else "cross",
                leverage=float(p["leverage"]) if p.get("leverage") else None,
                entry_price=float(p["openPriceAvg"]),
                exit_price=None,
                size=size,
                fee=0,
                pnl=float(p["unrealizedPL"]),
                roi=None,
                open_time=datetime.utcfromtimestamp(int(p.get("cTime") or p.get("ctime") or 0) / 1000) if (p.get("cTime") or p.get("ctime")) else datetime.utcnow(),
                close_time=None,
                status="running",
            ))
        return out

    def fetch_closed_trades(self, since: Optional[datetime] = None) -> List[NormalizedTrade]:
        params = {"productType": "USDT-FUTURES", "limit": "100"}
        if since:
            params["startTime"] = str(int(since.timestamp() * 1000))
        data = self._signed_get("/api/v2/mix/position/history-position", params)

        out: List[NormalizedTrade] = []
        for row in data.get("data", {}).get("list", []):
            pnl = float(row["netProfit"])
            out.append(NormalizedTrade(
                exchange_trade_id=row["positionId"],
                pair=row["symbol"],
                side="long" if row["holdSide"] == "long" else "short",
                margin_mode="isolated" if row.get("marginMode") == "isolated" else "cross",
                leverage=float(row["leverage"]) if row.get("leverage") else None,
                entry_price=float(row["openAvgPrice"]),
                exit_price=float(row["closeAvgPrice"]),
                size=float(row["openTotalPos"]),
                fee=float(row.get("openFee", 0)) + float(row.get("closeFee", 0)),
                pnl=pnl,
                roi=None,
                open_time=datetime.utcfromtimestamp(int(row["ctime"]) / 1000),
                close_time=datetime.utcfromtimestamp(int(row["utime"]) / 1000),
                status=pnl_to_status(pnl),
            ))
        return out