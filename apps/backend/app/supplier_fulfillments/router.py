import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_supplier, require_roles
from app.core.enums import UserRole
from app.db.session import get_db
from app.supplier_fulfillments import service
from app.supplier_fulfillments.schemas import FulfillmentStatusUpdate, SupplierFulfillmentResponse

router = APIRouter(prefix="/api/v1/supplier/fulfillments", tags=["supplier-fulfillments"], dependencies=[Depends(require_roles(UserRole.SUPPLIER))])


@router.get("", response_model=list[SupplierFulfillmentResponse])
def supplier_fulfillments(supplier=Depends(get_current_supplier), db: Session = Depends(get_db)):
    return service.list_supplier_fulfillments(db, supplier.id)


@router.get("/{fulfillment_id}", response_model=SupplierFulfillmentResponse)
def supplier_fulfillment(fulfillment_id: uuid.UUID, supplier=Depends(get_current_supplier), db: Session = Depends(get_db)):
    return service.get_supplier_fulfillment(db, supplier.id, fulfillment_id)


@router.patch("/{fulfillment_id}/status", response_model=SupplierFulfillmentResponse)
def update_fulfillment_status(fulfillment_id: uuid.UUID, payload: FulfillmentStatusUpdate, supplier=Depends(get_current_supplier), db: Session = Depends(get_db)):
    return service.change_fulfillment_status(db, supplier.id, fulfillment_id, payload.status)
