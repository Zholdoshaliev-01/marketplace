import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_column, uuid_column


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[uuid.UUID] = uuid_column()
    name: Mapped[str] = mapped_column(String(150))
    slug: Mapped[str] = mapped_column(String(180), unique=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("supplier_id", "sku", name="uq_products_supplier_sku"), CheckConstraint("price >= 0", name="ck_products_price_nonnegative"), CheckConstraint("minimum_order_quantity >= 1", name="ck_products_moq_positive"), CheckConstraint("stock_quantity >= 0", name="ck_products_stock_nonnegative"), Index("ix_products_supplier_active", "supplier_id", "is_active"), Index("ix_products_category_active", "category_id", "is_active"))
    id: Mapped[uuid.UUID] = uuid_column()
    supplier_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("suppliers.id", ondelete="RESTRICT"))
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(280))
    description: Mapped[str | None] = mapped_column(Text)
    sku: Mapped[str] = mapped_column(String(100))
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    minimum_order_quantity: Mapped[int] = mapped_column(Integer)
    stock_quantity: Mapped[int] = mapped_column(Integer)
    unit: Mapped[str] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ProductImage(Base):
    __tablename__ = "product_images"
    id: Mapped[uuid.UUID] = uuid_column()
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"))
    image_url: Mapped[str] = mapped_column(String(1000))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
