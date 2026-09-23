import os
import subprocess
import uuid
from pathlib import Path

import pytest
from sqlalchemy import text

from app.db.metadata import Base

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def require_postgres():
    if not os.getenv("TEST_DATABASE_URL", "").startswith("postgresql"):
        pytest.skip("Migration test requires PostgreSQL")


def test_0001_to_0002_backfills_unique_order_supplier_pairs_once(db):
    engine = db.get_bind()
    db.close()
    Base.metadata.drop_all(engine)
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
    backend_dir = Path(__file__).parents[1]

    def upgrade(revision: str) -> None:
        subprocess.run(["alembic", "-c", str(backend_dir / "alembic.ini"), "upgrade", revision], cwd=backend_dir, check=True)

    upgrade("0001_initial")

    user_id, shop_id = uuid.uuid4(), uuid.uuid4()
    supplier_a, supplier_b, category_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    product_a, product_b, order_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    item_a, item_b = uuid.uuid4(), uuid.uuid4()
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO users (id, phone, password_hash, role, is_active) VALUES (:id, '+996700000001', 'hash', 'SHOP', true)"), {"id": user_id})
        connection.execute(text("INSERT INTO shops (id, owner_user_id, name, phone, city, address) VALUES (:id, :owner, 'Shop', '+996700000001', 'City', 'Address')"), {"id": shop_id, "owner": user_id})
        connection.execute(text("INSERT INTO suppliers (id, name, phone, market, is_active) VALUES (:a, 'A', '+996700000002', 'DORDOI', true), (:b, 'B', '+996700000003', 'KARA_SUU', true)"), {"a": supplier_a, "b": supplier_b})
        connection.execute(text("INSERT INTO categories (id, name, slug) VALUES (:id, 'Category', 'category')"), {"id": category_id})
        connection.execute(text("INSERT INTO products (id, supplier_id, category_id, name, slug, sku, price, minimum_order_quantity, stock_quantity, unit, is_active) VALUES (:a, :sa, :c, 'A', 'a', 'A', 100, 1, 10, 'шт', true), (:b, :sb, :c, 'B', 'b', 'B', 200, 1, 10, 'шт', true)"), {"a": product_a, "b": product_b, "sa": supplier_a, "sb": supplier_b, "c": category_id})
        connection.execute(text("INSERT INTO orders (id, order_number, idempotency_key, shop_id, status, subtotal, delivery_price, total, payment_type, city, address, phone) VALUES (:id, 'ORD-MIGRATION', 'migration', :shop, 'NEW', 300, 0, 300, 'CASH', 'City', 'Address', '+996700000001')"), {"id": order_id, "shop": shop_id})
        connection.execute(text("INSERT INTO order_items (id, order_id, product_id, supplier_id, product_name_snapshot, sku_snapshot, quantity, unit_price, total_price) VALUES (:ia, :o, :pa, :sa, 'A', 'A', 1, 100, 100), (:ib, :o, :pb, :sb, 'B', 'B', 1, 200, 200)"), {"ia": item_a, "ib": item_b, "o": order_id, "pa": product_a, "pb": product_b, "sa": supplier_a, "sb": supplier_b})

    upgrade("head")
    with engine.connect() as connection:
        rows = connection.execute(text("SELECT order_id, supplier_id, status FROM supplier_fulfillments ORDER BY supplier_id")).all()
    assert len(rows) == 2
    assert {(row.order_id, row.supplier_id) for row in rows} == {(order_id, supplier_a), (order_id, supplier_b)}
    assert all(row.status == "PENDING" for row in rows)

    upgrade("head")
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM supplier_fulfillments")) == 2
