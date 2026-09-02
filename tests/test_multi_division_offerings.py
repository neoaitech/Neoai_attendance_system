import pytest
from datetime import date
from sqlalchemy.orm import Session

from backend.app.db.models import ClassCourse, Student, User, AttendanceSession, AttendanceRecord

def test_multi_division_course_offering_creation(client, admin_token, db_session: Session):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Setup sample students for Division A and Division B
    s_a = Student(
        roll_number="DIVA-001",
        full_name="Aarav DivA",
        email="aarav.diva@test.edu",
        department="Computer Science & Engineering",
        program="B.Tech",
        semester="Semester 7",
        section="A",
        academic_year="2026-27",
        is_active=True
    )
    s_b = Student(
        roll_number="DIVB-001",
        full_name="Bhavya DivB",
        email="bhavya.divb@test.edu",
        department="Computer Science & Engineering",
        program="B.Tech",
        semester="Semester 7",
        section="B",
        academic_year="2026-27",
        is_active=True
    )
    db_session.add_all([s_a, s_b])
    db_session.commit()
    db_session.refresh(s_a)
    db_session.refresh(s_b)

    teacher = db_session.query(User).filter(User.role == "teacher").first()

    # 2. Create multi-division course offering for 520 - MongoDB with Divisions A & B
    payload = {
        "code": "520-MULTIDIV",
        "name": "MongoDB Multi-Division",
        "subject_name": "MongoDB Advanced Systems",
        "department": "Computer Science & Engineering",
        "program": "B.Tech",
        "semester": "Semester 7",
        "sections": ["A", "B"],
        "academic_year": "2026-27",
        "credits": 4,
        "teacher_id": teacher.id if teacher else None,
        "division_student_map": {
            "A": [s_a.id],
            "B": [s_b.id]
        },
        "faculty_scope_map": {
            "All": [teacher.id] if teacher else [],
            "A": [],
            "B": []
        }
    }

    res = client.post("/api/classes", json=payload, headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert "sections" in data
    assert "A" in data["sections"]
    assert "B" in data["sections"]

    # 3. Verify in DB that two ClassCourse offerings exist, with isolated rosters
    class_a = db_session.query(ClassCourse).filter(
        ClassCourse.code == "520-MULTIDIV",
        ClassCourse.section == "A"
    ).first()
    class_b = db_session.query(ClassCourse).filter(
        ClassCourse.code == "520-MULTIDIV",
        ClassCourse.section == "B"
    ).first()

    assert class_a is not None
    assert class_b is not None
    assert len(class_a.students) == 1
    assert class_a.students[0].roll_number == "DIVA-001"
    assert len(class_b.students) == 1
    assert class_b.students[0].roll_number == "DIVB-001"

    # 4. Verify duplicate prevention
    dup_res = client.post("/api/classes", json=payload, headers=headers)
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"]

    # Cleanup
    db_session.delete(class_a)
    db_session.delete(class_b)
    db_session.delete(s_a)
    db_session.delete(s_b)
    db_session.commit()
