import pytest
import os
import cv2
import numpy as np
import concurrent.futures
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.db.models import User, SystemSetting, Student, ClassCourse, AttendanceSession, AttendanceRecord
from backend.app.services.attendance_service import attendance_service
from backend.app.ai.router import face_ai_router


@pytest.fixture
def registered_student_fixture(db_session, sample_class):
    """Enrolls a student with a valid face embedding into the sample class."""
    filepath = settings.STUDENT_PHOTOS_DIR / "portrait_BCA2302144_angle2_e323d4.jpg"
    assert os.path.exists(filepath), "Webcam test portrait must exist"

    student = db_session.query(Student).filter(Student.roll_number == "BCA2302144").first()
    if not student:
        student = Student(
            roll_number="BCA2302144",
            full_name="Prathviraj Chavan",
            email="prathviraj@test.edu",
            department="Computer Science",
            is_active=True
        )
        enc = face_ai_router.extract_single_face_encoding(str(filepath))
        student.face_embedding = enc
        student.enrolled_classes.append(sample_class)
        db_session.add(student)
        db_session.commit()
    return student


def test_standard_multi_photo_1_to_8_photos(db_session, sample_class, teacher_user, registered_student_fixture):
    """Verify Standard architecture handles 1, 2, 4, and 8 classroom photos with unique attendance."""
    face_ai_router.set_active_architecture("STANDARD")
    photo_path = str(settings.STUDENT_PHOTOS_DIR / "portrait_BCA2302144_angle2_e323d4.jpg")

    for count in [1, 2, 4, 8]:
        photos = [photo_path] * count
        session = attendance_service.process_new_attendance_session(
            db=db_session,
            class_id=sample_class.id,
            teacher_id=teacher_user.id,
            session_name=f"Standard {count}-Photo Session",
            image_paths=photos,
            tolerance=0.50
        )
        # Unique attendance record: Student should only be marked PRESENT once
        records = db_session.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.id).all()
        student_records = [r for r in records if r.student_id == registered_student_fixture.id]
        assert len(student_records) == 1, f"Expected exactly 1 attendance record for student in {count}-photo session"
        assert student_records[0].status == "PRESENT"
        assert session.total_recognized == 1


def test_advanced_multi_photo_1_to_8_photos(db_session, sample_class, teacher_user, registered_student_fixture):
    """Verify Advanced architecture handles 1, 2, 4, and 8 classroom photos with quality & duplicate protection."""
    face_ai_router.set_active_architecture("ADVANCED")
    photo_path = str(settings.STUDENT_PHOTOS_DIR / "portrait_BCA2302144_angle2_e323d4.jpg")

    for count in [1, 2, 4, 8]:
        photos = [photo_path] * count
        session = attendance_service.process_new_attendance_session(
            db=db_session,
            class_id=sample_class.id,
            teacher_id=teacher_user.id,
            session_name=f"Advanced {count}-Photo Session",
            image_paths=photos,
            tolerance=0.50
        )
        records = db_session.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.id).all()
        student_records = [r for r in records if r.student_id == registered_student_fixture.id]
        assert len(student_records) == 1, f"Expected exactly 1 attendance record for student in {count}-photo session"
        assert student_records[0].status == "PRESENT"
        assert session.total_recognized == 1

    face_ai_router.set_active_architecture("STANDARD")


