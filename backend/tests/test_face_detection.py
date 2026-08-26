from io import BytesIO

import cv2
import numpy as np
from fastapi.testclient import TestClient

from app.main import app
import app.api.sessions as sessions_api
from app.services.face_detection import FaceDetector

client = TestClient(app)


def test_face_detector_runs_on_decodable_image():
    image = np.zeros((120, 160, 3), dtype=np.uint8)
    ok, encoded = cv2.imencode(".jpg", image)
    assert ok
    decoded = cv2.imdecode(np.frombuffer(encoded.tobytes(), dtype=np.uint8), cv2.IMREAD_COLOR)

    detector = FaceDetector()
    annotated, faces = detector.detect_and_annotate(decoded)

    assert annotated.shape == decoded.shape
    assert isinstance(faces, list)


def test_upload_endpoint_invokes_detection(monkeypatch, tmp_path):
    called = {}

    def fake_detect(data, output_path):
        called["size"] = len(data)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(b"annotated")
        return [{"x": 1, "y": 2, "width": 30, "height": 40}]

    monkeypatch.setattr(sessions_api, "detect_and_save", fake_detect)
    jpeg = b"\xff\xd8\xff\xe0" + b"sample" + b"\xff\xd9"
    response = client.post(
        "/api/v1/sessions/1/photo",
        files={"photo": ("classroom.jpg", BytesIO(jpeg), "image/jpeg")},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["detection"]["face_count"] == 1
    assert body["detection"]["annotated_path"]
    assert called["size"] == len(jpeg)
