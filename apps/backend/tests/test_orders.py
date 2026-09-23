import os
import threading
import uuid
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core.enums import Market, OrderStatus, PaymentType, UserRole
from app.orders import service as orders_module
from app.cart.models import Cart, CartItem
from app.catalog.models import Category, Product
from app.delivery.models import DeliveryZone
from app.orders.models import Order, OrderItem
from app.shops.models import Shop
from app.supplier_fulfillments.models import SupplierFulfillment
from app.suppliers.models import Supplier
from app.users.models import User
from app.orders.schemas import CheckoutRequest
from app.core.security import create_access_token, hash_password

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def require_postgres():
    if not os.getenv("TEST_DATABASE_URL", "").startswith("postgresql"):
        pytest.skip("Order integration tests require TEST_DATABASE_URL")


def make_user(db, role, phone):
    user = User(phone=phone, password_hash=hash_password("strong-password"), role=role, is_active=True)
    db.add(user)
    db.flush()
    return user


def setup_shop(db, suffix, role=UserRole.SHOP):
    user = make_user(db, role, f"+996700{suffix:06d}")
    shop = None
    if role == UserRole.SHOP:
        shop = Shop(owner_user_id=user.id, name=f"Shop {suffix}", phone=user.phone, city="Бишкек", address="Address")
        db.add(shop)
        db.flush()
    return user, shop


def setup_catalog(db):
    category = Category(name="Одежда", slug=f"clothes-{uuid.uuid4()}")
    supplier_user = make_user(db, UserRole.SUPPLIER, "+996700300001")
    supplier = Supplier(owner_user_id=supplier_user.id, name="Supplier", phone=supplier_user.phone, market=Market.DORDOI, is_active=True)
    db.add_all([category, supplier])
    db.flush()
    product = Product(supplier_id=supplier.id, category_id=category.id, name="Original name", slug=str(uuid.uuid4()), sku="SKU-ORDER", price=Decimal("1000.00"), minimum_order_quantity=5, stock_quantity=10, unit="шт", is_active=True)
    zone = DeliveryZone(city="Каракол", price=Decimal("150.00"), is_active=True)
    db.add_all([product, zone])
    db.flush()
    return supplier_user, supplier, category, product, zone


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(str(user.id), user.role.value)}"}


def add_item(db, shop, product, quantity=5):
    cart = Cart(shop_id=shop.id)
    db.add(cart)
    db.flush()
    db.add(CartItem(cart_id=cart.id, product_id=product.id, quantity=quantity))
    db.commit()
    return cart


def checkout(client, shop_user, key="order-key", city="Каракол", payment_type="CASH"):
    return client.post("/api/v1/orders", headers={**auth(shop_user), "Idempotency-Key": key}, json={"city": city, "address": "ул. Тестовая 1", "phone": shop_user.phone, "comment": "", "payment_type": payment_type})


def test_cart_replace_quantity_and_current_price(client, db):
    shop_user, shop = setup_shop(db, 1)
    _, _, _, product, _ = setup_catalog(db)
    db.commit()
    first = client.post("/api/v1/cart/items", headers=auth(shop_user), json={"product_id": str(product.id), "quantity": 5})
    assert first.status_code == 200
    second = client.post("/api/v1/cart/items", headers=auth(shop_user), json={"product_id": str(product.id), "quantity": 6})
    assert second.status_code == 200
    product.price = Decimal("1200.00")
    db.commit()
    response = client.get("/api/v1/cart", headers=auth(shop_user))
    assert response.json()["items"][0]["quantity"] == 6
    assert response.json()["items"][0]["product"]["price"] == "1200.00"


def test_checkout_recalculates_price_clears_cart_and_snapshots(client, db):
    shop_user, shop = setup_shop(db, 2)
    _, supplier, _, product, _ = setup_catalog(db)
    add_item(db, shop, product, 5)
    product.price = Decimal("1200.00")
    db.commit()
    response = checkout(client, shop_user, payment_type="INSTALLMENT_REQUEST")
    assert response.status_code == 201
    data = response.json()
    assert data["payment_type"] == "INSTALLMENT_REQUEST"
    assert data["subtotal"] == "6000.00"
    assert data["delivery_price"] == "150.00"
    assert data["total"] == "6150.00"
    assert data["items"][0]["unit_price"] == "1200.00"
    assert len(db.scalars(select(SupplierFulfillment).where(SupplierFulfillment.order_id == uuid.UUID(data["id"]))).all()) == 1
    assert db.scalar(select(CartItem).where(CartItem.cart_id == db.scalar(select(Cart.id).where(Cart.shop_id == shop.id)))) is None
    product.name = "Changed name"
    product.sku = "CHANGED-SKU"
    product.price = Decimal("2000.00")
    db.commit()
    detail = client.get(f"/api/v1/orders/{data['id']}", headers=auth(shop_user)).json()
    assert detail["items"][0]["product_name_snapshot"] == "Original name"
    assert detail["items"][0]["sku_snapshot"] == "SKU-ORDER"
    assert detail["items"][0]["unit_price"] == "1200.00"


