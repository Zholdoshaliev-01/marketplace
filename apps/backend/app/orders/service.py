import math
import secrets
import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import delete, desc, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.cart.models import CartItem
from app.cart.service import get_or_create_cart
from app.catalog.models import Product
from app.core.enums import OrderStatus, PaymentType
from app.core.exceptions import BusinessError
from app.delivery.service import find_active_zone
from app.orders import repository
from app.orders.models import Order, OrderItem
from app.orders.schemas import AdminOrderResponse, CheckoutRequest, OrderItemResponse, OrderListResponse, OrderResponse, SupplierOrderResponse
from app.orders.state_machine import can_transition
from app.shops.models import Shop
from app.supplier_fulfillments.models import SupplierFulfillment
from app.supplier_fulfillments.service import admin_fulfillment_summaries
from app.supplier_fulfillments.state_machine import FulfillmentStatus
from app.suppliers.models import Supplier

MONEY = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(MONEY, rounding=ROUND_HALF_UP)


def normalize_key(value: str | None) -> str:
    key = (value or "").strip()
    if not key or len(key) > 64:
        raise BusinessError("INVALID_IDEMPOTENCY_KEY", "Idempotency-Key обязателен и должен содержать от 1 до 64 символов", 422)
    return key


def order_number() -> str:
    return f"ORD-{datetime.now(timezone.utc):%Y%m%d}-{secrets.token_hex(3).upper()}"


def order_response_with_items(order: Order, items: list[OrderItem]) -> OrderResponse:
    return OrderResponse(id=order.id, order_number=order.order_number, status=order.status, payment_type=order.payment_type, subtotal=order.subtotal, delivery_price=order.delivery_price, total=order.total, city=order.city, address=order.address, phone=order.phone, comment=order.comment, created_at=order.created_at, updated_at=order.updated_at, items=[OrderItemResponse.model_validate(item, from_attributes=True) for item in items])


def order_response(db: Session, order: Order) -> OrderResponse:
    return order_response_with_items(order, repository.load_order_items(db, order.id))


def checkout_order(db: Session, shop: Shop, payload: CheckoutRequest, idempotency_key: str) -> tuple[OrderResponse, bool]:
    """Run the existing checkout transaction in its original lock/validation order."""
    db.rollback()
    try:
        with db.begin():
            cart = get_or_create_cart(db, shop.id)
            existing = repository.find_by_idempotency_key(db, shop.id, idempotency_key)
            if existing is not None:
                return order_response(db, existing), True
            cart_items = db.scalars(select(CartItem).where(CartItem.cart_id == cart.id).order_by(CartItem.product_id)).all()
            if not cart_items:
                raise BusinessError("EMPTY_CART", "Корзина пуста", 409)
            product_ids = sorted((item.product_id for item in cart_items), key=str)
            locked_products = repository.lock_products_in_order(db, product_ids)
            products = {product.id: product for product in locked_products}
            if len(products) != len(product_ids):
                raise BusinessError("PRODUCT_UNAVAILABLE", "Один из товаров больше не существует", 409)
            suppliers = {supplier.id: supplier for supplier in db.scalars(select(Supplier).where(Supplier.id.in_({product.supplier_id for product in locked_products}))).all()}
            zone = find_active_zone(db, payload.city.strip())
            if zone is None:
                raise BusinessError("DELIVERY_ZONE_NOT_SUPPORTED", "Для города нет активной зоны доставки", 409)
            subtotal = Decimal("0.00")
            snapshots = []
            for item in cart_items:
                product = products[item.product_id]
                supplier = suppliers.get(product.supplier_id)
                if not product.is_active:
                    raise BusinessError("PRODUCT_UNAVAILABLE", "Товар недоступен", 409)
                if supplier is None or not supplier.is_active:
                    raise BusinessError("SUPPLIER_INACTIVE", "Поставщик деактивирован", 409)
                if item.quantity < product.minimum_order_quantity:
                    raise BusinessError("MOQ_NOT_MET", "Количество меньше минимального заказа", 409)
                if item.quantity > product.stock_quantity:
                    raise BusinessError("INSUFFICIENT_STOCK", "Недостаточно товара на складе", 409)
                total_price = money(product.price * item.quantity)
                subtotal += total_price
                snapshots.append((item, product, total_price))
            subtotal = money(subtotal)
            delivery_price = money(zone.price)
            total = money(subtotal + delivery_price)
            order = Order(order_number=order_number(), idempotency_key=idempotency_key, shop_id=shop.id, status=OrderStatus.NEW, subtotal=subtotal, delivery_price=delivery_price, total=total, payment_type=payload.payment_type, city=payload.city.strip(), address=payload.address, phone=payload.phone, comment=payload.comment)
            db.add(order)
            db.flush()
            for item, product, total_price in snapshots:
                db.add(OrderItem(order_id=order.id, product_id=product.id, supplier_id=product.supplier_id, product_name_snapshot=product.name, sku_snapshot=product.sku, quantity=item.quantity, unit_price=product.price, total_price=total_price))
            for supplier_id in sorted({product.supplier_id for _, product, _ in snapshots}, key=str):
                db.add(SupplierFulfillment(order_id=order.id, supplier_id=supplier_id, status=FulfillmentStatus.PENDING))
            for item, product, _ in snapshots:
                product.stock_quantity -= item.quantity
            db.execute(delete(CartItem).where(CartItem.cart_id == cart.id))
            db.flush()
            return order_response(db, order), False
    except IntegrityError:
        db.rollback()
        existing = repository.find_by_idempotency_key(db, shop.id, idempotency_key)
        if existing is not None:
            return order_response(db, existing), True
        raise BusinessError("IDEMPOTENCY_CONFLICT", "Не удалось безопасно повторить checkout", 409) from None


