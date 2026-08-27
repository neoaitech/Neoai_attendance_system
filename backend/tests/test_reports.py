from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import get_db
from app.main import app
from app.models.attendance_model import Attendance
from app.models.base import Base
from app.models.class_model import Class
from app.models.session_model import AttendanceSession
from app.models.student_model import Student


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def seed(db):
    class_record = Class(
        class_name="BCA-A",
        subject="Database",
        teacher_name="Teacher",
        academic_year="2026-27",
        created_at=datetime.utcnow(),
    )
    db.add(class_record)
    db.commit()
    db.refresh(class_record)

    students = [
        Student(roll_no="S001", full_name="Student One", class_id=class_record.class_id, is_active=True),
        Student(roll_no="S002", full_name="Student Two", class_id=class_record.class_id, is_active=True),
        Student(roll_no="S003", full_name="Student Three", class_id=class_record.class_id, is_active=True),
    ]
    db.add_all(students)
    db.commit()
    for student in students:
        db.refresh(student)

    session = AttendanceSession(
        class_id=class_record.class_id,
        session_date=date(2026, 8, 27),
        total_students_expected=3,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    db.add_all(
        [
            Attendance(session_id=session.session_id, student_id=students[0].student_id, status="present", confidence_score=0.95, marked_at=datetime.utcnow()),
            Attendance(session_id=session.session_id, student_id=students[1].student_id, status="late", confidence_score=0.88, marked_at=datetime.utcnow()),
        ]
    )
    db.commit()
    return class_record


def test_daily_report_includes_counts_and_missing_student_as_absent(db):
    from app.services.report_service import build_daily_report

    class_record = seed(db)
    report = build_daily_report(db, class_id=class_record.class_id, report_date=date(2026, 8, 27))

    assert report["total_students"] == 3
    assert report["present_count"] == 1
    assert report["late_count"] == 1
    assert report["absent_count"] == 1
    assert report["attendance_percentage"] == pytest.approx(66.67)
    assert report["records"][-1]["status"] == "absent"


def test_daily_report_unknown_class_raises(db):
    from app.services.report_service import build_daily_report

    with pytest.raises(ValueError, match="Class not found"):
        build_daily_report(db, class_id=9999, report_date=date(2026, 8, 27))


def test_daily_report_endpoint_returns_report(db):
    class_record = seed(db)

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    try:
        response = client.get(
            "/api/v1/reports/daily",
            params={"class_id": class_record.class_id, "report_date": "2026-08-27"},
        )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    body = response.json()
    assert body["class_id"] == class_record.class_id
    assert body["present_count"] == 1
    assert body["late_count"] == 1
    assert body["absent_count"] == 1
