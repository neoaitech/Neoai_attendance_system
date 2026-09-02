import pytest
from datetime import date, timedelta
from sqlalchemy.orm import Session

from backend.app.db.models import (
    User, Student, ClassCourse, AttendanceSession, AttendanceRecord
)
from backend.app.services.attendance_service import AttendanceService

def test_dynamic_database_attendance_calculation_multiple_students(db_session: Session):
    """
    Demonstrates that all attendance values are computed dynamically from actual
    database records without any hardcoding:
    
    Student A in Course A (2 sessions conducted):
      2 present, 0 absent, 0 extra lectures -> Total: 2, Present: 2, Absent: 0, Final: 100.0% -> ELIGIBLE
      
    Student B in Course B (17 sessions conducted):
      10 present, 7 absent, 3 approved extra lectures -> Total: 20, Present: 13, Absent: 7, Final: 65.0% -> DEFAULTER (<75%)
      
    Student C in Course C (12 sessions conducted):
      8 present, 4 absent, 4 approved extra lectures -> Total: 16, Present: 12, Absent: 4, Final: 75.0% -> ELIGIBLE (>=75%)
      
    Student D in Course D (0 sessions conducted):
      0 present, 0 absent, 0 extra lectures -> Total: 0, Present: 0, Absent: 0, Final: 0.0% -> ELIGIBLE
    """
    # 1. Faculty
    teacher = db_session.query(User).filter(User.email == "faculty_dyn_multi@visionattend.edu").first()
    if not teacher:
        teacher = User(
            username="faculty_dyn_multi",
            email="faculty_dyn_multi@visionattend.edu",
            full_name="Prof. Multi Dynamic",
            role="FACULTY",
            hashed_password="fakehashpassword123"
        )
        db_session.add(teacher)
        db_session.commit()
        db_session.refresh(teacher)

    today_str = date.today().isoformat()

    # 2. Distinct Courses
    course_a = ClassCourse(
        code=f"DYN-A-{today_str}",
        name="Dynamic Subject A",
        department="Computer Science",
        program="B.Tech",
        semester="Semester 1",
        section="A",
        teacher_id=teacher.id
    )
    course_b = ClassCourse(
        code=f"DYN-B-{today_str}",
        name="Dynamic Subject B",
        department="Computer Science",
        program="B.Tech",
        semester="Semester 3",
        section="B",
        teacher_id=teacher.id
    )
    course_c = ClassCourse(
        code=f"DYN-C-{today_str}",
        name="Dynamic Subject C",
        department="Computer Science",
        program="B.Tech",
        semester="Semester 5",
        section="C",
        teacher_id=teacher.id
    )
    course_d = ClassCourse(
        code=f"DYN-D-{today_str}",
        name="Dynamic Subject D",
        department="Computer Science",
        program="B.Tech",
        semester="Semester 7",
        section="D",
        teacher_id=teacher.id
    )
    course_workshop = ClassCourse(
        code=f"DYN-WS-{today_str}",
        name="Dynamic Workshop Outside Course",
        department="Information Technology",
        program="MCA",
        semester="Semester 1",
        section="A",
        teacher_id=teacher.id
    )
    db_session.add_all([course_a, course_b, course_c, course_d, course_workshop])
    db_session.commit()
    for c in [course_a, course_b, course_c, course_d, course_workshop]:
        db_session.refresh(c)

    # 3. Students
    stu_a = Student(
        roll_number=f"DYN-STU-A-{today_str}",
        full_name="Student Alpha",
        email=f"alpha_{today_str}@visionattend.edu",
        department="Computer Science",
        program="B.Tech",
        semester="Semester 1",
        section="A"
    )
    stu_b = Student(
        roll_number=f"DYN-STU-B-{today_str}",
        full_name="Student Beta",
        email=f"beta_{today_str}@visionattend.edu",
        department="Computer Science",
        program="B.Tech",
        semester="Semester 3",
        section="B"
    )
    stu_c = Student(
        roll_number=f"DYN-STU-C-{today_str}",
        full_name="Student Gamma",
        email=f"gamma_{today_str}@visionattend.edu",
        department="Computer Science",
        program="B.Tech",
        semester="Semester 5",
        section="C"
    )
    stu_d = Student(
        roll_number=f"DYN-STU-D-{today_str}",
        full_name="Student Delta",
        email=f"delta_{today_str}@visionattend.edu",
        department="Computer Science",
        program="B.Tech",
        semester="Semester 7",
        section="D"
    )
    db_session.add_all([stu_a, stu_b, stu_c, stu_d])
    db_session.commit()
    for s in [stu_a, stu_b, stu_c, stu_d]:
        db_session.refresh(s)

    course_a.students.append(stu_a)
    course_b.students.append(stu_b)
    course_c.students.append(stu_c)
    course_d.students.append(stu_d)
    db_session.commit()

    # --- POPULATE REAL DATABASE SESSIONS & ATTENDANCE RECORDS ---

    # Student A in Course A: 2 sessions (2 present)
    for i in range(1, 3):
        s = AttendanceSession(
            class_id=course_a.id,
            teacher_id=teacher.id,
            session_name=f"Course A Lecture {i}",
            session_date=date.today() - timedelta(days=30 - i),
            status="CONFIRMED"
        )
        db_session.add(s)
        db_session.flush()
        db_session.add(AttendanceRecord(
            session_id=s.id,
            student_id=stu_a.id,
            status="PRESENT",
            attendance_type="REGULAR",
            is_extra_lecture=False
        ))

    # Student B in Course B: 17 normal sessions (10 present, 7 absent)
    for i in range(1, 18):
        s = AttendanceSession(
            class_id=course_b.id,
            teacher_id=teacher.id,
            session_name=f"Course B Lecture {i}",
            session_date=date.today() - timedelta(days=25 - i),
            status="CONFIRMED"
        )
        db_session.add(s)
        db_session.flush()
        is_pres = (i <= 10)
        db_session.add(AttendanceRecord(
            session_id=s.id,
            student_id=stu_b.id,
            status="PRESENT" if is_pres else "ABSENT",
            attendance_type="REGULAR",
            is_extra_lecture=False
        ))

    # 3 approved extra lectures for Student B in course_workshop
    for i in range(1, 4):
        s = AttendanceSession(
            class_id=course_workshop.id,
            teacher_id=teacher.id,
            session_name=f"Workshop Session {i}",
            session_date=date.today() - timedelta(days=5 - i),
            status="CONFIRMED"
        )
        db_session.add(s)
        db_session.flush()
        db_session.add(AttendanceRecord(
            session_id=s.id,
            student_id=stu_b.id,
            status="PRESENT",
            attendance_type="EXTRA_LECTURE",
            verification_type="EXTRA_LECTURE",
            is_extra_lecture=True
        ))

    # Student C in Course C: 12 normal sessions (8 present, 4 absent)
    for i in range(1, 13):
        s = AttendanceSession(
            class_id=course_c.id,
            teacher_id=teacher.id,
            session_name=f"Course C Lecture {i}",
            session_date=date.today() - timedelta(days=20 - i),
            status="CONFIRMED"
        )
        db_session.add(s)
        db_session.flush()
        is_pres = (i <= 8)
        db_session.add(AttendanceRecord(
            session_id=s.id,
            student_id=stu_c.id,
            status="PRESENT" if is_pres else "ABSENT",
            attendance_type="REGULAR",
            is_extra_lecture=False
        ))

    # 4 approved extra lectures for Student C in course_workshop
    for i in range(1, 5):
        s = AttendanceSession(
            class_id=course_workshop.id,
            teacher_id=teacher.id,
            session_name=f"Advanced Lab Session {i}",
            session_date=date.today() - timedelta(days=6 - i),
            status="CONFIRMED"
        )
        db_session.add(s)
        db_session.flush()
        db_session.add(AttendanceRecord(
            session_id=s.id,
            student_id=stu_c.id,
            status="PRESENT",
            attendance_type="EXTRA_LECTURE",
            verification_type="EXTRA_LECTURE",
            is_extra_lecture=True
        ))

    db_session.commit()

    # --- VERIFY DYNAMIC SINGLE-SOURCE-OF-TRUTH SUMMARY ---

    # Student A Verification: 2 normal (2 P, 0 A), 0 extra -> Total: 2, Present: 2, Absent: 0 -> 100.0% -> ELIGIBLE
    sum_a = AttendanceService.get_student_attendance_summary(db_session, stu_a.id)
    assert sum_a["normal_sessions"] == 2
    assert sum_a["normal_present"] == 2
    assert sum_a["normal_absent"] == 0
    assert sum_a["normal_percentage"] == 100.0
    assert sum_a["extra_lectures"] == 0
    assert sum_a["total_sessions"] == 2
    assert sum_a["total_present"] == 2
    assert sum_a["total_absent"] == 0
    assert sum_a["final_percentage"] == 100.0
    assert sum_a["eligibility_status"] == "ELIGIBLE"

    # Student B Verification: 17 normal (10 P, 7 A), 3 extra -> 20 total, 13 P, 7 A -> 65.0% -> DEFAULTER
    sum_b = AttendanceService.get_student_attendance_summary(db_session, stu_b.id)
    assert sum_b["normal_sessions"] == 17
    assert sum_b["normal_present"] == 10
    assert sum_b["normal_absent"] == 7
    assert sum_b["normal_percentage"] == 58.82
    assert sum_b["extra_lectures"] == 3
    assert sum_b["total_sessions"] == 20
    assert sum_b["total_present"] == 13
    assert sum_b["total_absent"] == 7
    assert sum_b["final_percentage"] == 65.0
    assert sum_b["is_defaulter"] is True
    assert sum_b["eligibility_status"] == "DEFAULTER"

    # Student C Verification: 12 normal (8 P, 4 A), 4 extra -> 16 total, 12 P, 4 A -> 75.0% -> ELIGIBLE
    sum_c = AttendanceService.get_student_attendance_summary(db_session, stu_c.id)
    assert sum_c["normal_sessions"] == 12
    assert sum_c["normal_present"] == 8
    assert sum_c["normal_absent"] == 4
    assert sum_c["normal_percentage"] == 66.67
    assert sum_c["extra_lectures"] == 4
    assert sum_c["total_sessions"] == 16
    assert sum_c["total_present"] == 12
    assert sum_c["total_absent"] == 4
    assert sum_c["final_percentage"] == 75.0
    assert sum_c["is_defaulter"] is False
    assert sum_c["eligibility_status"] == "ELIGIBLE"

    # Student D Verification: 0 sessions
    sum_d = AttendanceService.get_student_attendance_summary(db_session, stu_d.id)
    assert sum_d["normal_sessions"] == 0
    assert sum_d["total_sessions"] == 0
    assert sum_d["final_percentage"] == 0.0
    assert sum_d["is_defaulter"] is False
