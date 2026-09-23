import os
import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.enums import Market, OrderStatus, PaymentType, UserRole
from app.cart.models import Cart, CartItem
from app.catalog.models import Category, Product
from app.orders.models import Order
from app.shops.models import Shop
from app.suppliers.models import Supplier
from app.users.models import User
from app.core.security import hash_password

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def require_postgres():
    if not os.getenv("TEST_DATABASE_URL", "").startswith("postgresql"):
        pytest.skip("PostgreSQL integration tests require TEST_DATABASE_URL")


def user(phone: str = "+996700000010", email: str | None = None) -> User:
    return User(phone=phone, email=email, password_hash=hash_password("strong-password"), role=UserRole.SHOP)


def supplier(owner_user_id=None, name="Supplier", sku=None):
    return Supplier(owner_user_id=owner_user_id, name=name, phone="+996555000000", market=Market.DORDOI)


def test_duplicate_user_phone_rejected(db):
    db.add_all([user(), user(email="other@example.com")])
    with pytest.raises(IntegrityError):
        db.commit()


def test_second_shop_for_same_owner_rejected(db):
    owner = user()
    db.add(owner)
    db.flush()
    db.add_all([
        Shop(owner_user_id=owner.id, name="One", phone=owner.phone, city="Бишкек", address="A"),
        Shop(owner_user_id=owner.id, name="Two", phone=owner.phone, city="Бишкек", address="B"),
    ])
    with pytest.raises(IntegrityError):
        db.commit()


def test_duplicate_supplier_sku_rejected(db):
    owner = user()
    db.add(owner)
    db.flush()
    first_supplier = supplier(owner.id)
    db.add(first_supplier)
    db.flush()
    category = Category(name="Одежда", slug=f"clothes-{uuid.uuid4()}")
    db.add(category)
    db.flush()
    product_fields = dict(supplier_id=first_supplier.id, category_id=category.id, name="Item", slug=str(uuid.uuid4()), description=None, sku="SKU-1", price=10, minimum_order_quantity=1, stock_quantity=5, unit="шт")
    db.add_all([Product(**product_fields), Product(**{**product_fields, "slug": str(uuid.uuid4())})])
    with pytest.raises(IntegrityError):
        db.commit()


def test_duplicate_cart_item_product_rejected(db):
    owner = user()
    db.add(owner)
    db.flush()
    shop = Shop(owner_user_id=owner.id, name="Shop", phone=owner.phone, city="Бишкек", address="A")
    db.add(shop)
    db.flush()
    supplier_row = supplier(name="Supplier")
    category = Category(name="Одежда", slug=f"clothes-{uuid.uuid4()}")
    db.add_all([supplier_row, category])
    db.flush()
    product = Product(supplier_id=supplier_row.id, category_id=category.id, name="Item", slug=str(uuid.uuid4()), sku="SKU-1", price=10, minimum_order_quantity=1, stock_quantity=5, unit="шт")
    db.add(product)
    db.flush()
    cart = Cart(shop_id=shop.id)
    db.add(cart)
    db.flush()
    db.add_all([CartItem(cart_id=cart.id, product_id=product.id, quantity=1), CartItem(cart_id=cart.id, product_id=product.id, quantity=2)])
    with pytest.raises(IntegrityError):
        db.commit()


def test_duplicate_order_idempotency_key_for_same_shop_rejected(db):
    owner = user()
    db.add(owner)
    db.flush()
    shop = Shop(owner_user_id=owner.id, name="Shop", phone=owner.phone, city="Бишкек", address="A")
    db.add(shop)
    db.flush()
    values = dict(order_number="ORD-1", idempotency_key="key-1", shop_id=shop.id, status=OrderStatus.NEW, subtotal=10, delivery_price=0, total=10, payment_type=PaymentType.CASH, city="Бишкек", address="A", phone=shop.phone)
    db.add_all([Order(**values), Order(**{**values, "order_number": "ORD-2"})])
    with pytest.raises(IntegrityError):
        db.commit()


def test_negative_stock_and_invalid_moq_rejected(db):
    supplier_row = supplier()
    category = Category(name="Одежда", slug=f"clothes-{uuid.uuid4()}")
    db.add_all([supplier_row, category])
    db.flush()
    db.add(Product(supplier_id=supplier_row.id, category_id=category.id, name="Bad stock", slug=str(uuid.uuid4()), sku="SKU-STOCK", price=10, minimum_order_quantity=1, stock_quantity=-1, unit="шт"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    db.add(Product(supplier_id=supplier_row.id, category_id=category.id, name="Bad MOQ", slug=str(uuid.uuid4()), sku="SKU-MOQ", price=10, minimum_order_quantity=0, stock_quantity=1, unit="шт"))
    with pytest.raises(IntegrityError):
        db.commit()


def test_transaction_rollback_removes_partial_records(db):
    phone = "+996700000011"
    try:
        with db.begin():
            owner = user(phone)
            db.add(owner)
            db.flush()
            db.add(Shop(owner_user_id=owner.id, name="Rolled back", phone=phone, city="Бишкек", address="A"))
            raise RuntimeError("intentional failure")
    except RuntimeError:
        pass
    assert db.scalar(select(User).where(User.phone == phone)) is None
    assert db.scalar(select(Shop).where(Shop.name == "Rolled back")) is None
