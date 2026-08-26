"""Reusable OpenCV face-detection service for the attendance backend.

The detector follows the project's existing OpenCV/Haar-cascade approach from
Priti's earlier detection work, packaged here as an importable backend service
for API integration.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


CASCADE_PATH = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"


@dataclass(frozen=True)
class DetectedFace:
    x: int
    y: int
    width: int
    height: int

    def as_dict(self) -> dict[str, int]:
        return {
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
        }


class FaceDetector:
    def __init__(
        self,
        cascade_path: str | Path = CASCADE_PATH,
        scale_factor: float = 1.1,
        min_neighbors: int = 5,
        min_size: tuple[int, int] = (30, 30),
    ) -> None:
        self.cascade = cv2.CascadeClassifier(str(cascade_path))
        if self.cascade.empty():
            raise RuntimeError(f"Unable to load face cascade: {cascade_path}")
        self.scale_factor = scale_factor
        self.min_neighbors = min_neighbors
        self.min_size = min_size

    def detect(self, image: np.ndarray) -> list[DetectedFace]:
        if image is None or image.size == 0:
            return []
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = self.cascade.detectMultiScale(
            gray,
            scaleFactor=self.scale_factor,
            minNeighbors=self.min_neighbors,
            minSize=self.min_size,
        )
        return [
            DetectedFace(int(x), int(y), int(w), int(h))
            for x, y, w, h in faces
        ]

    def detect_and_annotate(self, image: np.ndarray) -> tuple[np.ndarray, list[DetectedFace]]:
        faces = self.detect(image)
        annotated = image.copy()
        for face in faces:
            cv2.rectangle(
                annotated,
                (face.x, face.y),
                (face.x + face.width, face.y + face.height),
                (0, 255, 0),
                2,
            )
        return annotated, faces


def detect_and_save(data: bytes, output_path: Path) -> list[dict[str, int]]:
    """Detect faces in uploaded bytes, save an annotated image, return boxes."""
    encoded = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Unable to decode image data")

    annotated, faces = FaceDetector().detect_and_annotate(image)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output_path), annotated):
        raise OSError(f"Unable to save detected image: {output_path}")
    return [face.as_dict() for face in faces]
