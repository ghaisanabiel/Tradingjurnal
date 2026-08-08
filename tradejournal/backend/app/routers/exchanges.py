from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..exchanges import get_connector
from ..security import encrypt_secret
from ..sync_service import sync_connection

router = APIRouter(prefix="/exchanges", tags=["exchanges"])


@router.post("/connect", response_model=schemas.ExchangeConnectionOut)
def connect_exchange(
    payload: schemas.ExchangeConnectionCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    # Validate key works + is reachable before saving.
    connector = get_connector(payload.exchange, payload.api_key, payload.api_secret, payload.passphrase)
    if not connector.validate():
        raise HTTPException(400, "Could not validate API key — check the key/secret and permissions")

    conn = models.ExchangeConnection(
        user_id=user.id,
        exchange=payload.exchange,
        label=payload.label,
        api_key_encrypted=encrypt_secret(payload.api_key),
        api_secret_encrypted=encrypt_secret(payload.api_secret),
        passphrase_encrypted=encrypt_secret(payload.passphrase) if payload.passphrase else None,
        auto_sync=payload.auto_sync,
        status="connected",
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)

    sync_connection(db, conn)  # initial pull right after connecting
    return conn


@router.get("", response_model=List[schemas.ExchangeConnectionOut])
def list_connections(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return db.query(models.ExchangeConnection).filter_by(user_id=user.id).all()


@router.post("/{connection_id}/sync")
def manual_sync(connection_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    conn = db.query(models.ExchangeConnection).filter_by(id=connection_id, user_id=user.id).first()
    if not conn:
        raise HTTPException(404, "Connection not found")
    return sync_connection(db, conn)


@router.delete("/{connection_id}")
def disconnect(connection_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    conn = db.query(models.ExchangeConnection).filter_by(id=connection_id, user_id=user.id).first()
    if not conn:
        raise HTTPException(404, "Connection not found")
    db.delete(conn)
    db.commit()
    return {"ok": True}
