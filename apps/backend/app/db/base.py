import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def uuid_column() -> Mapped[uuid.UUID]:
    return mapped_column(primary_key=True, default=uuid.uuid4)


def created_column() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
