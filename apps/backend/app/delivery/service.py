from sqlalchemy import select
from sqlalchemy.orm import Session

from app.delivery.models import DeliveryZone


def find_active_zone(db: Session, city: str) -> DeliveryZone | None:
    return db.scalar(select(DeliveryZone).where(DeliveryZone.city == city, DeliveryZone.is_active.is_(True)))
