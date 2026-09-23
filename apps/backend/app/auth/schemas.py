from pydantic import BaseModel, EmailStr, Field

from app.shops.schemas import ShopCreate, ShopResponse
from app.users.schemas import UserResponse


class RegisterRequest(BaseModel):
    phone: str = Field(min_length=3, max_length=32)
    email: EmailStr | None = None
    password: str = Field(min_length=8, max_length=128)
    shop: ShopCreate


class LoginRequest(BaseModel):
    phone_or_email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class AuthResponse(BaseModel):
    user: UserResponse
    shop: ShopResponse | None = None
    access_token: str
    token_type: str = "bearer"


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    user: UserResponse
    shop: ShopResponse | None = None
