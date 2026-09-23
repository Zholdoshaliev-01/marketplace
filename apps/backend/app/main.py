from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.catalog.router import admin_router as admin_catalog_router
from app.catalog.router import router as catalog_router
from app.catalog.router import supplier_router as supplier_catalog_router
from app.core.exceptions import BusinessError, business_error_handler, integrity_error_handler
from app.cart.router import router as cart_router
from app.orders.router import admin_router as admin_order_router
from app.orders.router import router as order_router
from app.orders.router import supplier_router as supplier_order_router
from app.suppliers.router import admin_router as admin_supplier_router
from app.suppliers.router import router as public_supplier_router
from app.auth.router import router as auth_router
from app.core.router import router as health_router
from app.supplier_fulfillments.router import router as supplier_fulfillment_router

settings = get_settings()
app = FastAPI(title="Marketplace API", version="0.1.0", openapi_url="/docs/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_exception_handler(BusinessError, business_error_handler)
app.add_exception_handler(IntegrityError, integrity_error_handler)
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(catalog_router)
app.include_router(admin_catalog_router)
app.include_router(supplier_catalog_router)
app.include_router(public_supplier_router)
app.include_router(admin_supplier_router)
app.include_router(cart_router)
app.include_router(order_router)
app.include_router(admin_order_router)
app.include_router(supplier_order_router)
app.include_router(supplier_fulfillment_router)
