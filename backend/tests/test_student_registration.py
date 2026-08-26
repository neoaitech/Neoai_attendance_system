from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.db import get_db
from app.main import app
from app.models.base import Base
from app.models.class_model import Class
from app.models.student_model import Student

TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(bind=TEST_ENGINE, autoflush=False, autocommit=False)
Base.metadata.create_all(TEST_ENGINE)

def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def seed_class():
    db = TestSessionLocal()
    cls = Class(class_name="BCA Test Class", subject="DBMS")
    db.add(cls)
    db.commit()
    db.refresh(cls)
    class_id = cls.class_id
    db.close()
    return class_id

def test_student_registration_inserts_record():
    class_id = seed_class()
    response = client.post(
        "/api/v1/students",
        json={
            "roll_no": "STU-001",
            "full_name": "Test Student",
            "class_id": class_id,
            "email": "student@example.com",
            "is_active": True,
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["roll_no"] == "STU-001"
    assert body["full_name"] == "Test Student"

    db = TestSessionLocal()
    saved = db.query(Student).filter(Student.roll_no == "STU-001").first()
    db.close()
    assert saved is not None
    assert saved.class_id == class_id

def test_duplicate_roll_no_is_rejected():
    class_id = seed_class()
    payload = {
        "roll_no": "STU-002",
        "full_name": "First Student",
        "class_id": class_id,
    }
    assert client.post("/api/v1/students", json=payload).status_code == 201
    duplicate = client.post(
        "/api/v1/students",
        json={**payload, "full_name": "Second Student"},
    )
    assert duplicate.status_code == 409

def test_unknown_class_is_rejected():
    response = client.post(
        "/api/v1/students",
        json={
            "roll_no": "STU-003",
            "full_name": "No Class Student",
            "class_id": 99999,
        },
    )
    assert response.status_code == 404
