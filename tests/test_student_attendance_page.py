import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.session import get_db, SessionLocal
from backend.app.db.models import Student, User, AttendanceSession, AttendanceRecord, ClassCourse
from backend.app.core.security import create_access_token

client = TestClient(app)

@pytest.fixture
def admin_token():
    db = SessionLocal()
    admin = db.query(User).filter(User.username == "admin").first()
    db.close()
    if not admin:
        pytest.skip("Admin user not found in database")
    return create_access_token(subject=admin.username, role=admin.role)

def test_student_attendance_profile_detailed_endpoint(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 1. Find Pooja Choudhary or first student in DB
    db = SessionLocal()
    student = db.query(Student).filter(Student.full_name.like("%Pooja%")).first()
    if not student:
        student = db.query(Student).first()
    db.close()

    assert student is not None, "At least one student must exist in the database"

    # 2. Query Student Detailed Report Endpoint
    response = client.get(f"/api/reports/student/{student.id}", headers=headers)
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"
    
    data = response.json()
    
    # 3. Verify Required Identity Fields
    assert data["student_id"] == student.id
    assert data["full_name"] == student.full_name
    assert data["roll_number"] == student.roll_number
    assert "program" in data
    assert "semester" in data
    assert "division" in data
    assert "department" in data
    assert "academic_year" in data
    assert "biometric_status" in data
    
    # 4. Verify 3-Tier Attendance KPIs
    assert "normal_sessions" in data
    assert "normal_present" in data
    assert "normal_absent" in data
    assert "normal_percentage" in data
    
    assert "extra_lecture_count" in data
    assert "extra_lectures" in data
    assert isinstance(data["extra_lectures"], list)
    
    assert "total_sessions" in data
    assert "total_present" in data
    assert "total_absent" in data
    assert "final_percentage" in data
    assert "is_defaulter" in data
    assert "eligibility_status" in data
    
    # Verify exact combined logic: Total Sessions = Normal Sessions + Extra Sessions
    assert data["total_sessions"] == data["normal_sessions"] + data["extra_lecture_count"]
    assert data["total_present"] == data["normal_present"] + data["extra_lecture_count"]
    assert data["total_absent"] == max(0, data["total_sessions"] - data["total_present"])
    
    # 5. Verify Timeline History & Actual Timestamps
    assert "lecture_history" in data
    assert isinstance(data["lecture_history"], list)
    if len(data["lecture_history"]) > 0:
        first_event = data["lecture_history"][0]
        assert "date" in first_event
        assert "time" in first_event
        assert "actual_time" in first_event
        assert "course_code" in first_event
        assert "status" in first_event
        assert "attendance_type" in first_event

def test_student_attendance_pdf_export_consistency(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    db = SessionLocal()
    student = db.query(Student).filter(Student.full_name.like("%Pooja%")).first()
    if not student:
        student = db.query(Student).first()
    db.close()

    assert student is not None

    # Test PDF generation endpoint
    response = client.get(f"/api/reports/student/{student.id}/export/pdf", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 1000  # Non-empty valid PDF binary
