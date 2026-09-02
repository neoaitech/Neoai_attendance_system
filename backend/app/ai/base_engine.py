import os
import cv2
import uuid
import logging
import numpy as np
from abc import ABC, abstractmethod
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Any, Union
from PIL import Image, ImageOps

from backend.app.core.config import settings

logger = logging.getLogger("FaceAIEngine")


class FaceAIEngine(ABC):
    """
    Common Abstract Interface for Face AI Architectures.
    Enables pluggable switching between STANDARD and ADVANCED architectures.
    """

    def __init__(self):
        self.embedding_dim = settings.EMBEDDING_DIMENSION
        self.default_tolerance = settings.DEFAULT_TOLERANCE
        self.min_face_size = settings.MIN_FACE_SIZE

    def load_and_orient_image(self, image_path_or_bytes: Any) -> np.ndarray:
        """
        Loads an image and corrects EXIF rotation (e.g. from mobile phone/webcam).
        Returns RGB numpy array.
        """
        try:
            if isinstance(image_path_or_bytes, (str, Path)):
                pil_img = Image.open(str(image_path_or_bytes))
            else:
                pil_img = Image.open(image_path_or_bytes)

            pil_img = ImageOps.exif_transpose(pil_img)
            if pil_img.mode != "RGB":
                pil_img = pil_img.convert("RGB")
            return np.array(pil_img)
        except Exception:
            if isinstance(image_path_or_bytes, (str, Path)):
                bgr = cv2.imread(str(image_path_or_bytes))
                if bgr is not None:
                    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            raise ValueError("Could not decode image file")

    def preprocess_image(self, image_rgb: np.ndarray) -> np.ndarray:
        """
        Applies CLAHE (Contrast Limited Adaptive Histogram Equalization) in LAB space.
        """
        try:
            lab = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            merged = cv2.merge((cl, a, b))
            return cv2.cvtColor(merged, cv2.COLOR_LAB2RGB)
        except Exception as e:
            logger.warning(f"Error during CLAHE preprocessing: {e}")
            return image_rgb

    @staticmethod
    def compute_cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
        """
        Calculates normalized cosine similarity between two 512-D vectors:
        Cosine Sim = (A • B) / (||A|| * ||B||)
        Range: [-1.0, 1.0] (1.0 = exact match).
        """
        v1 = np.asarray(vec1, dtype=np.float32).flatten()
        v2 = np.asarray(vec2, dtype=np.float32).flatten()
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        if norm1 == 0.0 or norm2 == 0.0:
            return 0.0
        return float(np.dot(v1, v2) / (norm1 * norm2))

    @staticmethod
    def calculate_confidence_score(similarity: float, threshold: float = 0.50) -> float:
        """
        Converts raw cosine similarity into a standardized human-readable percentage [0.0 - 100.0%].
        """
        sim = max(0.0, min(1.0, float(similarity)))
        thresh = max(0.1, min(0.9, float(threshold)))

        if sim < thresh:
            conf = (sim / thresh) * 70.0
        else:
            conf = 70.0 + ((sim - thresh) / (1.0 - thresh)) * 29.0

        return round(float(conf), 1)

    @staticmethod
    def compute_fallback_512d_descriptor(face_crop_rgb: np.ndarray) -> np.ndarray:
        """
        Generates a 512-D geometric+texture face descriptor fallback.
        """
        try:
            gray = cv2.cvtColor(face_crop_rgb, cv2.COLOR_RGB2GRAY)
            resized = cv2.resize(gray, (16, 16), interpolation=cv2.INTER_AREA).flatten().astype(np.float32)
            hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten().astype(np.float32)
            desc = np.concatenate([resized, hist])
            norm = np.linalg.norm(desc)
            if norm > 0:
                desc = desc / norm
            return desc
        except Exception:
            return np.zeros(512, dtype=np.float32)

    def crop_and_save_face(self, image_rgb: np.ndarray, bbox: List[int], output_dir: Path) -> str:
        """
        Crops face with 20% margin and saves to disk. Returns absolute file path.
        """
        top, right, bottom, left = bbox
        h, w, _ = image_rgb.shape
        margin_y = int((bottom - top) * 0.20)
        margin_x = int((right - left) * 0.20)

        y1 = max(0, top - margin_y)
        y2 = min(h, bottom + margin_y)
        x1 = max(0, left - margin_x)
        x2 = min(w, right + margin_x)

        face_crop = image_rgb[y1:y2, x1:x2]
        output_dir.mkdir(parents=True, exist_ok=True)
        filename = f"unknown_{uuid.uuid4().hex[:10]}.jpg"
        filepath = output_dir / filename

        face_bgr = cv2.cvtColor(face_crop, cv2.COLOR_RGB2BGR)
        cv2.imwrite(str(filepath), face_bgr)
        return str(filepath)

    def render_annotated_classroom_image(
        self,
        image_rgb: np.ndarray,
        recognized: List[Dict[str, Any]],
        unknown: List[Dict[str, Any]],
        spoofs: Optional[List[Dict[str, Any]]] = None,
        output_path: Optional[str] = None
    ) -> Optional[str]:
        """
        Draws bounding boxes and identification labels on classroom images.
        """
        annotated = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
        h, w, _ = annotated.shape
        font_scale = max(0.5, min(1.0, w / 1600.0))
        thickness = max(2, int(w / 700.0))

        # 1. Draw Recognized Students (Emerald Green)
        for rec in recognized:
            top, right, bottom, left = rec["bbox"]
            color = (34, 197, 94)  # Emerald Green (BGR)
            cv2.rectangle(annotated, (left, top), (right, bottom), color, thickness)
            label = f"{rec['student_name']} ({rec['confidence']}%)"
            (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_DUPLEX, font_scale, 1)
            cv2.rectangle(annotated, (left, max(0, top - lh - 14)), (left + lw + 14, top), color, cv2.FILLED)
            cv2.putText(annotated, label, (left + 7, max(lh + 4, top - 6)), cv2.FONT_HERSHEY_DUPLEX, font_scale, (255, 255, 255), 1, cv2.LINE_AA)

        # 2. Draw Unknown Faces (Vibrant Red)
        for unk in unknown:
            top, right, bottom, left = unk["bbox"]
            color = (239, 68, 68)  # Red (BGR)
            cv2.rectangle(annotated, (left, top), (right, bottom), color, thickness)
            label = f"Unknown ({unk.get('confidence', 0):.0f}%)" if unk.get("confidence", 0) > 0 else "Unknown Face"
            (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_DUPLEX, font_scale, 1)
            cv2.rectangle(annotated, (left, max(0, top - lh - 14)), (left + lw + 14, top), color, cv2.FILLED)
            cv2.putText(annotated, label, (left + 7, max(lh + 4, top - 6)), cv2.FONT_HERSHEY_DUPLEX, font_scale, (255, 255, 255), 1, cv2.LINE_AA)

        # 3. Draw Spoofed Presentation Attacks (Amber / Orange)
        if spoofs:
            for sp in spoofs:
                top, right, bottom, left = sp["bbox"]
                color = (0, 140, 255)  # Orange / Amber (BGR)
                liveness_pct = sp.get("liveness_score", 0) * 100.0
                label = f"SPOOF REJECTED (Live: {liveness_pct:.0f}%)"
                cv2.rectangle(annotated, (left, top), (right, bottom), color, thickness + 1)
                (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_DUPLEX, font_scale, 1)
                cv2.rectangle(annotated, (left, max(0, top - lh - 14)), (left + lw + 14, top), color, cv2.FILLED)
                cv2.putText(annotated, label, (left + 7, max(lh + 4, top - 6)), cv2.FONT_HERSHEY_DUPLEX, font_scale, (255, 255, 255), 1, cv2.LINE_AA)

        if output_path:
            cv2.imwrite(output_path, annotated)
        return output_path

    @abstractmethod
    def detect_face_locations(self, image_rgb: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """Detects bounding boxes in (top, right, bottom, left) format."""
        pass

    @abstractmethod
    def compute_face_encodings(
        self,
        image_rgb: np.ndarray,
        face_locations: Optional[List[Tuple[int, int, int, int]]] = None
    ) -> List[np.ndarray]:
        """Extracts 512-D ArcFace normalized embeddings."""
        pass

    @abstractmethod
    def extract_single_face_encoding(self, image_path_or_bytes: Any) -> Optional[List[float]]:
        """Extracts single normalized 512-D face embedding for student portrait registration."""
        pass

    @abstractmethod
    def evaluate_anti_spoofing(
        self,
        crop_rgb: np.ndarray,
        full_rgb: np.ndarray,
        bbox: Tuple[int, int, int, int],
        liveness_threshold: float = 0.50
    ) -> Tuple[bool, float, List[str]]:
        """Evaluates face liveness and presentation attack probability."""
        pass

    @abstractmethod
    def match_detected_faces(
        self,
        detected_encodings: List[np.ndarray],
        detected_locations: List[Tuple[int, int, int, int]],
        registered_students: Optional[List[Dict[str, Any]]] = None,
        tolerance: float = 0.50,
        enrolled_students: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Matches face embeddings with registered student embeddings."""
        pass

    @abstractmethod
    def process_classroom_session_photo(
        self,
        image_path_or_bytes: Any = None,
        registered_students: Optional[List[Dict[str, Any]]] = None,
        tolerance: Optional[float] = None,
        session_id: Optional[int] = None,
        image_path: Optional[str] = None,
        enrolled_students: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Processes a single classroom photo."""
        pass

    @abstractmethod
    def process_multi_classroom_photos(
        self,
        image_paths_or_bytes: Optional[List[Any]] = None,
        registered_students: Optional[List[Dict[str, Any]]] = None,
        tolerance: Optional[float] = None,
        session_id: Optional[int] = None,
        max_workers: int = 4,
        image_paths: Optional[List[str]] = None,
        enrolled_students: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Processes multi-camera / batch classroom photos."""
        pass
