import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import require_roles
from app.core.enums import Market, UserRole
from app.db.session import get_db
from app.suppliers import service
from app.suppliers.schemas import SupplierCreate, SupplierListResponse, SupplierManagement, SupplierPublic, SupplierUpdate

router = APIRouter(prefix="/api/v1", tags=["catalog"])
admin_router = APIRouter(prefix="/api/v1/admin", tags=["admin-catalog"], dependencies=[Depends(require_roles(UserRole.ADMIN))])


@router.get("/suppliers", response_model=SupplierListResponse)
def public_suppliers(market: Market | None = None, search: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    return service.list_public_suppliers(db, market, search, page, page_size)


@router.get("/suppliers/{supplier_id}", response_model=SupplierPublic)
def public_supplier(supplier_id: uuid.UUID, db: Session = Depends(get_db)):
    return service.get_public_supplier(db, supplier_id)


@admin_router.get("/suppliers", response_model=list[SupplierManagement])
def admin_suppliers(db: Session = Depends(get_db)):
    return service.list_all_suppliers(db)


@admin_router.post("/suppliers", response_model=SupplierManagement, status_code=status.HTTP_201_CREATED)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db)):
    return service.create_supplier(db, payload)


@admin_router.patch("/suppliers/{supplier_id}", response_model=SupplierManagement)
def update_supplier(supplier_id: uuid.UUID, payload: SupplierUpdate, db: Session = Depends(get_db)):
    return service.update_supplier(db, supplier_id, payload)


@admin_router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_supplier(supplier_id: uuid.UUID, db: Session = Depends(get_db)):
    service.deactivate_supplier(db, supplier_id)
