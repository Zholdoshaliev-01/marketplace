from sqlalchemy import select

from app.db.session import get_db
from app.core.enums import UserRole
from app.users.models import User


def payload(phone="+996700000001", email="shop@example.com"):
    return {"phone": phone, "email": email, "password": "strong-password", "shop": {"name": "Магазин", "phone": phone, "city": "Бишкек", "address": "ул. Тестовая 1"}}


def test_registration_returns_access_and_sets_refresh_cookie(client):
    response = client.post("/api/v1/auth/register", json=payload())
    assert response.status_code == 201
    assert response.json()["user"]["role"] == "SHOP"
    assert response.json()["shop"]["name"] == "Магазин"
    assert response.json()["shop"]["owner_user_id"] == response.json()["user"]["id"]
    assert response.json()["access_token"]
    assert "refresh_token" in response.cookies


def test_duplicate_phone(client):
    client.post("/api/v1/auth/register", json=payload())
    response = client.post("/api/v1/auth/register", json=payload(email="other@example.com"))
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "DUPLICATE_USER"


def test_login_and_wrong_password(client):
    client.post("/api/v1/auth/register", json=payload())
    response = client.post("/api/v1/auth/login", json={"phone_or_email": "+996700000001", "password": "strong-password"})
    assert response.status_code == 200
    assert response.json()["shop"]["name"] == "Магазин"
    assert client.post("/api/v1/auth/login", json={"phone_or_email": "+996700000001", "password": "wrong-password"}).status_code == 401


def test_refresh_rotation_and_revoked_token(client):
    client.post("/api/v1/auth/register", json=payload())
    old = client.cookies.get("refresh_token")
    first = client.post("/api/v1/auth/refresh")
    assert first.status_code == 200
    new = client.cookies.get("refresh_token")
    assert new and new != old
    client.cookies.set("refresh_token", old)
    assert client.post("/api/v1/auth/refresh").status_code == 401
    client.cookies.set("refresh_token", new)
    assert client.post("/api/v1/auth/refresh").status_code == 200


def test_logout_revokes_refresh_token_and_clears_cookie(client):
    client.post("/api/v1/auth/register", json=payload())
    refresh_token = client.cookies.get("refresh_token")
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 204
    assert client.cookies.get("refresh_token") is None
    client.cookies.set("refresh_token", refresh_token)
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_logout_without_refresh_cookie_is_idempotent(client):
    client.cookies.clear()
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 204
    assert client.cookies.get("refresh_token") is None


def test_inactive_user_cannot_login(client):
    client.post("/api/v1/auth/register", json=payload())
    db = next(get_db())
    user = db.scalar(select(User).where(User.phone == "+996700000001"))
    user.is_active = False
    db.commit()
    db.close()
    response = client.post("/api/v1/auth/login", json={"phone_or_email": "+996700000001", "password": "strong-password"})
    assert response.status_code == 403


def test_rbac_denies_shop_for_admin_only_dependency(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
