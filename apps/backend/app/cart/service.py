import uuid
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.cart.models import Cart, CartItem
from app.cart.schemas import CartItemResponse, CartProduct, CartResponse
from app.catalog.models import Product, ProductImage
from app.core.exceptions import BusinessError
from app.suppliers.models import Supplier

MONEY = Decimal("0.01")


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY, rounding=ROUND_HALF_UP)


def _primary_image_subquery():
    return select(ProductImage.image_url).where(ProductImage.product_id == Product.id).order_by(ProductImage.sort_order, ProductImage.id).limit(1).scalar_subquery()


def get_or_create_cart(db: Session, shop_id: uuid.UUID) -> Cart:
    cart = db.scalar(select(Cart).where(Cart.shop_id == shop_id).with_for_update())
    if cart is None:
        cart = Cart(shop_id=shop_id)
        db.add(cart)
        db.flush()
    return cart


def cart_view(db: Session, cart: Cart) -> CartResponse:
    image = _primary_image_subquery()
    rows = db.execute(select(CartItem, Product, Supplier, image).join(Product, Product.id == CartItem.product_id).join(Supplier, Supplier.id == Product.supplier_id).where(CartItem.cart_id == cart.id).order_by(CartItem.id)).all()
    items = []
    subtotal = Decimal("0.00")
    for item, product, _, image_url in rows:
        line_total = _money(product.price * item.quantity)
        subtotal += line_total
        items.append(CartItemResponse(id=item.id, product=CartProduct(id=product.id, name=product.name, sku=product.sku, price=product.price, minimum_order_quantity=product.minimum_order_quantity, stock_quantity=product.stock_quantity, unit=product.unit, primary_image_url=image_url), quantity=item.quantity, line_total=line_total))
    return CartResponse(id=cart.id, items=items, subtotal=_money(subtotal))


def _validate_product(db: Session, product_id: uuid.UUID, quantity: int) -> Product:
    row = db.execute(select(Product, Supplier).join(Supplier, Supplier.id == Product.supplier_id).where(Product.id == product_id)).first()
    if row is None:
        raise BusinessError("PRODUCT_UNAVAILABLE", "Товар не найден", 404)
    product, supplier = row
    if not product.is_active:
        raise BusinessError("PRODUCT_UNAVAILABLE", "Товар недоступен", 409)
    if not supplier.is_active:
        raise BusinessError("SUPPLIER_INACTIVE", "Поставщик деактивирован", 409)
    if quantity < product.minimum_order_quantity:
        raise BusinessError("MOQ_NOT_MET", "Количество меньше минимального заказа", 409)
    if quantity > product.stock_quantity:
        raise BusinessError("INSUFFICIENT_STOCK", "Недостаточно товара на складе", 409)
    return product


def get_cart(db: Session, shop_id: uuid.UUID) -> CartResponse:
    db.rollback()
    with db.begin():
        return cart_view(db, get_or_create_cart(db, shop_id))


def add_cart_item(db: Session, shop_id: uuid.UUID, product_id: uuid.UUID, quantity: int) -> CartResponse:
    db.rollback()
    with db.begin():
        cart = get_or_create_cart(db, shop_id)
        product = _validate_product(db, product_id, quantity)
        item = db.scalar(select(CartItem).where(CartItem.cart_id == cart.id, CartItem.product_id == product.id))
        if item is None:
            db.add(CartItem(cart_id=cart.id, product_id=product.id, quantity=quantity))
        else:
            item.quantity = quantity
        db.flush()
        return cart_view(db, cart)


def update_cart_quantity(db: Session, shop_id: uuid.UUID, item_id: uuid.UUID, quantity: int) -> CartResponse:
    db.rollback()
    with db.begin():
        cart = get_or_create_cart(db, shop_id)
        item = db.scalar(select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id))
        if item is None:
            raise BusinessError("CART_ITEM_NOT_FOUND", "Позиция корзины не найдена", 404)
        _validate_product(db, item.product_id, quantity)
        item.quantity = quantity
        db.flush()
        return cart_view(db, cart)


def delete_cart_item(db: Session, shop_id: uuid.UUID, item_id: uuid.UUID) -> None:
    db.rollback()
    with db.begin():
        cart = get_or_create_cart(db, shop_id)
        item = db.scalar(select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id))
        if item is None:
            raise BusinessError("CART_ITEM_NOT_FOUND", "Позиция корзины не найдена", 404)
        db.delete(item)


def clear_cart(db: Session, shop_id: uuid.UUID) -> None:
    db.rollback()
    with db.begin():
        cart = get_or_create_cart(db, shop_id)
        db.execute(delete(CartItem).where(CartItem.cart_id == cart.id))
