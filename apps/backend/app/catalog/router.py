import math
import uuid
from collections import defaultdict
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, asc, delete, desc, exists, func, or_, select
from sqlalchemy.orm import Session

from app.catalog.schemas import (
    CategoryCreate,
    CategoryListResponse,
    CategoryPublic,
    CategoryUpdate,
    ProductCard,
    ProductCreateAdmin,
    ProductCreateSupplier,
    ProductDetail,
    ProductImageCreate,
    ProductImageResponse,
    ProductImageUpdate,
    ProductListResponse,
    ProductManagement,
    ProductQuery,
    ProductSupplierSummary,
    ProductUpdate,
    SupplierListResponse,
    SupplierPublic,
    PaginationMeta,
    ProductCategorySummary,
)
from app.suppliers.schemas import SupplierCreate, SupplierUpdate
from app.db.session import get_db
from app.auth.dependencies import CurrentUser, get_current_supplier, require_roles
from app.core.enums import Market, UserRole
from app.core.exceptions import BusinessError
from app.catalog.models import Category, Product, ProductImage
from app.catalog.repository import apply_product_filters, product_query_base
from app.catalog import service
from app.suppliers.models import Supplier
from app.users.models import User

router = APIRouter(prefix="/api/v1", tags=["catalog"])
admin_router = APIRouter(prefix="/api/v1/admin", tags=["admin-catalog"], dependencies=[Depends(require_roles(UserRole.ADMIN))])
supplier_router = APIRouter(prefix="/api/v1/supplier", tags=["supplier-catalog"], dependencies=[Depends(require_roles(UserRole.SUPPLIER))])


ProductQueryParams = Annotated[ProductQuery, Query()]


def category_tree(categories: list[Category]) -> list[CategoryPublic]:
    nodes = {item.id: CategoryPublic(id=item.id, name=item.name, slug=item.slug) for item in categories}
    roots: list[CategoryPublic] = []
    for item in categories:
        node = nodes[item.id]
        if item.parent_id and item.parent_id in nodes:
            nodes[item.parent_id].children.append(node)
        else:
            roots.append(node)
    return roots


def supplier_public(supplier: Supplier) -> SupplierPublic:
    return SupplierPublic.model_validate(supplier, from_attributes=True)


def image_response(image: ProductImage) -> ProductImageResponse:
    return ProductImageResponse.model_validate(image, from_attributes=True)


def product_card(product: Product, supplier: Supplier, category: Category, primary_image_url: str | None) -> ProductCard:
    return ProductCard(
        id=product.id,
        name=product.name,
        slug=product.slug,
        sku=product.sku,
        price=product.price,
        minimum_order_quantity=product.minimum_order_quantity,
        stock_quantity=product.stock_quantity,
        unit=product.unit,
        supplier=ProductSupplierSummary.model_validate(supplier, from_attributes=True),
        category=ProductCategorySummary.model_validate(category, from_attributes=True),
        primary_image_url=primary_image_url,
    )


def product_detail(db: Session, product: Product, supplier: Supplier, category: Category, include_inactive: bool = False):
    images = db.scalars(select(ProductImage).where(ProductImage.product_id == product.id).order_by(ProductImage.sort_order, ProductImage.id)).all()
    result = ProductDetail(
        **product_card(product, supplier, category, images[0].image_url if images else None).model_dump(),
        description=product.description,
        images=[image_response(image) for image in images],
        created_at=product.created_at,
        updated_at=product.updated_at,
    )
    if include_inactive:
        return ProductManagement(**result.model_dump(), is_active=product.is_active)
    return result


def product_management_value(product: Product, supplier: Supplier, category: Category, images: list[ProductImage]):
    detail = ProductDetail(
        **product_card(product, supplier, category, images[0].image_url if images else None).model_dump(),
        description=product.description,
        images=[image_response(image) for image in images],
        created_at=product.created_at,
        updated_at=product.updated_at,
    )
    return ProductManagement(**detail.model_dump(), is_active=product.is_active)


def product_management_response(db: Session, product: Product) -> ProductManagement:
    supplier = db.get(Supplier, product.supplier_id)
    category = db.get(Category, product.category_id)
    if supplier is None or category is None:
        raise BusinessError("CATALOG_REFERENCE_MISSING", "Связанный ресурс товара не найден", 500)
    images = db.scalars(select(ProductImage).where(ProductImage.product_id == product.id).order_by(ProductImage.sort_order, ProductImage.id)).all()
    return product_management_value(product, supplier, category, images)


