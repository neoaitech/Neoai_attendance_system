import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.db.session import get_db, SessionLocal
from backend.app.db.models import User, ClassCourse, Notification, AuditLog, AttendanceSession, AttendanceRecord
from backend.app.core.security import create_access_token, get_password_hash
from backend.app.core.datetime_utils import (
    format_iso_utc,
    format_ist_datetime,
    format_ist_date,
    format_ist_time,
    get_utc_now,
    get_ist_now
)
from backend.app.services.notification_service import NotificationService

client = TestClient(app)


def test_datetime_utils_formatting():
    """Verify backend datetime utility functions produce exact ISO UTC and IST strings."""
    # Test specific fixed UTC time: 2026-08-31 10:30:00 UTC (which is 16:00:00 IST / 04:00 PM IST)
    utc_dt = datetime(2026, 8, 31, 10, 30, 0, tzinfo=timezone.utc)
    
    iso_str = format_iso_utc(utc_dt)
    assert iso_str == "2026-08-31T10:30:00Z"
    
    ist_full = format_ist_datetime(utc_dt)
    assert "31 Aug 2026" in ist_full
    assert "04:00 PM IST" in ist_full
    
    ist_date = format_ist_date(utc_dt)
    assert ist_date == "31 Aug 2026"
    
    ist_time = format_ist_time(utc_dt)
    assert ist_time == "04:00 PM"


def test_naive_utc_formatting():
    """Verify naive datetime objects stored by SQLite are correctly assumed UTC."""
    naive_dt = datetime(2026, 8, 31, 11, 0, 0)
    iso_str = format_iso_utc(naive_dt)
    assert iso_str == "2026-08-31T11:00:00Z"
    
    ist_str = format_ist_datetime(naive_dt)
    assert "04:30 PM IST" in ist_str


def test_model_serialization_ends_with_z():
    """Verify all database model to_dict methods serialize timestamps with Z suffix."""
    db = SessionLocal()
    try:
        user = db.query(User).first()
        assert user is not None
        
        notif = Notification(
            recipient_user_id=user.id,
            notification_type="TEST_TIME",
            title="Time Test",
            message="Testing ISO UTC serialization",
            created_at=datetime.utcnow()
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        
        d = notif.to_dict()
        assert d["created_at"] is not None
        assert d["created_at"].endswith("Z")
        
        # Verify User model
        u_dict = user.to_dict()
        if u_dict.get("created_at"):
            assert u_dict["created_at"].endswith("Z")
            
        # Clean up
        db.delete(notif)
        db.commit()
    finally:
        db.close()


def test_no_5_hour_discrepancy():
    """
    Verify the root-cause fix for the '5 hours ago' timestamp bug.
    When a notification is generated at the current moment, parsing its ISO string
    in JS or Python results in a difference of <= 2 seconds, NOT 19800 seconds (5.5 hours).
    """
    notif_service = NotificationService()
    db = SessionLocal()
    try:
        faculty = db.query(User).filter(User.role == "teacher").first()
        if not faculty:
            faculty = User(
                username="test_fac_time",
                email="fac_time@institution.edu",
                hashed_password=get_password_hash("pass123"),
                full_name="Prof. Time Test",
                role="teacher"
            )
            db.add(faculty)
            db.commit()
            db.refresh(faculty)
            
        notif = notif_service.create_notification(
            db=db,
            recipient_user_id=faculty.id,
            notification_type="COURSE_ASSIGNED",
            title="Real-Time Course Assignment",
            message="Assignment timestamp validation",
            category="Assignments",
            priority="SUCCESS"
        )
        
        assert notif is not None
        notif_dict = notif.to_dict()
        iso_created_at = notif_dict["created_at"]
        assert iso_created_at.endswith("Z")
        
        # Parse ISO string as UTC
        parsed_dt = datetime.fromisoformat(iso_created_at.replace("Z", "+00:00"))
        now_utc = datetime.now(timezone.utc)
        diff = abs((now_utc - parsed_dt).total_seconds())
        
        # Difference must be strictly under 5 seconds, confirming NO 5.5 hour offset!
        assert diff < 5.0
        
        # Clean up
        db.delete(notif)
        db.commit()
    finally:
        db.close()


def test_unread_count_and_user_isolation():
    """Verify unread count is strictly user-scoped and isolated between accounts."""
    db = SessionLocal()
    try:
        # Create two distinct users
        u1 = db.query(User).filter(User.username == "user_iso_1").first()
        if not u1:
            u1 = User(username="user_iso_1", email="u1@inst.edu", hashed_password=get_password_hash("p"), full_name="User One", role="teacher")
            db.add(u1)
            db.commit()
            db.refresh(u1)
            
        u2 = db.query(User).filter(User.username == "user_iso_2").first()
        if not u2:
            u2 = User(username="user_iso_2", email="u2@inst.edu", hashed_password=get_password_hash("p"), full_name="User Two", role="teacher")
            db.add(u2)
            db.commit()
            db.refresh(u2)

        # Clear existing notifs for u1 and u2
        db.query(Notification).filter(Notification.recipient_user_id.in_([u1.id, u2.id])).delete(synchronize_session=False)
        db.commit()

        # Add 2 notifications for u1, 0 for u2
        n1 = Notification(recipient_user_id=u1.id, notification_type="T1", title="Notif 1", message="M1", is_read=False, created_at=datetime.utcnow())
        n2 = Notification(recipient_user_id=u1.id, notification_type="T2", title="Notif 2", message="M2", is_read=False, created_at=datetime.utcnow())
        db.add_all([n1, n2])
        db.commit()

        token1 = create_access_token(subject=u1.username, role=u1.role)
        token2 = create_access_token(subject=u2.username, role=u2.role)

        # User 1 should have unread_count = 2
        r1 = client.get("/api/notifications/unread-count", headers={"Authorization": f"Bearer {token1}"})
        assert r1.status_code == 200
        assert r1.json()["unread_count"] == 2

        # User 2 should have unread_count = 0 (Total Isolation!)
        r2 = client.get("/api/notifications/unread-count", headers={"Authorization": f"Bearer {token2}"})
        assert r2.status_code == 200
        assert r2.json()["unread_count"] == 0

        # Mark 1 as read for User 1
        r_read = client.patch(f"/api/notifications/{n1.id}/read", headers={"Authorization": f"Bearer {token1}"})
        assert r_read.status_code == 200
        assert r_read.json()["notification"]["is_read"] is True

        # User 1 count is now 1
        r1_after = client.get("/api/notifications/unread-count", headers={"Authorization": f"Bearer {token1}"})
        assert r1_after.json()["unread_count"] == 1

        # User 2 cannot mark User 1's notification as read (Forbidden 403)
        r_forbidden = client.patch(f"/api/notifications/{n2.id}/read", headers={"Authorization": f"Bearer {token2}"})
        assert r_forbidden.status_code == 403

        # Clean up
        db.query(Notification).filter(Notification.recipient_user_id.in_([u1.id, u2.id])).delete(synchronize_session=False)
        db.delete(u1)
        db.delete(u2)
        db.commit()
    finally:
        db.close()
