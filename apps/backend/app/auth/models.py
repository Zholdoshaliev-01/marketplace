import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_column, uuid_column


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id: Mapped[uuid.UUID] = uuid_column()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(255), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_column()
