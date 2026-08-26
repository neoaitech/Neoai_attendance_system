from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.class_model import Class
from app.models.student_model import Student
from app.models.session_model import AttendanceSession
from app.services.attendance_service import (
    get_session_attendance,
    mark_class_attendance,
)


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def seed_class_with_students(db):
    class_record = Class(
        class_name="BCA-A",
        subject="Database",
        teacher_name="Teacher",
        academic_year="2026-27",
    )
    db.add(class_record)
    db.commit()
    db.refresh(class_record)

    students = [
        Student(
            roll_no="S001",
            full_name="Student One",
            class_id=class_record.class_id,
            is_active=True,
        ),
        Student(
            roll_no="S002",
            full_name="Student Two",
            class_id=class_record.class_id,
            is_active=True,
        ),
        Student(
            roll_no="S003",
            full_name="Student Three",
            class_id=class_record.class_id,
            is_active=True,
        ),
    ]
    db.add_all(students)
    db.commit()
    for student in students:
        db.refresh(student)

    session = AttendanceSession(
        class_id=class_record.class_id,
        session_date=date(2026, 8, 26),
        total_students_expected=3,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return session, students


def test_marks_present_late_and_absent(db):
    session, students = seed_class_with_students(db)

    records = mark_class_attendance(
        db,
        session_id=session.session_id,
        present_student_ids=[students[0].student_id],
        late_student_ids=[students[1].student_id],
    )

    assert len(records) == 3
    assert [record.status for record in records] == [
        "present",
        "late",
        "absent",
    ]


def test_duplicate_mark_does_not_create_second_record(db):
    session, students = seed_class_with_students(db)

    first = mark_class_attendance(
        db,
        session_id=session.session_id,
        present_student_ids=[students[0].student_id],
    )
    second = mark_class_attendance(
        db,
        session_id=session.session_id,
        present_student_ids=[students[0].student_id],
    )

    records = get_session_attendance(db, session_id=session.session_id)

    assert first[0].attendance_id == second[0].attendance_id
    assert len(records) == 3


def test_rejects_student_from_another_class(db):
    session, students = seed_class_with_students(db)

    other_class = Class(class_name="BCA-B")
    db.add(other_class)
    db.commit()
    db.refresh(other_class)

    other_student = Student(
        roll_no="S999",
        full_name="Other Student",
        class_id=other_class.class_id,
        is_active=True,
    )
    db.add(other_student)
    db.commit()
    db.refresh(other_student)

    with pytest.raises(ValueError, match="do not belong"):
        mark_class_attendance(
            db,
            session_id=session.session_id,
            present_student_ids=[other_student.student_id],
        )


def test_rejects_student_as_present_and_late(db):
    session, students = seed_class_with_students(db)

    with pytest.raises(ValueError, match="both present and late"):
        mark_class_attendance(
            db,
            session_id=session.session_id,
            present_student_ids=[students[0].student_id],
            late_student_ids=[students[0].student_id],
        )
