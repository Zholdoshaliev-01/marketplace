import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import UserRole
from app.core.security import decode_access_token
from app.db.session import get_db
from app.shops.models import Shop
from app.suppliers.models import Supplier
from app.users.models import User

bearer = HTTPBearer(auto_error=False)


def get_current_user(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)], db: Annotated[Session, Depends(get_db)]) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется авторизация")
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError
        user_uuid = uuid.UUID(user_id)
    except (JWTError, ValueError, AttributeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недействительный токен") from None
    user = db.scalar(select(User).where(User.id == user_uuid))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь недоступен")
    return user


def require_roles(*roles: UserRole):
    def dependency(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
        return user
    return dependency


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_shop(user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> Shop:
    shop = db.scalar(select(Shop).where(Shop.owner_user_id == user.id))
    if shop is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Магазин не найден")
    return shop


def get_current_supplier(user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> Supplier:
    supplier = db.scalar(select(Supplier).where(Supplier.owner_user_id == user.id, Supplier.is_active.is_(True)))
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Поставщик не найден")
    return supplier
