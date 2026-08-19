import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from .models import ExchangeName, MarginMode, Side, TradeStatus


# ---------- Auth ----------
class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Exchange connection ----------
class ExchangeConnectionCreate(BaseModel):
    exchange: ExchangeName
    label: str = "default"
    api_key: str
    api_secret: str
    passphrase: Optional[str] = None  # Bitget only
    auto_sync: bool = True


class ExchangeConnectionOut(BaseModel):
    id: uuid.UUID
    exchange: ExchangeName
    label: str
    status: str
    last_sync_at: Optional[datetime]
    auto_sync: bool
    class Config:
        from_attributes = True


# ---------- Trading Plan ----------
class TradingPlanCreate(BaseModel):
    name: str
    description: Optional[str] = None


class TradingPlanOut(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    class Config:
        from_attributes = True


# ---------- Trade ----------
class TradeOut(BaseModel):
    id: uuid.UUID
    exchange: ExchangeName
    pair: str
    side: Side
    status: TradeStatus
    margin_mode: Optional[MarginMode]
    leverage: Optional[float]
    entry_price: float
    exit_price: Optional[float]
    size: float
    fee: float
    pnl: Optional[float]
    roi: Optional[float]
    open_time: datetime
    close_time: Optional[datetime]
    screenshot_url: Optional[str]
    note: Optional[str]
    trading_plan_id: Optional[uuid.UUID]
    planned_tp: Optional[float]
    planned_sl: Optional[float]
    class Config:
        from_attributes = True


class TradeUpdate(BaseModel):
    note: Optional[str] = None
    screenshot_url: Optional[str] = None
    trading_plan_id: Optional[uuid.UUID] = None
    planned_tp: Optional[float] = None
    planned_sl: Optional[float] = None


class TradeManualCreate(BaseModel):
    exchange: ExchangeName
    pair: str
    side: Side
    margin_mode: Optional[MarginMode] = None
    leverage: Optional[float] = None
    entry_price: float
    exit_price: Optional[float] = None
    size: float
    fee: float = 0
    open_time: datetime
    close_time: Optional[datetime] = None
    note: Optional[str] = None
    trading_plan_id: Optional[uuid.UUID] = None
    planned_tp: Optional[float] = None
    planned_sl: Optional[float] = None


# ---------- Stats ----------
class OverviewStats(BaseModel):
    win_rate: float
    total_pnl: float
    total_trades: int


class PairStat(BaseModel):
    pair: str
    trades: int
    pnl: float
    win_rate: float


class TimeBucketStat(BaseModel):
    bucket: str  # "14" for hour, "Monday" for day
    trades: int
    pnl: float
    win_rate: float