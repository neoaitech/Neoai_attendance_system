from io import BytesIO

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_photo_upload_accepts_jpeg():
    # Minimal valid JPEG header/trailer is sufficient for the endpoint's header validation.
    jpeg = b"\xff\xd8\xff\xe0" + b"sample" + b"\xff\xd9"
    response = client.post(
        "/api/v1/sessions/1/photo",
        files={"photo": ("classroom.jpg", BytesIO(jpeg), "image/jpeg")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["session_id"] == 1
    assert body["photo"]["content_type"] == "image/jpeg"


def test_photo_upload_rejects_non_image():
    response = client.post(
        "/api/v1/sessions/1/photo",
        files={"photo": ("notes.txt", BytesIO(b"not an image"), "text/plain")},
    )
    assert response.status_code == 400


def test_photo_upload_rejects_empty_file():
    response = client.post(
        "/api/v1/sessions/1/photo",
        files={"photo": ("empty.jpg", BytesIO(b""), "image/jpeg")},
    )
    assert response.status_code == 400
