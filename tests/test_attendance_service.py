import pytest
from datetime import date
from backend.app.services.attendance_service import attendance_service
from backend.app.services.face_engine import face_engine
from backend.app.db.models import AttendanceSession, AttendanceRecord, UnknownFace, Student

def test_attendance_service_bulk_update(db_session, sample_class, sample_students, teacher_user):
    # Create manual session
    session = AttendanceSession(
        class_id=sample_class.id,
        teacher_id=teacher_user.id,
        session_name="Unit Test Session",
        session_date=date.today(),
        status="CONFIRMED"
    )
    db_session.add(session)
    db_session.flush()

    rec1 = AttendanceRecord(
        session_id=session.id,
        student_id=sample_students[0].id,
        status="ABSENT",
        verification_type="AUTO_ABSENT"
    )
    db_session.add(rec1)
    db_session.commit()

    # Apply manual override
    updates = [{"record_id": rec1.id, "status": "PRESENT", "notes": "Medical excuse verified"}]
    updated = attendance_service.update_attendance_records(
        db=db_session,
        session_id=session.id,
        updates=updates,
        user_id=teacher_user.id
    )

    assert len(updated) == 1
    assert updated[0].status == "PRESENT"
    assert updated[0].verification_type == "MANUAL_OVERRIDE"
    assert updated[0].notes == "Medical excuse verified"

def test_unknown_face_resolution(db_session, sample_class, sample_students, teacher_user):
    session = AttendanceSession(
        class_id=sample_class.id,
        teacher_id=teacher_user.id,
        session_name="Unknown Face Test Session",
        session_date=date.today(),
        status="CONFIRMED"
    )
    db_session.add(session)
    db_session.flush()

    unk = UnknownFace(
        session_id=session.id,
        cropped_image_path="/uploads/unknown_faces/test_crop.jpg",
        bbox=[10, 50, 60, 20],
        confidence_score=45.0,
        status="PENDING"
    )
    db_session.add(unk)
    db_session.commit()

    # Resolve unknown face
    target_student = sample_students[1]
    resolved = attendance_service.resolve_unknown_face(
        db=db_session,
        unknown_face_id=unk.id,
        student_id=target_student.id,
        update_attendance=True,
        user_id=teacher_user.id
    )

    assert resolved.status == "RESOLVED"
    assert resolved.assigned_student_id == target_student.id

    # Verify attendance record updated
    rec = db_session.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.id,
        AttendanceRecord.student_id == target_student.id
    ).first()
    assert rec is not None
    assert rec.status == "PRESENT"
    assert rec.verification_type == "MANUAL_OVERRIDE"

def test_unknown_face_dismiss(db_session, sample_class, teacher_user):
    session = AttendanceSession(
        class_id=sample_class.id,
        teacher_id=teacher_user.id,
        session_name="Dismiss Test",
        session_date=date.today(),
        status="CONFIRMED"
    )
    db_session.add(session)
    db_session.flush()

    unk = UnknownFace(
        session_id=session.id,
        cropped_image_path="/uploads/unknown_faces/dismiss_test.jpg",
        bbox=[10, 50, 60, 20],
        status="PENDING"
    )
    db_session.add(unk)
    db_session.commit()

    dismissed = attendance_service.dismiss_unknown_face(db=db_session, unknown_face_id=unk.id)
    assert dismissed.status == "DISMISSED"

def test_newly_registered_student_recognition(db_session, sample_class, teacher_user):
    import os, cv2, numpy as np
    from backend.app.core.config import settings

    # 1. Create a student portrait
    filepath = settings.STUDENT_PHOTOS_DIR / "portrait_BCA2302145_angle1_e1720e.jpg"
    assert os.path.exists(filepath), "Seed portrait must exist"

    # 2. Register new student with embedding
    from backend.app.services.face_engine import face_engine
    encoding = face_engine.extract_single_face_encoding(str(filepath))
    assert encoding is not None and len(encoding) == 512

    new_student = Student(
        roll_number="CS-NEW-001",
        full_name="Newly Registered Student",
        email="newstudent@univ.edu",
        department="Computer Science",
        is_active=True,
        photo_url=f"/uploads/students/{os.path.basename(filepath)}"
    )
    new_student.face_embedding = encoding
    new_student.enrolled_classes.append(sample_class)
    db_session.add(new_student)
    db_session.commit()

    # 3. Process attendance session with the same photo
    session = attendance_service.process_new_attendance_session(
        db=db_session,
        class_id=sample_class.id,
        teacher_id=teacher_user.id,
        session_name="New Student Verification Session",
        image_path=str(filepath),
        tolerance=0.60
    )

    assert session.total_recognized >= 1
    assert session.total_unknown == 0

    rec = db_session.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.id,
        AttendanceRecord.student_id == new_student.id
    ).first()
    assert rec is not None
    assert rec.status == "PRESENT"
    assert rec.confidence_score >= 70.0

