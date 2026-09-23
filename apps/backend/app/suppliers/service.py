import math
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import Market, UserRole
from app.core.exceptions import BusinessError
from app.suppliers.models import Supplier
from app.suppliers.schemas import PaginationMeta, SupplierCreate, SupplierListResponse, SupplierPublic, SupplierUpdate
from app.users.models import User


def supplier_public(supplier: Supplier) -> SupplierPublic:
    return SupplierPublic(id=supplier.id, name=supplier.name, market=supplier.market, pavilion=supplier.pavilion, description=supplier.description)


def list_public_suppliers(db: Session, market: Market | None, search: str | None, page: int, page_size: int) -> SupplierListResponse:
    query = select(Supplier).where(Supplier.is_active.is_(True))
    if market is not None:
        query = query.where(Supplier.market == market)
    if search and search.strip():
        query = query.where(Supplier.name.ilike(f"%{search.strip()}%"))
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(query.order_by(Supplier.name).offset((page - 1) * page_size).limit(page_size)).all()
    return SupplierListResponse(items=[supplier_public(item) for item in items], pagination=PaginationMeta(page=page, page_size=page_size, total_items=total, total_pages=math.ceil(total / page_size) if total else 0))


def get_public_supplier(db: Session, supplier_id: uuid.UUID) -> SupplierPublic:
    supplier = db.scalar(select(Supplier).where(Supplier.id == supplier_id, Supplier.is_active.is_(True)))
    if supplier is None:
        raise BusinessError("SUPPLIER_NOT_FOUND", "Поставщик не найден", 404)
    return supplier_public(supplier)


def list_all_suppliers(db: Session) -> list[SupplierPublic]:
    return [supplier_public(item) for item in db.scalars(select(Supplier).order_by(Supplier.name)).all()]


def _ensure_owner_user(db: Session, owner_user_id: uuid.UUID | None) -> None:
    if owner_user_id is None:
        return
    owner = db.get(User, owner_user_id)
    if owner is None or owner.role != UserRole.SUPPLIER:
        raise BusinessError("INVALID_SUPPLIER_OWNER", "Владелец должен быть пользователем SUPPLIER", 422)


def create_supplier(db: Session, payload: SupplierCreate) -> SupplierPublic:
    _ensure_owner_user(db, payload.owner_user_id)
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier_public(supplier)


def update_supplier(db: Session, supplier_id: uuid.UUID, payload: SupplierUpdate) -> SupplierPublic:
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise BusinessError("SUPPLIER_NOT_FOUND", "Поставщик не найден", 404)
    changes = payload.model_dump(exclude_unset=True)
    _ensure_owner_user(db, changes.get("owner_user_id", supplier.owner_user_id))
    for field, value in changes.items():
        setattr(supplier, field, value)
    db.commit()
    return supplier_public(supplier)


def deactivate_supplier(db: Session, supplier_id: uuid.UUID) -> None:
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise BusinessError("SUPPLIER_NOT_FOUND", "Поставщик не найден", 404)
    supplier.is_active = False
    db.commit()
