from datetime import datetime

from sqlalchemy.orm import Session

from . import models
from .exchanges import get_connector
from .security import decrypt_secret


def sync_connection(db: Session, conn: models.ExchangeConnection) -> dict:
    """
    Pulls open + closed trades for one exchange connection, upserts into `trades`
    keyed on (exchange_connection_id, exchange_trade_id). Call this from the manual
    "Sync" button and from the auto-sync cron job — same code path either way.
    """
    connector = get_connector(
        conn.exchange,
        api_key=decrypt_secret(conn.api_key_encrypted),
        api_secret=decrypt_secret(conn.api_secret_encrypted),
        passphrase=decrypt_secret(conn.passphrase_encrypted) if conn.passphrase_encrypted else None,
    )

    try:
        closed = connector.fetch_closed_trades(since=conn.last_sync_at)
        open_positions = connector.fetch_open_positions()
    except Exception as e:
        conn.status = "error"
        conn.last_error = str(e)[:500]
        db.commit()
        return {"ok": False, "error": str(e)}

    inserted, updated = 0, 0
    for t in closed + open_positions:
        existing = (
            db.query(models.Trade)
            .filter_by(exchange_connection_id=conn.id, exchange_trade_id=t["exchange_trade_id"])
            .first()
        )
        if existing:
            for field in ("status", "exit_price", "pnl", "roi", "close_time"):
                setattr(existing, field, t.get(field))
            updated += 1
        else:
            db.add(models.Trade(
                user_id=conn.user_id,
                exchange_connection_id=conn.id,
                exchange=conn.exchange,
                exchange_trade_id=t["exchange_trade_id"],
                pair=t["pair"],
                side=t["side"],
                status=t["status"],
                margin_mode=t.get("margin_mode"),
                leverage=t.get("leverage"),
                entry_price=t["entry_price"],
                exit_price=t.get("exit_price"),
                size=t["size"],
                fee=t.get("fee", 0),
                pnl=t.get("pnl"),
                roi=t.get("roi"),
                open_time=t["open_time"],
                close_time=t.get("close_time"),
                source="sync",
            ))
            inserted += 1

    conn.status = "connected"
    conn.last_error = None
    conn.last_sync_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "inserted": inserted, "updated": updated}
