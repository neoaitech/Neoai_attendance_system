from __future__ import annotations

from datetime import date, datetime
from typing import Iterable

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.attendance_model import Attendance
from app.models.session_model import AttendanceSession
from app.models.student_model import Student


VALID_STATUSES = {"present", "absent", "late"}


def get_expected_students(db: Session, class_id: int) -> list[Student]:
    """Return active students belonging to the requested class."""
    return (
        db.query(Student)
        .filter(
            Student.class_id == class_id,
            Student.is_active.is_(True),
        )
        .order_by(Student.student_id)
        .all()
    )


def get_or_create_session(
    db: Session,
    *,
    class_id: int,
    session_date: date,
    created_by: int | None = None,
) -> AttendanceSession:
    """Find a class/date session or create one."""
    existing = (
        db.query(AttendanceSession)
        .filter(
            AttendanceSession.class_id == class_id,
            AttendanceSession.session_date == session_date,
        )
        .first()
    )
    if existing:
        return existing

    expected = len(get_expected_students(db, class_id))
    session = AttendanceSession(
        class_id=class_id,
        session_date=session_date,
        total_students_expected=expected,
        created_by=created_by,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def mark_attendance(
    db: Session,
    *,
    session_id: int,
    student_id: int,
    status: str,
    confidence_score: float | None = None,
    marked_by: int | None = None,
) -> Attendance:
    """Create one attendance record for a student in a session.

    The database unique constraint remains the final duplicate-safety guard.
    """
    normalized_status = status.strip().lower()
    if normalized_status not in VALID_STATUSES:
        raise ValueError(
            f"Invalid attendance status: {status}. "
            f"Allowed values: {sorted(VALID_STATUSES)}"
        )

    existing = (
        db.query(Attendance)
        .filter(
            Attendance.session_id == session_id,
            Attendance.student_id == student_id,
        )
        .first()
    )
    if existing:
        return existing

    record = Attendance(
        session_id=session_id,
        student_id=student_id,
        status=normalized_status,
        confidence_score=confidence_score,
        marked_by=marked_by,
        marked_at=datetime.utcnow(),
    )
    db.add(record)

    try:
        db.commit()
        db.refresh(record)
    except IntegrityError:
        db.rollback()
        # Another request may have inserted the same student/session first.
        existing = (
            db.query(Attendance)
            .filter(
                Attendance.session_id == session_id,
                Attendance.student_id == student_id,
            )
            .first()
        )
        if existing:
            return existing
        raise

    return record


def mark_class_attendance(
    db: Session,
    *,
    session_id: int,
    present_student_ids: Iterable[int],
    late_student_ids: Iterable[int] = (),
    marked_by: int | None = None,
) -> list[Attendance]:
    """Mark all active class students for a session as present/late/absent."""
    session = db.query(AttendanceSession).filter(
        AttendanceSession.session_id == session_id
    ).first()
    if session is None:
        raise ValueError("Attendance session not found")

    expected_students = get_expected_students(db, session.class_id)
    present = set(present_student_ids)
    late = set(late_student_ids)

    if present & late:
        raise ValueError("A student cannot be both present and late")

    expected_ids = {student.student_id for student in expected_students}
    unknown_ids = (present | late) - expected_ids
    if unknown_ids:
        raise ValueError(
            f"Students do not belong to the session class: {sorted(unknown_ids)}"
        )

    records: list[Attendance] = []
    for student in expected_students:
        if student.student_id in late:
            status = "late"
        elif student.student_id in present:
            status = "present"
        else:
            status = "absent"

        records.append(
            mark_attendance(
                db,
                session_id=session_id,
                student_id=student.student_id,
                status=status,
                marked_by=marked_by,
            )
        )

    return records


def get_session_attendance(
    db: Session,
    *,
    session_id: int,
) -> list[Attendance]:
    """Return attendance records for one session."""
    return (
        db.query(Attendance)
        .filter(Attendance.session_id == session_id)
        .order_by(Attendance.student_id)
        .all()
    )
