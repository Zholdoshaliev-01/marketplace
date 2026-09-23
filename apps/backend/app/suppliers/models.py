import uuid
from datetime import datetime

from sqlalchemy import Boolean, Enum, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import Market
from app.db.base import Base, created_column, uuid_column


class Supplier(Base):
    __tablename__ = "suppliers"
    __table_args__ = (UniqueConstraint("owner_user_id", name="uq_suppliers_owner_user_id"), Index("ix_suppliers_market_active", "market", "is_active"))
    id: Mapped[uuid.UUID] = uuid_column()
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(32))
    market: Mapped[Market] = mapped_column(Enum(Market, name="market"))
    pavilion: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = created_column()
