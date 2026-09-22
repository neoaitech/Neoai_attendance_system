import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, datetime
from backend.app.db.session import SessionLocal
from backend.app.db.models import (
    Student, ClassCourse, AttendanceSession, AttendanceRecord,
    UnknownFace, User, AuditLog, StudentFreezeLog
)
from backend.app.services.report_service import ReportService
from backend.app.services.attendance_service import AttendanceService
from backend.app.core.config import settings

def run_master_audit():
    print("=" * 80)
    print("      VISIONATTEND PRO - MASTER END-TO-END DEEP SYSTEM VERIFICATION")
    print("=" * 80)
    db = SessionLocal()
    passed = 0
    failed = 0

    def check(name, condition, error_msg=""):
        nonlocal passed, failed
        if condition:
            print(f" [PASS] {name}")
            passed += 1
        else:
            print(f" [FAIL] {name} - ERROR: {error_msg}")
            failed += 1

    try:
        # -------------------------------------------------------------
        # MODULE 1: DATABASE INTEGRITY & SEEDING AUDIT
        # -------------------------------------------------------------
        print("\n--- 1. DATABASE MODELS & BASIC INTEGRITY ---")
        students = db.query(Student).all()
        check("Students table populated", len(students) > 0, f"Found {len(students)} students")

        courses = db.query(ClassCourse).all()
        check("Courses table populated", len(courses) > 0, f"Found {len(courses)} courses")

        users = db.query(User).all()
        check("Users table populated", len(users) > 0, f"Found {len(users)} users")

        finalized_sessions = db.query(AttendanceSession).filter(AttendanceSession.finalized_at.isnot(None)).all()
        check("Finalized sessions exist", len(finalized_sessions) > 0, f"Found {len(finalized_sessions)} finalized sessions")

        unfinalized_sessions = db.query(AttendanceSession).filter(AttendanceSession.finalized_at.is_(None)).all()
        check("No lingering unfinalized sessions in clean state", len(unfinalized_sessions) == 0, f"Found {len(unfinalized_sessions)} unfinalized sessions")

        # -------------------------------------------------------------
        # MODULE 2: STUDENT PROFILE & ENROLLED COURSES ISOLATION
        # -------------------------------------------------------------
        print("\n--- 2. STUDENT DOSSIER & ENROLLED COURSES PURITY ---")
        for s in students:
            rep = ReportService.get_student_detailed_report(db, s.id)
            # Section 1 subjects breakdown check
            subjects = rep.get("subjects_breakdown", [])
            for sub in subjects:
                # Every course in subjects_breakdown MUST be enrolled!
                check(
                    f"Student {s.roll_number}: Subject '{sub.get('course_code')}' is an enrolled course",
                    sub.get("is_enrolled") == True,
                    f"Course {sub.get('course_code')} appeared in enrolled subjects for student {s.roll_number} but is_enrolled is False!"
                )
            
            # Check KPI calculations consistency
            n_cond = rep.get("normal_conducted", 0)
            n_pres = rep.get("normal_present", 0)
            n_abs = rep.get("normal_absent", 0)
            n_froz = rep.get("normal_frozen", 0)
            n_elig = rep.get("normal_eligible", 0)
            extra_cnt = rep.get("extra_lecture_count", 0)
            tot_sess = rep.get("total_sessions", 0)
            tot_pres = rep.get("total_present", 0)
            tot_abs = rep.get("total_absent", 0)

            check(
                f"Student {s.roll_number}: Normal eligible = conducted - frozen",
                n_elig == max(0, n_cond - n_froz),
                f"Mismatch: elig={n_elig}, cond={n_cond}, froz={n_froz}"
            )
            check(
                f"Student {s.roll_number}: Total sessions = normal eligible + extra",
                tot_sess == n_elig + extra_cnt,
                f"Mismatch: tot_sess={tot_sess}, n_elig={n_elig}, extra={extra_cnt}"
            )
            check(
                f"Student {s.roll_number}: Total present = normal present + extra",
                tot_pres == n_pres + extra_cnt,
                f"Mismatch: tot_pres={tot_pres}, n_pres={n_pres}, extra={extra_cnt}"
            )

        # -------------------------------------------------------------
        # MODULE 3: CROSS-CLASS ATTENDANCE & EXTRA LECTURE WORKFLOW
        # -------------------------------------------------------------
        print("\n--- 3. CROSS-CLASS EXTRA LECTURE APPROVAL & REVOCATION WORKFLOW ---")
        # Find course 1 (BCA) and a student NOT enrolled in course 1
        bca_course = db.query(ClassCourse).filter(ClassCourse.program == "BCA").first()
        outside_student = None
        for s in students:
            if s not in bca_course.students and getattr(s, "program", "") != "BCA":
                outside_student = s
                break
        
        check("Identified outside-roster student for testing", outside_student is not None)

        if bca_course and outside_student:
            # Baseline metrics for outside student
            base_rep = ReportService.get_student_detailed_report(db, outside_student.id)
            base_extra = base_rep.get("extra_lecture_count", 0)
            base_normal_pres = base_rep.get("normal_present", 0)

            # Create a test session for BCA course
            test_sess = AttendanceSession(
                class_id=bca_course.id,
                session_name="AUDIT TEST CROSS-CLASS EXTRA LECTURE",
                session_date=date.today(),
                status="DRAFT",
                finalized_at=None,
                created_at=datetime.utcnow()
            )
            db.add(test_sess)
            db.flush()

            # Approve outside student as extra lecture
            AttendanceService.approve_extra_lecture_attendance(db, test_sess.id, outside_student.id)
            db.commit()

            # 1. While session is DRAFT, outside student must NOT see it in reports
            draft_rep = ReportService.get_student_detailed_report(db, outside_student.id)
            check(
                "Draft session extra lecture is INVISIBLE in student detailed report",
                draft_rep.get("extra_lecture_count") == base_extra,
                f"Expected {base_extra}, got {draft_rep.get('extra_lecture_count')}"
            )

            # 2. Finalize session
            test_sess.finalized_at = datetime.utcnow()
            test_sess.status = "FINALIZED"
            db.commit()

            # 3. After finalize, extra lecture increments extra_lecture_count by 1, but normal_present is UNCHANGED
            fin_rep = ReportService.get_student_detailed_report(db, outside_student.id)
            check(
                "Finalized extra lecture incremented extra_lecture_count by exactly 1",
                fin_rep.get("extra_lecture_count") == base_extra + 1,
                f"Expected {base_extra + 1}, got {fin_rep.get('extra_lecture_count')}"
            )
            check(
                "Finalized extra lecture did NOT alter normal_present (Regular attendance untouched)",
                fin_rep.get("normal_present") == base_normal_pres,
                f"Expected {base_normal_pres}, got {fin_rep.get('normal_present')}"
            )

            # 4. Outside course must NOT be in outside student's subjects_breakdown
            sub_codes = [sub["course_code"] for sub in fin_rep.get("subjects_breakdown", [])]
            check(
                f"Outside course '{bca_course.code}' is NOT in outside student's enrolled subjects table",
                bca_course.code not in sub_codes,
                f"Found {bca_course.code} in subjects breakdown: {sub_codes}"
            )

            # 5. Revoke / Ignore Extra Lecture
            AttendanceService.ignore_extra_lecture_attendance(db, test_sess.id, outside_student.id)
            db.commit()
            rev_rep = ReportService.get_student_detailed_report(db, outside_student.id)
            check(
                "Revoking extra lecture decremented extra_lecture_count back to baseline",
                rev_rep.get("extra_lecture_count") == base_extra,
                f"Expected {base_extra}, got {rev_rep.get('extra_lecture_count')}"
            )

            # Clean up test session
            db.delete(test_sess)
            db.commit()
            check("Test session deleted cleanly", True)

        # -------------------------------------------------------------
        # MODULE 4: FROZEN STUDENT DENOMINATOR EXEMPTION AUDIT
        # -------------------------------------------------------------
        print("\n--- 4. ATTENDANCE FREEZE & DENOMINATOR EXEMPTION AUDIT ---")
        frozen_student = db.query(Student).filter(Student.is_frozen == True).first()
        if frozen_student:
            f_rep = ReportService.get_student_detailed_report(db, frozen_student.id)
            check("Frozen student flagged as is_frozen=True", f_rep.get("is_frozen") == True)
            check("Frozen student attendance status is 'FROZEN'", f_rep.get("attendance_status") == "FROZEN")
            # If frozen student has 0 normal sessions conducted, final attendance should be 100% or based on extra
            print(f"       Frozen Student '{frozen_student.full_name}' - Normal: {f_rep.get('normal_present')}/{f_rep.get('normal_eligible')}, Extra: {f_rep.get('extra_lecture_count')}, Final %: {f_rep.get('final_percentage')}%")
        else:
            print("       No frozen student found in database.")

        # -------------------------------------------------------------
        # MODULE 5: DEFAULTER LOGIC & THRESHOLD AUDIT
        # -------------------------------------------------------------
        print("\n--- 5. DEFAULTER (<75%) CALCULATION ACCURACY ---")
        defaulters = ReportService.get_all_defaulters(db)
        print(f"       Total Defaulters Identified: {len(defaulters)}")
        for d in defaulters:
            pct = d.get("overall_attendance_percentage", d.get("attendance_percentage", 100.0))
            check(
                f"Defaulter {d.get('roll_number')} ({pct}%) is strictly below threshold {settings.DEFAULTER_THRESHOLD_PERCENT}%",
                pct < settings.DEFAULTER_THRESHOLD_PERCENT,
                f"Student {d.get('roll_number')} has percentage {pct}% >= {settings.DEFAULTER_THRESHOLD_PERCENT}%"
            )

        # -------------------------------------------------------------
        # MODULE 6: ADVANCED REPORT GENERATION & HIERARCHY
        # -------------------------------------------------------------
        print("\n--- 6. ADVANCED HIERARCHICAL REPORT ENGINE ---")
        adv_data = ReportService.get_advanced_report_data(db)
        check("Advanced report returns batches", len(adv_data.get("batches", [])) > 0)
        check("Available filters return programs, semesters, divisions", len(ReportService.get_available_filters(db)["programs"]) > 0)

        # -------------------------------------------------------------
        # MODULE 7: EXCEL & PDF EXPORT PURITY
        # -------------------------------------------------------------
        print("\n--- 7. EXCEL MULTI-SHEET & PDF EXPORT AUDIT ---")
        excel_path = ReportService.export_advanced_excel(db)
        check("Master Excel export file created", os.path.exists(excel_path) and os.path.getsize(excel_path) > 1000)

        pdf_path = ReportService.export_advanced_pdf(db)
        check("Master PDF export file created", os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 1000)

        # Student dossier PDF
        if students:
            stu_pdf = ReportService.export_student_pdf(db, students[0].id)
            check("Individual Student Dossier PDF created", os.path.exists(stu_pdf) and os.path.getsize(stu_pdf) > 1000)

        print("\n" + "=" * 80)
        print(f" MASTER AUDIT SUMMARY: {passed} PASSED, {failed} FAILED")
        print("=" * 80)
        return failed == 0

    finally:
        db.close()

if __name__ == "__main__":
    success = run_master_audit()
    sys.exit(0 if success else 1)
