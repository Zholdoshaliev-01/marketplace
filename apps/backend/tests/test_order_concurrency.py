import os
import threading
import uuid
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker

from app.core.enums import Market, PaymentType, UserRole
from app.cart.models import Cart, CartItem
from app.catalog.models import Category, Product
from app.delivery.models import DeliveryZone
from app.orders.models import Order
from app.supplier_fulfillments.models import SupplierFulfillment
from app.shops.models import Shop
from app.suppliers.models import Supplier
from app.users.models import User
from app.orders.schemas import CheckoutRequest
from app.orders import checkout
from app.core.security import hash_password

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def require_postgres():
    if not os.getenv("TEST_DATABASE_URL", "").startswith("postgresql"):
        pytest.skip("Concurrency tests require PostgreSQL")


def setup_concurrent_data(db, stock=5, quantity=5):
    category = Category(name="Concurrent", slug=f"concurrent-{uuid.uuid4()}")
    supplier = Supplier(name="Concurrent Supplier", phone="+996555111111", market=Market.DORDOI, is_active=True)
    db.add_all([category, supplier])
    db.flush()
    product = Product(supplier_id=supplier.id, category_id=category.id, name="Concurrent", slug=str(uuid.uuid4()), sku=f"CON-{uuid.uuid4()}", price=Decimal("100.00"), minimum_order_quantity=quantity, stock_quantity=stock, unit="шт", is_active=True)
    zone = DeliveryZone(city="Каракол", price=Decimal("50.00"), is_active=True)
    db.add_all([product, zone])
    shops = []
    for index in range(2):
        user = User(phone=f"+9967008{index:05d}", password_hash=hash_password("password"), role=UserRole.SHOP, is_active=True)
        db.add(user)
        db.flush()
        shop = Shop(owner_user_id=user.id, name=f"Concurrent Shop {index}", phone=user.phone, city="Каракол", address="A")
        db.add(shop)
        db.flush()
        cart = Cart(shop_id=shop.id)
        db.add(cart)
        db.flush()
        db.add(CartItem(cart_id=cart.id, product_id=product.id, quantity=quantity))
        shops.append(shop)
    db.commit()
    return product.id, [shop.id for shop in shops]


def run_two_checkouts(db, shop_ids, product_id, keys):
    Session = sessionmaker(bind=db.get_bind(), autoflush=False, expire_on_commit=False)
    barrier = threading.Barrier(2)
    results = []

    def worker(shop_id, key):
        session = Session()
        try:
            shop = session.get(Shop, shop_id)
            barrier.wait(timeout=10)
            result, replay = checkout(session, shop, CheckoutRequest(city="Каракол", address="Address", phone=shop.phone, payment_type=PaymentType.CASH), key)
            results.append(("success", result.id, replay))
        except Exception as exc:
            results.append(("error", getattr(exc, "code", type(exc).__name__), None))
        finally:
            session.close()

    threads = [threading.Thread(target=worker, args=(shop_ids[index], keys[index])) for index in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=20)
    assert len(results) == 2
    return results


def test_concurrent_last_stock_one_success(db):
    product_id, shop_ids = setup_concurrent_data(db, stock=5, quantity=5)
    results = run_two_checkouts(db, shop_ids, product_id, ["a", "b"])
    assert sum(result[0] == "success" for result in results) == 1
    assert sum(result[1] == "INSUFFICIENT_STOCK" for result in results) == 1
    db.expire_all()
    assert db.get(Product, product_id).stock_quantity == 0
    assert db.scalar(select(func.count(Order.id))) == 1
    assert db.scalar(select(func.count(SupplierFulfillment.id))) == 1


def test_concurrent_partial_stock_one_success(db):
    product_id, shop_ids = setup_concurrent_data(db, stock=10, quantity=6)
    results = run_two_checkouts(db, shop_ids, product_id, ["a", "b"])
    assert sum(result[0] == "success" for result in results) == 1
    assert sum(result[1] == "INSUFFICIENT_STOCK" for result in results) == 1
    db.expire_all()
    assert db.get(Product, product_id).stock_quantity == 4


def test_concurrent_same_idempotency_key_one_order_and_replay(db):
    product_id, shop_ids = setup_concurrent_data(db, stock=5, quantity=5)
    first_shop = shop_ids[0]
    second_cart = db.scalar(select(Cart).where(Cart.shop_id == shop_ids[1]))
    db.execute(CartItem.__table__.delete().where(CartItem.cart_id == second_cart.id))
    db.commit()
    results = run_two_checkouts(db, [first_shop, first_shop], product_id, ["same", "same"])
    assert sum(result[0] == "success" for result in results) == 2
    assert sum(result[2] is True for result in results) == 1
    db.expire_all()
    assert db.get(Product, product_id).stock_quantity == 0
    assert db.scalar(select(func.count(Order.id))) == 1
    assert db.scalar(select(func.count(SupplierFulfillment.id))) == 1


def test_concurrent_different_products_are_independent(db):
    product_id, shop_ids = setup_concurrent_data(db, stock=5, quantity=5)
    product = db.get(Product, product_id)
    second_product = Product(supplier_id=product.supplier_id, category_id=product.category_id, name="Concurrent two", slug=str(uuid.uuid4()), sku=f"CON-{uuid.uuid4()}", price=Decimal("200.00"), minimum_order_quantity=5, stock_quantity=5, unit="шт", is_active=True)
    db.add(second_product)
    db.flush()
    second_cart = db.scalar(select(Cart).where(Cart.shop_id == shop_ids[1]))
    db.execute(CartItem.__table__.delete().where(CartItem.cart_id == second_cart.id))
    db.add(CartItem(cart_id=second_cart.id, product_id=second_product.id, quantity=5))
    db.commit()
    results = run_two_checkouts(db, shop_ids, product_id, ["different-a", "different-b"])
    assert sum(result[0] == "success" for result in results) == 2
    db.expire_all()
    assert db.get(Product, product_id).stock_quantity == 0
    assert db.get(Product, second_product.id).stock_quantity == 0