def test_multi_classroom_batch_deduplication(db_session, sample_class, sample_students, teacher_user):
    import os
    from backend.app.core.config import settings

    filepath = settings.STUDENT_PHOTOS_DIR / "portrait_BCA2302145_angle1_e1720e.jpg"
    assert os.path.exists(filepath)

    # Process 3 classroom photos containing the same student
    session = attendance_service.process_new_attendance_session(
        db=db_session,
        class_id=sample_class.id,
        teacher_id=teacher_user.id,
        session_name="Multi-Photo Batch Session",
        image_paths=[str(filepath), str(filepath), str(filepath)],
        tolerance=0.56
    )

    assert session.total_recognized >= 1
    # Check that records contain each enrolled student ONCE
    recs = db_session.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.id).all()
    student_ids = [r.student_id for r in recs]
    assert len(student_ids) == len(set(student_ids)), "Each student must be recorded exactly once"

def test_quick_verify_student_face(db_session, sample_class, sample_students, teacher_user):
    import os
    from backend.app.core.config import settings

    filepath = settings.STUDENT_PHOTOS_DIR / "portrait_BCA2302145_angle1_e1720e.jpg"
    
    # 1. Create a session with absent records
    session = AttendanceSession(
        class_id=sample_class.id,
        teacher_id=teacher_user.id,
        session_name="Quick Verify Session",
        session_date=date.today(),
        status="CONFIRMED"
    )
    db_session.add(session)
    db_session.flush()

    target_student = sample_students[0]
    target_student.face_embedding = face_engine.extract_single_face_encoding(str(filepath))
    db_session.add(target_student)
    db_session.commit()

    rec = AttendanceRecord(
        session_id=session.id,
        student_id=target_student.id,
        status="ABSENT",
        verification_type="AUTO_ABSENT"
    )
    db_session.add(rec)
    db_session.commit()

    # 2. Quick verify using instant snapshot
    verified_rec = attendance_service.quick_verify_student_face(
        db=db_session,
        session_id=session.id,
        student_id=target_student.id,
        photo_path=str(filepath),
        user_id=teacher_user.id
    )

    assert verified_rec.status == "PRESENT"
    assert verified_rec.verification_type in ["LIVE_BIOMETRIC_VERIFIED", "MANUAL_PHOTO_VERIFIED"]


