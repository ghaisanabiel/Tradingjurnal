from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .database import Base, engine
from .routers import auth_routes, exchanges, stats, trades

# Dev convenience only — use Alembic migrations once this is past prototype stage.
Base.metadata.create_all(bind=engine)

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


@app.get("/health")
def health():
    return {"status": "ok"}
# trigger redeploy 
