import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.core.enums import UserRole


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    phone: str
    email: EmailStr | None
    role: UserRole
    is_active: bool
    created_at: datetime
