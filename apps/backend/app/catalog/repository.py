from sqlalchemy import or_, select

from app.catalog.models import Category, Product, ProductImage
from app.catalog.schemas import ProductQuery
from app.suppliers.models import Supplier


def product_query_base():
    primary_image = (
        select(ProductImage.image_url)
        .where(ProductImage.product_id == Product.id)
        .order_by(ProductImage.sort_order, ProductImage.id)
        .limit(1)
        .scalar_subquery()
    )
    return select(Product, Supplier, Category, primary_image).join(Supplier, Supplier.id == Product.supplier_id).join(Category, Category.id == Product.category_id)


def apply_product_filters(query, params: ProductQuery, public_only: bool = True):
    conditions = []
    if public_only:
        conditions.extend([Product.is_active.is_(True), Supplier.is_active.is_(True)])
    if params.search:
        pattern = f"%{params.search}%"
        conditions.append(or_(Product.name.ilike(pattern), Product.sku.ilike(pattern)))
    if params.category_id:
        conditions.append(Product.category_id == params.category_id)
    if params.supplier_id:
        conditions.append(Product.supplier_id == params.supplier_id)
    if params.market:
        conditions.append(Supplier.market == params.market)
    if params.min_price is not None:
        conditions.append(Product.price >= params.min_price)
    if params.max_price is not None:
        conditions.append(Product.price <= params.max_price)
    if params.in_stock:
        conditions.append(Product.stock_quantity > 0)
    return query.where(*conditions)
