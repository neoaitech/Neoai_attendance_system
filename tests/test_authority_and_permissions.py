import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from backend.app.main import app
from backend.app.db.session import Base, get_db
from backend.app.db.models import User, Role, Permission, UserPermissionOverride, UserAcademicScope, PermissionRequest, AuditLog, Notification
from backend.app.services.permission_service import permission_service
from backend.app.core.security import get_password_hash, create_access_token

# Test In-Memory SQLite setup
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

    # Seed test users
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
    faculty_anita = User(
        username="test_anita",
        email="anita@test.edu",
        hashed_password=get_password_hash("pass123"),
        full_name="Dr. Anita Desai",
        role="teacher",
        status="Active",
        is_active=True
    )
    deactivated_user = User(
        username="test_inactive",
        email="inactive@test.edu",
        hashed_password=get_password_hash("pass123"),
        full_name="Inactive Faculty",
        role="teacher",
        status="Deactivated",
        is_active=False
    )

    db.add_all([super_admin, admin, faculty_rajesh, faculty_anita, deactivated_user])
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

# ===================================================================
# 1. Super Admin Unconditional Access Tests
# ===================================================================
def test_super_admin_has_all_permissions(db_session):
    super_user = db_session.query(User).filter(User.username == "test_super").first()
    assert permission_service.is_super_admin(super_user) is True
    assert permission_service.has_permission(db_session, super_user, "student.delete") is True
    assert permission_service.has_permission(db_session, super_user, "permissions.manage") is False
    assert permission_service.has_permission(db_session, super_user, "settings.manage") is True

# ===================================================================
# 2. Administrator Access Tests
# ===================================================================
def test_admin_has_management_permissions(db_session):
    admin_user = db_session.query(User).filter(User.username == "test_admin").first()
    assert permission_service.has_permission(db_session, admin_user, "permissions.manage") is True
    assert permission_service.has_permission(db_session, admin_user, "course.create") is True

# ===================================================================
# 3. Faculty Default Permissions & Restrictions Tests
# ===================================================================
def test_faculty_default_permissions_and_restrictions(db_session):
    faculty = db_session.query(User).filter(User.username == "test_rajesh").first()
    
    # Allowed by default for faculty
    assert permission_service.has_permission(db_session, faculty, "attendance.take") is True
    assert permission_service.has_permission(db_session, faculty, "attendance.view") is True
    assert permission_service.has_permission(db_session, faculty, "student.view") is True
    assert permission_service.has_permission(db_session, faculty, "report.view") is True
    
    # Sensitive operations blocked by default for faculty
    assert permission_service.has_permission(db_session, faculty, "student.delete") is False
    assert permission_service.has_permission(db_session, faculty, "permissions.manage") is False
    assert permission_service.has_permission(db_session, faculty, "unknown_face.enroll_new_student") is False

# ===================================================================
# 4. Academic Scope Enforcement Tests (Crucial User Requirement)
# ===================================================================
def test_academic_scope_allow_and_deny(db_session):
    faculty = db_session.query(User).filter(User.username == "test_rajesh").first()
    admin = db_session.query(User).filter(User.username == "test_admin").first()

    # Grant Dr. Rajesh student.edit permission
    permission_service.grant_user_permission(db_session, faculty.id, "student.edit", actor=admin, effect="ALLOW")

    # Assign single scope: CSE -> BCA -> Semester 7 -> Division A
    scope_data = {
        "department": "Computer Science & Engineering",
        "program": "BCA",
        "semester": "Semester 7",
        "division": "A"
    }
    permission_service.add_user_scope(db_session, faculty.id, scope_data, actor=admin)

    # 1. Matching Scope -> Should be ALLOWED
    matching_scope = {
        "department": "Computer Science & Engineering",
        "program": "BCA",
        "semester": "Semester 7",
        "division": "A"
    }
    assert permission_service.has_permission(db_session, faculty, "student.edit", scope=matching_scope) is True

    # 2. Different Division (B) -> Should be DENIED
    diff_div_scope = {
        "department": "Computer Science & Engineering",
        "program": "BCA",
        "semester": "Semester 7",
        "division": "B"
    }
    assert permission_service.has_permission(db_session, faculty, "student.edit", scope=diff_div_scope) is False

    # 3. Different Semester (Sem 8) -> Should be DENIED
    diff_sem_scope = {
        "department": "Computer Science & Engineering",
        "program": "BCA",
        "semester": "Semester 8",
        "division": "A"
    }
    assert permission_service.has_permission(db_session, faculty, "student.edit", scope=diff_sem_scope) is False

    # 4. Different Program (MCA) -> Should be DENIED
    diff_prog_scope = {
        "department": "Computer Science & Engineering",
        "program": "MCA",
        "semester": "Semester 1",
        "division": "A"
    }
    assert permission_service.has_permission(db_session, faculty, "student.edit", scope=diff_prog_scope) is False

