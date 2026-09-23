from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser
from app.auth.schemas import AuthResponse, LoginRequest, MeResponse, RefreshResponse, RegisterRequest
from app.auth.service import AuthResult, login_user, register_user, revoke_refresh_token, rotate_refresh_token
from app.core.config import get_settings
from app.db.session import get_db
from app.shops.models import Shop
from app.shops.schemas import ShopResponse
from app.users.schemas import UserResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, raw: str) -> None:
    response.set_cookie("refresh_token", raw, httponly=True, secure=get_settings().environment == "production", samesite="lax", max_age=30 * 24 * 60 * 60, path="/api/v1/auth")


def _response(result: AuthResult, response: Response) -> AuthResponse:
    _set_refresh_cookie(response, result.refresh_token)
    return AuthResponse(user=UserResponse.model_validate(result.user), shop=ShopResponse.model_validate(result.shop) if result.shop else None, access_token=result.access_token)


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    return _response(register_user(db, payload), response)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    return _response(login_user(db, payload), response)


@router.post("/refresh", response_model=RefreshResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    access_token, raw = rotate_refresh_token(db, request.cookies.get("refresh_token"))
    _set_refresh_cookie(response, raw)
    return RefreshResponse(access_token=access_token)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    revoke_refresh_token(db, request.cookies.get("refresh_token"))
    response.delete_cookie("refresh_token", path="/api/v1/auth")


@router.get("/me", response_model=MeResponse)
def me(user: CurrentUser, db: Session = Depends(get_db)):
    shop = db.query(Shop).filter(Shop.owner_user_id == user.id).scalar()
    return MeResponse(user=UserResponse.model_validate(user), shop=ShopResponse.model_validate(shop) if shop else None)
