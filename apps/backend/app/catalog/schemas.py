import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.enums import Market
from app.suppliers.schemas import SupplierPublic


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    slug: str = Field(min_length=1, max_length=180, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    parent_id: uuid.UUID | None = None


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    slug: str | None = Field(default=None, min_length=1, max_length=180, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    parent_id: uuid.UUID | None = None


class CategoryPublic(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    children: list["CategoryPublic"] = Field(default_factory=list)


class ProductImageCreate(BaseModel):
    image_url: str = Field(min_length=1, max_length=1000)
    sort_order: int = Field(default=0, ge=0)


class ProductImageUpdate(BaseModel):
    sort_order: int = Field(ge=0)


class ProductImageResponse(BaseModel):
    id: uuid.UUID
    image_url: str
    sort_order: int


class ProductCreateAdmin(BaseModel):
    supplier_id: uuid.UUID
    category_id: uuid.UUID
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=280)
    description: str | None = None
    sku: str = Field(min_length=1, max_length=100)
    price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    minimum_order_quantity: int = Field(ge=1)
    stock_quantity: int = Field(ge=0)
    unit: str = Field(min_length=1, max_length=30)
    is_active: bool = True
    images: list[ProductImageCreate] = Field(default_factory=list, max_length=10)


class ProductCreateSupplier(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category_id: uuid.UUID
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=280)
    description: str | None = None
    sku: str = Field(min_length=1, max_length=100)
    price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    minimum_order_quantity: int = Field(ge=1)
    stock_quantity: int = Field(ge=0)
    unit: str = Field(min_length=1, max_length=30)
    is_active: bool = True
    images: list[ProductImageCreate] = Field(default_factory=list, max_length=10)


class ProductUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=280)
    description: str | None = None
    sku: str | None = Field(default=None, min_length=1, max_length=100)
    price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    minimum_order_quantity: int | None = Field(default=None, ge=1)
    stock_quantity: int | None = Field(default=None, ge=0)
    unit: str | None = Field(default=None, min_length=1, max_length=30)
    is_active: bool | None = None


class ProductSupplierSummary(SupplierPublic):
    pass


class ProductCategorySummary(BaseModel):
    id: uuid.UUID
    name: str
    slug: str


class ProductCard(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    sku: str
    price: Decimal
    minimum_order_quantity: int
    stock_quantity: int
    unit: str
    supplier: ProductSupplierSummary
    category: ProductCategorySummary
    primary_image_url: str | None


class ProductDetail(ProductCard):
    description: str | None
    images: list[ProductImageResponse]
    created_at: datetime
    updated_at: datetime


class ProductManagement(ProductDetail):
    is_active: bool


class ProductListResponse(BaseModel):
    items: list[ProductCard]
    pagination: PaginationMeta


class SupplierListResponse(BaseModel):
    items: list[SupplierPublic]
    pagination: PaginationMeta


class CategoryListResponse(BaseModel):
    items: list[CategoryPublic]


class ProductQuery(BaseModel):
    search: str | None = None
    category_id: uuid.UUID | None = None
    supplier_id: uuid.UUID | None = None
    market: Market | None = None
    min_price: Decimal | None = Field(default=None, ge=0)
    max_price: Decimal | None = Field(default=None, ge=0)
    in_stock: bool = False
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    sort: Literal["newest", "price_asc", "price_desc", "name_asc"] = "newest"

    @field_validator("search")
    @classmethod
    def trim_search(cls, value: str | None) -> str | None:
        value = value.strip() if value else None
        return value or None

    @model_validator(mode="after")
    def validate_price_range(self):
        if self.min_price is not None and self.max_price is not None and self.min_price > self.max_price:
            raise ValueError("min_price не может быть больше max_price")
        return self


CategoryPublic.model_rebuild()