# ===================================================================
# 5. Multi-Scope Evaluation Tests
# ===================================================================
def test_multi_scope_evaluation(db_session):
    faculty = db_session.query(User).filter(User.username == "test_anita").first()
    admin = db_session.query(User).filter(User.username == "test_admin").first()

    # Grant student.create permission
    permission_service.grant_user_permission(db_session, faculty.id, "student.create", actor=admin, effect="ALLOW")

    # Add 2 distinct scopes to Dr. Anita:
    # Scope 1: BCA Semester 7 Division A
    # Scope 2: MCA Semester 1 Division B
    permission_service.add_user_scope(db_session, faculty.id, {
        "department": "Computer Science & Engineering",
        "program": "BCA",
        "semester": "Semester 7",
        "division": "A"
    }, actor=admin)

    permission_service.add_user_scope(db_session, faculty.id, {
        "department": "Computer Science & Engineering",
        "program": "MCA",
        "semester": "Semester 1",
        "division": "B"
    }, actor=admin)

    # Scope 1 match -> True
    assert permission_service.has_permission(db_session, faculty, "student.create", scope={
        "department": "Computer Science & Engineering",
        "program": "BCA",
        "semester": "Semester 7",
        "division": "A"
    }) is True

    # Scope 2 match -> True
    assert permission_service.has_permission(db_session, faculty, "student.create", scope={
        "department": "Computer Science & Engineering",
        "program": "MCA",
        "semester": "Semester 1",
        "division": "B"
    }) is True

    # Unassigned Combination (MCA Semester 1 Division A) -> False
    assert permission_service.has_permission(db_session, faculty, "student.create", scope={
        "department": "Computer Science & Engineering",
        "program": "MCA",
        "semester": "Semester 1",
        "division": "A"
    }) is False

# ===================================================================
# 6. Explicit DENY Precedence Tests
# ===================================================================
def test_explicit_deny_overrides_role_default(db_session):
    faculty = db_session.query(User).filter(User.username == "test_rajesh").first()
    admin = db_session.query(User).filter(User.username == "test_admin").first()

    # By default, attendance.take is True for faculty
    assert permission_service.has_permission(db_session, faculty, "attendance.take") is True

    # Explicitly DENY attendance.take
    permission_service.grant_user_permission(db_session, faculty.id, "attendance.take", actor=admin, effect="DENY")

    # Now attendance.take MUST be False
    assert permission_service.has_permission(db_session, faculty, "attendance.take") is False

    # Revoke override -> Reverts to role default (True)
    permission_service.revoke_user_permission(db_session, faculty.id, "attendance.take", actor=admin)
    assert permission_service.has_permission(db_session, faculty, "attendance.take") is True

# ===================================================================
# 7. Deactivated Account Enforcement Tests
# ===================================================================
def test_deactivated_account_has_zero_access(db_session):
    deactivated = db_session.query(User).filter(User.username == "test_inactive").first()
    assert permission_service.has_permission(db_session, deactivated, "dashboard.view") is False
    assert permission_service.has_permission(db_session, deactivated, "attendance.take") is False

# ===================================================================
# 8. Last Super Administrator Protection Tests
# ===================================================================
def test_last_super_admin_protection(client, db_session):
    super_user = db_session.query(User).filter(User.username == "test_super").first()
    headers = get_auth_headers("test_admin", "admin")

    # Attempt to demote the only Super Admin to Teacher
    res = client.put(f"/api/authority/users/{super_user.id}/authority", json={
        "role": "teacher",
        "status": "Active"
    }, headers=headers)

    assert res.status_code == 400
    assert "last remaining Super Administrator" in res.json()["detail"]

# ===================================================================
# 9. Permission Request & Approval Workflow Tests
# ===================================================================
def test_permission_request_workflow(client, db_session):
    faculty = db_session.query(User).filter(User.username == "test_rajesh").first()
    admin = db_session.query(User).filter(User.username == "test_admin").first()

    # 1. Faculty submits request for unknown_face.enroll_new_student
    req = permission_service.submit_permission_request(
        db=db_session,
        user=faculty,
        permission_key="unknown_face.enroll_new_student",
        action_type="Enroll Unknown Face",
        reason="Need to register lab students detected as unknown.",
        scope_data={"program": "BCA", "semester": "Semester 7", "division": "A"}
    )
    assert req.id is not None
    assert req.status == "PENDING"

    # Verify notification dispatched to admin
    notif = db_session.query(Notification).filter(
        Notification.recipient_user_id == admin.id,
        Notification.notification_type == "PERMISSION_REQUEST_SUBMITTED"
    ).first()
    assert notif is not None

    # 2. Administrator Approves request
    reviewed = permission_service.review_permission_request(
        db=db_session,
        request_id=req.id,
        reviewer=admin,
        status="APPROVED",
        reviewer_notes="Approved for Semester 7 Lab.",
        grant_scope={"department": "CSE", "program": "BCA", "semester": "Semester 7", "division": "A"}
    )
    assert reviewed.status == "APPROVED"

    # 3. Verify user now has the permission
    assert permission_service.has_permission(db_session, faculty, "unknown_face.enroll_new_student") is True

    # 4. Verify Audit Log was recorded
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "REQUEST_APPROVED",
        AuditLog.target_user_id == faculty.id
    ).first()
    assert audit is not None
    assert audit.result == "SUCCESS"

# ===================================================================
# 10. Bulk Permission Assignment Tests
# ===================================================================
def test_bulk_permission_assignment(client, db_session):
    admin_headers = get_auth_headers("test_admin", "admin")
    rajesh = db_session.query(User).filter(User.username == "test_rajesh").first()
    anita = db_session.query(User).filter(User.username == "test_anita").first()

    res = client.post("/api/authority/bulk-assign", json={
        "user_ids": [rajesh.id, anita.id],
        "permission_key": "course.create",
        "effect": "ALLOW"
    }, headers=admin_headers)

    assert res.status_code == 200
    assert "Successfully configured authority for 2 faculty members" in res.json()["message"]

    assert permission_service.has_permission(db_session, rajesh, "course.create") is True
    assert permission_service.has_permission(db_session, anita, "course.create") is True
