import os
import uuid
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.cart.models import Cart, CartItem
from app.catalog.models import Category, Product
from app.core.enums import Market, UserRole
from app.core.security import create_access_token, hash_password
from app.delivery.models import DeliveryZone
from app.orders.models import Order
from app.shops.models import Shop
from app.supplier_fulfillments.models import SupplierFulfillment
from app.supplier_fulfillments.state_machine import FulfillmentStatus
from app.suppliers.models import Supplier
from app.users.models import User

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def require_postgres():
    if not os.getenv("TEST_DATABASE_URL", "").startswith("postgresql"):
        pytest.skip("Fulfillment integration tests require PostgreSQL")


def user(db, role, phone):
    row = User(phone=phone, password_hash=hash_password("strong-password"), role=role, is_active=True)
    db.add(row)
    db.flush()
    return row


def auth(row):
    return {"Authorization": f"Bearer {create_access_token(str(row.id), row.role.value)}"}


def setup_multi_supplier_order(client, db, key="fulfillment-order"):
    shop_user = user(db, UserRole.SHOP, "+996701000001")
    shop = Shop(owner_user_id=shop_user.id, name="Buyer", phone=shop_user.phone, city="Каракол", address="Private address")
    supplier_user_a = user(db, UserRole.SUPPLIER, "+996701000002")
    supplier_user_b = user(db, UserRole.SUPPLIER, "+996701000003")
    supplier_a = Supplier(owner_user_id=supplier_user_a.id, name="Supplier A", phone=supplier_user_a.phone, market=Market.DORDOI, is_active=True)
    supplier_b = Supplier(owner_user_id=supplier_user_b.id, name="Supplier B", phone=supplier_user_b.phone, market=Market.KARA_SUU, is_active=True)
    category = Category(name="Fulfillment", slug=f"fulfillment-{uuid.uuid4()}")
    zone = DeliveryZone(city="Каракол", price=Decimal("100.00"), is_active=True)
    db.add_all([shop, supplier_a, supplier_b, category, zone])
    db.flush()
    product_a1 = Product(supplier_id=supplier_a.id, category_id=category.id, name="A one", slug=str(uuid.uuid4()), sku="A-1", price=Decimal("100.00"), minimum_order_quantity=1, stock_quantity=20, unit="шт", is_active=True)
    product_a2 = Product(supplier_id=supplier_a.id, category_id=category.id, name="A two", slug=str(uuid.uuid4()), sku="A-2", price=Decimal("200.00"), minimum_order_quantity=1, stock_quantity=20, unit="шт", is_active=True)
    product_b = Product(supplier_id=supplier_b.id, category_id=category.id, name="B one", slug=str(uuid.uuid4()), sku="B-1", price=Decimal("300.00"), minimum_order_quantity=1, stock_quantity=20, unit="шт", is_active=True)
    db.add_all([product_a1, product_a2, product_b])
    db.flush()
    cart = Cart(shop_id=shop.id)
    db.add(cart)
    db.flush()
    db.add_all([CartItem(cart_id=cart.id, product_id=product_a1.id, quantity=2), CartItem(cart_id=cart.id, product_id=product_a2.id, quantity=1), CartItem(cart_id=cart.id, product_id=product_b.id, quantity=1)])
    db.commit()
    response = client.post("/api/v1/orders", headers={**auth(shop_user), "Idempotency-Key": key}, json={"city": "Каракол", "address": "Secret street", "phone": "+996555000000", "comment": "Secret comment", "payment_type": "CASH"})
    assert response.status_code == 201
    return response.json(), shop_user, supplier_user_a, supplier_user_b, supplier_a, supplier_b


def test_checkout_creates_one_fulfillment_per_unique_supplier_and_same_supplier_items_share_it(client, db):
    order, _, _, _, supplier_a, supplier_b = setup_multi_supplier_order(client, db)
    rows = db.scalars(select(SupplierFulfillment).where(SupplierFulfillment.order_id == uuid.UUID(order["id"]))).all()
    assert len(rows) == 2
    assert {row.supplier_id for row in rows} == {supplier_a.id, supplier_b.id}
    assert all(row.status == FulfillmentStatus.PENDING for row in rows)


def test_idempotent_replay_does_not_duplicate_fulfillments(client, db):
    order, shop_user, _, _, _, _ = setup_multi_supplier_order(client, db, "same-fulfillment")
    replay = client.post("/api/v1/orders", headers={**auth(shop_user), "Idempotency-Key": "same-fulfillment"}, json={"city": "Каракол", "address": "ignored", "phone": "+123", "payment_type": "CASH"})
    assert replay.status_code == 200
    assert replay.json()["id"] == order["id"]
    assert db.scalar(select(func.count(SupplierFulfillment.id))) == 2


