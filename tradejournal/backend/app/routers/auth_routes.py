from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.UserOut)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(400, "Email already registered")
    user = models.User(email=payload.email, hashed_password=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form.username).first()
    if not user or not user.hashed_password or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    return {"access_token": create_access_token(str(user.id))}


# --- Google OAuth ---
# Flow: frontend gets a Google ID token via Google Identity Services JS SDK,
# sends it here. We verify it server-side with google-auth, then find-or-create
# the user by google_sub. No client secret needed for this flow (frontend-driven).
@router.post("/google", response_model=schemas.Token)
def google_login(id_token_str: str, db: Session = Depends(get_db)):
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
    import os

    try:
        idinfo = google_id_token.verify_oauth2_token(
            id_token_str, google_requests.Request(), os.environ["GOOGLE_CLIENT_ID"]
        )
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google token")

    sub, email = idinfo["sub"], idinfo["email"]
    user = db.query(models.User).filter(models.User.google_sub == sub).first()
    if not user:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            user.google_sub = sub  # link existing email/password account
        else:
            user = models.User(email=email, google_sub=sub)
            db.add(user)
        db.commit()
        db.refresh(user)

    return {"access_token": create_access_token(str(user.id))}


# --- Forgot password ---
# Standard token-in-email flow: /auth/forgot-password sends a short-lived reset
# token via email (use Resend/SES — not scaffolded here, plug in your mailer),
# /auth/reset-password verifies the token and sets a new hashed_password.
