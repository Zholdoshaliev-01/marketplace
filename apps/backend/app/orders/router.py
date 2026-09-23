import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_shop, get_current_supplier, require_roles
from app.core.enums import OrderStatus, PaymentType, UserRole
from app.db.session import get_db
from app.orders import service
from app.orders.schemas import AdminOrderResponse, CheckoutRequest, OrderListResponse, OrderResponse, OrderStatusUpdate, SupplierOrderResponse
from app.shops.models import Shop

router = APIRouter(prefix="/api/v1/orders", tags=["orders"], dependencies=[Depends(require_roles(UserRole.SHOP))])
admin_router = APIRouter(prefix="/api/v1/admin/orders", tags=["admin-orders"], dependencies=[Depends(require_roles(UserRole.ADMIN))])
supplier_router = APIRouter(prefix="/api/v1/supplier/orders", tags=["supplier-orders"], dependencies=[Depends(require_roles(UserRole.SUPPLIER))])


@router.post("", response_model=OrderResponse)
def create_order(payload: CheckoutRequest, response: Response, idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None, shop: Shop = Depends(get_current_shop), db: Session = Depends(get_db)):
    result, replay = service.checkout_order(db, shop, payload, service.normalize_key(idempotency_key))
    response.status_code = status.HTTP_200_OK if replay else status.HTTP_201_CREATED
    return result


@router.get("", response_model=OrderListResponse)
def shop_orders(status_filter: OrderStatus | None = Query(default=None, alias="status"), page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), shop: Shop = Depends(get_current_shop), db: Session = Depends(get_db)):
    return service.list_shop_orders(db, shop.id, status_filter, page, page_size)


@router.get("/{order_id}", response_model=OrderResponse)
def shop_order(order_id: uuid.UUID, shop: Shop = Depends(get_current_shop), db: Session = Depends(get_db)):
    return service.get_shop_order(db, shop.id, order_id)


@admin_router.get("", response_model=OrderListResponse)
def admin_orders(status_filter: OrderStatus | None = Query(default=None, alias="status"), date_from: datetime | None = None, date_to: datetime | None = None, shop_id: uuid.UUID | None = None, payment_type: PaymentType | None = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    return service.list_admin_orders(db, status_filter, date_from, date_to, shop_id, payment_type, page, page_size)


@admin_router.get("/{order_id}", response_model=AdminOrderResponse)
def admin_order(order_id: uuid.UUID, db: Session = Depends(get_db)):
    return service.get_admin_order(db, order_id)


@admin_router.patch("/{order_id}/status", response_model=OrderResponse)
def update_order_status(order_id: uuid.UUID, payload: OrderStatusUpdate, db: Session = Depends(get_db)):
    return service.change_order_status(db, order_id, payload.status)


@supplier_router.get("", response_model=list[SupplierOrderResponse])
def supplier_orders(supplier=Depends(get_current_supplier), db: Session = Depends(get_db)):
    return service.list_supplier_orders(db, supplier.id)
