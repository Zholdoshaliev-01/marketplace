import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import UserRole
from app.db.base import Base, created_column, uuid_column


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = uuid_column()
    phone: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), default=UserRole.SHOP)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