def test_checkout_replay_returns_same_order_without_stock_change(client, db):
    shop_user, shop = setup_shop(db, 3)
    _, _, _, product, _ = setup_catalog(db)
    add_item(db, shop, product, 5)
    first = checkout(client, shop_user, "same-key")
    db.expire_all()
    stock_after = db.get(Product, product.id).stock_quantity
    replay = checkout(client, shop_user, "same-key")
    assert first.status_code == 201
    assert replay.status_code == 200
    assert replay.json()["id"] == first.json()["id"]
    db.expire_all()
    assert db.get(Product, product.id).stock_quantity == stock_after
    assert len(db.scalars(select(SupplierFulfillment).where(SupplierFulfillment.order_id == uuid.UUID(first.json()["id"]))).all()) == 1


def test_checkout_errors_preserve_cart_and_stock(client, db):
    shop_user, shop = setup_shop(db, 4)
    _, _, _, product, zone = setup_catalog(db)
    add_item(db, shop, product, 5)
    zone.is_active = False
    db.commit()
    response = checkout(client, shop_user, "no-zone")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "DELIVERY_ZONE_NOT_SUPPORTED"
    db.expire_all()
    assert db.get(Product, product.id).stock_quantity == 10
    assert db.scalar(select(Order).where(Order.shop_id == shop.id)) is None
    assert db.scalar(select(CartItem)) is not None


def test_empty_cart_and_inactive_product_rejected(client, db):
    shop_user, shop = setup_shop(db, 5)
    _, _, _, product, _ = setup_catalog(db)
    db.commit()
    empty_response = checkout(client, shop_user, "empty")
    assert empty_response.json()["error"]["code"] == "EMPTY_CART"
    add_item(db, shop, product, 5)
    product.is_active = False
    db.commit()
    response = checkout(client, shop_user, "inactive")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "PRODUCT_UNAVAILABLE"


def test_supplier_inactive_and_moq_change_rejected(client, db):
    shop_user, shop = setup_shop(db, 14)
    _, supplier, _, product, _ = setup_catalog(db)
    add_item(db, shop, product, 5)
    supplier.is_active = False
    db.commit()
    supplier_response = checkout(client, shop_user, "inactive-supplier")
    assert supplier_response.status_code == 409
    assert supplier_response.json()["error"]["code"] == "SUPPLIER_INACTIVE"
    supplier.is_active = True
    product.minimum_order_quantity = 10
    db.commit()
    moq_response = checkout(client, shop_user, "changed-moq")
    assert moq_response.status_code == 409
    assert moq_response.json()["error"]["code"] == "MOQ_NOT_MET"


def test_cart_item_and_order_ownership(client, db):
    user_a, shop_a = setup_shop(db, 6)
    user_b, shop_b = setup_shop(db, 7)
    _, _, _, product, _ = setup_catalog(db)
    cart = add_item(db, shop_a, product, 5)
    item = db.scalar(select(CartItem).where(CartItem.cart_id == cart.id))
    assert client.patch(f"/api/v1/cart/items/{item.id}", headers=auth(user_b), json={"quantity": 5}).status_code == 404
    response = checkout(client, user_a, "owned")
    assert response.status_code == 201
    assert client.get(f"/api/v1/orders/{response.json()['id']}", headers=auth(user_b)).status_code == 404