def management_values(db: Session, rows) -> list[ProductManagement]:
    rows = list(rows)
    product_ids = [product.id for product, _, _, _ in rows]
    images_by_product: dict[uuid.UUID, list[ProductImage]] = defaultdict(list)
    if product_ids:
        images = db.scalars(select(ProductImage).where(ProductImage.product_id.in_(product_ids)).order_by(ProductImage.product_id, ProductImage.sort_order, ProductImage.id)).all()
        for image in images:
            images_by_product[image.product_id].append(image)
    return [product_management_value(product, supplier, category, images_by_product[product.id]) for product, supplier, category, _ in rows]


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


def validate_category_parent(db: Session, category_id: uuid.UUID | None, parent_id: uuid.UUID | None) -> None:
    if parent_id is None:
        return
    if category_id == parent_id:
        raise BusinessError("CATEGORY_CYCLE", "Категория не может быть родителем самой себя", 409)
    current_id = parent_id
    seen: set[uuid.UUID] = set()
    while current_id is not None:
        if current_id in seen or current_id == category_id:
            raise BusinessError("CATEGORY_CYCLE", "Нельзя создать цикл категорий", 409)
        seen.add(current_id)
        current = ensure_category(db, current_id)
        current_id = current.parent_id


def ensure_owner_user(db: Session, owner_user_id: uuid.UUID | None) -> None:
    if owner_user_id is None:
        return
    owner = db.get(User, owner_user_id)
    if owner is None or owner.role != UserRole.SUPPLIER:
        raise BusinessError("INVALID_SUPPLIER_OWNER", "Владелец должен быть пользователем SUPPLIER", 422)


@router.get("/categories", response_model=CategoryListResponse)
def public_categories(db: Session = Depends(get_db)):
    return CategoryListResponse(items=category_tree(db.scalars(select(Category).order_by(Category.name, Category.id)).all()))


@admin_router.get("/categories", response_model=CategoryListResponse)
def admin_categories(db: Session = Depends(get_db)):
    return CategoryListResponse(items=category_tree(db.scalars(select(Category).order_by(Category.name, Category.id)).all()))


