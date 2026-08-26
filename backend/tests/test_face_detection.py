from io import BytesIO

from fastapi.testclient import TestClient

from app.main import app
import app.api.sessions as sessions_api

client = TestClient(app)


def test_upload_endpoint_returns_detected_faces(monkeypatch):
    def fake_detect(data, output_path):
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(b"annotated")
        return [
            {"x": 10, "y": 20, "width": 30, "height": 40},
            {"x": 50, "y": 60, "width": 70, "height": 80},
        ]

    monkeypatch.setattr(sessions_api, "detect_and_save", fake_detect)

    jpeg = b"\xff\xd8\xff\xe0sample\xff\xd9"
    response = client.post(
        "/api/v1/sessions/1/photo",
        files={"photo": ("classroom.jpg", BytesIO(jpeg), "image/jpeg")},
    )

    assert response.status_code == 201
    body = response.json()

    assert body["detection"]["face_count"] == 2
    assert body["detection"]["faces"] == [
        {"x": 10, "y": 20, "width": 30, "height": 40},
        {"x": 50, "y": 60, "width": 70, "height": 80},
    ]
    assert body["detection"]["annotated_path"]


def test_upload_endpoint_returns_empty_face_list_when_no_faces(monkeypatch):
    def fake_detect(data, output_path):
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(b"annotated")
        return []

    monkeypatch.setattr(sessions_api, "detect_and_save", fake_detect)

    jpeg = b"\xff\xd8\xff\xe0sample\xff\xd9"
    response = client.post(
        "/api/v1/sessions/1/photo",
        files={"photo": ("classroom.jpg", BytesIO(jpeg), "image/jpeg")},
    )

    assert response.status_code == 201
    body = response.json()

    assert body["detection"]["face_count"] == 0
    assert body["detection"]["faces"] == []
