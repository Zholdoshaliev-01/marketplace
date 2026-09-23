import os
from decimal import Decimal

from sqlalchemy import delete, func, or_, select

from app.catalog.models import Category, Product, ProductImage
from app.core.config import get_settings
from app.core.enums import Market, UserRole
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.delivery.models import DeliveryZone
from app.shops.models import Shop
from app.suppliers.models import Supplier
from app.users.models import User
from app.auth.models import RefreshToken
from app.cart.models import Cart, CartItem
from app.orders.models import Order, OrderItem
from app.core.enums import OrderStatus, PaymentType
from app.supplier_fulfillments.models import SupplierFulfillment
from app.supplier_fulfillments.state_machine import FulfillmentStatus


DEMO_PASSWORD = os.getenv("SEED_DEMO_PASSWORD", "MarketKG2026!")
DEMO_USERS = {
    "shop": ("shop.demo@market.kg", "+996700100001", UserRole.SHOP),
    "supplier_a": ("supplier.demo@market.kg", "+996700100002", UserRole.SUPPLIER),
    "supplier_b": ("supplier-b.demo@market.kg", "+996700100004", UserRole.SUPPLIER),
    "admin": ("admin.demo@market.kg", "+996700100003", UserRole.ADMIN),
}
CATEGORIES = [
    ("Напитки", "demo-drinks"),
    ("Бакалея", "demo-grocery"),
    ("Бытовые товары", "demo-household"),
]
SUPPLIERS = {
    "supplier_a": ("Демо-поставщик Дордой", Market.DORDOI),
    "supplier_b": ("Демо-поставщик Кара-Суу", Market.KARA_SUU),
}
PRODUCTS = [
    ("supplier_a", "demo-drinks", "Минеральная вода 1 л", "DEMO-001", "45.00", 6, 120, "бут."),
    ("supplier_a", "demo-drinks", "Чай чёрный 100 пакетиков", "DEMO-002", "280.00", 2, 48, "уп."),
    ("supplier_a", "demo-grocery", "Сахар 5 кг", "DEMO-003", "420.00", 2, 36, "меш."),
    ("supplier_a", "demo-grocery", "Рис круглозёрный 5 кг", "DEMO-004", "560.00", 2, 30, "меш."),
    ("supplier_b", "demo-household", "Средство для мытья посуды 1 л", "DEMO-005", "190.00", 3, 60, "шт."),
    ("supplier_b", "demo-household", "Бумажные полотенца 6 рулонов", "DEMO-006", "350.00", 2, 42, "уп."),
]


def remove_pilot_data(db) -> None:
    """Remove only the old PILOT seed graph, preserving real/non-pilot data."""
    pilot_user_ids = set(db.scalars(select(User.id).where(or_(User.email.like("pilot-%"), User.email.like("%.demo@market.kg")))).all())
    pilot_supplier_ids = set(db.scalars(select(Supplier.id).where(Supplier.owner_user_id.in_(pilot_user_ids))).all()) if pilot_user_ids else set()
    pilot_shop_ids = set(db.scalars(select(Shop.id).where(Shop.owner_user_id.in_(pilot_user_ids))).all()) if pilot_user_ids else set()
    pilot_category_ids = set(db.scalars(select(Category.id).where(Category.slug.like("pilot-%"))).all())
    pilot_product_ids = set(db.scalars(select(Product.id).where(or_(Product.sku.like("PILOT-%"), Product.supplier_id.in_(pilot_supplier_ids)))).all())

    pilot_order_ids = set(db.scalars(select(Order.id).where(Order.shop_id.in_(pilot_shop_ids))).all()) if pilot_shop_ids else set()
    if pilot_product_ids or pilot_supplier_ids:
        order_item_query = select(OrderItem.order_id).where(or_(OrderItem.product_id.in_(pilot_product_ids), OrderItem.supplier_id.in_(pilot_supplier_ids)))
        pilot_order_ids.update(db.scalars(order_item_query).all())

    if pilot_order_ids:
        db.execute(delete(SupplierFulfillment).where(SupplierFulfillment.order_id.in_(pilot_order_ids)))
        db.execute(delete(OrderItem).where(OrderItem.order_id.in_(pilot_order_ids)))
        db.execute(delete(Order).where(Order.id.in_(pilot_order_ids)))
    if pilot_shop_ids:
        pilot_cart_ids = select(Cart.id).where(Cart.shop_id.in_(pilot_shop_ids))
        db.execute(delete(CartItem).where(CartItem.cart_id.in_(pilot_cart_ids)))
        db.execute(delete(Cart).where(Cart.shop_id.in_(pilot_shop_ids)))
    if pilot_product_ids:
        db.execute(delete(ProductImage).where(ProductImage.product_id.in_(pilot_product_ids)))
        db.execute(delete(Product).where(Product.id.in_(pilot_product_ids)))
    if pilot_supplier_ids:
        db.execute(delete(Supplier).where(Supplier.id.in_(pilot_supplier_ids)))
    if pilot_category_ids:
        db.execute(delete(Category).where(Category.id.in_(pilot_category_ids)))
    if pilot_shop_ids:
        db.execute(delete(Shop).where(Shop.id.in_(pilot_shop_ids)))
    if pilot_user_ids:
        db.execute(delete(RefreshToken).where(RefreshToken.user_id.in_(pilot_user_ids)))
        db.execute(delete(User).where(User.id.in_(pilot_user_ids)))


