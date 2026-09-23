from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import RefreshToken
from app.auth.schemas import LoginRequest, RegisterRequest
from app.core.enums import UserRole
from app.core.exceptions import BusinessError
from app.core.security import create_access_token, create_refresh_token, hash_password, hash_refresh_token, refresh_expiry, verify_password
from app.shops.models import Shop
from app.users.models import User


@dataclass
class AuthResult:
    user: User
    shop: Shop | None
    access_token: str
    refresh_token: str


def _new_refresh(db: Session, user: User) -> str:
    raw = create_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=hash_refresh_token(raw), expires_at=refresh_expiry()))
    return raw


def _auth_result(db: Session, user: User) -> AuthResult:
    shop = db.scalar(select(Shop).where(Shop.owner_user_id == user.id))
    raw = _new_refresh(db, user)
    db.commit()
    return AuthResult(user, shop, create_access_token(str(user.id), user.role.value), raw)


def register_user(db: Session, payload: RegisterRequest) -> AuthResult:
    if db.scalar(select(User).where((User.phone == payload.phone) | (User.email == payload.email if payload.email else False))):
        raise BusinessError("DUPLICATE_USER", "Телефон или email уже зарегистрирован", 409)
    user = User(phone=payload.phone, email=str(payload.email) if payload.email else None, password_hash=hash_password(payload.password), role=UserRole.SHOP)
    db.add(user)
    db.flush()
    db.add(Shop(owner_user_id=user.id, **payload.shop.model_dump()))
    return _auth_result(db, user)


def login_user(db: Session, payload: LoginRequest) -> AuthResult:
    user = db.scalar(select(User).where((User.phone == payload.phone_or_email) | (User.email == payload.phone_or_email)))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверные учетные данные")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Пользователь деактивирован")
    return _auth_result(db, user)


def rotate_refresh_token(db: Session, raw: str | None) -> tuple[str, str]:
    if not raw:
        raise HTTPException(status_code=401, detail="Refresh token отсутствует")
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw)))
    now = datetime.now(timezone.utc)
    expires_at = stored.expires_at.replace(tzinfo=timezone.utc) if stored and stored.expires_at.tzinfo is None else stored.expires_at if stored else None
    if stored is None or stored.revoked_at is not None or expires_at <= now:
        raise HTTPException(status_code=401, detail="Refresh token недействителен")
    user = db.get(User, stored.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Пользователь недоступен")
    stored.revoked_at = now
    replacement = _new_refresh(db, user)
    db.commit()
    return create_access_token(str(user.id), user.role.value), replacement


def revoke_refresh_token(db: Session, raw: str | None) -> None:
    if not raw:
        return
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw)))
    if stored is not None and stored.revoked_at is None:
        stored.revoked_at = datetime.now(timezone.utc)
        db.commit()