checkout = checkout_order


def order_list_response(db: Session, query, page: int, page_size: int) -> OrderListResponse:
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    orders = db.scalars(query.order_by(desc(Order.created_at), Order.id).offset((page - 1) * page_size).limit(page_size)).all()
    order_ids = [order.id for order in orders]
    items_by_order: dict[uuid.UUID, list[OrderItem]] = {order_id: [] for order_id in order_ids}
    if order_ids:
        for item in db.scalars(select(OrderItem).where(OrderItem.order_id.in_(order_ids)).order_by(OrderItem.order_id, OrderItem.id)).all():
            items_by_order[item.order_id].append(item)
    return OrderListResponse(items=[order_response_with_items(order, items_by_order[order.id]) for order in orders], page=page, page_size=page_size, total_items=total, total_pages=math.ceil(total / page_size) if total else 0)


def list_shop_orders(db: Session, shop_id: uuid.UUID, status_filter: OrderStatus | None, page: int, page_size: int) -> OrderListResponse:
    query = select(Order).where(Order.shop_id == shop_id)
    if status_filter:
        query = query.where(Order.status == status_filter)
    return order_list_response(db, query, page, page_size)


def get_shop_order(db: Session, shop_id: uuid.UUID, order_id: uuid.UUID) -> OrderResponse:
    order = db.scalar(select(Order).where(Order.id == order_id, Order.shop_id == shop_id))
    if order is None:
        raise BusinessError("ORDER_NOT_FOUND", "Заказ не найден", 404)
    return order_response(db, order)


def list_admin_orders(db: Session, status_filter: OrderStatus | None, date_from: datetime | None, date_to: datetime | None, shop_id: uuid.UUID | None, payment_type: PaymentType | None, page: int, page_size: int) -> OrderListResponse:
    query = select(Order)
    if status_filter: query = query.where(Order.status == status_filter)
    if date_from: query = query.where(Order.created_at >= date_from)
    if date_to: query = query.where(Order.created_at <= date_to)
    if shop_id: query = query.where(Order.shop_id == shop_id)
    if payment_type: query = query.where(Order.payment_type == payment_type)
    return order_list_response(db, query, page, page_size)


def get_order(db: Session, order_id: uuid.UUID) -> OrderResponse:
    order = db.get(Order, order_id)
    if order is None:
        raise BusinessError("ORDER_NOT_FOUND", "Заказ не найден", 404)
    return order_response(db, order)


def get_admin_order(db: Session, order_id: uuid.UUID) -> AdminOrderResponse:
    base = get_order(db, order_id)
    return AdminOrderResponse(**base.model_dump(), fulfillments=admin_fulfillment_summaries(db, order_id))


def change_order_status(db: Session, order_id: uuid.UUID, target: OrderStatus) -> OrderResponse:
    db.rollback()
    with db.begin():
        order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
        if order is None:
            raise BusinessError("ORDER_NOT_FOUND", "Заказ не найден", 404)
        if not can_transition(order.status, target):
            raise BusinessError("INVALID_ORDER_STATUS_TRANSITION", "Недопустимый переход статуса", 409)
        order.status = target
        db.flush()
        result = order_response(db, order)
    return result


def list_supplier_orders(db: Session, supplier_id: uuid.UUID) -> list[SupplierOrderResponse]:
    rows = db.execute(select(Order, OrderItem).join(OrderItem, OrderItem.order_id == Order.id).where(OrderItem.supplier_id == supplier_id).order_by(desc(Order.created_at), Order.id, OrderItem.id)).all()
    grouped: dict[uuid.UUID, SupplierOrderResponse] = {}
    for order, item in rows:
        if order.id not in grouped:
            grouped[order.id] = SupplierOrderResponse(order_id=order.id, order_number=order.order_number, status=order.status, payment_type=order.payment_type, created_at=order.created_at, items=[])
        grouped[order.id].items.append(OrderItemResponse.model_validate(item, from_attributes=True))
    return list(grouped.values())
