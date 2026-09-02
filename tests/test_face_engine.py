import os
import cv2
import numpy as np
import pytest
from backend.app.services.face_engine import face_engine
from backend.app.core.config import settings

def test_confidence_score_formula():
    # Exactly matching cosine similarity (1.0) -> high confidence 99%
    assert face_engine.calculate_confidence_score(1.0, threshold=0.50) == 99.0

    # At threshold (0.50) -> 70%
    assert face_engine.calculate_confidence_score(0.50, threshold=0.50) == 70.0

    # Above threshold (0.75) -> around 84.5%
    score_mid = face_engine.calculate_confidence_score(0.75, threshold=0.50)
    assert 80.0 <= score_mid <= 90.0

    # Far/low similarity (0.20) -> low confidence
    score_far = face_engine.calculate_confidence_score(0.20, threshold=0.50)
    assert score_far < 50.0

def test_image_preprocessing_clahe():
    dummy_img = np.random.randint(0, 255, (200, 200, 3), dtype=np.uint8)
    enhanced = face_engine.preprocess_image(dummy_img)
    assert enhanced.shape == dummy_img.shape
    assert enhanced.dtype == np.uint8

def test_match_detected_faces_logic():
    np.random.seed(42)
    vec1 = np.random.randn(512)
    vec1 = vec1 / np.linalg.norm(vec1)

    vec2 = np.random.randn(512)
    vec2 = vec2 / np.linalg.norm(vec2)

    enrolled = [
        {"id": 1, "name": "Alice", "roll_number": "CS-01", "embedding": vec1.tolist()},
        {"id": 2, "name": "Bob", "roll_number": "CS-02", "embedding": vec2.tolist()}
    ]

    detected_locations = [(10, 50, 60, 20), (70, 120, 130, 80)]
    noise = np.random.randn(512) * 0.05
    query_alice = (vec1 + noise)
    query_alice = query_alice / np.linalg.norm(query_alice)

    unknown_vec = np.random.randn(512)
    unknown_vec = unknown_vec / np.linalg.norm(unknown_vec)

    detected_encodings = [query_alice, unknown_vec]

    recognized, unknown = face_engine.match_detected_faces(
        detected_encodings=detected_encodings,
        detected_locations=detected_locations,
        enrolled_students=enrolled,
        tolerance=0.50
    )

    assert len(recognized) == 1
    assert recognized[0]["student_id"] == 1
    assert recognized[0]["student_name"] == "Alice"
    assert recognized[0]["confidence"] > 70.0

    assert len(unknown) == 1
    assert unknown[0]["bbox"] == [70, 120, 130, 80]

def test_minifasnetv2_anti_spoofing_evaluation():
    # Test 1: Live face crop evaluation
    live_crop = np.random.randint(60, 200, (100, 100, 3), dtype=np.uint8)
    full_img = np.random.randint(50, 180, (400, 400, 3), dtype=np.uint8)
    bbox = (50, 150, 150, 50)

    is_live, score, reasons = face_engine.evaluate_anti_spoofing(live_crop, full_img, bbox)
    assert isinstance(is_live, bool)
    assert isinstance(score, float)
    assert 0.0 <= score <= 1.0

    # Test 2: Smartphone screen spoof simulation (High specular reflection + high contrast display + frame lines)
    spoof_full = np.ones((400, 400, 3), dtype=np.uint8) * 40
    # Draw screen bezel lines
    cv2.rectangle(spoof_full, (30, 30), (200, 250), (255, 255, 255), 3)
    for i in range(10):
        cv2.line(spoof_full, (30, 30 + i*20), (200, 30 + i*20), (255, 255, 255), 2)
    # Bright emissive screen area
    spoof_crop = np.ones((100, 100, 3), dtype=np.uint8) * 245
    # Specular white glare hotspot
    spoof_crop[20:60, 20:60] = 255

    is_live_sp, score_sp, reasons_sp = face_engine.evaluate_anti_spoofing(spoof_crop, spoof_full, (50, 150, 150, 50))
    assert is_live_sp is False
    assert len(reasons_sp) > 0
    assert score_sp < 0.50

def test_render_annotated_classroom_image(tmp_path):
    canvas = np.ones((400, 600, 3), dtype=np.uint8) * 200
    recognized = [{
        "student_name": "Alice",
        "confidence": 92.5,
        "bbox": [50, 150, 180, 70]
    }]
    unknown = [{
        "confidence": 35.0,
        "bbox": [200, 350, 330, 270]
    }]
    spoofs = [{
        "bbox": [250, 550, 370, 430],
        "liveness_score": 0.15,
        "is_spoof": True
    }]

    out_file = str(tmp_path / "annotated_test.jpg")
    result = face_engine.render_annotated_classroom_image(canvas, recognized, unknown, spoofs=spoofs, output_path=out_file)
    assert os.path.exists(result)
    assert os.path.getsize(result) > 0

def test_yolo_and_arcface_pipeline(tmp_path):
    canvas = np.ones((300, 300, 3), dtype=np.uint8) * 230
    cv2.circle(canvas, (150, 150), 60, (180, 210, 235), -1)
    cv2.circle(canvas, (130, 140), 8, (30, 40, 50), -1)
    cv2.circle(canvas, (170, 140), 8, (30, 40, 50), -1)
    cv2.line(canvas, (150, 145), (150, 170), (140, 170, 190), 3)
    cv2.ellipse(canvas, (150, 185), (20, 8), 0, 0, 180, (70, 70, 170), -1)

    img_path = str(tmp_path / "portrait_test.jpg")
    cv2.imwrite(img_path, canvas)

    enc = face_engine.extract_single_face_encoding(img_path)
    assert enc is not None
    assert len(enc) == 512
    assert abs(np.linalg.norm(np.array(enc)) - 1.0) < 1e-3