@admin_router.post("/categories", response_model=CategoryPublic, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    validate_category_parent(db, None, payload.parent_id)
    if db.scalar(select(exists().where(Category.slug == payload.slug))):
        raise BusinessError("DUPLICATE_CATEGORY_SLUG", "Категория с таким slug уже существует", 409)
    category = Category(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return CategoryPublic(id=category.id, name=category.name, slug=category.slug, children=[])


@admin_router.patch("/categories/{category_id}", response_model=CategoryPublic)
def update_category(category_id: uuid.UUID, payload: CategoryUpdate, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if category is None:
        raise BusinessError("CATEGORY_NOT_FOUND", "Категория не найдена", 404)
    changes = payload.model_dump(exclude_unset=True)
    validate_category_parent(db, category.id, changes.get("parent_id", category.parent_id))
    if "slug" in changes and changes["slug"] != category.slug and db.scalar(select(exists().where(Category.slug == changes["slug"]))):
        raise BusinessError("DUPLICATE_CATEGORY_SLUG", "Категория с таким slug уже существует", 409)
    for field, value in changes.items():
        setattr(category, field, value)
    db.commit()
    return CategoryPublic(id=category.id, name=category.name, slug=category.slug, children=[])


@admin_router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: uuid.UUID, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if category is None:
        raise BusinessError("CATEGORY_NOT_FOUND", "Категория не найдена", 404)
    if db.scalar(select(exists().where(Category.parent_id == category_id))) or db.scalar(select(exists().where(Product.category_id == category_id))):
        raise BusinessError("CATEGORY_DELETE_CONFLICT", "Категория содержит товары или дочерние категории", 409)
    db.delete(category)
    db.commit()


@router.get("/products", response_model=ProductListResponse)
def public_products(params: ProductQueryParams, db: Session = Depends(get_db)):
    params.validate_price_range()
    query = apply_product_filters(product_query_base(), params)
    total_query = apply_product_filters(select(func.count(Product.id)).select_from(Product).join(Supplier, Supplier.id == Product.supplier_id).join(Category, Category.id == Product.category_id), params)
    total = db.scalar(total_query) or 0
    if params.sort == "price_asc":
        query = query.order_by(asc(Product.price), Product.id)
    elif params.sort == "price_desc":
        query = query.order_by(desc(Product.price), Product.id)
    elif params.sort == "name_asc":
        query = query.order_by(asc(Product.name), Product.id)
    else:
        query = query.order_by(desc(Product.created_at), Product.id)
    rows = db.execute(query.offset((params.page - 1) * params.page_size).limit(params.page_size)).all()
    return ProductListResponse(items=[product_card(product, supplier, category, image_url) for product, supplier, category, image_url in rows], pagination=PaginationMeta(page=params.page, page_size=params.page_size, total_items=total, total_pages=math.ceil(total / params.page_size) if total else 0))


@router.get("/products/{product_id}", response_model=ProductDetail)
def public_product(product_id: uuid.UUID, db: Session = Depends(get_db)):
    row = db.execute(product_query_base().where(Product.id == product_id, Product.is_active.is_(True), Supplier.is_active.is_(True))).first()
    if row is None:
        raise BusinessError("PRODUCT_NOT_FOUND", "Товар не найден", 404)
    product, supplier, category, _ = row
    return product_detail(db, product, supplier, category)


@admin_router.get("/products", response_model=list[ProductManagement])
def admin_products(params: ProductQuery = Depends(), db: Session = Depends(get_db)):
    params.validate_price_range()
    query = apply_product_filters(product_query_base(), params, public_only=False)
    query = query.order_by(desc(Product.created_at), Product.id).offset((params.page - 1) * params.page_size).limit(params.page_size)
    rows = db.execute(query).all()
    return management_values(db, rows)


@admin_router.post("/products", response_model=ProductManagement, status_code=status.HTTP_201_CREATED)
def admin_create_product(payload: ProductCreateAdmin, db: Session = Depends(get_db)):
    service.ensure_supplier(db, payload.supplier_id)
    service.ensure_category(db, payload.category_id)
    values = payload.model_dump(exclude={"images"})
    return product_management_response(db, service.create_product(db, values, payload.images))


@admin_router.patch("/products/{product_id}", response_model=ProductManagement)
def admin_update_product(product_id: uuid.UUID, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None:
        raise BusinessError("PRODUCT_NOT_FOUND", "Товар не найден", 404)
    changes = payload.model_dump(exclude_unset=True)
    if "category_id" in changes:
        ensure_category(db, changes["category_id"])
    for field, value in changes.items():
        setattr(product, field, value)
    db.commit()
    return product_management_response(db, product)


@admin_router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_deactivate_product(product_id: uuid.UUID, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None:
        raise BusinessError("PRODUCT_NOT_FOUND", "Товар не найден", 404)
    product.is_active = False
    db.commit()


def supplier_product_query(supplier_id: uuid.UUID):
    return product_query_base().where(Product.supplier_id == supplier_id)


@supplier_router.get("/products", response_model=list[ProductManagement])
def supplier_products(supplier=Depends(get_current_supplier), db: Session = Depends(get_db)):
    rows = db.execute(supplier_product_query(supplier.id).order_by(desc(Product.created_at), Product.id)).all()
    return management_values(db, rows)


@supplier_router.post("/products", response_model=ProductManagement, status_code=status.HTTP_201_CREATED)
def supplier_create_product(payload: ProductCreateSupplier, supplier=Depends(get_current_supplier), db: Session = Depends(get_db)):
    service.ensure_category(db, payload.category_id)
    product = service.create_product(db, {**payload.model_dump(exclude={"images"}), "supplier_id": supplier.id}, payload.images)
    return product_management_response(db, product)


@supplier_router.patch("/products/{product_id}", response_model=ProductManagement)
def supplier_update_product(product_id: uuid.UUID, payload: ProductUpdate, supplier=Depends(get_current_supplier), db: Session = Depends(get_db)):
    product = db.scalar(select(Product).where(Product.id == product_id, Product.supplier_id == supplier.id))
    if product is None:
        raise BusinessError("PRODUCT_NOT_FOUND", "Товар не найден", 404)
    changes = payload.model_dump(exclude_unset=True)
    if "category_id" in changes:
        ensure_category(db, changes["category_id"])
    for field, value in changes.items():
        setattr(product, field, value)
    db.commit()
    return product_management_response(db, product)


@supplier_router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def supplier_deactivate_product(product_id: uuid.UUID, supplier=Depends(get_current_supplier), db: Session = Depends(get_db)):
    product = db.scalar(select(Product).where(Product.id == product_id, Product.supplier_id == supplier.id))
    if product is None:
        raise BusinessError("PRODUCT_NOT_FOUND", "Товар не найден", 404)
    product.is_active = False
    db.commit()


def product_for_image(db: Session, product_id: uuid.UUID, supplier_id: uuid.UUID | None = None) -> Product:
    query = select(Product).where(Product.id == product_id)
    if supplier_id is not None:
        query = query.where(Product.supplier_id == supplier_id)
    product = db.scalar(query)
    if product is None:
        raise BusinessError("PRODUCT_NOT_FOUND", "Товар не найден", 404)
    return product


def add_image(db: Session, product: Product, payload: ProductImageCreate) -> ProductImageResponse:
    count = db.scalar(select(func.count(ProductImage.id)).where(ProductImage.product_id == product.id)) or 0
    if count >= 10:
        raise BusinessError("IMAGE_LIMIT_REACHED", "У товара может быть не более 10 изображений", 409)
    image = ProductImage(product_id=product.id, **payload.model_dump())
    db.add(image)
    db.commit()
    db.refresh(image)
    return image_response(image)


@admin_router.post("/products/{product_id}/images", response_model=ProductImageResponse, status_code=status.HTTP_201_CREATED)
def admin_add_image(product_id: uuid.UUID, payload: ProductImageCreate, db: Session = Depends(get_db)):
    return add_image(db, product_for_image(db, product_id), payload)


@admin_router.patch("/products/{product_id}/images/{image_id}", response_model=ProductImageResponse)
def admin_update_image(product_id: uuid.UUID, image_id: uuid.UUID, payload: ProductImageUpdate, db: Session = Depends(get_db)):
    image = db.scalar(select(ProductImage).where(ProductImage.id == image_id, ProductImage.product_id == product_id))
    if image is None:
        raise BusinessError("IMAGE_NOT_FOUND", "Изображение не найдено", 404)
    image.sort_order = payload.sort_order
    db.commit()
    return image_response(image)


@admin_router.delete("/products/{product_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_image(product_id: uuid.UUID, image_id: uuid.UUID, db: Session = Depends(get_db)):
    image = db.scalar(select(ProductImage).where(ProductImage.id == image_id, ProductImage.product_id == product_id))
    if image is None:
        raise BusinessError("IMAGE_NOT_FOUND", "Изображение не найдено", 404)
    db.delete(image)
    db.commit()


@supplier_router.post("/products/{product_id}/images", response_model=ProductImageResponse, status_code=status.HTTP_201_CREATED)
def supplier_add_image(product_id: uuid.UUID, payload: ProductImageCreate, supplier=Depends(get_current_supplier), db: Session = Depends(get_db)):
    return add_image(db, product_for_image(db, product_id, supplier.id), payload)


@supplier_router.patch("/products/{product_id}/images/{image_id}", response_model=ProductImageResponse)
def supplier_update_image(product_id: uuid.UUID, image_id: uuid.UUID, payload: ProductImageUpdate, supplier=Depends(get_current_supplier), db: Session = Depends(get_db)):
    product_for_image(db, product_id, supplier.id)
    image = db.scalar(select(ProductImage).where(ProductImage.id == image_id, ProductImage.product_id == product_id))
    if image is None:
        raise BusinessError("IMAGE_NOT_FOUND", "Изображение не найдено", 404)
    image.sort_order = payload.sort_order
    db.commit()
    return image_response(image)


@supplier_router.delete("/products/{product_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def supplier_delete_image(product_id: uuid.UUID, image_id: uuid.UUID, supplier=Depends(get_current_supplier), db: Session = Depends(get_db)):
    product_for_image(db, product_id, supplier.id)
    image = db.scalar(select(ProductImage).where(ProductImage.id == image_id, ProductImage.product_id == product_id))
    if image is None:
        raise BusinessError("IMAGE_NOT_FOUND", "Изображение не найдено", 404)
    db.delete(image)
    db.commit()
