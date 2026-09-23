import uuid
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessError
from app.orders.models import Order, OrderItem
from app.supplier_fulfillments.models import SupplierFulfillment
from app.supplier_fulfillments.schemas import AdminFulfillmentSummary, FulfillmentItemResponse, SupplierFulfillmentResponse
from app.supplier_fulfillments.state_machine import FulfillmentStatus, validate_fulfillment_transition
from app.suppliers.models import Supplier


def _response(fulfillment: SupplierFulfillment, order: Order, items: list[OrderItem]) -> SupplierFulfillmentResponse:
    return SupplierFulfillmentResponse(
        fulfillment_id=fulfillment.id,
        order_id=order.id,
        order_number=order.order_number,
        status=fulfillment.status,
        order_status=order.status,
        payment_type=order.payment_type,
        created_at=fulfillment.created_at,
        supplier_subtotal=sum((item.total_price for item in items), Decimal("0.00")),
        items=[FulfillmentItemResponse.model_validate(item, from_attributes=True) for item in items],
    )


def _load_items(db: Session, order_ids: list[uuid.UUID], supplier_id: uuid.UUID) -> dict[uuid.UUID, list[OrderItem]]:
    grouped: dict[uuid.UUID, list[OrderItem]] = defaultdict(list)
    if order_ids:
        rows = db.scalars(select(OrderItem).where(OrderItem.order_id.in_(order_ids), OrderItem.supplier_id == supplier_id).order_by(OrderItem.order_id, OrderItem.id)).all()
        for item in rows:
            grouped[item.order_id].append(item)
    return grouped


def list_supplier_fulfillments(db: Session, supplier_id: uuid.UUID) -> list[SupplierFulfillmentResponse]:
    rows = db.execute(select(SupplierFulfillment, Order).join(Order, Order.id == SupplierFulfillment.order_id).where(SupplierFulfillment.supplier_id == supplier_id).order_by(desc(SupplierFulfillment.created_at), SupplierFulfillment.id)).all()
    items = _load_items(db, [fulfillment.order_id for fulfillment, _ in rows], supplier_id)
    return [_response(fulfillment, order, items[fulfillment.order_id]) for fulfillment, order in rows]


def get_supplier_fulfillment(db: Session, supplier_id: uuid.UUID, fulfillment_id: uuid.UUID) -> SupplierFulfillmentResponse:
    row = db.execute(select(SupplierFulfillment, Order).join(Order, Order.id == SupplierFulfillment.order_id).where(SupplierFulfillment.id == fulfillment_id, SupplierFulfillment.supplier_id == supplier_id)).first()
    if row is None:
        raise BusinessError("FULFILLMENT_NOT_FOUND", "Выполнение заказа не найдено", 404)
    fulfillment, order = row
    return _response(fulfillment, order, _load_items(db, [order.id], supplier_id)[order.id])


def change_fulfillment_status(db: Session, supplier_id: uuid.UUID, fulfillment_id: uuid.UUID, target: FulfillmentStatus) -> SupplierFulfillmentResponse:
    db.rollback()
    with db.begin():
        row = db.execute(select(SupplierFulfillment, Order).join(Order, Order.id == SupplierFulfillment.order_id).where(SupplierFulfillment.id == fulfillment_id, SupplierFulfillment.supplier_id == supplier_id).with_for_update()).first()
        if row is None:
            raise BusinessError("FULFILLMENT_NOT_FOUND", "Выполнение заказа не найдено", 404)
        fulfillment, order = row
        try:
            validate_fulfillment_transition(fulfillment.status, target)
        except ValueError:
            raise BusinessError("INVALID_FULFILLMENT_STATUS_TRANSITION", "Недопустимый переход статуса выполнения", 409) from None
        fulfillment.status = target
        db.flush()
        result = _response(fulfillment, order, _load_items(db, [order.id], supplier_id)[order.id])
    return result


def admin_fulfillment_summaries(db: Session, order_id: uuid.UUID) -> list[AdminFulfillmentSummary]:
    rows = db.execute(
        select(SupplierFulfillment, Supplier.name, func.count(OrderItem.id), func.coalesce(func.sum(OrderItem.total_price), 0))
        .join(Supplier, Supplier.id == SupplierFulfillment.supplier_id)
        .join(OrderItem, and_(OrderItem.order_id == SupplierFulfillment.order_id, OrderItem.supplier_id == SupplierFulfillment.supplier_id))
        .where(SupplierFulfillment.order_id == order_id)
        .group_by(SupplierFulfillment.id, Supplier.name)
        .order_by(Supplier.name, SupplierFulfillment.id)
    ).all()
    return [AdminFulfillmentSummary(fulfillment_id=fulfillment.id, supplier_id=fulfillment.supplier_id, supplier_name=name, status=fulfillment.status, item_count=item_count, supplier_subtotal=subtotal) for fulfillment, name, item_count, subtotal in rows]
