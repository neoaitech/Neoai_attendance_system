from datetime import datetime

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models.class_model import Class
from app.models.student_model import Student


client = TestClient(app)


def seed_class():
    db = SessionLocal()

    class_record = Class(
        class_name="BCA-A",
        subject="Database",
        teacher_name="Test Teacher",
        academic_year="2026-27",
        created_at=datetime.utcnow(),
    )

    db.add(class_record)
    db.commit()
    db.refresh(class_record)

    class_id = class_record.class_id
    db.close()

    return class_id


def test_student_registration_inserts_record():
    class_id = seed_class()

    roll_no = "TEST-STUDENT-001"

    response = client.post(
        "/api/v1/students",
        json={
            "roll_no": roll_no,
            "full_name": "Test Student",
            "class_id": class_id,
            "email": "student@example.com",
            "is_active": True,
        },
    )

    assert response.status_code == 201

    body = response.json()

    assert body["roll_no"] == roll_no
    assert body["full_name"] == "Test Student"

    db = SessionLocal()

    saved = (
        db.query(Student)
        .filter(Student.roll_no == roll_no)
        .first()
    )

    db.close()

    assert saved is not None
    assert saved.full_name == "Test Student"
    assert saved.class_id == class_id


def test_duplicate_roll_no_is_rejected():
    class_id = seed_class()

    roll_no = "TEST-STUDENT-002"

    payload = {
        "roll_no": roll_no,
        "full_name": "First Student",
        "class_id": class_id,
    }

    first_response = client.post(
        "/api/v1/students",
        json=payload,
    )

    assert first_response.status_code == 201

    second_response = client.post(
        "/api/v1/students",
        json={
            "roll_no": roll_no,
            "full_name": "Second Student",
            "class_id": class_id,
        },
    )

    assert second_response.status_code == 409


def test_unknown_class_is_rejected():
    response = client.post(
        "/api/v1/students",
        json={
            "roll_no": "TEST-STUDENT-003",
            "full_name": "Unknown Class Student",
            "class_id": 999999,
        },
    )

    assert response.status_code == 404
