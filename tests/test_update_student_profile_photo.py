import io
import base64
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.db.models import Student, User, AuditLog
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

def test_update_student_profile_photo_file(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    db = SessionLocal()
    student = db.query(Student).filter(Student.roll_number == "CS2026-001").first() or db.query(Student).first()
    orig_photo = student.photo_url if student else None
    db.close()

    assert student is not None

    # Create dummy 100x100 PNG
    png_bytes = (
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4'
        b'\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
    )
    
    try:
        files = {"photo": ("new_avatar.png", io.BytesIO(png_bytes), "image/png")}
        response = client.post(f"/api/students/{student.id}/update-profile-photo", headers=headers, files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == student.id
        assert "photo_url" in data
        assert data["photo_url"].startswith("/uploads/students/")

        # Verify audit log recorded
        db = SessionLocal()
        audit = db.query(AuditLog).filter(
            AuditLog.action == "UPDATE_STUDENT_PROFILE_PHOTO",
            AuditLog.entity_id == student.id
        ).order_by(AuditLog.id.desc()).first()
        assert audit is not None
        assert "UPDATE_STUDENT_PROFILE_PHOTO" in audit.action
        db.close()
    finally:
        if orig_photo:
            db = SessionLocal()
            st = db.query(Student).filter(Student.id == student.id).first()
            if st:
                st.photo_url = orig_photo
                db.commit()
            db.close()

def test_update_student_profile_photo_base64_snapshot(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    db = SessionLocal()
    student = db.query(Student).filter(Student.roll_number == "CS2026-001").first() or db.query(Student).first()
    orig_photo = student.photo_url if student else None
    db.close()

    assert student is not None

    # Dummy base64 jpeg
    sample_b64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
    
    try:
        response = client.post(
            f"/api/students/{student.id}/update-profile-photo",
            headers=headers,
            data={"photo_base64": sample_b64}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == student.id
        assert data["photo_url"].startswith("/uploads/students/")
    finally:
        if orig_photo:
            db = SessionLocal()
            st = db.query(Student).filter(Student.id == student.id).first()
            if st:
                st.photo_url = orig_photo
                db.commit()
            db.close()

def test_update_student_profile_photo_invalid_format(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    db = SessionLocal()
    student = db.query(Student).first()
    db.close()

    assert student is not None

    files = {"photo": ("malicious.exe", io.BytesIO(b"fake binary"), "application/octet-stream")}
    response = client.post(f"/api/students/{student.id}/update-profile-photo", headers=headers, files=files)
    assert response.status_code == 400
    assert "Invalid image format" in response.json()["detail"]
