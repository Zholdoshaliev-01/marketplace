import uuid

from pydantic import BaseModel, ConfigDict, Field


class ShopCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=3, max_length=32)
    city: str = Field(min_length=1, max_length=100)
    address: str = Field(min_length=1, max_length=500)


class ShopResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    owner_user_id: uuid.UUID
    name: str
    phone: str
    city: str
    address: str