def test_academic_roster_isolation_btech_vs_mca(db_session, teacher_user, monkeypatch):
    """
    Verify master requirement:
    - B.Tech MongoDB (6 students) and MCA MongoDB (4 students) coexist with same course code
    - Scanning MCA MongoDB with 3 recognized students produces:
      Total Roster = 4, Present = 3, Absent = 1
    - 6 B.Tech students are strictly excluded from candidate gallery and not marked absent
    """
    from backend.app.db.models import ClassCourse, Student

    course_btech = ClassCourse(
        code="520",
        name="MONGODB",
        department="Computer Science",
        program="B.Tech",
        semester="Semester 7",
        section="A",
        teacher_id=teacher_user.id
    )
    course_mca = ClassCourse(
        code="520",
        name="MONGODB",
        department="Computer Science",
        program="MCA",
        semester="Semester 7",
        section="A",
        teacher_id=teacher_user.id
    )
    db_session.add_all([course_btech, course_mca])
    db_session.flush()

    # 6 B.Tech students
    btech_students = []
    for i in range(1, 7):
        st = Student(
            roll_number=f"BT2026-00{i}",
            full_name=f"BTech Student {i}",
            email=f"bt{i}@univ.edu",
            program="B.Tech",
            course="B.Tech Computer Science",
            semester="Semester 7",
            department="Computer Science",
            section="A",
            is_active=True
        )
        st.face_embedding = [0.1] * 512
        btech_students.append(st)
        course_btech.students.append(st)
        db_session.add(st)

    # 4 MCA students
    mca_students = []
    for i in range(1, 5):
        st = Student(
            roll_number=f"MCA2026-00{i}",
            full_name=f"MCA Student {i}",
            email=f"mca{i}@univ.edu",
            program="MCA",
            course="MCA Computer Science",
            semester="Semester 7",
            department="Computer Science",
            section="A",
            is_active=True
        )
        st.face_embedding = [0.2] * 512
        mca_students.append(st)
        course_mca.students.append(st)
        db_session.add(st)

    db_session.commit()

    # Mock face recognition to detect 3 MCA students + 1 stranger
    def mock_process_multi_photos(image_paths, enrolled_students, session_id, tolerance):
        return {
            "total_detected": 4,
            "total_recognized": 3,
            "total_unknown": 1,
            "total_spoof": 0,
            "processed_photo_path": "/uploads/sessions/test.jpg",
            "processed_photo_paths": ["/uploads/sessions/test.jpg"],
            "recognized": [
                {
                    "student_id": mca_students[0].id,
                    "student_name": mca_students[0].full_name,
                    "roll_number": mca_students[0].roll_number,
                    "confidence": 94.5,
                    "bbox": [50, 50, 100, 100],
                    "is_spoof": False
                },
                {
                    "student_id": mca_students[1].id,
                    "student_name": mca_students[1].full_name,
                    "roll_number": mca_students[1].roll_number,
                    "confidence": 92.0,
                    "bbox": [150, 50, 100, 100],
                    "is_spoof": False
                },
                {
                    "student_id": mca_students[2].id,
                    "student_name": mca_students[2].full_name,
                    "roll_number": mca_students[2].roll_number,
                    "confidence": 96.0,
                    "bbox": [250, 50, 100, 100],
                    "is_spoof": False
                }
            ],
            "unknown": [
                {
                    "bbox": [350, 50, 100, 100],
                    "confidence": 42.0,
                    "cropped_image_path": "/uploads/unknown/crop1.jpg"
                }
            ]
        }

    monkeypatch.setattr(face_engine, "process_multi_classroom_photos", mock_process_multi_photos)

    # Process attendance for MCA MongoDB
    session = attendance_service.process_new_attendance_session(
        db=db_session,
        class_id=course_mca.id,
        teacher_id=teacher_user.id,
        image_paths=["dummy.jpg"],
        session_name="MongoDB - Aggregation Framework",
        session_date=date.today(),
        tolerance=0.50
    )

    records = db_session.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.id,
        AttendanceRecord.is_extra_lecture == False
    ).all()
    assert len(records) == 4
    
    presents = [r for r in records if r.status == "PRESENT"]
    absents = [r for r in records if r.status == "ABSENT"]
    assert len(presents) == 3
    assert len(absents) == 1
    assert absents[0].student_id == mca_students[3].id

    # Verify B.Tech students are untouched in this session
    btech_records = db_session.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == session.id
    ).join(Student).filter(Student.program == "B.Tech").all()
    assert len(btech_records) == 0
    assert len(course_btech.students) == 6


def test_course_offering_delete_and_unenroll(db_session, teacher_user):
    """
    Verify course removal and student unenrollment logic.
    """
    from backend.app.db.models import ClassCourse, Student

    course = ClassCourse(
        code="520-TEST",
        name="TEMPORARY COURSE",
        department="Computer Science",
        program="B.Tech",
        semester="Semester 7",
        section="A",
        teacher_id=teacher_user.id
    )
    db_session.add(course)
    db_session.flush()

    student = Student(
        roll_number="DEL-001",
        full_name="Test Student",
        email="del001@univ.edu",
        program="B.Tech",
        course="B.Tech CS",
        semester="Semester 7",
        department="Computer Science",
        section="A",
        is_active=True
    )
    course.students.append(student)
    db_session.add(student)
    db_session.commit()

    assert len(course.students) == 1

    # 1. Unenroll student
    course.students.remove(student)
    db_session.commit()
    assert len(course.students) == 0
    assert student.is_active is True  # Student still exists

    # 2. Delete course
    course_id = course.id
    db_session.delete(course)
    db_session.commit()

    deleted = db_session.query(ClassCourse).filter(ClassCourse.id == course_id).first()
    assert deleted is None




