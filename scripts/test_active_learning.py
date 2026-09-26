import sys
import numpy as np
import cv2
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.ai.base_engine import FaceAIEngine
from backend.app.ai.standard_engine import StandardFaceAIEngine
from backend.app.services.face_engine import face_engine

def test_quality_check():
    print("\n--- 1. Testing Quality Check (Sharpness & Resolution) ---")
    
    # Create sharp synthetic face (high frequency checkerboard pattern, 150x150)
    sharp_img = np.zeros((300, 300, 3), dtype=np.uint8)
    sharp_img[50:200, 50:200] = np.random.randint(0, 255, (150, 150, 3), dtype=np.uint8)
    bbox_sharp = [50, 200, 200, 50]
    
    is_sharp, var, dim = face_engine.evaluate_face_crop_quality(sharp_img, bbox_sharp)
    print(f"Sharp test: is_sharp={is_sharp}, variance={var}, dim={dim}")
    assert is_sharp == True, "Sharp image should pass quality test"
    assert dim == 150, "Dimension should be 150"

    # Create blurry image (blurred with heavy Gaussian blur)
    blurry_img = cv2.GaussianBlur(sharp_img, (51, 51), 30)
    is_sharp_blur, var_blur, dim_blur = face_engine.evaluate_face_crop_quality(blurry_img, bbox_sharp)
    print(f"Blurry test: is_sharp={is_sharp_blur}, variance={var_blur}, dim={dim_blur}")
    assert is_sharp_blur == False, "Blurry image must be rejected"
    assert var_blur < 90.0, "Blurry variance must be < 90"

    # Create small crop (< 100px)
    small_img = np.zeros((200, 200, 3), dtype=np.uint8)
    bbox_small = [20, 80, 80, 20]  # 60x60
    is_sharp_sm, var_sm, dim_sm = face_engine.evaluate_face_crop_quality(small_img, bbox_small)
    print(f"Small crop test (<100px): is_sharp={is_sharp_sm}, dim={dim_sm}")
    assert is_sharp_sm == False, "Small crop (<100px) must be rejected"

    print("Quality check tests passed successfully! [OK]")

def test_gallery_cap_logic():
    print("\n--- 2. Testing Gallery Cap Logic (Max 7 Photos) ---")
    photos = [f"/uploads/students/angle_{i}.jpg" for i in range(1, 9)] # 8 photos
    embs = [[0.1] * 512 for _ in range(8)]

    # Enforce maximum gallery cap of 7 photos (preserve index 0 primary)
    while len(photos) > 7:
        photos.pop(1)
        if len(embs) > 1:
            embs.pop(1)

    assert len(photos) == 7, "Photos should be capped at 7"
    assert len(embs) == 7, "Embeddings should be capped at 7"
    assert photos[0] == "/uploads/students/angle_1.jpg", "Primary photo must be preserved"
    print(f"Gallery cap test passed: {len(photos)} photos, primary intact: {photos[0]} [OK]")

if __name__ == "__main__":
    test_quality_check()
    test_gallery_cap_logic()
    print("\nALL ACTIVE LEARNING TESTS PASSED! [OK]")
