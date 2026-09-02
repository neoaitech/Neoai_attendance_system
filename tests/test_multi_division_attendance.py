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

def test_multi_division_attendance_roster_aggregation_and_isolation(client, admin_token, db_session: Session):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create Course Offerings for Division A, B, and C
    offering_a = ClassCourse(
        code="CS-MULTIDIV-101",
        name="Distributed Systems Architecture",
        subject_name="Distributed Systems Architecture",
        department="Computer Science & Engineering",
        program="B.Tech",
        semester="Semester 7",
        section="A",
        academic_year="2026-27",
        status="Active",
        credits=4
    )
    offering_b = ClassCourse(
        code="CS-MULTIDIV-101",
        name="Distributed Systems Architecture",
        subject_name="Distributed Systems Architecture",
        department="Computer Science & Engineering",
        program="B.Tech",
        semester="Semester 7",
        section="B",
        academic_year="2026-27",
        status="Active",
        credits=4
    )
    offering_c = ClassCourse(
        code="CS-MULTIDIV-101",
        name="Distributed Systems Architecture",
        subject_name="Distributed Systems Architecture",
        department="Computer Science & Engineering",
        program="B.Tech",
        semester="Semester 7",
        section="C",
        academic_year="2026-27",
        status="Active",
        credits=4
    )
    db_session.add_all([offering_a, offering_b, offering_c])
    db_session.commit()
    db_session.refresh(offering_a)
    db_session.refresh(offering_b)
    db_session.refresh(offering_c)

    # 2. Create Students in Div A, B, and C
    student_a = Student(
        full_name="Div A Student",
        roll_number="CSE-2026-DIVA",
        email="diva@university.edu",
        department="Computer Science & Engineering",
        program="B.Tech",
        semester="Semester 7",
        section="A",
        academic_year="2026-27",
        status="Active",
        is_active=True
    )
    student_b = Student(
        full_name="Div B Student",
        roll_number="CSE-2026-DIVB",
        email="divb@university.edu",
        department="Computer Science & Engineering",
        program="B.Tech",
        semester="Semester 7",
        section="B",
        academic_year="2026-27",
        status="Active",
        is_active=True
    )
    student_c = Student(
        full_name="Div C Student",
        roll_number="CSE-2026-DIVC",
        email="divc@university.edu",
        department="Computer Science & Engineering",
        program="B.Tech",
        semester="Semester 7",
        section="C",
        academic_year="2026-27",
        status="Active",
        is_active=True
    )
    db_session.add_all([student_a, student_b, student_c])
    db_session.commit()
    db_session.refresh(student_a)
    db_session.refresh(student_b)
    db_session.refresh(student_c)

    # Enroll students in their respective offerings
    offering_a.students.append(student_a)
    offering_b.students.append(student_b)
    offering_c.students.append(student_c)
    db_session.commit()

    # 3. Trigger Attendance Session for Division A + Division B ONLY
    img_buf = create_dummy_jpeg()
    files = [("photos", ("classroom_angle1.jpg", img_buf, "image/jpeg"))]

    data = {
        "class_id": str(offering_a.id),
        "class_ids": f"{offering_a.id},{offering_b.id}",
        "session_name": "Distributed Systems - Raft Consensus Multi-Div",
        "department": "Computer Science & Engineering",
        "program": "B.Tech",
        "semester": "Semester 7",
        "section": "A, B",
        "tolerance": "0.50"
    }

    res = client.post("/api/sessions/create-and-process", data=data, files=files, headers=headers)
    assert res.status_code == 200, res.text
    session_data = res.json()

    assert "id" in session_data
    assert "records" in session_data
    records = session_data["records"]

    # 4. Verify Roster Isolation
    evaluated_student_ids = {r["student_id"] for r in records}
    assert student_a.id in evaluated_student_ids, "Student A must be in roster"
    assert student_b.id in evaluated_student_ids, "Student B must be in roster"
    assert student_c.id not in evaluated_student_ids, "CRITICAL: Student C must NOT be evaluated or marked absent!"

    # Verify sections present in records
    sections_in_records = {r["section"] for r in records}
    assert "A" in sections_in_records
    assert "B" in sections_in_records
    assert "C" not in sections_in_records

    # Cleanup
    session_id = session_data["id"]
    db_session_obj = db_session.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if db_session_obj:
        db_session.delete(db_session_obj)
    db_session.delete(student_a)
    db_session.delete(student_b)
    db_session.delete(student_c)
    db_session.delete(offering_a)
    db_session.delete(offering_b)
    db_session.delete(offering_c)
    db_session.commit()
