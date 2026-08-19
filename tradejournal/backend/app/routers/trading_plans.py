from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/trading-plans", tags=["trading-plans"])


@router.get("", response_model=List[schemas.TradingPlanOut])
def list_plans(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return db.query(models.TradingPlan).filter_by(user_id=user.id).order_by(models.TradingPlan.created_at).all()


@router.post("", response_model=schemas.TradingPlanOut)
def create_plan(payload: schemas.TradingPlanCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if db.query(models.TradingPlan).filter_by(user_id=user.id, name=payload.name).first():
        raise HTTPException(400, "Trading plan dengan nama ini udah ada")
    plan = models.TradingPlan(user_id=user.id, name=payload.name, description=payload.description)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/{plan_id}")
def delete_plan(plan_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    plan = db.query(models.TradingPlan).filter_by(id=plan_id, user_id=user.id).first()
    if not plan:
        raise HTTPException(404, "Trading plan not found")
    # Detach from any trades before deleting so we don't hit a FK constraint.
    db.query(models.Trade).filter_by(trading_plan_id=plan.id).update({"trading_plan_id": None})
    db.delete(plan)
    db.commit()
    return {"ok": True}