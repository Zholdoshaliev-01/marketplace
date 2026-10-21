import os
import uuid
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core.enums import Market, UserRole
from app.catalog.models import Category, Product, ProductImage
from app.suppliers.models import Supplier
from app.users.models import User
from app.core.security import create_access_token, hash_password

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def require_postgres():
    if not os.getenv("TEST_DATABASE_URL", "").startswith("postgresql"):
        pytest.skip("Catalog integration tests require TEST_DATABASE_URL")


def make_user(db, role, phone):
    user = User(phone=phone, password_hash=hash_password("strong-password"), role=role, is_active=True)
    db.add(user)
    db.flush()
    return user


def make_category(db, name="Одежда", slug=None, parent_id=None):
    category = Category(name=name, slug=slug or f"category-{uuid.uuid4()}", parent_id=parent_id)
    db.add(category)
    db.flush()
    return category


def make_supplier(db, name, owner=None, market=Market.DORDOI, active=True):
    supplier = Supplier(owner_user_id=owner.id if owner else None, name=name, phone="+996555000000", market=market, pavilion="A-1", description="Описание", is_active=active)
    db.add(supplier)
    db.flush()
    return supplier


def make_product(db, supplier, category, sku="SKU-1", name="Базовый товар", price=Decimal("1200.00"), stock=10, active=True):
    product = Product(supplier_id=supplier.id, category_id=category.id, name=name, slug=f"{sku.lower()}-{uuid.uuid4()}", sku=sku, price=price, minimum_order_quantity=2, stock_quantity=stock, unit="шт", is_active=active)
    db.add(product)
    db.flush()
    return product


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(str(user.id), user.role.value)}"}


def catalog_setup(db):
    admin = make_user(db, UserRole.ADMIN, "+996700100001")
    supplier_user_a = make_user(db, UserRole.SUPPLIER, "+996700100002")
    supplier_user_b = make_user(db, UserRole.SUPPLIER, "+996700100003")
    root = make_category(db, "Одежда", "odezhda")
    women = make_category(db, "Женская одежда", "zhenskaya-odezhda", root.id)
    men = make_category(db, "Мужская одежда", "muzhskaya-odezhda", root.id)
    supplier_a = make_supplier(db, "Dordoi Fashion", supplier_user_a, Market.DORDOI)
    supplier_b = make_supplier(db, "Kara-Suu Trade", supplier_user_b, Market.KARA_SUU)
    product_a = make_product(db, supplier_a, women, "A-001", "Платье базовое", Decimal("1200.00"), 10)
    product_b = make_product(db, supplier_b, men, "B-001", "Куртка мужская", Decimal("2400.00"), 0)
    db.commit()
    return admin, supplier_user_a, supplier_user_b, root, women, men, supplier_a, supplier_b, product_a, product_b


def test_public_category_tree(client, db):
    _, _, _, root, women, _, _, _, _, _ = catalog_setup(db)
    response = client.get("/api/v1/categories")
    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == str(root.id)
    assert response.json()["items"][0]["children"][0]["id"] == str(women.id)


def test_admin_category_create_and_non_admin_forbidden(client, db):
    admin, _, _, _, _, _, _, _, _, _ = catalog_setup(db)
    created = client.post("/api/v1/admin/categories", headers=auth(admin), json={"name": "Обувь", "slug": "obuv"})
    assert created.status_code == 201
    shop = make_user(db, UserRole.SHOP, "+996700100004")
    db.commit()
    forbidden = client.post("/api/v1/admin/categories", headers=auth(shop), json={"name": "Аксессуары", "slug": "aksessuary"})
    assert forbidden.status_code == 403


def test_category_duplicate_slug_self_parent_and_cycle_rejected(client, db):
    admin, _, _, root, women, men, *_ = catalog_setup(db)
    duplicate = client.post("/api/v1/admin/categories", headers=auth(admin), json={"name": "Еще", "slug": "odezhda"})
    assert duplicate.status_code == 409
    self_parent = client.patch(f"/api/v1/admin/categories/{women.id}", headers=auth(admin), json={"parent_id": str(women.id)})
    assert self_parent.status_code == 409
    cycle = client.patch(f"/api/v1/admin/categories/{root.id}", headers=auth(admin), json={"parent_id": str(men.id)})
    assert cycle.status_code == 409