def test_photo_limit_enforcement(db_session, sample_class, teacher_user):
    """Verify 0 photos and >8 photos raise validation errors."""
    photo_path = str(settings.STUDENT_PHOTOS_DIR / "portrait_BCA2302144_angle2_e323d4.jpg")

    # 1. Zero photos -> Error
    with pytest.raises(Exception) as exc_0:
        attendance_service.process_new_attendance_session(
            db=db_session,
            class_id=sample_class.id,
            teacher_id=teacher_user.id,
            session_name="Zero Photo Session",
            image_paths=[],
            tolerance=0.50
        )
    assert "No classroom photos" in str(exc_0.value) or "400" in str(exc_0.value)

    # 2. 9 photos (> 8) -> Error
    with pytest.raises(Exception) as exc_9:
        attendance_service.process_new_attendance_session(
            db=db_session,
            class_id=sample_class.id,
            teacher_id=teacher_user.id,
            session_name="Nine Photo Session",
            image_paths=[photo_path] * 9,
            tolerance=0.50
        )
    assert "Maximum 8" in str(exc_9.value) or "400" in str(exc_9.value)


def test_concurrent_faculty_session_isolation(db_session, teacher_user):
    """
    Simulate multiple faculty members concurrently processing attendance sessions
    (e.g. Faculty A with 8 photos, Faculty B with 5 photos, Faculty C with 3 photos).
    Verifies complete session and data isolation without race conditions or cross-talk.
    """
    from backend.app.db.session import SessionLocal

    photo_path = str(settings.STUDENT_PHOTOS_DIR / "portrait_BCA2302144_angle2_e323d4.jpg")
    assert os.path.exists(photo_path)

    import uuid
    faculty_configs = [
        {"name": "Faculty A - Lecture 1", "photo_count": 8, "dept": "Computer Science", "uid": uuid.uuid4().hex[:6]},
        {"name": "Faculty B - Lecture 2", "photo_count": 5, "dept": "Information Technology", "uid": uuid.uuid4().hex[:6]},
        {"name": "Faculty C - Lecture 3", "photo_count": 3, "dept": "Data Science", "uid": uuid.uuid4().hex[:6]},
    ]

    def _run_faculty_session(cfg):
        session_db = SessionLocal()
        try:
            # Create course for this faculty
            course = ClassCourse(
                code=f"CRS-{cfg['uid']}",
                name=cfg['name'],
                subject_name=cfg['name'],
                department=cfg['dept'],
                program="B.Tech",
                semester="Semester 3",
                section="A",
                academic_year="2026-27",
                teacher_id=teacher_user.id
            )
            session_db.add(course)
            session_db.commit()
            session_db.refresh(course)

            # Create student for this course
            student = Student(
                roll_number=f"RN-{cfg['uid']}",
                full_name=f"Student {cfg['dept'][:3]}",
                email=f"stu_{cfg['uid']}@test.edu",
                department=cfg['dept'],
                program="B.Tech",
                semester="Semester 3",
                section="A",
                is_active=True
            )
            enc = face_ai_router.extract_single_face_encoding(photo_path)
            student.face_embedding = enc
            student.enrolled_classes.append(course)
            session_db.add(student)
            session_db.commit()
            session_db.refresh(student)

            # Process session with specified photo count
            photos = [photo_path] * cfg['photo_count']
            att_session = attendance_service.process_new_attendance_session(
                db=session_db,
                class_id=course.id,
                teacher_id=teacher_user.id,
                session_name=cfg['name'],
                image_paths=photos,
                tolerance=0.50
            )

            student_records = session_db.query(AttendanceRecord).filter(
                AttendanceRecord.session_id == att_session.id,
                AttendanceRecord.student_id == student.id
            ).all()
            return {
                "session_id": att_session.id,
                "session_name": att_session.session_name,
                "class_id": att_session.class_id,
                "student_record_count": len(student_records),
                "student_id": student.id,
                "status": "SUCCESS"
            }
        finally:
            session_db.close()

    # Execute concurrent sessions via ThreadPoolExecutor
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(_run_faculty_session, faculty_configs))

    assert len(results) == 3
    session_ids = set()
    for res in results:
        assert res["status"] == "SUCCESS"
        assert res["session_id"] not in session_ids, "Session IDs must be strictly unique"
        session_ids.add(res["session_id"])
        assert res["student_record_count"] == 1, "Each isolated session must have exactly 1 unique attendance record per student"
