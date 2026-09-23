import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_column, uuid_column


class Cart(Base):
    __tablename__ = "carts"
    id: Mapped[uuid.UUID] = uuid_column()
    shop_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shops.id", ondelete="RESTRICT"), unique=True)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("cart_id", "product_id", name="uq_cart_items_cart_product"), CheckConstraint("quantity >= 1", name="ck_cart_items_quantity_positive"), Index("ix_cart_items_product", "product_id"))
    id: Mapped[uuid.UUID] = uuid_column()
    cart_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("carts.id", ondelete="CASCADE"))
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"))
    quantity: Mapped[int] = mapped_column(Integer)
