import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from backend.app.main import app
from backend.app.db.session import Base, get_db
from backend.app.db.models import User
from backend.app.services.permission_service import permission_service
from backend.app.core.security import get_password_hash, create_access_token

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    permission_service.seed_default_roles_and_permissions(db)

    super_admin = User(
        username="test_super",
        email="super@test.edu",
        hashed_password=get_password_hash("pass123"),
        full_name="Super Administrator",
        role="super_admin",
        status="Active",
        is_active=True
    )
    admin = User(
        username="test_admin",
        email="admin@test.edu",
        hashed_password=get_password_hash("pass123"),
        full_name="Department Admin",
        role="admin",
        status="Active",
        is_active=True
    )
    faculty_rajesh = User(
        username="test_rajesh",
        email="rajesh@test.edu",
        hashed_password=get_password_hash("pass123"),
        full_name="Dr. Rajesh Sharma",
        role="teacher",
        status="Active",
        is_active=True
    )

    db.add_all([super_admin, admin, faculty_rajesh])
    db.commit()

    yield db

    db.close()

@pytest.fixture(scope="module")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def get_auth_headers(username: str, role: str):
    token = create_access_token(subject=username, role=role)
    return {"Authorization": f"Bearer {token}"}

def test_3_tier_permissions_evaluation(db_session):
    admin = db_session.query(User).filter(User.username == "test_admin").first()
    super_user = db_session.query(User).filter(User.username == "test_super").first()
    faculty = db_session.query(User).filter(User.username == "test_rajesh").first()

    # 1. Admin has permissions.manage
    assert permission_service.has_permission(db_session, admin, "permissions.manage") is True
    assert permission_service.has_permission(db_session, admin, "student.create") is True

    # 2. Super Admin has all operational permissions EXCEPT permissions.manage
    assert permission_service.has_permission(db_session, super_user, "permissions.manage") is False
    assert permission_service.has_permission(db_session, super_user, "student.create") is True
    assert permission_service.has_permission(db_session, super_user, "student.edit") is True
    assert permission_service.has_permission(db_session, super_user, "course.create") is True
    assert permission_service.has_permission(db_session, super_user, "attendance.take") is True

    # 3. Faculty has default permissions
    assert permission_service.has_permission(db_session, faculty, "permissions.manage") is False
    assert permission_service.has_permission(db_session, faculty, "attendance.take") is True

def test_super_admin_cannot_access_authority_endpoints(client, db_session):
    super_headers = get_auth_headers("test_super", "super_admin")
    admin_headers = get_auth_headers("test_admin", "admin")

    # Super admin accessing /api/authority/users -> 403
    res_super = client.get("/api/authority/users", headers=super_headers)
    assert res_super.status_code == 403
    assert "Access Denied" in res_super.json()["detail"]

    # Admin accessing /api/authority/users -> 200
    res_admin = client.get("/api/authority/users", headers=admin_headers)
    assert res_admin.status_code == 200

def test_super_admin_cannot_edit_administrator_profile(client, db_session):
    super_headers = get_auth_headers("test_super", "super_admin")
    admin = db_session.query(User).filter(User.username == "test_admin").first()

    # Super admin trying to modify Admin user -> 403 Forbidden
    res = client.put(f"/api/admin/faculty/{admin.id}", json={
        "full_name": "Tampered Admin Name"
    }, headers=super_headers)

    assert res.status_code == 403
    assert "cannot modify Administrator profiles" in res.json()["detail"]

def test_super_admin_cannot_promote_to_admin(client, db_session):
    super_headers = get_auth_headers("test_super", "super_admin")
    faculty = db_session.query(User).filter(User.username == "test_rajesh").first()

    # Super admin trying to promote faculty to admin -> 403 Forbidden
    res = client.put(f"/api/admin/faculty/{faculty.id}", json={
        "role": "admin"
    }, headers=super_headers)

    assert res.status_code == 403
    assert "can only assign Faculty role" in res.json()["detail"]

def test_super_admin_can_edit_faculty_profile(client, db_session):
    super_headers = get_auth_headers("test_super", "super_admin")
    faculty = db_session.query(User).filter(User.username == "test_rajesh").first()

    # Super admin updating standard faculty details -> 200 OK
    res = client.put(f"/api/admin/faculty/{faculty.id}", json={
        "full_name": "Dr. Rajesh Sharma Updated"
    }, headers=super_headers)

    assert res.status_code == 200
    assert res.json()["full_name"] == "Dr. Rajesh Sharma Updated"
