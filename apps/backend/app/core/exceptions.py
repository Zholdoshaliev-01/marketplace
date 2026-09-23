from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError


class BusinessError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code


async def business_error_handler(_: Request, exc: BusinessError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": {"code": exc.code, "message": exc.message}})


async def integrity_error_handler(_: Request, __: IntegrityError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"error": {"code": "CONFLICT", "message": "Ресурс уже существует или связан с другими данными"}})
