from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/trades", tags=["trades"])


@router.get("", response_model=List[schemas.TradeOut])
def list_trades(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
    q: Optional[str] = Query(None, description="search pair, e.g. BTC"),
    exchange: Optional[models.ExchangeName] = None,
    status: Optional[models.TradeStatus] = None,
    side: Optional[models.Side] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    cursor: Optional[str] = Query(None, description="trade id to paginate after, for infinite scroll"),
    limit: int = Query(20, le=100),
):
    query = db.query(models.Trade).filter(models.Trade.user_id == user.id)

    if q:
        query = query.filter(models.Trade.pair.ilike(f"%{q}%"))
    if exchange:
        query = query.filter(models.Trade.exchange == exchange)
    if status:
        query = query.filter(models.Trade.status == status)
    if side:
        query = query.filter(models.Trade.side == side)
    if date_from:
        query = query.filter(models.Trade.open_time >= date_from)
    if date_to:
        query = query.filter(models.Trade.open_time <= date_to)

    query = query.order_by(models.Trade.open_time.desc())

    if cursor:
        anchor = db.query(models.Trade).filter_by(id=cursor).first()
        if anchor:
            query = query.filter(models.Trade.open_time < anchor.open_time)

    return query.limit(limit).all()


@router.get("/{trade_id}", response_model=schemas.TradeOut)
def get_trade(trade_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    trade = db.query(models.Trade).filter_by(id=trade_id, user_id=user.id).first()
    if not trade:
        raise HTTPException(404, "Trade not found")
    return trade


@router.patch("/{trade_id}", response_model=schemas.TradeOut)
def update_trade(trade_id: str, payload: schemas.TradeUpdate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Journal-only fields — note and screenshot. Price/PnL fields stay sync-owned to avoid drift from the exchange."""
    trade = db.query(models.Trade).filter_by(id=trade_id, user_id=user.id).first()
    if not trade:
        raise HTTPException(404, "Trade not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(trade, field, value)
    db.commit()
    db.refresh(trade)
    return trade


@router.post("", response_model=schemas.TradeOut)
def create_manual_trade(payload: schemas.TradeManualCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """For trades on exchanges/accounts not yet connected, or manual backfill."""
    pnl = None
    status = "running"
    if payload.exit_price is not None:
        direction = 1 if payload.side == "long" else -1
        pnl = (payload.exit_price - payload.entry_price) * direction * payload.size - payload.fee
        status = "win" if pnl > 0 else "loss" if pnl < 0 else "breakeven"

    trade = models.Trade(
        user_id=user.id,
        exchange=payload.exchange,
        pair=payload.pair,
        side=payload.side,
        status=status,
        margin_mode=payload.margin_mode,
        leverage=payload.leverage,
        entry_price=payload.entry_price,
        exit_price=payload.exit_price,
        size=payload.size,
        fee=payload.fee,
        pnl=pnl,
        open_time=payload.open_time,
        close_time=payload.close_time,
        note=payload.note,
        source="manual",
    )
    db.add(trade)
    db.commit()
    db.refresh(trade)
    return trade
