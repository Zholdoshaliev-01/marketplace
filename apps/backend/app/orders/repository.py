import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalog.models import Product
from app.orders.models import Order, OrderItem


def find_by_idempotency_key(db: Session, shop_id: uuid.UUID, key: str) -> Order | None:
    return db.scalar(select(Order).where(Order.shop_id == shop_id, Order.idempotency_key == key))


def lock_products_in_order(db: Session, product_ids: list[uuid.UUID]) -> list[Product]:
    return list(db.scalars(select(Product).where(Product.id.in_(product_ids)).order_by(Product.id).with_for_update()).all())


def load_order_items(db: Session, order_id: uuid.UUID) -> list[OrderItem]:
    return list(db.scalars(select(OrderItem).where(OrderItem.order_id == order_id).order_by(OrderItem.id)).all())
