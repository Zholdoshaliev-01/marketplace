import uuid
from decimal import Decimal

from sqlalchemy import Boolean, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, uuid_column


class DeliveryZone(Base):
    __tablename__ = "delivery_zones"
    id: Mapped[uuid.UUID] = uuid_column()
    city: Mapped[str] = mapped_column(String(100), unique=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
