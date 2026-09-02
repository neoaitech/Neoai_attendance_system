import pytest
from datetime import datetime, date, timezone, timedelta
from sqlalchemy.orm import Session

from backend.app.db.session import SessionLocal
from backend.app.db.models import User, ClassCourse, Student, AttendanceSession, AttendanceRecord
from backend.app.services.attendance_service import attendance_service
from backend.app.services.report_service import report_service
from backend.app.core.datetime_utils import format_iso_utc, format_ist_time, format_ist_date, format_ist_datetime

def test_attendance_session_timestamp_separation():
    """
    Test that scheduled class time (e.g. 09:00 AM) and actual attendance session time
    (e.g. 04:35 PM IST) are strictly decoupled and accurately serialized.
    """
    db: Session = SessionLocal()
    try:
        # 1. Create a course with scheduled timetable 09:00 AM - 10:30 AM
        course = db.query(ClassCourse).filter(ClassCourse.code == "TIME-TST-101").first()
        if not course:
            course = ClassCourse(
                code="TIME-TST-101",
                name="Time Accuracy & Scheduling Test",
                department="Computer Science & Engineering",
                program="B.Tech",
                semester="Semester 5",
                section="A",
                start_time="09:00 AM",
                end_time="10:30 AM",
                day="Monday",
                status="Active"
            )
            db.add(course)
            db.commit()
            db.refresh(course)

        # 2. Create student with email
        student = db.query(Student).filter(Student.roll_number == "TIME-ST-01").first()
        if not student:
            student = Student(
                roll_number="TIME-ST-01",
                full_name="Timestamp Verification Student",
                email="timest01@institution.edu",
                department="Computer Science & Engineering",
                program="B.Tech",
                semester="Semester 5",
                section="A",
                is_active=True
            )
            db.add(student)
            db.commit()
            db.refresh(student)

        if course not in student.enrolled_classes:
            student.enrolled_classes.append(course)
            db.commit()

        # 3. Simulate an actual attendance session created at 16:35:00 IST (11:05:00 UTC) on 2026-08-31
        actual_scan_utc = datetime(2026, 8, 31, 11, 5, 0)
        session = AttendanceSession(
            class_id=course.id,
            session_name="Lecture on Temporal Accuracy",
            session_date=date(2026, 8, 31),
            start_time="09:00 AM", # Timetable scheduled time
            end_time="10:30 AM",
            created_at=actual_scan_utc,
            status="CONFIRMED"
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        # Record attendance
        rec = AttendanceRecord(
            session_id=session.id,
            student_id=student.id,
            status="PRESENT",
            confidence_score=98.5,
            verification_type="AUTO_AI",
            attendance_type="REGULAR",
            is_extra_lecture=False,
            marked_at=actual_scan_utc
        )
        db.add(rec)
        db.commit()

        # 4. Verify AttendanceSession.to_dict() separation
        s_dict = session.to_dict()
        assert s_dict["scheduled_start_time"] == "09:00 AM", "Scheduled timetable time must remain 09:00 AM"
        assert s_dict["actual_time"] == "04:35 PM", "Actual attendance time derived from created_at must be 04:35 PM IST"
        assert "04:35 PM IST" in s_dict["actual_datetime"], "Actual datetime must display 04:35 PM IST"
        assert s_dict["created_at"] == "2026-08-31T11:05:00Z", "Created at must serialize to authoritative UTC ISO string"

        # 5. Verify Student Attendance History / Lecture Timeline
        summary = report_service.get_student_detailed_report(db, student.id)
        assert summary is not None
        history = summary.get("lecture_history", [])
        matched_history = [h for h in history if h["session_id"] == session.id]
        assert len(matched_history) == 1, "Session must appear in student's lecture history"
        
        hist_item = matched_history[0]
        assert hist_item["time"] == "04:35 PM", "Student timeline 'time' field MUST show actual attendance time (04:35 PM), NOT scheduled 09:00 AM"
        assert hist_item["actual_time"] == "04:35 PM"
        assert hist_item["scheduled_time"] == "09:00 AM", "Scheduled timetable time must be available separately"

        # 6. Verify finalization timestamp on update
        assert session.finalized_at is None
        attendance_service.update_attendance_records(
            db=db,
            session_id=session.id,
            updates=[{"record_id": rec.id, "status": "PRESENT", "notes": "Confirmed by faculty"}]
        )
        db.refresh(session)
        assert session.finalized_at is not None, "Finalizing / updating records must set finalized_at"
        s_dict_after = session.to_dict()
        assert s_dict_after["finalized_at"] is not None
        assert s_dict_after["finalized_at"].endswith("Z")

        # Cleanup
        db.delete(rec)
        db.delete(session)
        db.delete(student)
        db.delete(course)
        db.commit()
    finally:
        db.close()
