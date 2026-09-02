import pytest

def test_login_success(client, admin_user):
    response = client.post(
        "/api/auth/login-json",
        json={"username": "test_admin", "password": "adminpass"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "admin"
    assert data["username"] == "test_admin"

def test_login_invalid_password(client, admin_user):
    response = client.post(
        "/api/auth/login-json",
        json={"username": "test_admin", "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert "Incorrect username or password" in response.json()["detail"]

def test_get_current_user_profile(client, admin_token):
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "test_admin"
    assert data["role"] == "admin"

def test_unauthorized_access(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401

def test_rbac_admin_route_by_teacher(client, teacher_token):
    # Teacher attempting to access restricted admin-only delete endpoint should get 403 Forbidden
    response = client.delete(
        "/api/students/99999",
        headers={"Authorization": f"Bearer {teacher_token}"}
    )
    assert response.status_code == 403
    assert "Administrator access required" in response.json()["detail"]

def test_rbac_admin_route_by_admin(client, admin_token):
    response = client.get(
        "/api/admin/health",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "HEALTHY"
