import io
import pytest
from PIL import Image
from sqlalchemy.orm import Session

from backend.app.db.models import ClassCourse, Student, User, AttendanceSession, AttendanceRecord

def create_dummy_jpeg():
    img = Image.new("RGB", (112, 112), color=(120, 180, 240))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf

def test_custom_other_course_attendance_session(client, admin_token, db_session: Session):
    headers = {"Authorization": f"Bearer {admin_token}"}

    img_buf = create_dummy_jpeg()
    files = [("photos", ("test_classroom.jpg", img_buf, "image/jpeg"))]

    data = {
        "class_id": "OTHER",
        "custom_code": "AI-SPECIAL-99",
        "custom_name": "Advanced Computer Vision & Generative AI Workshop",
        "department": "Biotechnology & Computational Sciences",
        "program": "B.Tech",
        "semester": "Semester 7",
        "section": "A",
        "session_name": "Advanced Computer Vision Workshop",
        "tolerance": "0.50"
    }

    res = client.post("/api/sessions/create-and-process", data=data, files=files, headers=headers)
    assert res.status_code == 200, res.text
    session_data = res.json()

    assert "id" in session_data
    assert session_data["session_name"] == "Advanced Computer Vision Workshop"

    # Verify session in database
    session_id = session_data["id"]
    db_session_obj = db_session.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    assert db_session_obj is not None
    assert db_session_obj.course is not None
    assert db_session_obj.course.code == "AI-SPECIAL-99"
    assert db_session_obj.course.status == "AdHoc"

    # Verify no fake students fabricated
    assert len(db_session_obj.course.students) == 0

    # Cleanup
    db_session.delete(db_session_obj)
    db_session.commit()