def test_supplier_list_and_detail_are_ownership_scoped_and_private(client, db):
    _, _, supplier_user_a, supplier_user_b, supplier_a, _ = setup_multi_supplier_order(client, db)
    listed = client.get("/api/v1/supplier/fulfillments", headers=auth(supplier_user_a))
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    payload = listed.json()[0]
    assert len(payload["items"]) == 2
    assert {item["sku_snapshot"] for item in payload["items"]} == {"A-1", "A-2"}
    assert payload["supplier_subtotal"] == "400.00"
    for private_field in ("address", "phone", "comment", "subtotal", "delivery_price", "total"):
        assert private_field not in payload
    detail = client.get(f"/api/v1/supplier/fulfillments/{payload['fulfillment_id']}", headers=auth(supplier_user_a))
    assert detail.status_code == 200
    assert all("supplier_id" not in item for item in detail.json()["items"])
    assert client.get(f"/api/v1/supplier/fulfillments/{payload['fulfillment_id']}", headers=auth(supplier_user_b)).status_code == 404
    assert client.patch(f"/api/v1/supplier/fulfillments/{payload['fulfillment_id']}/status", headers=auth(supplier_user_b), json={"status": "ACCEPTED"}).status_code == 404
    assert db.scalar(select(func.count(SupplierFulfillment.id)).where(SupplierFulfillment.supplier_id == supplier_a.id)) == 1


def test_supplier_accept_collect_ready_does_not_change_global_order(client, db):
    order, _, supplier_user_a, _, _, _ = setup_multi_supplier_order(client, db)
    fulfillment = client.get("/api/v1/supplier/fulfillments", headers=auth(supplier_user_a)).json()[0]
    path = f"/api/v1/supplier/fulfillments/{fulfillment['fulfillment_id']}/status"
    for target in ("ACCEPTED", "COLLECTING", "READY"):
        response = client.patch(path, headers=auth(supplier_user_a), json={"status": target})
        assert response.status_code == 200
        assert response.json()["status"] == target
    assert db.get(Order, uuid.UUID(order["id"])).status.value == "NEW"
    terminal = client.patch(path, headers=auth(supplier_user_a), json={"status": "CANCELLED"})
    assert terminal.status_code == 409
    assert terminal.json()["error"]["code"] == "INVALID_FULFILLMENT_STATUS_TRANSITION"


@pytest.mark.parametrize("accepted_first", [False, True])
def test_supplier_can_cancel_pending_or_accepted_without_stock_restore_or_global_cancel(client, db, accepted_first):
    order, _, supplier_user_a, _, _, _ = setup_multi_supplier_order(client, db)
    stock_after_checkout = {
        product.sku: product.stock_quantity
        for product in db.scalars(select(Product).where(Product.sku.in_(["A-1", "A-2", "B-1"]))).all()
    }
    fulfillment = client.get("/api/v1/supplier/fulfillments", headers=auth(supplier_user_a)).json()[0]
    path = f"/api/v1/supplier/fulfillments/{fulfillment['fulfillment_id']}/status"
    if accepted_first:
        assert client.patch(path, headers=auth(supplier_user_a), json={"status": "ACCEPTED"}).status_code == 200
    response = client.patch(path, headers=auth(supplier_user_a), json={"status": "CANCELLED"})
    assert response.status_code == 200
    assert response.json()["status"] == "CANCELLED"
    assert db.get(Order, uuid.UUID(order["id"])).status.value == "NEW"
    db.expire_all()
    assert {
        product.sku: product.stock_quantity
        for product in db.scalars(select(Product).where(Product.sku.in_(["A-1", "A-2", "B-1"]))).all()
    } == stock_after_checkout
    assert client.patch(path, headers=auth(supplier_user_a), json={"status": "ACCEPTED"}).status_code == 409


def test_invalid_transition_and_inactive_supplier_are_rejected(client, db):
    _, _, supplier_user_a, _, supplier_a, _ = setup_multi_supplier_order(client, db)
    fulfillment = client.get("/api/v1/supplier/fulfillments", headers=auth(supplier_user_a)).json()[0]
    invalid = client.patch(f"/api/v1/supplier/fulfillments/{fulfillment['fulfillment_id']}/status", headers=auth(supplier_user_a), json={"status": "READY"})
    assert invalid.status_code == 409
    assert invalid.json()["error"]["code"] == "INVALID_FULFILLMENT_STATUS_TRANSITION"
    supplier_a.is_active = False
    db.commit()
    assert client.get("/api/v1/supplier/fulfillments", headers=auth(supplier_user_a)).status_code == 403


def test_admin_order_detail_sees_every_fulfillment(client, db):
    order, _, supplier_user_a, _, _, _ = setup_multi_supplier_order(client, db)
    first = client.get("/api/v1/supplier/fulfillments", headers=auth(supplier_user_a)).json()[0]
    client.patch(f"/api/v1/supplier/fulfillments/{first['fulfillment_id']}/status", headers=auth(supplier_user_a), json={"status": "CANCELLED"})
    admin = user(db, UserRole.ADMIN, "+996701000004")
    db.commit()
    response = client.get(f"/api/v1/admin/orders/{order['id']}", headers=auth(admin))
    assert response.status_code == 200
    assert len(response.json()["fulfillments"]) == 2
    assert {item["supplier_name"] for item in response.json()["fulfillments"]} == {"Supplier A", "Supplier B"}
    assert {item["status"] for item in response.json()["fulfillments"]} == {"CANCELLED", "PENDING"}
