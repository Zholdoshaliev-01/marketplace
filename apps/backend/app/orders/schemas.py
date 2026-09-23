import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.core.enums import OrderStatus, PaymentType
from app.supplier_fulfillments.schemas import AdminFulfillmentSummary


class CheckoutRequest(BaseModel):
    city: str = Field(min_length=1, max_length=100)
    address: str = Field(min_length=1, max_length=500)
    phone: str = Field(min_length=3, max_length=32)
    comment: str | None = None
    payment_type: PaymentType


class OrderItemResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    supplier_id: uuid.UUID
    product_name_snapshot: str
    sku_snapshot: str
    quantity: int
    unit_price: Decimal
    total_price: Decimal


class OrderResponse(BaseModel):
    id: uuid.UUID
    order_number: str
    status: OrderStatus
    payment_type: PaymentType
    subtotal: Decimal
    delivery_price: Decimal
    total: Decimal
    city: str
    address: str
    phone: str
    comment: str | None
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemResponse]


class AdminOrderResponse(OrderResponse):
    fulfillments: list[AdminFulfillmentSummary]


class OrderListResponse(BaseModel):
    items: list[OrderResponse]
    page: int
    page_size: int
    total_items: int
    total_pages: int


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class SupplierOrderResponse(BaseModel):
    order_id: uuid.UUID
    order_number: str
    status: OrderStatus
    payment_type: PaymentType
    created_at: datetime
    items: list[OrderItemResponse]
