from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.models.attendance_model import Attendance
from app.models.class_model import Class
from app.models.session_model import AttendanceSession
from app.models.student_model import Student


VALID_STATUSES = {"present", "absent", "late"}


def build_daily_report(
    db: Session,
    *,
    class_id: int,
    report_date: date,
) -> dict:
    """Build a daily attendance report for one class and date.

    The report includes every active student in the class. If an attendance
    row is missing for a student, that student is reported as absent.
    """
    class_record = (
        db.query(Class)
        .filter(Class.class_id == class_id)
        .first()
    )
    if class_record is None:
        raise ValueError("Class not found")

    students = (
        db.query(Student)
        .filter(
            Student.class_id == class_id,
            Student.is_active.is_(True),
        )
        .order_by(Student.student_id)
        .all()
    )

    sessions = (
        db.query(AttendanceSession)
        .filter(
            AttendanceSession.class_id == class_id,
            AttendanceSession.session_date == report_date,
        )
        .order_by(AttendanceSession.session_id)
        .all()
    )

    session_ids = [session.session_id for session in sessions]
    attendance_rows = []
    if session_ids:
        attendance_rows = (
            db.query(Attendance)
            .filter(Attendance.session_id.in_(session_ids))
            .order_by(Attendance.student_id, Attendance.session_id)
            .all()
        )

    # A class/date normally has one session. If multiple sessions exist,
    # keep the latest row for each student in the daily aggregate.
    latest_by_student: dict[int, Attendance] = {}
    for row in attendance_rows:
        latest_by_student[row.student_id] = row

    counts = {"present": 0, "late": 0, "absent": 0}
    records = []

    for student in students:
        row = latest_by_student.get(student.student_id)
        status = row.status if row else "absent"
        if status not in VALID_STATUSES:
            status = "absent"

        counts[status] += 1
        records.append(
            {
                "student_id": student.student_id,
                "roll_no": student.roll_no,
                "full_name": student.full_name,
                "status": status,
                "confidence_score": row.confidence_score if row else None,
                "marked_at": row.marked_at if row else None,
            }
        )

    total_students = len(records)
    attended = counts["present"] + counts["late"]
    attendance_percentage = (
        round(attended / total_students * 100, 2)
        if total_students
        else 0.0
    )

    return {
        "class_id": class_id,
        "class_name": class_record.class_name,
        "report_date": report_date,
        "session_count": len(sessions),
        "total_students": total_students,
        "present_count": counts["present"],
        "late_count": counts["late"],
        "absent_count": counts["absent"],
        "attendance_percentage": attendance_percentage,
        "records": records,
    }
