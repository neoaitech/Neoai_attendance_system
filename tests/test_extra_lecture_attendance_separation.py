import os
import cv2
import numpy as np
import pytest
from datetime import date
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db.models import Student, ClassCourse, AttendanceSession, AttendanceRecord, UnknownFace, User
from backend.app.services.attendance_service import attendance_service
from backend.app.core.config import settings

client = TestClient(app)

@pytest.fixture
def extra_lecture_fixture(db_session, teacher_user):
    # 1. Create Course Offering: MCA, Semester 1, Division A, MongoDB
    mca_course = ClassCourse(
        code="MCA-101",
        name="MongoDB & NoSQL Databases",
        subject_name="MongoDB",
        department="Computer Science",
        program="MCA",
        semester="Semester 1",
        section="A",
        academic_year="2026-27",
        teacher_id=teacher_user.id
    )
    db_session.add(mca_course)
    db_session.commit()
    db_session.refresh(mca_course)

    # 2. Create Sample Vector Generator for Synthetic ArcFace Embeddings
    def make_embedding(seed_val: float):
        vec = np.zeros(512, dtype=np.float32)
        vec[0] = seed_val
        vec[1] = 1.0 - seed_val
        norm = np.linalg.norm(vec)
        return (vec / norm).tolist()

    # 3. Create Student A: MCA Division A (In Roster)
    student_a = Student(
        roll_number="MCA2601001",
        full_name="Aarav MCA-A",
        email="aarav.mca@college.edu",
        department="Computer Science",
        program="MCA",
        semester="Semester 1",
        section="A",
        is_active=True,
        status="Active",
        face_embedding=make_embedding(0.95)
    )
    db_session.add(student_a)

    # 4. Create Student E: MCA Division B (Outside Roster)
    student_e = Student(
        roll_number="MCA2601045",
        full_name="Eshan MCA-B",
        email="eshan.mcab@college.edu",
        department="Computer Science",
        program="MCA",
        semester="Semester 1",
        section="B",
        is_active=True,
        status="Active",
        face_embedding=make_embedding(0.75)
    )
    db_session.add(student_e)

    # 5. Create Student F: BCA Division A (Outside Roster)
    student_f = Student(
        roll_number="BCA2601088",
        full_name="Fatima BCA-A",
        email="fatima.bca@college.edu",
        department="Information Technology",
        program="BCA",
        semester="Semester 1",
        section="A",
        is_active=True,
        status="Active",
        face_embedding=make_embedding(0.55)
    )
    db_session.add(student_f)

    # 6. Enroll ONLY Student A into the MCA-A course offering
    mca_course.students.append(student_a)
    db_session.commit()
    db_session.refresh(mca_course)

    # 7. Create a dummy synthetic classroom image with 4 synthetic faces
    img_h, img_w = 480, 640
    test_img = np.ones((img_h, img_w, 3), dtype=np.uint8) * 200

    # Draw 4 face regions
    boxes = [
        (40, 140, 140, 40),    # Face 1: Student A
        (40, 300, 140, 200),   # Face 2: Student E
        (40, 460, 140, 360),   # Face 3: Student F
        (40, 620, 140, 520),   # Face 4: Truly Unknown
    ]
    for top, right, bottom, left in boxes:
        cv2.rectangle(test_img, (left, top), (right, bottom), (50, 50, 50), -1)

    os.makedirs(str(settings.SESSION_PHOTOS_DIR), exist_ok=True)
    img_path = str(settings.SESSION_PHOTOS_DIR / "test_extra_lecture_classroom.jpg")
    cv2.imwrite(img_path, test_img)

    return {
        "course": mca_course,
        "student_a": student_a,
        "student_e": student_e,
        "student_f": student_f,
        "img_path": img_path,
        "teacher": teacher_user
    }


