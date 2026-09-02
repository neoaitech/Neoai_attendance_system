import pytest
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session

from backend.app.db.models import (
    User, Student, ClassCourse, AttendanceSession, AttendanceRecord
)
from backend.app.services.attendance_service import AttendanceService
from backend.app.services.report_service import ReportService

def test_pooja_extra_lecture_final_calculation_and_eligibility(db_session: Session):
    """
    Validates User's Exact Requirement:
    Student: Pooja
    Normal Sessions: 6
    Normal Present: 4
    Normal Absent: 2
    Extra Lectures: 3
    
    Expected Calculations:
    Normal % = 66.67% (Defaulter if unassisted)
    Total Sessions = 6 + 3 = 9
    Total Present = 4 + 3 = 7
    Total Absent = 9 - 7 = 2
    Final Attendance % = (7 / 9) * 100 = 77.78%
    Status at 75% threshold = ELIGIBLE.
    """
    # 1. Setup Faculty
    teacher = db_session.query(User).filter(User.email == "faculty_pooja@visionattend.edu").first()
    if not teacher:
        teacher = User(
            username="faculty_pooja",
            email="faculty_pooja@visionattend.edu",
            full_name="Prof. Sharma",
            role="FACULTY",
            hashed_password="fakehashpassword123"
        )
        db_session.add(teacher)
        db_session.commit()
        db_session.refresh(teacher)

    # 2. Setup Pooja's Regular Course (MCA Python Course)
    course_mca = db_session.query(ClassCourse).filter(ClassCourse.code == "MCA-PY-101").first()
    if not course_mca:
        course_mca = ClassCourse(
            code="MCA-PY-101",
            name="Python Advanced Concepts",
            department="Computer Applications",
            program="MCA",
            semester="Semester 1",
            section="A",
            teacher_id=teacher.id
        )
        db_session.add(course_mca)

    # Setup an Outside Course (BCA Web Course) where Pooja attends extra lectures
    course_bca = db_session.query(ClassCourse).filter(ClassCourse.code == "BCA-JS-301").first()
    if not course_bca:
        course_bca = ClassCourse(
            code="BCA-JS-301",
            name="Full-Stack JavaScript",
            department="Computer Applications",
            program="BCA",
            semester="Semester 3",
            section="B",
            teacher_id=teacher.id
        )
        db_session.add(course_bca)

    db_session.commit()
    db_session.refresh(course_mca)
    db_session.refresh(course_bca)

    # 3. Setup Student: Pooja
    pooja = db_session.query(Student).filter(Student.roll_number == "MCA26-POOJA").first()
    if not pooja:
        pooja = Student(
            roll_number="MCA26-POOJA",
            full_name="Pooja Sharma",
            email="pooja.sharma@visionattend.edu",
            department="Computer Applications",
            program="MCA",
            semester="Semester 1",
            section="A"
        )
        db_session.add(pooja)
        db_session.commit()
        db_session.refresh(pooja)

    if pooja not in course_mca.students:
        course_mca.students.append(pooja)
        db_session.commit()

    # 4. Create 6 Normal Sessions for MCA-PY-101
    # Pooja attended 4 (Present), missed 2 (Absent)
    for i in range(1, 7):
        sess = AttendanceSession(
            class_id=course_mca.id,
            teacher_id=teacher.id,
            session_name=f"Python Lecture {i}",
            session_date=date.today() - timedelta(days=20 - i),
            start_time="09:00 AM",
            total_detected=1,
            total_recognized=1,
            total_unknown=0,
            status="CONFIRMED"
        )
        db_session.add(sess)
        db_session.flush()

        is_present = (i <= 4)  # First 4 present, last 2 absent
        rec = AttendanceRecord(
            session_id=sess.id,
            student_id=pooja.id,
            status="PRESENT" if is_present else "ABSENT",
            confidence_score=97.5 if is_present else 0.0,
            verification_type="AUTO_AI" if is_present else "AUTO_ABSENT",
            attendance_type="REGULAR",
            is_extra_lecture=False
        )
        db_session.add(rec)

    # 5. Create 3 Outside Sessions (BCA Web Course) where Pooja is approved as EXTRA LECTURE
    for j in range(1, 4):
        extra_sess = AttendanceSession(
            class_id=course_bca.id,
            teacher_id=teacher.id,
            session_name=f"Web Architecture Workshop {j}",
            session_date=date.today() - timedelta(days=10 - j),
            start_time="02:00 PM",
            total_detected=1,
            total_recognized=0,
            total_unknown=0,
            extra_candidates=[
                {
                    "student_id": pooja.id,
                    "student_name": pooja.full_name,
                    "roll_number": pooja.roll_number,
                    "department": pooja.department,
                    "program": pooja.program,
                    "semester": pooja.semester,
                    "division": pooja.section,
                    "confidence": 98.0,
                    "is_approved": False,
                    "status": "CANDIDATE"
                }
            ]
        )
        db_session.add(extra_sess)
        db_session.flush()

        # Approve Extra Lecture Attendance
        AttendanceService.approve_extra_lecture_attendance(
            db=db_session,
            session_id=extra_sess.id,
            student_id=pooja.id
        )

    db_session.commit()

    # 6. VERIFY STUDENT DETAILED REPORT
    pooja_report = ReportService.get_student_detailed_report(
        db=db_session,
        student_id=pooja.id
    )

    assert pooja_report["normal_sessions"] == 6
    assert pooja_report["normal_present"] == 4
    assert pooja_report["normal_absent"] == 2
    assert pooja_report["normal_percentage"] == 66.67
    assert pooja_report["extra_lecture_count"] == 3
    assert pooja_report["total_sessions"] == 9
    assert pooja_report["total_present"] == 7
    assert pooja_report["total_absent"] == 2
    assert pooja_report["final_percentage"] == 77.78
    assert pooja_report["is_defaulter"] is False
    assert pooja_report["eligibility_status"] == "ELIGIBLE"

    # 7. VERIFY ADVANCED REPORT MATRIX FOR MCA SEMESTER 1 DIVISION A
    adv_data = ReportService.get_advanced_report_data(
        db=db_session,
        department="Computer Applications",
        programs=["MCA"],
        semesters=["Semester 1"],
        divisions=["A"]
    )

    batch_mca = next(b for b in adv_data["batches"] if b["program"] == "MCA" and b["semester"] == "Semester 1" and b["division"] == "A")
    pooja_summary = next(s for s in batch_mca["students"] if s["student_id"] == pooja.id)

    assert pooja_summary["normal_sessions"] == 6
    assert pooja_summary["normal_present"] == 4
    assert pooja_summary["normal_absent"] == 2
    assert pooja_summary["normal_percentage"] == 66.67
    assert pooja_summary["extra_lectures"] == 3
    assert pooja_summary["total_sessions"] == 9
    assert pooja_summary["total_present"] == 7
    assert pooja_summary["total_absent"] == 2
    assert pooja_summary["final_percentage"] == 77.78
    assert pooja_summary["attendance_percentage"] == 77.78
    assert pooja_summary["is_defaulter"] is False
    assert pooja_summary["eligibility_status"] == "ELIGIBLE"

    # 8. VERIFY EXCEL & PDF EXPORT GENERATION
    excel_path = ReportService.export_advanced_excel(
        db=db_session,
        department="Computer Applications"
    )
    assert excel_path is not None

    pdf_path = ReportService.export_student_pdf(
        db=db_session,
        student_id=pooja.id
    )
    assert pdf_path is not None
