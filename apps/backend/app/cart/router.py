import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_shop, require_roles
from app.cart import service
from app.cart.schemas import CartItemCreate, CartItemUpdate, CartResponse
from app.core.enums import UserRole
from app.db.session import get_db
from app.shops.models import Shop

router = APIRouter(prefix="/api/v1/cart", tags=["cart"], dependencies=[Depends(require_roles(UserRole.SHOP))])


@router.get("", response_model=CartResponse)
def get_cart(shop: Shop = Depends(get_current_shop), db: Session = Depends(get_db)):
    return service.get_cart(db, shop.id)


@router.post("/items", response_model=CartResponse, status_code=status.HTTP_200_OK)
def add_cart_item(payload: CartItemCreate, shop: Shop = Depends(get_current_shop), db: Session = Depends(get_db)):
    return service.add_cart_item(db, shop.id, payload.product_id, payload.quantity)


@router.patch("/items/{item_id}", response_model=CartResponse)
def update_cart_item(item_id: uuid.UUID, payload: CartItemUpdate, shop: Shop = Depends(get_current_shop), db: Session = Depends(get_db)):
    return service.update_cart_quantity(db, shop.id, item_id, payload.quantity)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cart_item(item_id: uuid.UUID, shop: Shop = Depends(get_current_shop), db: Session = Depends(get_db)):
    service.delete_cart_item(db, shop.id, item_id)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_cart(shop: Shop = Depends(get_current_shop), db: Session = Depends(get_db)):
    service.clear_cart(db, shop.id)
