import os
import cv2
import json
import logging
import numpy as np
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Any, Union

import torch
from ultralytics import YOLO
import onnxruntime as ort

from backend.app.core.config import settings
from backend.app.ai.base_engine import FaceAIEngine
from backend.app.ai.minifasnet import MiniFASNetV2AntiSpoofing

logger = logging.getLogger("AdvancedFaceAI")


class AdvancedFaceAIEngine(FaceAIEngine):
    """
    ADVANCED Face Recognition Architecture (Photo-Based High-Reliability Pipeline):
    1. Single Classroom Photo -> YOLOv8-Face (Face Detection)
    2. Face Quality Assessment (Size, Laplacian Sharpness/Blur, Lighting/Illumination)
    3. MiniFASNetV2 (Anti-Spoofing / Presentation Attack Detection)
    4. ArcFace ResNet-50 (512-D High-Density Angular Embedding)
    5. Robust Identity Matching (Top-1 / Top-2 Cosine Similarity Margin Analysis)
    6. Confidence & Ambiguity Validation
    7. Duplicate Identity Protection -> Attendance
    """

    def __init__(self):
        super().__init__()
        logger.info("[FaceAI] Selected architecture: ADVANCED")

        # Device selection
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.onnx_providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if torch.cuda.is_available() else ["CPUExecutionProvider"]

        # Quality & Robust Matching Configuration (internally configurable)
        self.min_quality_face_size = 28          # Minimum width/height in pixels
        self.min_blur_threshold = 12.0           # Laplacian variance threshold (rejects severe blur)
        self.min_brightness = 15.0               # Minimum mean grayscale luminance (rejects pitch dark)
        self.max_brightness = 248.0              # Maximum mean grayscale luminance (rejects blown out/washed out)
        self.min_identity_margin = 0.05          # Minimum margin between Top-1 and Top-2 similarity

        # 1. Load YOLOv8-Face
        logger.info("[FaceAI] Loading YOLOv8-Face")
        self.yolo_path = settings.YOLO_FACE_MODEL_PATH
        if not os.path.exists(self.yolo_path):
            err_msg = f"Advanced Face AI Architecture could not be initialized. YOLOv8-Face model file not found at {self.yolo_path}."
            logger.error(err_msg)
            raise RuntimeError(err_msg)

        try:
            self.yolo_model = YOLO(str(self.yolo_path))
            logger.info(f"[AdvancedFaceAI] YOLOv8-Face initialized successfully from {self.yolo_path} (device: {self.device})")
        except Exception as e:
            err_msg = f"Advanced Face AI Architecture could not be initialized. Failed to load YOLOv8-Face model: {e}."
            logger.error(err_msg)
            raise RuntimeError(err_msg)

        # 2. Initializing Face Quality Assessment
        logger.info("[FaceAI] Initializing Face Quality Assessment")

        # 3. Load MiniFASNetV2 Anti-Spoofing
        logger.info("[FaceAI] Loading MiniFASNetV2")
        self.minifasnet_path = settings.MINIFASNET_MODEL_PATH
        try:
            self.anti_spoof_engine = MiniFASNetV2AntiSpoofing(
                model_path=str(self.minifasnet_path) if os.path.exists(self.minifasnet_path) else None,
                device=self.device
            )
        except Exception as e:
            err_msg = f"Advanced Face AI Architecture could not be initialized. Failed to load MiniFASNetV2: {e}."
            logger.error(err_msg)
            raise RuntimeError(err_msg)

        # 4. Load ArcFace Model
        logger.info("[FaceAI] Loading ArcFace")
        self.arc_path = settings.ARCFACE_MODEL_PATH
        if not os.path.exists(self.arc_path):
            err_msg = f"Advanced Face AI Architecture could not be initialized. ArcFace model file not found at {self.arc_path}."
            logger.error(err_msg)
            raise RuntimeError(err_msg)

        try:
            self.arc_session = ort.InferenceSession(str(self.arc_path), providers=self.onnx_providers)
            self.arc_input_name = self.arc_session.get_inputs()[0].name
            self.arc_output_name = self.arc_session.get_outputs()[0].name
            logger.info(f"[AdvancedFaceAI] ArcFace ONNX loaded successfully from {self.arc_path}")
        except Exception as e:
            err_msg = f"Advanced Face AI Architecture could not be initialized. Failed to load ArcFace ONNX: {e}."
            logger.error(err_msg)
            raise RuntimeError(err_msg)

        # 5. Initializing Robust Identity Matcher
        logger.info("[FaceAI] Initializing robust identity matcher")

    def _detect_boxes_and_scores(self, image_bgr: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Runs YOLOv8-Face detection and returns (bboxes_xyxy, scores).
        """
        try:
            results = self.yolo_model(image_bgr, conf=0.30, iou=0.45, verbose=False, device=self.device)
            bboxes_list = []
            scores_list = []
            for r in results:
                b = r.boxes.xyxy.cpu().numpy()
                s = r.boxes.conf.cpu().numpy()
                if len(b) > 0:
                    bboxes_list.append(b)
                    scores_list.append(s)
            if not bboxes_list:
                return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.float32)
            bboxes = np.vstack(bboxes_list)
            scores = np.concatenate(scores_list)
            return bboxes, scores
        except Exception as e:
            logger.error(f"[AdvancedFaceAI] YOLOv8 detection error: {e}")
            return np.empty((0, 4), dtype=np.float32), np.empty((0,), dtype=np.float32)

    def assess_face_quality(
        self,
        face_crop_rgb: np.ndarray,
        bbox: Tuple[int, int, int, int],
        image_shape: Tuple[int, int]
    ) -> Tuple[bool, float, List[str]]:
        """
        Stage 2: Advanced Face Quality Assessment
        Evaluates each detected face independently for:
        - Minimum dimensions (width / height)
        - Sharpness / Blur (Variance of Laplacian)
        - Illumination / Lighting (Underexposure / Overexposure)
        - Aspect ratio anomalies

        Returns (is_quality_pass, quality_score, rejection_reasons)
        """
        top, right, bottom, left = bbox
        w_box = max(0, right - left)
        h_box = max(0, bottom - top)
        reasons = []

        if face_crop_rgb is None or face_crop_rgb.size == 0 or w_box <= 0 or h_box <= 0:
            return False, 0.0, ["Invalid or empty face crop"]

        # 1. Minimum Face Size Check
        if w_box < self.min_quality_face_size or h_box < self.min_quality_face_size:
            reasons.append(f"Face resolution too small ({w_box}x{h_box}px < {self.min_quality_face_size}px minimum)")

        # 2. Aspect Ratio Anomaly Check
        aspect = float(w_box) / float(max(1, h_box))
        if aspect < 0.45 or aspect > 2.2:
            reasons.append(f"Abnormal face aspect ratio ({aspect:.2f})")

        # Convert crop to grayscale for image processing checks
        gray_crop = cv2.cvtColor(face_crop_rgb, cv2.COLOR_RGB2GRAY) if face_crop_rgb.ndim == 3 else face_crop_rgb

        # 3. Blur / Sharpness Check using Variance of Laplacian
        try:
            lap_var = float(cv2.Laplacian(gray_crop, cv2.CV_64F).var())
            # For very small crops, normalize Laplacian variance
            norm_lap_var = lap_var / max(1.0, (w_box * h_box) / 1600.0)
            if lap_var < self.min_blur_threshold and w_box >= 40:
                reasons.append(f"Severe motion blur / defocus detected (sharpness: {lap_var:.1f} < {self.min_blur_threshold})")
        except Exception:
            lap_var = 50.0

        # 4. Lighting / Illumination Check
        mean_lum = float(np.mean(gray_crop))
        if mean_lum < self.min_brightness:
            reasons.append(f"Severe underexposure / pitch dark face (luminance: {mean_lum:.1f} < {self.min_brightness})")
        elif mean_lum > self.max_brightness:
            reasons.append(f"Severe overexposure / washed out face (luminance: {mean_lum:.1f} > {self.max_brightness})")

        is_pass = len(reasons) == 0
        quality_score = max(0.0, min(1.0, (mean_lum / 128.0) * (min(100.0, lap_var) / 100.0)))

        return is_pass, quality_score, reasons

    def detect_face_locations(self, image_rgb: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detects all faces in RGB image using YOLOv8-Face.
        Returns coordinates in (top, right, bottom, left) format.
        """
        h, w, _ = image_rgb.shape
        image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
        bboxes_xyxy, scores = self._detect_boxes_and_scores(image_bgr)

        face_locations = []
        for box in bboxes_xyxy:
            x1, y1, x2, y2 = box[:4]
            x1, y1, x2, y2 = int(max(0, x1)), int(max(0, y1)), int(min(w, x2)), int(min(h, y2))
            if (x2 - x1) >= self.min_face_size and (y2 - y1) >= self.min_face_size:
                face_locations.append((y1, x2, y2, x1))

        return face_locations

    def compute_face_encodings(
        self,
        image_rgb: np.ndarray,
        face_locations: Optional[List[Tuple[int, int, int, int]]] = None
    ) -> List[np.ndarray]:
        """
        Computes 512-D ArcFace feature vectors for each detected face box.
        """
        if face_locations is None:
            face_locations = self.detect_face_locations(image_rgb)

        if not face_locations:
            return []

        encodings = []
        h, w, _ = image_rgb.shape

        for loc in face_locations:
            top, right, bottom, left = loc
            top = max(0, top)
            left = max(0, left)
            bottom = min(h, bottom)
            right = min(w, right)

            if bottom <= top or right <= left:
                continue

            crop = image_rgb[top:bottom, left:right]
            if crop.size == 0:
                continue

            # ArcFace Preprocessing: 112x112 normalized input
            try:
                resized = cv2.resize(crop, (112, 112), interpolation=cv2.INTER_LINEAR)
                blob = cv2.dnn.blobFromImage(
                    resized,
                    scalefactor=1.0 / 127.5,
                    size=(112, 112),
                    mean=(127.5, 127.5, 127.5),
                    swapRB=False
                )
                embedding = self.arc_session.run([self.arc_output_name], {self.arc_input_name: blob})[0][0]
                norm = np.linalg.norm(embedding)
                if norm > 0:
                    embedding = embedding / norm
                encodings.append(embedding.astype(np.float32))
            except Exception as e:
                logger.error(f"[AdvancedFaceAI] ArcFace extraction error: {e}")
                fallback = self.compute_fallback_512d_descriptor(crop)
                encodings.append(fallback)

        return encodings

    def extract_single_face_encoding(self, image_path_or_bytes: Any) -> Optional[List[float]]:
        """
        Extracts 512-D face encoding from a single portrait image.
        """
        try:
            image_rgb = self.load_and_orient_image(image_path_or_bytes)
            image_rgb = self.preprocess_image(image_rgb)
            locations = self.detect_face_locations(image_rgb)

            if len(locations) == 0:
                h, w, _ = image_rgb.shape
                locations = [(0, w, h, 0)]

            encodings = self.compute_face_encodings(image_rgb, [locations[0]])
            if len(encodings) > 0:
                return encodings[0].tolist()
            return None
        except Exception as e:
            logger.error(f"Failed to extract face encoding: {e}")
            return None

    def evaluate_anti_spoofing(
        self,
        crop_rgb: np.ndarray,
        full_rgb: np.ndarray,
        bbox: Tuple[int, int, int, int],
        liveness_threshold: Optional[float] = None
    ) -> Tuple[bool, float, List[str]]:
        """
        Evaluates presentation attack using MiniFASNetV2.
        """
        thresh = liveness_threshold or settings.SPOOF_CONFIDENCE_THRESHOLD
        if self.anti_spoof_engine is not None:
            return self.anti_spoof_engine.evaluate_presentation_attack(
                crop_rgb=crop_rgb,
                full_rgb=full_rgb,
                bbox=bbox,
                liveness_threshold=thresh
            )
        return True, 0.95, []

    def robust_identity_match(
        self,
        face_vec: np.ndarray,
        target_students: List[Dict[str, Any]],
        tolerance: float,
        min_margin: float
    ) -> Tuple[str, Optional[Dict[str, Any]], float, float, float, Optional[str]]:
        """
        Stage 5: Robust Identity Matching (Top-1 / Top-2 Analysis with Ambiguity Validation)
        Returns:
          (status, best_student, top1_sim, top2_sim, confidence, rejection_reason)
        Status can be: "RECOGNIZED", "UNKNOWN", "AMBIGUOUS"
        """
        if not target_students or face_vec is None:
            return "UNKNOWN", None, 0.0, 0.0, 0.0, "No enrolled students available"

        candidate_scores: List[Tuple[float, Dict[str, Any]]] = []

        for student in target_students:
            emb_raw = student.get("embedding")
            if emb_raw is None:
                continue

            if isinstance(emb_raw, str):
                try:
                    emb = json.loads(emb_raw)
                except Exception:
                    continue
            else:
                emb = emb_raw

            # Multi-embedding support (list of embeddings per student)
            if isinstance(emb, list) and len(emb) > 0 and isinstance(emb[0], list):
                sim = max([self.compute_cosine_similarity(face_vec, np.array(v, dtype=np.float32)) for v in emb])
            else:
                sim = self.compute_cosine_similarity(face_vec, np.array(emb, dtype=np.float32))

            candidate_scores.append((float(sim), student))

        if not candidate_scores:
            return "UNKNOWN", None, 0.0, 0.0, 0.0, "No valid student embeddings"

        # Sort candidates descending by similarity
        candidate_scores.sort(key=lambda x: x[0], reverse=True)

        top1_sim, top1_student = candidate_scores[0]
        top2_sim, top2_student = (candidate_scores[1][0], candidate_scores[1][1]) if len(candidate_scores) > 1 else (0.0, None)

        # 1. Match Threshold Validation
        if top1_sim < tolerance:
            conf = self.calculate_confidence_score(top1_sim, threshold=tolerance) if top1_sim > 0.30 else 0.0
            reason = f"Top-1 similarity ({top1_sim:.3f}) below threshold ({tolerance:.3f})"
            return "UNKNOWN", None, top1_sim, top2_sim, conf, reason

        # 2. Ambiguity Validation (Top-1 vs Top-2 Margin Check)
        margin = top1_sim - top2_sim
        if top2_student is not None and top2_sim >= (tolerance - 0.10) and margin < min_margin:
            conf = self.calculate_confidence_score(top1_sim, threshold=tolerance)
            reason = f"Ambiguous match between {top1_student.get('name', 'Student 1')} ({top1_sim:.3f}) and {top2_student.get('name', 'Student 2')} ({top2_sim:.3f}) - margin ({margin:.3f}) < {min_margin:.3f}"
            return "AMBIGUOUS", top1_student, top1_sim, top2_sim, conf, reason

        # 3. Confident Recognition
        confidence = self.calculate_confidence_score(top1_sim, threshold=tolerance)
        return "RECOGNIZED", top1_student, top1_sim, top2_sim, confidence, None

    def match_detected_faces(
        self,
        detected_encodings: List[np.ndarray],
        detected_locations: List[Tuple[int, int, int, int]],
        registered_students: Optional[List[Dict[str, Any]]] = None,
        tolerance: Optional[float] = None,
        enrolled_students: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Matches detected encodings against registered students using Robust Identity Matcher.
        """
        target_students = registered_students if registered_students is not None else (enrolled_students or [])
        tol = tolerance if tolerance is not None else self.default_tolerance
        recognized = []
        unknown = []
        assigned_students = set()

        for face_vec, loc in zip(detected_encodings, detected_locations):
            status, match_student, top1_sim, top2_sim, conf, reason = self.robust_identity_match(
                face_vec=face_vec,
                target_students=target_students,
                tolerance=tol,
                min_margin=self.min_identity_margin
            )

            if status == "RECOGNIZED" and match_student is not None and match_student["id"] not in assigned_students:
                assigned_students.add(match_student["id"])
                recognized.append({
                    "student_id": match_student["id"],
                    "student_name": match_student["name"],
                    "roll_number": match_student["roll_number"],
                    "department": match_student.get("department", "Computer Science"),
                    "program": match_student.get("program", "B.Tech"),
                    "semester": match_student.get("semester", "Semester 1"),
                    "section": match_student.get("section", "A"),
                    "bbox": list(loc),
                    "similarity": round(float(top1_sim), 4),
                    "confidence": round(float(conf), 1)
                })
            else:
                unknown.append({
                    "bbox": list(loc),
                    "similarity": round(float(top1_sim), 4) if top1_sim > 0 else 0.0,
                    "confidence": round(float(conf), 1),
                    "rejection_reason": reason or ("Duplicate identity assignment" if status == "RECOGNIZED" else "Unrecognized identity")
                })

        return recognized, unknown

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
        """
        ADVANCED Photo-Based Recognition Pipeline:
        1. Single Classroom Photo -> YOLOv8-Face Detection
        2. Face Quality Assessment (Size, Blur, Lighting)
        3. MiniFASNetV2 Anti-Spoofing
        4. ArcFace 512-D Normalized Embedding
        5. Robust Identity Matching (Top-1 / Top-2 Margin Check)
        6. Duplicate Identity Protection
        7. Attendance Output
        """
        target_img = image_path_or_bytes if image_path_or_bytes is not None else image_path
        target_students = registered_students if registered_students is not None else (enrolled_students or [])
        tol = tolerance if tolerance is not None else self.default_tolerance

        image_rgb = self.load_and_orient_image(target_img)
        image_rgb = self.preprocess_image(image_rgb)
        h, w, _ = image_rgb.shape
        image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)

        # 1. YOLOv8-Face Detection
        bboxes_xyxy, det_scores = self._detect_boxes_and_scores(image_bgr)

        recognized_candidates = []
        unknown = []
        spoofs = []
        low_quality = []

        for idx, box in enumerate(bboxes_xyxy):
            x1, y1, x2, y2 = box[:4]
            x1, y1, x2, y2 = int(max(0, x1)), int(max(0, y1)), int(min(w, x2)), int(min(h, y2))

            if (x2 - x1) <= 0 or (y2 - y1) <= 0:
                continue

            loc = (y1, x2, y2, x1)  # top, right, bottom, left
            crop = image_rgb[y1:y2, x1:x2]

            # 2. Face Quality Assessment
            is_quality_pass, quality_score, quality_reasons = self.assess_face_quality(
                face_crop_rgb=crop,
                bbox=loc,
                image_shape=(h, w)
            )

            if not is_quality_pass:
                crop_path = None
                try:
                    crop_path = self.crop_and_save_face(image_rgb, list(loc), settings.UNKNOWN_FACES_DIR)
                except Exception:
                    pass
                item = {
                    "face_index": idx + 1,
                    "bbox": list(loc),
                    "status": "LOW_QUALITY",
                    "similarity": 0.0,
                    "confidence": 0.0,
                    "quality_score": round(float(quality_score), 3),
                    "reasons": quality_reasons,
                    "cropped_image_path": crop_path
                }
                low_quality.append(item)
                unknown.append(item)
                continue

            # 3. MiniFASNetV2 Anti-Spoofing (PAD)
            is_live, liveness_score, spoof_reasons = self.evaluate_anti_spoofing(
                crop_rgb=crop,
                full_rgb=image_rgb,
                bbox=loc,
                liveness_threshold=settings.SPOOF_CONFIDENCE_THRESHOLD
            )

            if not is_live:
                spoof_payload = {
                    "face_index": idx + 1,
                    "bbox": list(loc),
                    "status": "SPOOF",
                    "is_live": False,
                    "is_spoof": True,
                    "liveness_score": float(liveness_score),
                    "spoof_reasons": spoof_reasons,
                    "source_photo_index": 0
                }
                spoofs.append(spoof_payload)
                continue

            # 4. ArcFace 512-D Normalized Embedding
            encs = self.compute_face_encodings(image_rgb, [loc])
            if not encs:
                crop_path = None
                try:
                    crop_path = self.crop_and_save_face(image_rgb, list(loc), settings.UNKNOWN_FACES_DIR)
                except Exception:
                    pass
                unknown.append({
                    "face_index": idx + 1,
                    "bbox": list(loc),
                    "status": "UNKNOWN",
                    "similarity": 0.0,
                    "confidence": 0.0,
                    "reasons": ["Failed to extract facial embedding"],
                    "cropped_image_path": crop_path
                })
                continue

            face_vec = encs[0]

            # 5. Robust Identity Matching (Top-1 / Top-2 Margin & Ambiguity Validation)
            status, match_student, top1_sim, top2_sim, conf, match_reason = self.robust_identity_match(
                face_vec=face_vec,
                target_students=target_students,
                tolerance=tol,
                min_margin=self.min_identity_margin
            )

            if status == "RECOGNIZED" and match_student is not None:
                recognized_candidates.append({
                    "face_index": idx + 1,
                    "student_id": match_student["id"],
                    "student_name": match_student["name"],
                    "roll_number": match_student["roll_number"],
                    "bbox": list(loc),
                    "similarity": round(float(top1_sim), 4),
                    "top2_similarity": round(float(top2_sim), 4),
                    "confidence": round(float(conf), 1),
                    "liveness_score": round(float(liveness_score), 4),
                    "quality_score": round(float(quality_score), 3),
                    "status": "RECOGNIZED"
                })
            else:
                crop_path = None
                try:
                    crop_path = self.crop_and_save_face(image_rgb, list(loc), settings.UNKNOWN_FACES_DIR)
                except Exception:
                    pass

                unknown.append({
                    "face_index": idx + 1,
                    "bbox": list(loc),
                    "status": status,
                    "similarity": round(float(top1_sim), 4) if top1_sim > 0 else 0.0,
                    "top2_similarity": round(float(top2_sim), 4) if top2_sim > 0 else 0.0,
                    "confidence": round(float(conf), 1),
                    "liveness_score": round(float(liveness_score), 4),
                    "quality_score": round(float(quality_score), 3),
                    "reasons": [match_reason] if match_reason else [f"Status: {status}"],
                    "cropped_image_path": crop_path
                })

        # 6. Duplicate Identity Protection
        # If multiple face boxes matched the same student, keep the highest similarity/confidence one
        recognized = []
        seen_student_ids = {}

        # Sort candidates descending by similarity so highest confidence is processed first
        recognized_candidates.sort(key=lambda x: x["similarity"], reverse=True)

        for cand in recognized_candidates:
            sid = cand["student_id"]
            if sid not in seen_student_ids:
                seen_student_ids[sid] = cand
                recognized.append(cand)
            else:
                # Duplicate face in same photo matching the same student
                crop_path = None
                try:
                    crop_path = self.crop_and_save_face(image_rgb, cand["bbox"], settings.UNKNOWN_FACES_DIR)
                except Exception:
                    pass
                unknown.append({
                    "face_index": cand["face_index"],
                    "bbox": cand["bbox"],
                    "status": "DUPLICATE",
                    "similarity": cand["similarity"],
                    "confidence": cand["confidence"],
                    "liveness_score": cand["liveness_score"],
                    "quality_score": cand["quality_score"],
                    "reasons": [f"Duplicate detection for {cand['student_name']} (superseded by higher confidence match)"],
                    "cropped_image_path": crop_path
                })

        # 7. Render annotated debug image
        annotated_path = None
        try:
            import uuid
            output_filename = f"session_{session_id or 'anon'}_{uuid.uuid4().hex[:8]}_annotated.jpg"
            annotated_path = str(settings.SESSION_PHOTOS_DIR / output_filename)
            self.render_annotated_classroom_image(
                image_rgb=image_rgb,
                recognized=recognized,
                unknown=unknown,
                spoofs=spoofs,
                output_path=annotated_path
            )
        except Exception as e:
            logger.error(f"Error rendering annotated image: {e}")

        logger.info(f"[AdvancedFaceAI] Session #{session_id or 'N/A'}: Detected={len(bboxes_xyxy)}, Recognized={len(recognized)}, Unknown={len(unknown)}, Spoofs={len(spoofs)}, LowQuality={len(low_quality)}")

        return {
            "total_detected": len(bboxes_xyxy),
            "total_recognized": len(recognized),
            "total_unknown": len(unknown),
            "total_spoof": len(spoofs),
            "total_low_quality": len(low_quality),
            "recognized": recognized,
            "unknown": unknown,
            "spoofs": spoofs,
            "processed_photo_path": annotated_path,
            "processed_photo_paths": [annotated_path] if annotated_path else [],
            "architecture": "ADVANCED"
        }

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
        """
        Processes batch/multi-photo classroom images independently using the photo-based Advanced pipeline.
        Aggregates recognized students with duplicate protection across photos.
        """
        target_paths = image_paths_or_bytes if image_paths_or_bytes is not None else (image_paths or [])
        target_students = registered_students if registered_students is not None else (enrolled_students or [])
        tol = tolerance if tolerance is not None else self.default_tolerance

        if len(target_paths) == 1:
            return self.process_classroom_session_photo(
                image_path_or_bytes=target_paths[0],
                registered_students=target_students,
                tolerance=tol,
                session_id=session_id
            )

        total_detected = 0
        all_recognized = []
        all_unknown = []
        all_spoofs = []
        annotated_photo_paths = []

        seen_student_ids = {}

        for frame_idx, img_item in enumerate(target_paths):
            res = self.process_classroom_session_photo(
                image_path_or_bytes=img_item,
                registered_students=target_students,
                tolerance=tol,
                session_id=session_id
            )
            total_detected += res.get("total_detected", 0)
            if res.get("processed_photo_path"):
                annotated_photo_paths.append(res["processed_photo_path"])

            all_unknown.extend(res.get("unknown", []))
            all_spoofs.extend(res.get("spoofs", []))

            # Cross-photo duplicate protection: keep highest similarity
            for rec in res.get("recognized", []):
                sid = rec["student_id"]
                if sid not in seen_student_ids:
                    seen_student_ids[sid] = rec
                    all_recognized.append(rec)
                elif rec["similarity"] > seen_student_ids[sid]["similarity"]:
                    # Replace with higher similarity match
                    idx_to_replace = all_recognized.index(seen_student_ids[sid])
                    all_recognized[idx_to_replace] = rec
                    seen_student_ids[sid] = rec

        primary_annotated_path = annotated_photo_paths[0] if annotated_photo_paths else None

        return {
            "total_detected": total_detected,
            "total_recognized": len(all_recognized),
            "total_unknown": len(all_unknown),
            "total_spoof": len(all_spoofs),
            "recognized": all_recognized,
            "unknown": all_unknown,
            "spoofs": all_spoofs,
            "processed_photo_path": primary_annotated_path,
            "processed_photo_paths": annotated_photo_paths,
            "total_photos_processed": len(target_paths),
            "architecture": "ADVANCED"
        }
