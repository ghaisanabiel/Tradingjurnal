from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/stats", tags=["stats"])


def _closed_trades_query(db: Session, user_id, date_from: Optional[date], date_to: Optional[date]):
    q = db.query(models.Trade).filter(
        models.Trade.user_id == user_id,
        models.Trade.status.in_([models.TradeStatus.win, models.TradeStatus.loss, models.TradeStatus.breakeven]),
    )
    if date_from:
        q = q.filter(models.Trade.open_time >= date_from)
    if date_to:
        q = q.filter(models.Trade.open_time <= date_to)
    return q


@router.get("/overview")
def overview(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    trades = _closed_trades_query(db, user.id, date_from, date_to).all()
    total = len(trades)
    wins = [t for t in trades if t.status == models.TradeStatus.win]
    losses = [t for t in trades if t.status == models.TradeStatus.loss]

    win_rate = round(len(wins) / total * 100, 2) if total else 0.0
    total_pnl = round(sum(t.pnl or 0 for t in trades), 2)
    avg_win = round(sum(t.pnl for t in wins) / len(wins), 2) if wins else 0.0
    avg_loss = round(sum(t.pnl for t in losses) / len(losses), 2) if losses else 0.0
    profit_factor = round(sum(t.pnl for t in wins) / abs(sum(t.pnl for t in losses)), 2) if losses and sum(t.pnl for t in losses) != 0 else None
    expectancy = round((win_rate / 100 * avg_win) + ((1 - win_rate / 100) * avg_loss), 2) if total else 0.0
    largest_win = round(max((t.pnl for t in wins), default=0), 2)
    largest_loss = round(min((t.pnl for t in losses), default=0), 2)

    holding_times = [
        (t.close_time - t.open_time).total_seconds() / 3600
        for t in trades if t.close_time
    ]
    avg_holding_hours = round(sum(holding_times) / len(holding_times), 2) if holding_times else 0.0

    return {
        "win_rate": win_rate,
        "total_trades": total,
        "total_pnl": total_pnl,
        "profit_factor": profit_factor,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "expectancy": expectancy,
        "largest_win": largest_win,
        "largest_loss": largest_loss,
        "avg_holding_hours": avg_holding_hours,
    }


@router.get("/by-pair")
def stats_by_pair(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Best/worst pair — group by pair, sort by pnl desc/asc."""
    rows = (
        db.query(
            models.Trade.pair,
            func.count().label("trades"),
            func.sum(models.Trade.pnl).label("pnl"),
            func.sum(case((models.Trade.status == models.TradeStatus.win, 1), else_=0)).label("wins"),
        )
        .filter(models.Trade.user_id == user.id, models.Trade.status != models.TradeStatus.running)
        .group_by(models.Trade.pair)
        .all()
    )
    result = [
        {"pair": r.pair, "trades": r.trades, "pnl": round(r.pnl or 0, 2), "win_rate": round(r.wins / r.trades * 100, 2)}
        for r in rows
    ]
    return sorted(result, key=lambda x: x["pnl"], reverse=True)


@router.get("/by-hour")
def stats_by_hour(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Best/worst hour of day — bucketed by open_time hour (server stores UTC; convert client-side to user tz for display)."""
    trades = (
        db.query(models.Trade)
        .filter(models.Trade.user_id == user.id, models.Trade.status != models.TradeStatus.running)
        .all()
    )
    buckets = defaultdict(list)
    for t in trades:
        buckets[t.open_time.hour].append(t.pnl or 0)

    result = [
        {"bucket": str(h), "trades": len(pnls), "pnl": round(sum(pnls), 2),
         "win_rate": round(sum(1 for p in pnls if p > 0) / len(pnls) * 100, 2)}
        for h, pnls in buckets.items()
    ]
    return sorted(result, key=lambda x: x["pnl"], reverse=True)


@router.get("/by-day-of-week")
def stats_by_day(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    trades = (
        db.query(models.Trade)
        .filter(models.Trade.user_id == user.id, models.Trade.status != models.TradeStatus.running)
        .all()
    )
    names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    buckets = defaultdict(list)
    for t in trades:
        buckets[t.open_time.weekday()].append(t.pnl or 0)

    result = [
        {"bucket": names[d], "trades": len(pnls), "pnl": round(sum(pnls), 2),
         "win_rate": round(sum(1 for p in pnls if p > 0) / len(pnls) * 100, 2)}
        for d, pnls in buckets.items()
    ]
    return sorted(result, key=lambda x: x["pnl"], reverse=True)


@router.get("/streaks")
def streaks(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    trades = (
        db.query(models.Trade)
        .filter(models.Trade.user_id == user.id, models.Trade.status.in_([models.TradeStatus.win, models.TradeStatus.loss]))
        .order_by(models.Trade.close_time.asc())
        .all()
    )
    longest_win, longest_loss, cur_win, cur_loss = 0, 0, 0, 0
    for t in trades:
        if t.status == models.TradeStatus.win:
            cur_win += 1
            cur_loss = 0
        else:
            cur_loss += 1
            cur_win = 0
        longest_win = max(longest_win, cur_win)
        longest_loss = max(longest_loss, cur_loss)
    return {"longest_win_streak": longest_win, "longest_loss_streak": longest_loss}


@router.get("/history")
def profit_history(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
    granularity: str = Query("daily", regex="^(daily|weekly|monthly)$"),
):
    """Monthly/weekly/daily profit, for the History section + charts."""
    trunc_map = {"daily": "day", "weekly": "week", "monthly": "month"}
    bucket = func.date_trunc(trunc_map[granularity], models.Trade.close_time)
    rows = (
        db.query(bucket.label("period"), func.sum(models.Trade.pnl).label("pnl"))
        .filter(models.Trade.user_id == user.id, models.Trade.close_time.isnot(None))
        .group_by("period")
        .order_by("period")
        .all()
    )
    return [{"period": r.period.isoformat(), "pnl": round(r.pnl or 0, 2)} for r in rows]


@router.get("/notable")
def notable_trades(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Biggest win and biggest loss, with screenshot + note — for the Notes section."""
    biggest_win = (
        db.query(models.Trade)
        .filter(models.Trade.user_id == user.id, models.Trade.status == models.TradeStatus.win)
        .order_by(models.Trade.pnl.desc())
        .first()
    )
    biggest_loss = (
        db.query(models.Trade)
        .filter(models.Trade.user_id == user.id, models.Trade.status == models.TradeStatus.loss)
        .order_by(models.Trade.pnl.asc())
        .first()
    )
    def serialize(t):
        return t and {"pair": t.pair, "pnl": t.pnl, "screenshot_url": t.screenshot_url, "note": t.note}
    return {"biggest_win": serialize(biggest_win), "biggest_loss": serialize(biggest_loss)}


@router.get("/calendar")
def calendar_month(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Per-day rollup for the calendar view: pnl, win/loss/running counts, long/short counts."""
    start = date(year, month, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)

    trades = (
        db.query(models.Trade)
        .filter(models.Trade.user_id == user.id, models.Trade.open_time >= start, models.Trade.open_time < end)
        .all()
    )
    days = defaultdict(lambda: {"pnl": 0.0, "win": 0, "loss": 0, "running": 0, "long": 0, "short": 0})
    for t in trades:
        d = t.open_time.date().isoformat()
        days[d]["pnl"] += t.pnl or 0
        days[d][t.status.value if t.status != models.TradeStatus.breakeven else "win"] += 0  # breakeven excluded from win/loss count
        if t.status == models.TradeStatus.win:
            days[d]["win"] += 1
        elif t.status == models.TradeStatus.loss:
            days[d]["loss"] += 1
        elif t.status == models.TradeStatus.running:
            days[d]["running"] += 1
        days[d]["long" if t.side == models.Side.long else "short"] += 1

    return {d: {**v, "pnl": round(v["pnl"], 2)} for d, v in days.items()}
