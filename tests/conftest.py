import os
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.core.config import settings
from backend.app.db.session import Base, get_db
from backend.app.main import app
from backend.app.core.security import get_password_hash, create_access_token
from backend.app.db.models import User, ClassCourse, Student

# Test Database Engine
TEST_DB_PATH = settings.BASE_DIR / "test_attendance.db"
TEST_DATABASE_URL = f"sqlite:///{TEST_DB_PATH}"

test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    if TEST_DB_PATH.exists():
        try:
            os.remove(TEST_DB_PATH)
        except Exception:
            pass

@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def admin_user(db_session):
    user = db_session.query(User).filter(User.username == "test_admin").first()
    if not user:
        user = User(
            username="test_admin",
            email="admin_test@test.com",
            hashed_password=get_password_hash("adminpass"),
            full_name="Test Admin",
            role="admin",
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
    return user

@pytest.fixture
def teacher_user(db_session):
    user = db_session.query(User).filter(User.username == "test_teacher").first()
    if not user:
        user = User(
            username="test_teacher",
            email="teacher_test@test.com",
            hashed_password=get_password_hash("teacherpass"),
            full_name="Test Teacher",
            role="teacher",
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
    return user

@pytest.fixture
def admin_token(admin_user):
    return create_access_token(subject=admin_user.username, role=admin_user.role)

@pytest.fixture
def teacher_token(teacher_user):
    return create_access_token(subject=teacher_user.username, role=teacher_user.role)

@pytest.fixture
def sample_class(db_session, teacher_user):
    course = db_session.query(ClassCourse).filter(ClassCourse.code == "TEST-101").first()
    if not course:
        course = ClassCourse(
            code="TEST-101",
            name="Testing Algorithms",
            department="Computer Science",
            semester="Fall 2026",
            section="A",
            teacher_id=teacher_user.id
        )
        db_session.add(course)
        db_session.commit()
        db_session.refresh(course)
    return course

@pytest.fixture
def sample_students(db_session, sample_class):
    students = []
    for i in range(1, 4):
        roll = f"TEST-00{i}"
        s = db_session.query(Student).filter(Student.roll_number == roll).first()
        if not s:
            s = Student(
                roll_number=roll,
                full_name=f"Test Student {i}",
                email=f"student{i}@test.com",
                department="Computer Science",
                year=3,
                section="A",
                is_active=True
            )
            # Add synthetic 512-d ArcFace embedding
            import numpy as np
            np.random.seed(42 + i)
            vec = np.random.randn(512)
            vec = (vec / np.linalg.norm(vec)).tolist()
            s.face_embedding = vec
            db_session.add(s)
            db_session.flush()
            sample_class.students.append(s)
        students.append(s)
    db_session.commit()
    return students
