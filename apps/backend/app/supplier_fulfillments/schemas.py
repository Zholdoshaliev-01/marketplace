import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.core.enums import OrderStatus, PaymentType
from app.supplier_fulfillments.state_machine import FulfillmentStatus


class FulfillmentItemResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_name_snapshot: str
    sku_snapshot: str
    quantity: int
    unit_price: Decimal
    total_price: Decimal


class SupplierFulfillmentResponse(BaseModel):
    fulfillment_id: uuid.UUID
    order_id: uuid.UUID
    order_number: str
    status: FulfillmentStatus
    order_status: OrderStatus
    payment_type: PaymentType
    created_at: datetime
    supplier_subtotal: Decimal
    items: list[FulfillmentItemResponse]


class FulfillmentStatusUpdate(BaseModel):
    status: FulfillmentStatus


class AdminFulfillmentSummary(BaseModel):
    fulfillment_id: uuid.UUID
    supplier_id: uuid.UUID
    supplier_name: str
    status: FulfillmentStatus
    item_count: int
    supplier_subtotal: Decimal
