import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import OrderStatus, PaymentType
from app.db.base import Base, created_column, uuid_column


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (UniqueConstraint("shop_id", "idempotency_key", name="uq_orders_shop_idempotency_key"), CheckConstraint("subtotal >= 0", name="ck_orders_subtotal_nonnegative"), CheckConstraint("delivery_price >= 0", name="ck_orders_delivery_nonnegative"), CheckConstraint("total = subtotal + delivery_price", name="ck_orders_total"), Index("ix_orders_shop_created", "shop_id", "created_at"), Index("ix_orders_status_created", "status", "created_at"), Index("ix_orders_payment_created", "payment_type", "created_at"))
    id: Mapped[uuid.UUID] = uuid_column()
    order_number: Mapped[str] = mapped_column(String(32), unique=True)
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False)
    shop_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shops.id", ondelete="RESTRICT"))
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus, name="order_status"), default=OrderStatus.NEW)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    delivery_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    payment_type: Mapped[PaymentType] = mapped_column(Enum(PaymentType, name="payment_type"))
    city: Mapped[str] = mapped_column(String(100))
    address: Mapped[str] = mapped_column(String(500))
    phone: Mapped[str] = mapped_column(String(32))
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (CheckConstraint("quantity >= 1", name="ck_order_items_quantity_positive"), CheckConstraint("unit_price >= 0", name="ck_order_items_price_nonnegative"), CheckConstraint("total_price = quantity * unit_price", name="ck_order_items_total"), Index("ix_order_items_supplier_order", "supplier_id", "order_id"))
    id: Mapped[uuid.UUID] = uuid_column()
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id", ondelete="RESTRICT"))
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"))
    supplier_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("suppliers.id", ondelete="RESTRICT"))
    product_name_snapshot: Mapped[str] = mapped_column(String(255))
    sku_snapshot: Mapped[str] = mapped_column(String(100))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
