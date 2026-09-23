from fastapi import Depends
from fastapi.testclient import TestClient

from app.auth.dependencies import require_roles
from app.core.enums import UserRole
from app.main import app


def test_role_dependency_returns_403_for_wrong_role(client):
    app.add_api_route("/test-admin-only", lambda user=Depends(require_roles(UserRole.ADMIN)): {"ok": True}, methods=["GET"])
    registration = client.post("/api/v1/auth/register", json={"phone": "+996700000002", "password": "strong-password", "shop": {"name": "Shop", "phone": "+996700000002", "city": "Ош", "address": "A"}})
    response = client.get("/test-admin-only", headers={"Authorization": f"Bearer {registration.json()['access_token']}"})
    assert response.status_code == 403