def test_category_delete_conflicts(client, db):
    admin, _, _, root, women, _, supplier_a, _, product_a, _ = catalog_setup(db)
    assert client.delete(f"/api/v1/admin/categories/{root.id}", headers=auth(admin)).status_code == 409
    assert client.delete(f"/api/v1/admin/categories/{women.id}", headers=auth(admin)).status_code == 409
    product_a.category_id = root.id
    db.commit()
    assert client.delete(f"/api/v1/admin/categories/{women.id}", headers=auth(admin)).status_code == 204


def test_public_suppliers_only_active_filter_detail_and_deactivate(client, db):
    admin, _, _, _, _, _, supplier_a, supplier_b, _, _ = catalog_setup(db)
    supplier_b.is_active = False
    db.commit()
    response = client.get("/api/v1/suppliers", params={"market": "DORDOI"})
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [str(supplier_a.id)]
    assert client.get(f"/api/v1/suppliers/{supplier_b.id}").status_code == 404
    updated = client.patch(f"/api/v1/admin/suppliers/{supplier_a.id}", headers=auth(admin), json={"description": "Updated"})
    assert updated.status_code == 200
    assert updated.json()["phone"] == supplier_a.phone
    assert updated.json()["owner_user_id"] == str(supplier_a.owner_user_id)
    assert updated.json()["is_active"] is True
    assert client.delete(f"/api/v1/admin/suppliers/{supplier_a.id}", headers=auth(admin)).status_code == 204
    db.expire_all()
    assert db.get(Supplier, supplier_a.id).is_active is False


def test_public_products_search_filters_sort_pagination_and_invalid_range(client, db):
    _, _, _, root, women, men, supplier_a, supplier_b, product_a, product_b = catalog_setup(db)
    product_b.is_active = False
    make_product(db, supplier_a, women, "A-002", "Блузка женская", Decimal("800.00"), 4)
    make_product(db, supplier_a, men, "A-003", "Пальто женское", Decimal("3200.00"), 5)
    db.commit()
    assert client.get("/api/v1/products", params={"search": "  БЛУЗКА  "}).json()["pagination"]["total_items"] == 1
    assert client.get("/api/v1/products", params={"search": "B-001"}).json()["pagination"]["total_items"] == 0
    assert client.get("/api/v1/products", params={"category_id": str(women.id)}).json()["pagination"]["total_items"] == 2
    assert client.get("/api/v1/products", params={"supplier_id": str(supplier_a.id)}).json()["pagination"]["total_items"] == 3
    assert client.get("/api/v1/products", params={"market": "DORDOI", "min_price": "1000", "max_price": "2000"}).json()["pagination"]["total_items"] == 1
    assert client.get("/api/v1/products", params={"in_stock": "true"}).json()["pagination"]["total_items"] == 3
    sorted_response = client.get("/api/v1/products", params={"sort": "price_asc", "page_size": 2})
    assert sorted_response.status_code == 200
    assert sorted_response.json()["items"][0]["price"] == "800.00"
    assert client.get("/api/v1/products", params={"page_size": 1}).json()["pagination"]["total_pages"] == 3
    assert client.get("/api/v1/products", params={"min_price": "3000", "max_price": "1000"}).status_code == 422
    assert client.get(f"/api/v1/products/{product_b.id}").status_code == 404


def test_inactive_supplier_hides_products_and_product_detail(client, db):
    _, _, _, _, _, _, _, supplier_b, _, product_b = catalog_setup(db)
    supplier_b.is_active = False
    db.commit()
    assert client.get("/api/v1/products", params={"supplier_id": str(supplier_b.id)}).json()["pagination"]["total_items"] == 0
    assert client.get(f"/api/v1/products/{product_b.id}").status_code == 404


