import uuid
from decimal import Decimal

from pydantic import BaseModel, Field


class CartItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(ge=1)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1)


class CartProduct(BaseModel):
    id: uuid.UUID
    name: str
    sku: str
    price: Decimal
    minimum_order_quantity: int
    stock_quantity: int
    unit: str
    primary_image_url: str | None


class CartItemResponse(BaseModel):
    id: uuid.UUID
    product: CartProduct
    quantity: int
    line_total: Decimal


class CartResponse(BaseModel):
    id: uuid.UUID
    items: list[CartItemResponse]
    subtotal: Decimal
