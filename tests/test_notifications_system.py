import pytest
from sqlalchemy import text
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.session import SessionLocal, engine, Base
from backend.app.db.models import User, ClassCourse, Notification, AuditLog
from backend.app.core.security import create_access_token, get_password_hash

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_notification_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clean previous test entities
    db.query(Notification).delete()
    test_courses = db.query(ClassCourse).filter(ClassCourse.code.like("MCA-TEST-%")).all()
    for tc in test_courses:
        db.delete(tc)
    db.commit()

    db.execute(text("DELETE FROM student_class_association WHERE class_id NOT IN (SELECT id FROM classes)"))
    db.execute(text("DELETE FROM course_faculty_association WHERE class_id NOT IN (SELECT id FROM classes)"))
    db.commit()

    def get_or_create_user(username, full_name, email, role="teacher"):
        u = db.query(User).filter(User.username == username).first()
        if not u:
            u = User(username=username, email=email, hashed_password=get_password_hash("pass123"), full_name=full_name, role=role)
            db.add(u)
            db.commit()
            db.refresh(u)
        return u

    admin = get_or_create_user("admin_notif", "Admin Notif", "admin_notif@univ.edu", role="admin")
    f_a = get_or_create_user("notif_fa", "Dr. Rajesh Sharma", "notif_sharma@univ.edu")
    f_b = get_or_create_user("notif_fb", "Dr. Anup Shivanechari", "notif_anup@univ.edu")
    f_c = get_or_create_user("notif_fc", "Dr. Priya Patel", "notif_priya@univ.edu")

    data = {
        "admin": admin,
        "f_a": f_a,
        "f_b": f_b,
        "f_c": f_c,
        "admin_token": create_access_token(admin.username, admin.role),
        "fa_token": create_access_token(f_a.username, f_a.role),
        "fb_token": create_access_token(f_b.username, f_b.role),
        "fc_token": create_access_token(f_c.username, f_c.role),
    }
    db.close()
    yield data

def test_course_assignment_notification_targeting(setup_notification_db):
    """
    Verifies that when Admin assigns Course to Faculty A & B:
    - Faculty A receives 1 notification (Primary Faculty, Div A & B)
    - Faculty B receives 1 notification (Co-Faculty, Div A & B)
    - Faculty C (unrelated) receives 0 notifications.
    """
    ctx = setup_notification_db
    create_payload = {
        "code": "MCA-TEST-01",
        "name": "Distributed Systems",
        "subject_name": "Distributed Systems",
        "department": "Computer Science & Engineering",
        "program": "MCA",
        "semester": "Semester 1",
        "sections": ["A", "B"],
        "academic_year": "2026-27",
        "credits": 4,
        "teacher_id": ctx["f_a"].id,
        "faculty_ids": [ctx["f_a"].id, ctx["f_b"].id]
    }

    resp = client.post("/api/classes", json=create_payload, headers={"Authorization": f"Bearer {ctx['admin_token']}"})
    assert resp.status_code == 200

    # Faculty A check
    resp_fa = client.get("/api/notifications", headers={"Authorization": f"Bearer {ctx['fa_token']}"})
    assert resp_fa.status_code == 200
    fa_notifs = resp_fa.json()["notifications"]
    assert len(fa_notifs) == 1
    assert fa_notifs[0]["title"] == "Course Assigned to You"
    assert "Primary Faculty" in fa_notifs[0]["message"]

    # Faculty B check
    resp_fb = client.get("/api/notifications", headers={"Authorization": f"Bearer {ctx['fb_token']}"})
    assert resp_fb.status_code == 200
    fb_notifs = resp_fb.json()["notifications"]
    assert len(fb_notifs) == 1
    assert fb_notifs[0]["title"] == "Course Assigned to You"
    assert "Co-Faculty" in fb_notifs[0]["message"]

    # Faculty C check -> MUST BE 0!
    resp_fc = client.get("/api/notifications", headers={"Authorization": f"Bearer {ctx['fc_token']}"})
    assert resp_fc.status_code == 200
    assert len(resp_fc.json()["notifications"]) == 0

def test_notification_ownership_security(setup_notification_db):
    """
    Verifies that Faculty C cannot mark or modify Faculty A's notifications (403 Forbidden).
    """
    ctx = setup_notification_db
    resp_fa = client.get("/api/notifications", headers={"Authorization": f"Bearer {ctx['fa_token']}"})
    fa_notifs = resp_fa.json()["notifications"]
    assert len(fa_notifs) > 0
    fa_notif_id = fa_notifs[0]["id"]

    # Faculty C attempts to mark Faculty A's notification as read
    resp_sec = client.patch(f"/api/notifications/{fa_notif_id}/read", headers={"Authorization": f"Bearer {ctx['fc_token']}"})
    assert resp_sec.status_code == 403

def test_mark_as_read_and_read_all(setup_notification_db):
    """
    Verifies individual mark-as-read and bulk mark-all-as-read.
    """
    ctx = setup_notification_db
    count_resp = client.get("/api/notifications/unread-count", headers={"Authorization": f"Bearer {ctx['fa_token']}"})
    assert count_resp.status_code == 200
    assert count_resp.json()["unread_count"] > 0

    # Mark all read
    resp_all = client.patch("/api/notifications/read-all", headers={"Authorization": f"Bearer {ctx['fa_token']}"})
    assert resp_all.status_code == 200

    # Unread count should now be 0
    count_after = client.get("/api/notifications/unread-count", headers={"Authorization": f"Bearer {ctx['fa_token']}"})
    assert count_after.json()["unread_count"] == 0
