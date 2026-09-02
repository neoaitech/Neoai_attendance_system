import pytest
import io
import json
from datetime import datetime, date
from PIL import Image

from backend.app.db.models import (
    User, Student, ClassCourse, CourseMaster, AttendanceSession, AttendanceRecord
)
from backend.app.core.security import get_password_hash

def create_dummy_jpeg():
    img = Image.new("RGB", (112, 112), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf

def test_academic_metadata_endpoint(client, db_session):
    resp = client.get("/api/academic/metadata")
    assert resp.status_code == 200
    data = resp.json()
    assert "departments" in data
    assert "programs" in data
    assert "semesters" in data
    assert "divisions" in data
    assert "academic_years" in data
    assert "B.Tech" in data["programs"]
    assert "MCA" in data["programs"]

def test_course_master_creation_and_listing(client, admin_token, db_session):
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "code": "TEST-CS-999",
        "title": "Distributed Systems & Cloud Computing",
        "subject_name": "Distributed Systems",
        "credits": 4,
        "description": "Master curriculum for Distributed Systems",
        "department": "Computer Science & Engineering",
        "status": "Active"
    }
    resp = client.post("/api/academic/courses", json=payload, headers=headers)
    assert resp.status_code == 200
    created = resp.json()
    assert created["code"] == "TEST-CS-999"

    # List courses
    resp_list = client.get("/api/academic/courses")
    assert resp_list.status_code == 200
    codes = [c["code"] for c in resp_list.json()]
    assert "TEST-CS-999" in codes

def test_student_registration_photo_count_validation(client, teacher_token, db_session):
    headers = {"Authorization": f"Bearer {teacher_token}"}

    # 1. Test Reject with only 2 photos (< 3 min)
    files_2 = [
        ("photos", ("photo1.jpg", create_dummy_jpeg(), "image/jpeg")),
        ("photos", ("photo2.jpg", create_dummy_jpeg(), "image/jpeg"))
    ]
    data_2 = {
        "full_name": "Invalid Low Photo Student",
        "roll_number": "TEST-LOW-001",
        "email": "lowphoto@univ.edu",
        "department": "Computer Science",
        "program": "B.Tech",
        "semester": "Semester 7",
        "section": "A"
    }
    resp_2 = client.post("/api/students/register-with-photo", data=data_2, files=files_2, headers=headers)
    assert resp_2.status_code == 400
    assert "At least 3 face photos are required" in resp_2.json()["detail"]

    # 2. Test Reject with 9 photos (> 8 max)
    files_9 = [
        ("photos", (f"photo{i}.jpg", create_dummy_jpeg(), "image/jpeg")) for i in range(1, 10)
    ]
    data_9 = {
        "full_name": "Invalid High Photo Student",
        "roll_number": "TEST-HIGH-001",
        "email": "highphoto@univ.edu",
        "department": "Computer Science",
        "program": "B.Tech",
        "semester": "Semester 7",
        "section": "A"
    }
    resp_9 = client.post("/api/students/register-with-photo", data=data_9, files=files_9, headers=headers)
    assert resp_9.status_code == 400
    assert "Maximum 8 face photos allowed" in resp_9.json()["detail"]

    # 3. Test Accept with valid 4 photos (between 3 and 8)
    files_4 = [
        ("photos", (f"valid{i}.jpg", create_dummy_jpeg(), "image/jpeg")) for i in range(1, 5)
    ]
    data_4 = {
        "full_name": "Valid Biometric Student",
        "roll_number": "TEST-VALID-004",
        "email": "valid4@univ.edu",
        "mobile_number": "+91 9876543210",
        "dob": "2003-05-15",
        "gender": "Female",
        "status": "Active",
        "department": "Other",
        "other_department": "Robotics & Automation",
        "program": "Other",
        "other_program": "B.Tech Dual Degree",
        "semester": "Semester 7",
        "section": "B",
        "academic_year": "2026-27",
        "admission_year": "2023",
        "batch": "2023-2027"
    }
    resp_4 = client.post("/api/students/register-with-photo", data=data_4, files=files_4, headers=headers)
    assert resp_4.status_code == 200
    saved = resp_4.json()
    assert saved["roll_number"] == "TEST-VALID-004"
    assert saved["department"] == "Robotics & Automation"
    assert saved["program"] == "B.Tech Dual Degree"
    assert saved["photos_count"] == 4

def test_multi_faculty_assignments_and_my_teaching(client, admin_token, db_session):
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create two faculty users
    fac1 = User(
        username="prof_patil_unique",
        email="patil.unique@univ.edu",
        hashed_password=get_password_hash("password123"),
        full_name="Prof. Amit Patil",
        role="teacher",
        is_active=True
    )
    fac2 = User(
        username="dr_sharma_unique",
        email="sharma.unique@univ.edu",
        hashed_password=get_password_hash("password123"),
        full_name="Dr. Rajesh Sharma",
        role="teacher",
        is_active=True
    )
    db_session.add_all([fac1, fac2])
    db_session.commit()

    # Admin creates course offering with both assigned
    offering_payload = {
        "code": "ADV-AI-701",
        "name": "Advanced AI & Deep Learning",
        "subject_name": "Advanced AI",
        "department": "Computer Science",
        "program": "B.Tech",
        "semester": "Semester 7",
        "section": "A",
        "academic_year": "2026-27",
        "faculty_ids": [fac1.id, fac2.id],
        "auto_enroll": False
    }
    resp = client.post("/api/classes", json=offering_payload, headers=admin_headers)
    assert resp.status_code == 200
    created_class = resp.json()
    assert len(created_class["teachers"]) == 2

    # Login as Prof. Patil
    login_patil = client.post("/api/auth/login-json", json={"username": "prof_patil_unique", "password": "password123"})
    token_patil = login_patil.json()["access_token"]
    headers_patil = {"Authorization": f"Bearer {token_patil}"}

    # Get my-teaching classes for Prof. Patil
    resp_my = client.get("/api/classes/my-teaching", headers=headers_patil)
    assert resp_my.status_code == 200
    my_codes = [c["code"] for c in resp_my.json()]
    assert "ADV-AI-701" in my_codes

def test_inactive_faculty_login_rejection(client, db_session):
    # Inactive faculty
    inactive_user = User(
        username="inactive_faculty_user",
        email="inactive.faculty@univ.edu",
        hashed_password=get_password_hash("password123"),
        full_name="Inactive Faculty",
        role="teacher",
        is_active=False
    )
    db_session.add(inactive_user)
    db_session.commit()

    # Attempt login
    resp = client.post("/api/auth/login-json", json={"username": "inactive_faculty_user", "password": "password123"})
    assert resp.status_code == 400
    assert "Inactive" in resp.json()["detail"] or "invalid" in resp.json()["detail"].lower()