def test_admin_product_crud_and_duplicate_sku(client, db):
    admin, _, _, _, women, _, supplier_a, _, _, _ = catalog_setup(db)
    payload = {"supplier_id": str(supplier_a.id), "category_id": str(women.id), "name": "Новый товар", "slug": "new-product", "sku": "NEW-1", "price": "999.00", "minimum_order_quantity": 3, "stock_quantity": 20, "unit": "шт"}
    created = client.post("/api/v1/admin/products", headers=auth(admin), json=payload)
    assert created.status_code == 201
    duplicate = client.post("/api/v1/admin/products", headers=auth(admin), json={**payload, "slug": "new-product-2"})
    assert duplicate.status_code == 409
    product_id = created.json()["id"]
    updated = client.patch(f"/api/v1/admin/products/{product_id}", headers=auth(admin), json={"price": "1100.00", "stock_quantity": 42})
    assert updated.status_code == 200
    assert updated.json()["price"] == "1100.00"
    assert client.delete(f"/api/v1/admin/products/{product_id}", headers=auth(admin)).status_code == 204
    assert client.get(f"/api/v1/products/{product_id}").status_code == 404


def test_supplier_product_ownership_and_create_cannot_override_supplier(client, db):
    _, supplier_user_a, supplier_user_b, _, women, _, supplier_a, supplier_b, product_a, _ = catalog_setup(db)
    own = client.get("/api/v1/supplier/products", headers=auth(supplier_user_a))
    assert own.status_code == 200 and all(item["supplier"]["id"] == str(supplier_a.id) for item in own.json())
    payload = {"supplier_id": str(supplier_b.id), "category_id": str(women.id), "name": "Чужой поставщик", "slug": "wrong-owner", "sku": "WRONG-1", "price": "100.00", "minimum_order_quantity": 1, "stock_quantity": 1, "unit": "шт"}
    assert client.post("/api/v1/supplier/products", headers=auth(supplier_user_a), json=payload).status_code == 422
    assert client.patch(f"/api/v1/supplier/products/{product_a.id}", headers=auth(supplier_user_b), json={"price": "1.00"}).status_code == 404
    assert client.delete(f"/api/v1/supplier/products/{product_a.id}", headers=auth(supplier_user_b)).status_code == 404
    created = client.post("/api/v1/supplier/products", headers=auth(supplier_user_a), json={**{key: value for key, value in payload.items() if key != "supplier_id"}, "sku": "OWN-1", "slug": "own-product"})
    assert created.status_code == 201
    assert created.json()["supplier"]["id"] == str(supplier_a.id)


def test_inactive_supplier_cannot_use_supplier_operations(client, db):
    _, supplier_user_a, _, _, _, _, supplier_a, _, product_a, _ = catalog_setup(db)
    supplier_a.is_active = False
    db.commit()
    headers = auth(supplier_user_a)
    assert client.get("/api/v1/supplier/products", headers=headers).status_code == 403
    assert client.patch(f"/api/v1/supplier/products/{product_a.id}", headers=headers, json={"stock_quantity": 1}).status_code == 403
    assert client.get("/api/v1/supplier/orders", headers=headers).status_code == 403


def test_images_order_delete_and_limit(client, db):
    _, supplier_user_a, supplier_user_b, _, _, _, supplier_a, _, product_a, _ = catalog_setup(db)
    headers = auth(supplier_user_a)
    assert client.post(f"/api/v1/supplier/products/{product_a.id}/images", headers=auth(supplier_user_b), json={"image_url": "https://placehold.co/foreign"}).status_code == 404
    first = client.post(f"/api/v1/supplier/products/{product_a.id}/images", headers=headers, json={"image_url": "https://placehold.co/1", "sort_order": 2})
    assert first.status_code == 201
    second = client.post(f"/api/v1/supplier/products/{product_a.id}/images", headers=headers, json={"image_url": "https://placehold.co/2", "sort_order": 1})
    assert second.status_code == 201
    detail = client.get(f"/api/v1/products/{product_a.id}").json()
    assert detail["images"][0]["sort_order"] == 1
    assert client.patch(f"/api/v1/supplier/products/{product_a.id}/images/{first.json()['id']}", headers=headers, json={"sort_order": 0}).status_code == 200
    assert client.delete(f"/api/v1/supplier/products/{product_a.id}/images/{second.json()['id']}", headers=headers).status_code == 204
    for index in range(9):
        assert client.post(f"/api/v1/supplier/products/{product_a.id}/images", headers=headers, json={"image_url": f"https://placehold.co/{index + 10}", "sort_order": index + 10}).status_code == 201
    assert client.post(f"/api/v1/supplier/products/{product_a.id}/images", headers=headers, json={"image_url": "https://placehold.co/overflow"}).status_code == 409
