from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from . import models
from .database import Base, engine
from .routers import auth_routes, exchanges, stats, trades, trading_plans

# Dev convenience only — use Alembic migrations once this is past prototype stage.
Base.metadata.create_all(bind=engine)

# create_all() only creates tables that don't exist yet — it never adds new columns
# to a table that's already there. Since `trades` already existed before the trading
# plan feature, patch the missing columns in manually (idempotent, safe to rerun).
with engine.begin() as conn:
    conn.execute(text("ALTER TABLE trades ADD COLUMN IF NOT EXISTS trading_plan_id UUID REFERENCES trading_plans(id)"))
    conn.execute(text("ALTER TABLE trades ADD COLUMN IF NOT EXISTS planned_tp DOUBLE PRECISION"))
    conn.execute(text("ALTER TABLE trades ADD COLUMN IF NOT EXISTS planned_sl DOUBLE PRECISION"))

app = FastAPI(title="Trade Journal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your actual frontend origin(s) before going live
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(exchanges.router)
app.include_router(trades.router)
app.include_router(stats.router)
app.include_router(trading_plans.router)


@app.get("/health")
def health():
    return {"status": "ok"}