"""Alembic metadata entry point; imports every domain model exactly once."""

from app.auth.models import RefreshToken
from app.cart.models import Cart, CartItem
from app.catalog.models import Category, Product, ProductImage
from app.db.base import Base
from app.delivery.models import DeliveryZone
from app.orders.models import Order, OrderItem
from app.shops.models import Shop
from app.supplier_fulfillments.models import SupplierFulfillment
from app.suppliers.models import Supplier
from app.users.models import User

__all__ = ["Base"]
