import os
import pytest
from backend.app.services.backup_service import backup_service
from backend.app.db.models import User, Student, ClassCourse, AttendanceSession, AttendanceRecord

def test_database_integrity_verification(db_session):
    integrity = backup_service.verify_database_integrity(db_session)
    assert integrity["is_healthy"] is True
    assert "100% OK" in integrity["status"]
    assert "users" in integrity["table_statistics"]

def test_json_database_export(db_session, sample_class, sample_students):
    data = backup_service.export_full_database_json(db_session)
    assert "counts" in data
    assert "data" in data
    assert data["counts"]["students"] >= 3
    assert data["counts"]["classes"] >= 1

def test_cascade_delete_session(db_session, sample_class, sample_students, teacher_user):
    sess = AttendanceSession(
        class_id=sample_class.id,
        teacher_id=teacher_user.id,
        session_name="Cascade Test",
        status="CONFIRMED"
    )
    db_session.add(sess)
    db_session.flush()

    rec = AttendanceRecord(session_id=sess.id, student_id=sample_students[0].id, status="PRESENT")
    db_session.add(rec)
    db_session.commit()

    sess_id = sess.id
    rec_id = rec.id

    # Delete session
    db_session.delete(sess)
    db_session.commit()

    # AttendanceRecord should be cascade deleted
    found_rec = db_session.query(AttendanceRecord).filter(AttendanceRecord.id == rec_id).first()
    assert found_rec is None
