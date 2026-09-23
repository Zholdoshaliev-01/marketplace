import uuid

from sqlalchemy.orm import Session

from app.catalog.models import Category, Product, ProductImage
from app.catalog.schemas import ProductImageCreate, ProductManagement
from app.core.exceptions import BusinessError
from app.suppliers.models import Supplier


def ensure_category(db: Session, category_id: uuid.UUID) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise BusinessError("CATEGORY_NOT_FOUND", "Категория не найдена", 404)
    return category


def ensure_supplier(db: Session, supplier_id: uuid.UUID, require_active: bool = True) -> Supplier:
    supplier = db.get(Supplier, supplier_id)
    if supplier is None or (require_active and not supplier.is_active):
        raise BusinessError("SUPPLIER_NOT_FOUND", "Поставщик не найден или деактивирован", 404)
    return supplier


def create_product(db: Session, values: dict, images: list[ProductImageCreate]) -> Product:
    product = Product(**values)
    db.add(product)
    db.flush()
    for image in images:
        db.add(ProductImage(product_id=product.id, **image.model_dump()))
    db.commit()
    db.refresh(product)
    return product
