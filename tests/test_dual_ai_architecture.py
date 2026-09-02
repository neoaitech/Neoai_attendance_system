import pytest
import os
import cv2
import numpy as np
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.db.models import User, SystemSetting, Student, ClassCourse, Role
from backend.app.ai.standard_engine import StandardFaceAIEngine
from backend.app.ai.advanced_engine import AdvancedFaceAIEngine
from backend.app.ai.router import FaceAIRouter, face_ai_router
from backend.app.services.attendance_service import attendance_service


def test_standard_engine_instance():
    """Verify StandardFaceAIEngine initializes YOLOv8 and ArcFace."""
    engine = StandardFaceAIEngine()
    dummy_img = np.zeros((300, 300, 3), dtype=np.uint8)
    locs = engine.detect_face_locations(dummy_img)
    assert isinstance(locs, list)


def test_advanced_engine_instance():
    """Verify AdvancedFaceAIEngine initializes YOLOv8, Face Quality, MiniFASNet, and ArcFace."""
    engine = AdvancedFaceAIEngine()
    dummy_img = np.zeros((300, 300, 3), dtype=np.uint8)
    locs = engine.detect_face_locations(dummy_img)
    assert isinstance(locs, list)


def test_face_quality_assessment():
    """Verify Face Quality Assessment detects small dimensions, extreme blur, and bad lighting."""
    engine = AdvancedFaceAIEngine()

    # 1. Very small face (< 28px)
    small_crop = np.full((20, 20, 3), 128, dtype=np.uint8)
    is_pass, score, reasons = engine.assess_face_quality(small_crop, (0, 20, 20, 0), (500, 500))
    assert not is_pass
    assert any("too small" in r for r in reasons)

    # 2. Severely blurred face (flat/zero laplacian variance)
    blurred_crop = np.full((100, 100, 3), 128, dtype=np.uint8)  # uniform flat grey = zero variance
    is_pass, score, reasons = engine.assess_face_quality(blurred_crop, (0, 100, 100, 0), (500, 500))
    assert not is_pass
    assert any("blur" in r.lower() for r in reasons)

    # 3. Severely dark/underexposed face
    dark_crop = np.full((80, 80, 3), 5, dtype=np.uint8)
    is_pass, score, reasons = engine.assess_face_quality(dark_crop, (0, 80, 80, 0), (500, 500))
    assert not is_pass
    assert any("underexposure" in r.lower() or "dark" in r.lower() for r in reasons)

    # 4. Valid normal face crop with realistic texture
    textured_crop = np.random.randint(60, 200, (100, 100, 3), dtype=np.uint8)
    is_pass, score, reasons = engine.assess_face_quality(textured_crop, (0, 100, 100, 0), (500, 500))
    assert is_pass
    assert len(reasons) == 0


def test_robust_identity_matching_and_ambiguity():
    """Verify Robust Identity Matcher performs Top-1/Top-2 margin checks."""
    engine = AdvancedFaceAIEngine()

    dummy_vector = np.random.randn(512).astype(np.float32)
    dummy_vector /= np.linalg.norm(dummy_vector)

    # Case 1: Clear confident Top-1 match
    student_a_vec = dummy_vector.copy()  # similarity = 1.0
    student_b_vec = np.random.randn(512).astype(np.float32)  # similarity ~ 0.0
    student_b_vec /= np.linalg.norm(student_b_vec)

    enrolled = [
        {"id": 1, "name": "Alice", "roll_number": "R01", "embedding": student_a_vec.tolist()},
        {"id": 2, "name": "Bob", "roll_number": "R02", "embedding": student_b_vec.tolist()}
    ]

    status, best_stu, top1, top2, conf, reason = engine.robust_identity_match(
        face_vec=dummy_vector,
        target_students=enrolled,
        tolerance=0.50,
        min_margin=0.05
    )
    assert status == "RECOGNIZED"
    assert best_stu["id"] == 1
    assert top1 > 0.95

    # Case 2: Ambiguous match (Top-1 and Top-2 within 0.02 of each other)
    student_c_vec = dummy_vector + np.random.randn(512).astype(np.float32) * 0.05
    student_c_vec /= np.linalg.norm(student_c_vec)
    student_d_vec = dummy_vector + np.random.randn(512).astype(np.float32) * 0.06
    student_d_vec /= np.linalg.norm(student_d_vec)

    enrolled_ambiguous = [
        {"id": 3, "name": "Charlie", "roll_number": "R03", "embedding": student_c_vec.tolist()},
        {"id": 4, "name": "David", "roll_number": "R04", "embedding": student_d_vec.tolist()}
    ]

    status, best_stu, top1, top2, conf, reason = engine.robust_identity_match(
        face_vec=dummy_vector,
        target_students=enrolled_ambiguous,
        tolerance=0.50,
        min_margin=0.15  # Strict margin
    )
    assert status == "AMBIGUOUS"
    assert "Ambiguous match" in reason


