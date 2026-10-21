import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.enums import Market


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=3, max_length=32)
    market: Market
    pavilion: str | None = Field(default=None, max_length=100)
    description: str | None = None
    owner_user_id: uuid.UUID | None = None


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, min_length=3, max_length=32)
    market: Market | None = None
    pavilion: str | None = Field(default=None, max_length=100)
    description: str | None = None
    owner_user_id: uuid.UUID | None = None
    is_active: bool | None = None


class SupplierPublic(BaseModel):
    id: uuid.UUID
    name: str
    market: Market
    pavilion: str | None
    description: str | None


class SupplierManagement(SupplierPublic):
    phone: str
    owner_user_id: uuid.UUID | None
    is_active: bool
    created_at: datetime


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int


class SupplierListResponse(BaseModel):
    items: list[SupplierPublic]
    pagination: PaginationMeta
