import io
import os
import json
import base64
from pathlib import Path
import pytest
from PIL import Image

from backend.app.core.config import settings


def create_dummy_image_bytes():
    buf = io.BytesIO()
    img = Image.new("RGB", (100, 100), color=(73, 109, 137))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_staging_upload_file(client, admin_token):
    img_bytes = create_dummy_image_bytes()
    response = client.post(
        "/api/staging/upload",
        files={"file": ("test_snap.jpg", io.BytesIO(img_bytes), "image/jpeg")},
        data={"purpose": "student"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "staging_id" in data
    assert os.path.exists(data["file_path"])

    # Clean up test file
    staging_id = data["staging_id"]
    del_resp = client.delete(
        f"/api/staging/{staging_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert del_resp.status_code == 200
    assert not os.path.exists(data["file_path"])


def test_staging_upload_base64(client, admin_token):
    img_bytes = create_dummy_image_bytes()
    b64_str = "data:image/jpeg;base64," + base64.b64encode(img_bytes).decode("utf-8")

    response = client.post(
        "/api/staging/upload",
        data={"base64_data": b64_str, "purpose": "student"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "staging_id" in data
    file_path = data["file_path"]
    assert os.path.exists(file_path)

    # Verify instant delete removes file permanently
    staging_id = data["staging_id"]
    del_resp = client.delete(
        f"/api/staging/{staging_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert del_resp.status_code == 200
    assert not os.path.exists(file_path)


def test_staging_instant_delete_cleans_all_junk(client, admin_token):
    img_bytes = create_dummy_image_bytes()
    response = client.post(
        "/api/staging/upload",
        files={"file": ("retake_snap.jpg", io.BytesIO(img_bytes), "image/jpeg")},
        data={"purpose": "session"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    staging_id = response.json()["staging_id"]
    disk_path = response.json()["file_path"]
    assert os.path.exists(disk_path)

    # Teacher clicks Retake / Remove button
    del_resp = client.delete(
        f"/api/staging/{staging_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True
    # Disk path MUST be deleted instantly (no leftover junk)
    assert not os.path.exists(disk_path)


def test_staging_invalid_id_format_blocked(client, admin_token):
    bad_id = "invalid..slash/bad"
    response = client.delete(
        f"/api/staging/{bad_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code in [400, 404, 405]


def test_student_registration_with_staged_photos(client, admin_token, db_session):
    # Pre-stage 3 photos in background (Instagram trick)
    staged_ids = []
    staged_paths = []
    for i in range(3):
        img_bytes = create_dummy_image_bytes()
        res = client.post(
            "/api/staging/upload",
            files={"file": (f"stage_face_{i}.jpg", io.BytesIO(img_bytes), "image/jpeg")},
            data={"purpose": "student"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 200
        data = res.json()
        staged_ids.append(data["staging_id"])
        staged_paths.append(data["file_path"])

    for p in staged_paths:
        assert os.path.exists(p)

    roll_num = f"STAGE-{os.urandom(3).hex().upper()}"
    form_data = {
        "full_name": "Staged Student",
        "roll_number": roll_num,
        "email": f"staged_{roll_num.lower()}@college.edu",
        "department": "Computer",
        "program": "BCA",
        "semester": "Semester 5",
        "section": "A",
        "status": "Active",
        "staged_photo_ids": json.dumps(staged_ids)
    }

    # Submit form with staged photo IDs
    reg_res = client.post(
        "/api/students/register-with-photo",
        data=form_data,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert reg_data["roll_number"] == roll_num

    # Verify staging files were migrated and deleted from staging directory
    for p in staged_paths:
        assert not os.path.exists(p)


def test_session_create_with_staged_photos(client, admin_token, sample_class):
    # Pre-stage 1 classroom snap
    img_bytes = create_dummy_image_bytes()
    stage_res = client.post(
        "/api/staging/upload",
        files={"file": ("classroom_angle_1.jpg", io.BytesIO(img_bytes), "image/jpeg")},
        data={"purpose": "session"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert stage_res.status_code == 200
    staged_id = stage_res.json()["staging_id"]
    disk_path = stage_res.json()["file_path"]
    assert os.path.exists(disk_path)

    # Submit attendance session with staged_photos_json
    session_res = client.post(
        "/api/sessions/create-and-process",
        data={
            "class_id": str(sample_class.id),
            "session_name": "Staged Angle Test Lecture",
            "tolerance": "0.50",
            "staged_photos_json": json.dumps([staged_id])
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert session_res.status_code == 200
    data = session_res.json()
    assert "class_id" in data or "id" in data or "session_id" in data
    # Verify the temporary file was promoted and removed from staging
    assert not os.path.exists(disk_path)

