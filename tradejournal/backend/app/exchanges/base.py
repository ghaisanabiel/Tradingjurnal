"""
Every exchange connector implements fetch_closed_trades() and fetch_open_positions(),
returning a list of dicts already normalized to the `Trade` model shape. This is the
only contract routers/sync jobs depend on — adding a 4th exchange means writing one
new file that satisfies this interface, nothing else changes.
"""
from abc import ABC, abstractmethod
from datetime import datetime
from typing import List, Optional, TypedDict


class NormalizedTrade(TypedDict):
    exchange_trade_id: str
    pair: str
    side: str            # "long" | "short"
    margin_mode: Optional[str]   # "isolated" | "cross"
    leverage: Optional[float]
    entry_price: float
    exit_price: Optional[float]
    size: float
    fee: float
    pnl: Optional[float]
    roi: Optional[float]
    open_time: datetime
    close_time: Optional[datetime]
    status: str           # "running" | "win" | "loss" | "breakeven"


class ExchangeConnector(ABC):
    def __init__(self, api_key: str, api_secret: str, passphrase: Optional[str] = None):
        self.api_key = api_key
        self.api_secret = api_secret
        self.passphrase = passphrase

    @abstractmethod
    def validate(self) -> bool:
        """Lightweight read-only call (e.g. account/balance) to confirm the key works and is read-only scoped."""
        ...

    @abstractmethod
    def fetch_closed_trades(self, since: Optional[datetime] = None) -> List[NormalizedTrade]:
        ...

    @abstractmethod
    def fetch_open_positions(self) -> List[NormalizedTrade]:
        ...


def pnl_to_status(pnl: Optional[float]) -> str:
    if pnl is None:
        return "running"
    if pnl > 0:
        return "win"
    if pnl < 0:
        return "loss"
    return "breakeven"