def test_router_switching_and_delegation():
    """Verify FaceAIRouter hot-switches between STANDARD and ADVANCED."""
    router = FaceAIRouter()

    # Default
    assert router.get_active_architecture() == "STANDARD"
    std_engine = router.get_engine("STANDARD")
    assert isinstance(std_engine, StandardFaceAIEngine)

    # Switch to ADVANCED
    router.set_active_architecture("ADVANCED")
    assert router.get_active_architecture() == "ADVANCED"
    adv_engine = router.get_engine("ADVANCED")
    assert isinstance(adv_engine, AdvancedFaceAIEngine)

    # Switch back to STANDARD
    router.set_active_architecture("STANDARD")
    assert router.get_active_architecture() == "STANDARD"


def test_admin_face_ai_architecture_api(client, db_session, admin_user, teacher_user):
    """Verify Admin settings API for Face AI Architecture selection and RBAC."""
    from backend.app.core.security import create_access_token
    admin_token = create_access_token(admin_user.username, role="admin")
    teacher_token = create_access_token(teacher_user.username, role="teacher")

    # 1. GET current architecture setting
    res = client.get(
        "/api/admin/system-settings/face-ai-architecture",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "architecture" in data
    assert data["architecture"] in ["STANDARD", "ADVANCED"]

    # 2. Non-admin (Teacher) attempts to change architecture -> Must be 403 Forbidden
    res_forbidden = client.post(
        "/api/admin/system-settings/face-ai-architecture",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json={"architecture": "ADVANCED"}
    )
    assert res_forbidden.status_code == 403

    # 3. Admin updates architecture to ADVANCED
    res_update = client.post(
        "/api/admin/system-settings/face-ai-architecture",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"architecture": "ADVANCED"}
    )
    assert res_update.status_code == 200
    assert res_update.json()["architecture"] == "ADVANCED"

    # Verify DB persistence
    db_setting = db_session.query(SystemSetting).filter(SystemSetting.key == "face_ai_architecture").first()
    assert db_setting is not None
    assert db_setting.value == "ADVANCED"

    # 4. Switch back to STANDARD
    res_back = client.post(
        "/api/admin/system-settings/face-ai-architecture",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"architecture": "STANDARD"}
    )
    assert res_back.status_code == 200
    assert res_back.json()["architecture"] == "STANDARD"
    db_session.refresh(db_setting)
    assert db_setting.value == "STANDARD"


def test_attendance_session_under_both_architectures(db_session, sample_class, teacher_user):
    """Verify attendance processing executes correctly under both STANDARD and ADVANCED."""
    filepath = settings.STUDENT_PHOTOS_DIR / "portrait_BCA2302144_angle2_e323d4.jpg"
    assert os.path.exists(filepath), "Webcam test portrait must exist"

    # Register student
    new_student = Student(
        roll_number="BCA2302144",
        full_name="Prathviraj Chavan",
        email="prathviraj@test.edu",
        department="Computer Science",
        is_active=True
    )
    enc = face_ai_router.extract_single_face_encoding(str(filepath))
    new_student.face_embedding = enc
    new_student.enrolled_classes.append(sample_class)
    db_session.add(new_student)
    db_session.commit()

    # 1. Test Attendance with STANDARD architecture
    face_ai_router.set_active_architecture("STANDARD")
    session_std = attendance_service.process_new_attendance_session(
        db=db_session,
        class_id=sample_class.id,
        teacher_id=teacher_user.id,
        session_name="Dual Arch Standard Session",
        image_path=str(filepath),
        tolerance=0.50
    )
    assert session_std.total_recognized == 1
    assert session_std.total_detected >= 1

    # 2. Test Attendance with ADVANCED architecture
    face_ai_router.set_active_architecture("ADVANCED")
    session_adv = attendance_service.process_new_attendance_session(
        db=db_session,
        class_id=sample_class.id,
        teacher_id=teacher_user.id,
        session_name="Dual Arch Advanced Session",
        image_path=str(filepath),
        tolerance=0.50
    )
    assert session_adv.total_recognized == 1
    assert session_adv.total_detected >= 1

    # Restore to STANDARD
    face_ai_router.set_active_architecture("STANDARD")
