import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_column, uuid_column
from app.supplier_fulfillments.state_machine import FulfillmentStatus


class SupplierFulfillment(Base):
    __tablename__ = "supplier_fulfillments"
    __table_args__ = (
        UniqueConstraint("order_id", "supplier_id", name="uq_supplier_fulfillments_order_supplier"),
        Index("ix_supplier_fulfillments_supplier_created", "supplier_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = uuid_column()
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id", ondelete="RESTRICT"), nullable=False)
    supplier_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False)
    status: Mapped[FulfillmentStatus] = mapped_column(Enum(FulfillmentStatus, name="supplier_fulfillment_status"), default=FulfillmentStatus.PENDING, nullable=False)
    created_at: Mapped[datetime] = created_column()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
