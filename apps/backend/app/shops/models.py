import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_column, uuid_column


class Shop(Base):
    __tablename__ = "shops"
    __table_args__ = (UniqueConstraint("owner_user_id", name="uq_shops_owner_user_id"), Index("ix_shops_city", "city"))
    id: Mapped[uuid.UUID] = uuid_column()
    owner_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(32))
    city: Mapped[str] = mapped_column(String(100))
    address: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = created_column()