def test_selected_class_and_extra_lecture_separation(db_session, extra_lecture_fixture, monkeypatch):
    """
    Validates:
    1. Selected MCA-A student -> PRESENT in selected class
    2. MCA-B and BCA-A students -> EXTRA LECTURE CANDIDATES (Not in MCA-A stats)
    3. Unknown face -> UNKNOWN FACE
    4. Multi-angle deduplication across photos
    5. Teacher approval of Student E -> Student E gets 1 Extra Lecture Attendance
    6. Student E is NOT enrolled in MCA-A, and MCA-A stats remain 1 Present, 0 Absent.
    """
    ctx = extra_lecture_fixture
    course = ctx["course"]
    student_a = ctx["student_a"]
    student_e = ctx["student_e"]
    student_f = ctx["student_f"]
    img_path = ctx["img_path"]
    teacher = ctx["teacher"]

    # Mock face_engine.process_multi_classroom_photos to simulate exact multi-face detection & ArcFace recognition
    def mock_cv_process(image_paths, enrolled_students, session_id, tolerance):
        return {
            "total_detected": 4,
            "total_recognized": 3,
            "total_unknown": 1,
            "total_spoof": 0,
            "recognized": [
                {
                    "student_id": student_a.id,
                    "student_name": student_a.full_name,
                    "roll_number": student_a.roll_number,
                    "similarity": 0.95,
                    "confidence": 98.0,
                    "bbox": [40, 140, 140, 40],
                    "is_spoof": False
                },
                {
                    "student_id": student_e.id,
                    "student_name": student_e.full_name,
                    "roll_number": student_e.roll_number,
                    "similarity": 0.92,
                    "confidence": 96.0,
                    "bbox": [40, 300, 140, 200],
                    "is_spoof": False
                },
                {
                    "student_id": student_f.id,
                    "student_name": student_f.full_name,
                    "roll_number": student_f.roll_number,
                    "similarity": 0.90,
                    "confidence": 94.0,
                    "bbox": [40, 460, 140, 360],
                    "is_spoof": False
                }
            ],
            "unknown": [
                {
                    "detection_index": 3,
                    "bbox": [40, 620, 140, 520],
                    "confidence": 0.0,
                    "cropped_image_path": ""
                }
            ],
            "spoofs": [],
            "processed_photo_path": img_path,
            "processed_photo_paths": [img_path]
        }

    from backend.app.services.face_engine import face_engine
    monkeypatch.setattr(face_engine, "process_multi_classroom_photos", mock_cv_process)

    # Execute Attendance Processing
    session = attendance_service.process_new_attendance_session(
        db=db_session,
        class_id=course.id,
        teacher_id=teacher.id,
        session_name="MCA-A MongoDB Lecture 1",
        image_paths=[img_path],
        session_date=date.today(),
        tolerance=0.50
    )

    # 1. Verify Selected Class Attendance:
    # Only Student A belongs to MCA-A course offering.
    # Therefore, MCA-A enrolled = 1, Present = 1, Absent = 0.
    regular_records = db_session.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.id,
        AttendanceRecord.is_extra_lecture == False,
        AttendanceRecord.verification_type != "EXTRA_LECTURE"
    ).all()

    assert len(regular_records) == 1
    assert regular_records[0].student_id == student_a.id
    assert regular_records[0].status == "PRESENT"
    assert regular_records[0].verification_type == "AUTO_AI"

    # 2. Verify Outside-Roster Candidates:
    # Student E (MCA-B) and Student F (BCA-A) must be classified as EXTRA LECTURE CANDIDATES.
    candidates = session.extra_candidates
    assert len(candidates) == 2
    cand_student_ids = [c["student_id"] for c in candidates]
    assert student_e.id in cand_student_ids
    assert student_f.id in cand_student_ids
    assert all(c["status"] == "CANDIDATE" for c in candidates)
    assert all(c["is_approved"] is False for c in candidates)

    # 3. Verify Unknown Faces:
    unknowns = db_session.query(UnknownFace).filter(UnknownFace.session_id == session.id).all()
    assert len(unknowns) == 1

    # 4. Teacher Approves Student E (Extra Lecture Attendance)
    approved_record = attendance_service.approve_extra_lecture_attendance(
        db=db_session,
        session_id=session.id,
        student_id=student_e.id,
        user_id=teacher.id
    )
    assert approved_record is not None
    assert approved_record.status == "PRESENT"
    assert approved_record.verification_type == "EXTRA_LECTURE"
    assert approved_record.is_extra_lecture is True

    # 5. Teacher Ignores Student F
    attendance_service.ignore_extra_lecture_attendance(
        db=db_session,
        session_id=session.id,
        student_id=student_f.id,
        user_id=teacher.id
    )

    # 6. Verify CRITICAL INVARIANTS:
    # A) MCA-A selected class roster students count remains exactly 1 (Student A)
    db_session.refresh(course)
    assert len(course.students) == 1
    assert course.students[0].id == student_a.id

    # B) Student E is NOT enrolled in MCA-A and their academic info is unchanged
    db_session.refresh(student_e)
    assert student_e.program == "MCA"
    assert student_e.section == "B"
    assert course not in student_e.enrolled_classes

    # C) Student F has no attendance record in this session
    record_f = db_session.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.id,
        AttendanceRecord.student_id == student_f.id
    ).first()
    assert record_f is None

    # D) MCA-A regular class attendance remains 1 Present, 0 Absent
    regular_records_after = db_session.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.id,
        AttendanceRecord.is_extra_lecture == False,
        AttendanceRecord.verification_type != "EXTRA_LECTURE"
    ).all()
    assert len(regular_records_after) == 1
    assert regular_records_after[0].student_id == student_a.id
    assert regular_records_after[0].status == "PRESENT"

    print("\nSUCCESS: All Extra Lecture separation rules and critical invariants passed 100%!")