def ensure_development_environment() -> None:
    environment = get_settings().environment.lower()
    if environment not in {"development", "test"}:
        raise RuntimeError("Demo seed is allowed only when ENVIRONMENT is development or test")


def get_or_create_user(db, key: str) -> User:
    email, phone, role = DEMO_USERS[key]
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, phone=phone, password_hash=hash_password(DEMO_PASSWORD), role=role, is_active=True)
        db.add(user)
        db.flush()
    else:
        user.phone = phone
        user.password_hash = hash_password(DEMO_PASSWORD)
        user.role = role
        user.is_active = True
    return user


def get_or_create_category(db, name: str, slug: str) -> Category:
    category = db.scalar(select(Category).where(Category.slug == slug))
    if category is None:
        category = Category(name=name, slug=slug)
        db.add(category)
        db.flush()
    else:
        category.name = name
    return category


def get_or_create_supplier(db, key: str, owner: User) -> Supplier:
    name, market = SUPPLIERS[key]
    supplier = db.scalar(select(Supplier).where(Supplier.owner_user_id == owner.id))
    if supplier is None:
        supplier = Supplier(owner_user_id=owner.id, name=name, phone=owner.phone, market=market, pavilion="Демо-павильон 12", description="Демонстрационный поставщик Market KG", is_active=True)
        db.add(supplier)
        db.flush()
    else:
        supplier.name = name
        supplier.phone = owner.phone
        supplier.market = market
        supplier.pavilion = "Демо-павильон 12"
        supplier.description = "Демонстрационный поставщик Market KG"
        supplier.is_active = True
    return supplier


def run_seed() -> tuple[int, int, int, int]:
    ensure_development_environment()
    db = SessionLocal()
    try:
        remove_pilot_data(db)
        users = {key: get_or_create_user(db, key) for key in DEMO_USERS}
        shop = db.scalar(select(Shop).where(Shop.owner_user_id == users["shop"].id))
        if shop is None:
            shop = Shop(owner_user_id=users["shop"].id, name="Магазин У дома", phone=users["shop"].phone, city="Бишкек", address="ул. Токтогула, 100")
            db.add(shop)
        else:
            shop.name = "Магазин У дома"
            shop.phone = users["shop"].phone
            shop.city = "Бишкек"
            shop.address = "ул. Токтогула, 100"

        categories = {slug: get_or_create_category(db, name, slug) for name, slug in CATEGORIES}
        suppliers = {key: get_or_create_supplier(db, key, users[key]) for key in SUPPLIERS}
        zone = db.scalar(select(DeliveryZone).where(DeliveryZone.city == "Бишкек"))
        if zone is None:
            db.add(DeliveryZone(city="Бишкек", price=Decimal("200.00"), is_active=True))
        else:
            zone.price = Decimal("200.00")
            zone.is_active = True

        db.flush()
        for supplier_key, category_slug, name, sku, price, moq, stock, unit in PRODUCTS:
            supplier = suppliers[supplier_key]
            product = db.scalar(select(Product).where(Product.supplier_id == supplier.id, Product.sku == sku))
            values = {
                "category_id": categories[category_slug].id,
                "name": name,
                "slug": sku.lower(),
                "description": f"Демонстрационный товар: {name}. Оптовая поставка по Бишкеку.",
                "price": Decimal(price),
                "minimum_order_quantity": moq,
                "stock_quantity": stock,
                "unit": unit,
                "is_active": True,
            }
            if product is None:
                product = Product(supplier_id=supplier.id, sku=sku, **values)
                db.add(product)
                db.flush()
            else:
                for field, value in values.items():
                    setattr(product, field, value)
            image = db.scalar(select(ProductImage).where(ProductImage.product_id == product.id))
            if image is None:
                db.add(ProductImage(product_id=product.id, image_url=f"https://placehold.co/600x600?text={sku}", sort_order=0))

        demo_product = db.scalar(select(Product).where(Product.sku == "DEMO-002", Product.supplier_id == suppliers["supplier_a"].id))
        if demo_product and db.scalar(select(Order.id).where(Order.order_number == "DEMO-ORDER-001")) is None:
            subtotal = Decimal("560.00")
            order = Order(order_number="DEMO-ORDER-001", idempotency_key="demo-order-001", shop_id=shop.id, status=OrderStatus.CONFIRMED, subtotal=subtotal, delivery_price=Decimal("200.00"), total=Decimal("760.00"), payment_type=PaymentType.BANK_TRANSFER, city="Бишкек", address=shop.address, phone=shop.phone, comment="Демонстрационный заказ для проверки админки и поставщика")
            db.add(order)
            db.flush()
            db.add(OrderItem(order_id=order.id, product_id=demo_product.id, supplier_id=demo_product.supplier_id, product_name_snapshot=demo_product.name, sku_snapshot=demo_product.sku, quantity=2, unit_price=demo_product.price, total_price=subtotal))
            db.add(SupplierFulfillment(order_id=order.id, supplier_id=demo_product.supplier_id, status=FulfillmentStatus.PENDING))
        db.commit()
        product_count = db.scalar(select(func.count(Product.id)).where(Product.sku.like("DEMO-%"))) or 0
        return len(users), len(suppliers), len(categories), product_count
    finally:
        db.close()


if __name__ == "__main__":
    user_count, supplier_count, category_count, product_count = run_seed()
    print(f"Demo seed complete: users={user_count}, suppliers={supplier_count}, categories={category_count}, products={product_count}")
