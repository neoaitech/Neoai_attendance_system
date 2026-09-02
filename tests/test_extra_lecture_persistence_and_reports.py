import pytest
from datetime import date, datetime
from sqlalchemy.orm import Session

from backend.app.db.models import (
    User, Student, ClassCourse, AttendanceSession, AttendanceRecord
)
from backend.app.services.attendance_service import AttendanceService
from backend.app.services.report_service import ReportService

def test_extra_lecture_end_to_end_persistence_and_reports(db_session: Session):
    # 1. Setup Faculty
    teacher = db_session.query(User).filter(User.email == "faculty_extra@visionattend.edu").first()
    if not teacher:
        teacher = User(
            username="faculty_extra",
            email="faculty_extra@visionattend.edu",
            full_name="Prof. Ramanujam",
            role="FACULTY",
            hashed_password="fakehashpassword123"
        )
        db_session.add(teacher)
        db_session.commit()
        db_session.refresh(teacher)

    # 2. Setup Courses
    course_mca = db_session.query(ClassCourse).filter(ClassCourse.code == "MCA-DB-101").first()
    if not course_mca:
        course_mca = ClassCourse(
            code="MCA-DB-101",
            name="Advanced MongoDB Architecture",
            department="Computer Applications",
            program="MCA",
            semester="Semester 1",
            section="A",
            teacher_id=teacher.id
        )
        db_session.add(course_mca)

    course_bca = db_session.query(ClassCourse).filter(ClassCourse.code == "BCA-WD-201").first()
    if not course_bca:
        course_bca = ClassCourse(
            code="BCA-WD-201",
            name="Full-Stack Web Engineering",
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

    # 3. Setup Students
    student_mca = db_session.query(Student).filter(Student.roll_number == "MCA26-001").first()
    if not student_mca:
        student_mca = Student(
            roll_number="MCA26-001",
            full_name="Aarav Sharma",
            email="aarav.sharma@visionattend.edu",
            department="Computer Applications",
            program="MCA",
            semester="Semester 1",
            section="A"
        )
        db_session.add(student_mca)

    student_bca = db_session.query(Student).filter(Student.roll_number == "BCA26-009").first()
    if not student_bca:
        student_bca = Student(
            roll_number="BCA26-009",
            full_name="Priya Patel",
            email="priya.patel@visionattend.edu",
            department="Computer Applications",
            program="BCA",
            semester="Semester 3",
            section="B"
        )
        db_session.add(student_bca)

    db_session.commit()
    db_session.refresh(student_mca)
    db_session.refresh(student_bca)

    # Enroll in respective courses
    if student_mca not in course_mca.students:
        course_mca.students.append(student_mca)
    if student_bca not in course_bca.students:
        course_bca.students.append(student_bca)
    db_session.commit()

    # 4. Create an MCA-A Attendance Session with Priya (BCA) as an Extra Candidate
    extra_cands = [
        {
            "student_id": student_bca.id,
            "student_name": student_bca.full_name,
            "roll_number": student_bca.roll_number,
            "department": student_bca.department,
            "program": student_bca.program,
            "semester": student_bca.semester,
            "division": student_bca.section,
            "confidence": 96.5,
            "is_approved": False,
            "status": "CANDIDATE"
        }
    ]

    session = AttendanceSession(
        class_id=course_mca.id,
        session_name="MongoDB Replica Set Clustering",
        session_date=date.today(),
        start_time="10:00 AM",
        total_detected=2,
        total_recognized=1,
        total_unknown=0,
        extra_candidates=extra_cands
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    # Regular attendance record for Aarav (MCA-A)
    rec_aarav = AttendanceRecord(
        session_id=session.id,
        student_id=student_mca.id,
        status="PRESENT",
        confidence_score=98.2,
        verification_type="AUTO_AI",
        attendance_type="REGULAR",
        is_extra_lecture=False
    )
    db_session.add(rec_aarav)
    db_session.commit()

    # 5. Approve Extra Lecture for Priya (BCA)
    rec = AttendanceService.approve_extra_lecture_attendance(
        db=db_session,
        session_id=session.id,
        student_id=student_bca.id
    )

    assert rec is not None
    assert rec.status == "PRESENT"
    assert rec.attendance_type == "EXTRA_LECTURE"
    assert rec.is_extra_lecture is True

    # 6. Verify in Database
    bca_rec = db_session.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.id,
        AttendanceRecord.student_id == student_bca.id
    ).first()

    assert bca_rec is not None
    assert bca_rec.status == "PRESENT"
    assert bca_rec.attendance_type == "EXTRA_LECTURE"
    assert bca_rec.is_extra_lecture is True

    # Check that session extra_candidates updated
    db_session.refresh(session)
    cands_updated = session.extra_candidates
    assert len(cands_updated) == 1
    assert cands_updated[0]["is_approved"] is True
    assert cands_updated[0]["status"] == "APPROVED"

    # 7. Check Student Profile & Detailed Report for Priya (BCA)
    st_report = ReportService.get_student_detailed_report(
        db=db_session,
        student_id=student_bca.id
    )

    assert st_report is not None
    assert st_report["extra_lecture_count"] == 1
    assert st_report["total_recorded_attendance"] >= 1
    assert len(st_report["extra_lectures"]) == 1
    assert st_report["extra_lectures"][0]["course_code"] == "MCA-DB-101"
    assert st_report["extra_lectures"][0]["attendance_type"] == "EXTRA_LECTURE"

    # 8. Check Advanced Report Data
    adv_report = ReportService.get_advanced_report_data(
        db=db_session,
        department="Computer Applications"
    )

    assert adv_report is not None
    assert adv_report["total_extra_lectures_conducted"] >= 1

    # 9. Test Excel & PDF Export Execution
    excel_path = ReportService.export_advanced_excel(
        db=db_session,
        department="Computer Applications"
    )
    assert excel_path is not None

    pdf_path = ReportService.export_advanced_pdf(
        db=db_session,
        department="Computer Applications"
    )
    assert pdf_path is not None

    student_pdf_path = ReportService.export_student_pdf(
        db=db_session,
        student_id=student_bca.id
    )
    assert student_pdf_path is not None

    # 10. Test Ignore Extra Lecture
    ign_res = AttendanceService.ignore_extra_lecture_attendance(
        db=db_session,
        session_id=session.id,
        student_id=student_bca.id
    )
    assert ign_res is True

    # Verify deleted from attendance records
    deleted_rec = db_session.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.id,
        AttendanceRecord.student_id == student_bca.id
    ).first()
    assert deleted_rec is None