def test_admin_state_machine_and_shop_supplier_cannot_change_status(client, db):
    shop_user, shop = setup_shop(db, 8)
    supplier_user, _, _, product, _ = setup_catalog(db)
    admin, _ = setup_shop(db, 9, UserRole.ADMIN)
    add_item(db, shop, product, 5)
    order = checkout(client, shop_user, "status").json()
    assert client.patch(f"/api/v1/admin/orders/{order['id']}/status", headers=auth(shop_user), json={"status": "CONFIRMED"}).status_code == 403
    assert client.patch(f"/api/v1/admin/orders/{order['id']}/status", headers=auth(supplier_user), json={"status": "CONFIRMED"}).status_code == 403
    assert client.patch(f"/api/v1/admin/orders/{order['id']}/status", headers=auth(admin), json={"status": "DELIVERED"}).json()["error"]["code"] == "INVALID_ORDER_STATUS_TRANSITION"
    assert client.patch(f"/api/v1/admin/orders/{order['id']}/status", headers=auth(admin), json={"status": "CONFIRMED"}).status_code == 200
    assert client.patch(f"/api/v1/admin/orders/{order['id']}/status", headers=auth(admin), json={"status": "COLLECTING"}).status_code == 200


def test_supplier_orders_only_own_items(client, db):
    shop_user, shop = setup_shop(db, 10)
    supplier_user, supplier, category, product, _ = setup_catalog(db)
    supplier_two_user = make_user(db, UserRole.SUPPLIER, "+996700300009")
    supplier_two = Supplier(owner_user_id=supplier_two_user.id, name="Supplier Two", phone=supplier_two_user.phone, market=Market.KARA_SUU, is_active=True)
    db.add(supplier_two)
    db.flush()
    product_two = Product(supplier_id=supplier_two.id, category_id=category.id, name="Other", slug=str(uuid.uuid4()), sku="SKU-TWO", price=Decimal("500.00"), minimum_order_quantity=1, stock_quantity=5, unit="шт", is_active=True)
    db.add(product_two)
    db.commit()
    cart = add_item(db, shop, product, 5)
    db.add(CartItem(cart_id=cart.id, product_id=product_two.id, quantity=1))
    db.commit()
    order = checkout(client, shop_user, "multi").json()
    assert len(db.scalars(select(SupplierFulfillment).where(SupplierFulfillment.order_id == uuid.UUID(order["id"]))).all()) == 2
    response = client.get("/api/v1/supplier/orders", headers=auth(supplier_user))
    assert response.status_code == 200
    assert len(response.json()[0]["items"]) == 1
    assert response.json()[0]["items"][0]["supplier_id"] == str(supplier.id)
    supplier_order = response.json()[0]
    assert supplier_order["items"][0]["product_name_snapshot"] == "Original name"
    assert all(item["supplier_id"] == str(supplier.id) for item in supplier_order["items"])
    for private_field in ("address", "phone", "comment", "subtotal", "delivery_price", "total"):
        assert private_field not in supplier_order


def test_admin_filters_orders(client, db):
    shop_user, shop = setup_shop(db, 11)
    admin, _ = setup_shop(db, 12, UserRole.ADMIN)
    _, _, _, product, _ = setup_catalog(db)
    add_item(db, shop, product, 5)
    order = checkout(client, shop_user, "filter", payment_type="BANK_TRANSFER").json()
    response = client.get("/api/v1/admin/orders", headers=auth(admin), params={"payment_type": "BANK_TRANSFER", "shop_id": str(shop.id)})
    assert response.status_code == 200
    assert response.json()["total_items"] == 1
    assert response.json()["items"][0]["id"] == order["id"]


def test_checkout_exception_after_order_creation_rolls_back(monkeypatch, db):
    shop_user, shop = setup_shop(db, 13)
    _, _, _, product, _ = setup_catalog(db)
    add_item(db, shop, product, 5)
    original_response = orders_module.order_response

    def fail_after_writes(*args, **kwargs):
        raise RuntimeError("intentional post-write failure")

    monkeypatch.setattr(orders_module, "order_response", fail_after_writes)
    with pytest.raises(RuntimeError):
        orders_module.checkout(db, shop, CheckoutRequest(city="Каракол", address="A", phone=shop_user.phone, payment_type=PaymentType.CASH), "rollback")
    db.expire_all()
    assert db.scalar(select(Order).where(Order.shop_id == shop.id)) is None
    assert db.scalar(select(OrderItem)) is None
    assert db.scalar(select(SupplierFulfillment)) is None
    assert db.get(Product, product.id).stock_quantity == 10
    assert db.scalar(select(CartItem)) is not None
    monkeypatch.setattr(orders_module, "order_response", original_response)
