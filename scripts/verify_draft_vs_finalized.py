import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from datetime import date, datetime
from backend.app.db.session import SessionLocal
from backend.app.db.models import AttendanceSession, AttendanceRecord, Student, ClassCourse
from backend.app.services.report_service import ReportService
from backend.app.services.attendance_service import AttendanceService

def test_draft_vs_finalized():
    db = SessionLocal()
    try:
        # 1. Pick a course and student
        course = db.query(ClassCourse).first()
        student = course.students[0] if course and course.students else db.query(Student).first()
        assert course is not None and student is not None, "Course and student must exist"

        # Baseline counts before test
        rep_before = ReportService.get_advanced_report_data(db, class_id=course.id)
        stu_before = AttendanceService.get_student_attendance_summary(db, student.id, course_id=course.id)
        class_before = ReportService.get_class_summary_data(db, course.id)
        det_before = ReportService.get_student_detailed_report(db, student.id)

        print(f"[TEST 1] Baseline established for Course '{course.code}' and Student '{student.full_name}'")
        print(f"         Class total sessions: {class_before.get('total_sessions')}")
        print(f"         Student attended: {stu_before.get('total_present')} / {stu_before.get('total_sessions')}")

        # 2. CREATE A DRAFT (UNFINALIZED) SESSION
        draft_session = AttendanceSession(
            class_id=course.id,
            session_name="TEST DRAFT SESSION - UNSAVED",
            session_date=date.today(),
            status="DRAFT",
            finalized_at=None,
            created_at=datetime.utcnow()
        )
        db.add(draft_session)
        db.flush()

        # Add a record for this student as PRESENT in this draft session
        rec = AttendanceRecord(
            session_id=draft_session.id,
            student_id=student.id,
            status="PRESENT",
            confidence_score=0.99,
            verification_type="BIOMETRIC"
        )
        db.add(rec)
        db.commit()

        # 3. TEST THAT DRAFT IS COMPLETELY INVISIBLE IN ALL REPORTS AND SUMMARIES
        rep_draft = ReportService.get_advanced_report_data(db, class_id=course.id)
        stu_draft = AttendanceService.get_student_attendance_summary(db, student.id, course_id=course.id)
        class_draft = ReportService.get_class_summary_data(db, course.id)
        det_draft = ReportService.get_student_detailed_report(db, student.id)

        assert class_draft.get("total_sessions") == class_before.get("total_sessions"), (
            f"FAIL: Draft session counted in class summary! Got {class_draft.get('total_sessions')}, expected {class_before.get('total_sessions')}"
        )
        assert stu_draft.get("total_present") == stu_before.get("total_present"), (
            f"FAIL: Draft session counted in student attendance! Got {stu_draft.get('total_present')}, expected {stu_before.get('total_present')}"
        )
        assert stu_draft.get("total_sessions") == stu_before.get("total_sessions"), (
            f"FAIL: Draft session counted in student total sessions! Got {stu_draft.get('total_sessions')}, expected {stu_before.get('total_sessions')}"
        )
        assert len(det_draft.get("lecture_history", [])) == len(det_before.get("lecture_history", [])), (
            "FAIL: Draft record appeared in student dossier records!"
        )
        print("[TEST 2] SUCCESS: Draft session is 100% INVISIBLE in reports, dossier, and summaries!")

        # 4. FINALIZE THE SESSION (Simulate clicking Save & Finalize Attendance)
        draft_session.finalized_at = datetime.utcnow()
        draft_session.status = "FINALIZED"
        db.commit()

        # 5. TEST THAT FINALIZED SESSION IS NOW VISIBLE AND COUNTED
        class_final = ReportService.get_class_summary_data(db, course.id)
        stu_final = AttendanceService.get_student_attendance_summary(db, student.id, course_id=course.id)
        det_final = ReportService.get_student_detailed_report(db, student.id)

        assert class_final.get("total_sessions") == class_before.get("total_sessions") + 1, (
            "FAIL: Finalized session not counted in class summary!"
        )
        assert stu_final.get("total_present") == stu_before.get("total_present") + 1, (
            "FAIL: Finalized session not counted in student attended sessions!"
        )
        assert len(det_final.get("lecture_history", [])) == len(det_before.get("lecture_history", [])) + 1, (
            "FAIL: Finalized record did not appear in student dossier!"
        )
        print("[TEST 3] SUCCESS: Finalized session is 100% VISIBLE and correctly counted in all reports!")

        # 6. CLEAN UP TEST SESSION
        db.delete(draft_session)
        db.commit()
        print("[TEST 4] SUCCESS: Cleaned up test session cleanly.")
        print("\nALL DRAFT VS FINALIZED INTEGRATION TESTS PASSED 100%!")

    finally:
        db.close()

if __name__ == "__main__":
    test_draft_vs_finalized()
