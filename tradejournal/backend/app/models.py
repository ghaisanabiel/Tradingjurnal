"""
Core DB schema. One `trades` table, universal across exchanges — every
exchange normalizer maps its native trade format into this shape.
All statistics (win rate, best pair/hour/day, streaks, expectancy) are
derived via SQL aggregation over this table — no separate metrics tables.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String,
    Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .database import Base


class Side(str, enum.Enum):
    long = "long"
    short = "short"


class TradeStatus(str, enum.Enum):
    running = "running"
    win = "win"
    loss = "loss"
    breakeven = "breakeven"


class MarginMode(str, enum.Enum):
    isolated = "isolated"
    cross = "cross"


class ExchangeName(str, enum.Enum):
    binance = "binance"
    bybit = "bybit"
    bitget = "bitget"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=True)  # null if OAuth-only
    google_sub = Column(String, unique=True, nullable=True)
    apple_sub = Column(String, unique=True, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    exchange_connections = relationship("ExchangeConnection", back_populates="user", cascade="all, delete-orphan")
    trades = relationship("Trade", back_populates="user", cascade="all, delete-orphan")
    trading_plans = relationship("TradingPlan", back_populates="user", cascade="all, delete-orphan")


class ExchangeConnection(Base):
    """
    Read-only API key per user per exchange. api_key_encrypted / api_secret_encrypted
    are Fernet-encrypted at rest (see security.py) — never store plaintext.
    """
    __tablename__ = "exchange_connections"
    __table_args__ = (UniqueConstraint("user_id", "exchange", "label", name="uq_user_exchange_label"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    exchange = Column(Enum(ExchangeName), nullable=False)
    label = Column(String, default="default")  # lets a user connect multiple accounts on the same exchange
    api_key_encrypted = Column(Text, nullable=False)
    api_secret_encrypted = Column(Text, nullable=False)
    passphrase_encrypted = Column(Text, nullable=True)  # Bitget requires this, Binance/Bybit don't
    status = Column(String, default="connected")  # connected | error | revoked
    last_error = Column(Text, nullable=True)
    last_sync_at = Column(DateTime, nullable=True)
    auto_sync = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="exchange_connections")


class TradingPlan(Base):
    """User-defined setup/strategy, e.g. 'Support Resistance', 'EMA Touch'. Attached to trades optionally."""
    __tablename__ = "trading_plans"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_plan_name"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="trading_plans")


class Trade(Base):
    __tablename__ = "trades"
    __table_args__ = (
        UniqueConstraint("exchange_connection_id", "exchange_trade_id", name="uq_exchange_trade"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    exchange_connection_id = Column(UUID(as_uuid=True), ForeignKey("exchange_connections.id"), nullable=True)
    exchange = Column(Enum(ExchangeName), nullable=False)
    exchange_trade_id = Column(String, nullable=True)  # native position/order id, for dedup on sync

    pair = Column(String, nullable=False, index=True)          # e.g. BTCUSDT
    side = Column(Enum(Side), nullable=False)
    status = Column(Enum(TradeStatus), nullable=False, default=TradeStatus.running, index=True)
    margin_mode = Column(Enum(MarginMode), nullable=True)
    leverage = Column(Float, nullable=True)

    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=True)
    size = Column(Float, nullable=False)          # position size in base or contracts
    fee = Column(Float, default=0)

    pnl = Column(Float, nullable=True)
    roi = Column(Float, nullable=True)             # % return on margin

    open_time = Column(DateTime, nullable=False, index=True)
    close_time = Column(DateTime, nullable=True)

    screenshot_url = Column(String, nullable=True)
    note = Column(Text, nullable=True)

    trading_plan_id = Column(UUID(as_uuid=True), ForeignKey("trading_plans.id"), nullable=True)
    planned_tp = Column(Float, nullable=True)
    planned_sl = Column(Float, nullable=True)

    source = Column(String, default="sync")  # sync | manual
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="trades")
    trading_plan = relationship("TradingPlan")