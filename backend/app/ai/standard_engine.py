import os
import cv2
import json
import logging
import numpy as np
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Any, Union
from concurrent.futures import ThreadPoolExecutor

import torch
from ultralytics import YOLO
import onnxruntime as ort

from backend.app.core.config import settings
from backend.app.ai.base_engine import FaceAIEngine
from backend.app.ai.minifasnet import MiniFASNetV2AntiSpoofing

logger = logging.getLogger("StandardFaceAI")

# Optional fallback imports
try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except Exception:
    face_recognition = None
    FACE_RECOGNITION_AVAILABLE = False


class StandardFaceAIEngine(FaceAIEngine):
    """
    STANDARD Face Recognition Architecture:
    1. Camera -> YOLOv8-Face (Face Detection)
    2. MiniFASNetV2 (Anti-Spoofing / Presentation Attack Detection)
    3. ArcFace ResNet-50 (512-D High-Density Angular Embedding)
    4. Normalized Cosine Similarity Matching -> Attendance
    """

    def __init__(self):
        super().__init__()
        logger.info("[FaceAI] Selected architecture: STANDARD")

        # Device selection
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.onnx_providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if torch.cuda.is_available() else ["CPUExecutionProvider"]

        # 1. Load YOLOv8-Face
        logger.info("[FaceAI] Loading YOLOv8-Face")
        self.yolo_model = None
        self.yolo_path = settings.YOLO_FACE_MODEL_PATH
        if os.path.exists(self.yolo_path):
            try:
                self.yolo_model = YOLO(str(self.yolo_path))
                logger.info(f"[StandardFaceAI] YOLOv8-Face loaded successfully from {self.yolo_path} (device: {self.device})")
            except Exception as e:
                logger.error(f"[StandardFaceAI] Error loading YOLOv8-Face: {e}")
        else:
            logger.warning(f"[StandardFaceAI] YOLOv8-Face model file not found at {self.yolo_path}")

        # 2. Load MiniFASNetV2
        logger.info("[FaceAI] Loading MiniFASNetV2")
        self.minifasnet_path = settings.MINIFASNET_MODEL_PATH
        self.anti_spoof_engine = MiniFASNetV2AntiSpoofing(
            model_path=str(self.minifasnet_path) if os.path.exists(self.minifasnet_path) else None,
            device=self.device
        )

        # 3. Load ArcFace ResNet-50
        logger.info("[FaceAI] Loading ArcFace ResNet-50")
        self.arc_session = None
        self.arc_input_name = None
        self.arc_output_name = None
        self.arc_path = settings.ARCFACE_MODEL_PATH
        if os.path.exists(self.arc_path):
            try:
                self.arc_session = ort.InferenceSession(str(self.arc_path), providers=self.onnx_providers)
                self.arc_input_name = self.arc_session.get_inputs()[0].name
                self.arc_output_name = self.arc_session.get_outputs()[0].name
                logger.info(f"[StandardFaceAI] ArcFace ONNX loaded successfully from {self.arc_path}")
            except Exception as e:
                logger.error(f"[StandardFaceAI] Error loading ArcFace ONNX: {e}")
        else:
            logger.warning(f"[StandardFaceAI] ArcFace ONNX model file not found at {self.arc_path}")

        # Fallback Haar Cascade
        self.haar_frontal = None
        try:
            haar_path = cv2.data.haarcascades
            if os.path.exists(haar_path + 'haarcascade_frontalface_default.xml'):
                self.haar_frontal = cv2.CascadeClassifier(haar_path + 'haarcascade_frontalface_default.xml')
        except Exception:
            pass

    def detect_face_locations(self, image_rgb: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detects all faces in an RGB image using YOLOv8-Face.
        Returns coordinates in (top, right, bottom, left) format.
        """
        h, w, _ = image_rgb.shape
        face_locations = []

        if self.yolo_model is not None:
            try:
                image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
                results = self.yolo_model(image_bgr, conf=0.35, iou=0.45, verbose=False, device=self.device)

                for r in results:
                    boxes = r.boxes.xyxy.cpu().numpy()
                    for box in boxes:
                        x1, y1, x2, y2 = box[:4]
                        x1, y1, x2, y2 = int(max(0, x1)), int(max(0, y1)), int(min(w, x2)), int(min(h, y2))
                        w_box = x2 - x1
                        h_box = y2 - y1
                        if w_box >= self.min_face_size and h_box >= self.min_face_size:
                            aspect_ratio = w_box / max(1, h_box)
                            if 0.45 <= aspect_ratio <= 2.2:
                                face_locations.append((y1, x2, y2, x1))

                return face_locations
            except Exception as e:
                logger.warning(f"YOLOv8-Face detection failed, trying fallback: {e}")

        # Fallback to Haar Cascade only if YOLO model is unavailable
        if self.haar_frontal is not None:
            try:
                gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
                detected = self.haar_frontal.detectMultiScale(
                    gray,
                    scaleFactor=1.1,
                    minNeighbors=6,
                    minSize=(self.min_face_size, self.min_face_size)
                )
                for (x, y, fw, fh) in detected:
                    face_locations.append((y, x + fw, y + fh, x))
                if len(face_locations) > 0:
                    return face_locations
            except Exception as e:
                logger.warning(f"Haar Cascade fallback failed: {e}")

        # Fallback to face_recognition if available
        if FACE_RECOGNITION_AVAILABLE and face_recognition is not None:
            try:
                return face_recognition.face_locations(image_rgb, model="hog")
            except Exception:
                pass

        return []

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

            face_crop_rgb = image_rgb[top:bottom, left:right]

            # Primary: ArcFace ONNX Model
            if self.arc_session is not None:
                try:
                    face_bgr = cv2.cvtColor(face_crop_rgb, cv2.COLOR_RGB2BGR)
                    aligned = cv2.resize(face_bgr, (112, 112), interpolation=cv2.INTER_CUBIC)
                    blob = cv2.dnn.blobFromImage(
                        aligned,
                        scalefactor=1.0 / 127.5,
                        size=(112, 112),
                        mean=(127.5, 127.5, 127.5),
                        swapRB=True
                    )
                    feat = self.arc_session.run([self.arc_output_name], {self.arc_input_name: blob})[0]
                    feat = feat.flatten()
                    norm = np.linalg.norm(feat)
                    if norm > 0:
                        feat = feat / norm
                    encodings.append(feat)
                    continue
                except Exception as e:
                    logger.warning(f"ArcFace ONNX inference failed for face at {loc}: {e}")

            # Secondary: dlib face_recognition (128-D zero-padded to 512-D)
            if FACE_RECOGNITION_AVAILABLE and face_recognition is not None:
                try:
                    encs_128 = face_recognition.face_encodings(image_rgb, known_face_locations=[loc], num_jitters=1)
                    if len(encs_128) > 0:
                        e128 = encs_128[0]
                        e512 = np.pad(e128, (0, 384), mode='constant')
                        norm = np.linalg.norm(e512)
                        if norm > 0:
                            e512 = e512 / norm
                        encodings.append(e512)
                        continue
                except Exception as e:
                    logger.warning(f"face_recognition fallback failed: {e}")

            # Fallback 512-D descriptor
            desc = self.compute_fallback_512d_descriptor(face_crop_rgb)
            encodings.append(desc)

        return encodings

    def extract_single_face_encoding(self, image_path_or_bytes: Any) -> Optional[List[float]]:
        """
        Extracts a single normalized 512-D face embedding for student portrait registration.
        """
        try:
            image_rgb = self.load_and_orient_image(image_path_or_bytes)
            image_rgb = self.preprocess_image(image_rgb)
            locations = self.detect_face_locations(image_rgb)

            if len(locations) == 0:
                logger.warning(f"No face detected in portrait image: {image_path_or_bytes}")
                return None

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
        liveness_threshold: float = 0.50
    ) -> Tuple[bool, float, List[str]]:
        """
        Evaluates face liveness using MiniFASNetV2.
        """
        return self.anti_spoof_engine.evaluate_presentation_attack(
            crop_rgb=crop_rgb,
            full_rgb=full_rgb,
            bbox=bbox,
            liveness_threshold=liveness_threshold
        )

    def match_detected_faces(
        self,
        detected_encodings: List[np.ndarray],
        detected_locations: List[Tuple[int, int, int, int]],
        registered_students: Optional[List[Dict[str, Any]]] = None,
        tolerance: float = 0.50,
        enrolled_students: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Direct cosine similarity matching.
        """
        target_students = registered_students if registered_students is not None else (enrolled_students or [])
        recognized = []
        unknown = []

        if not detected_encodings or not detected_locations:
            return recognized, unknown

        assigned_students = set()
        candidates = []

        for idx, (face_vec, face_loc) in enumerate(zip(detected_encodings, detected_locations)):
            best_match = None
            best_sim = -1.0

            for student in target_students:
                s_id = student["id"]
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

                if isinstance(emb, list) and len(emb) > 0 and isinstance(emb[0], list):
                    sim = max([self.compute_cosine_similarity(face_vec, np.array(v, dtype=np.float32)) for v in emb])
                else:
                    sim = self.compute_cosine_similarity(face_vec, np.array(emb, dtype=np.float32))

                if sim > best_sim:
                    best_sim = sim
                    best_match = student

            candidates.append({
                "face_idx": idx,
                "bbox": face_loc,
                "best_match": best_match,
                "similarity": best_sim
            })

        candidates.sort(key=lambda c: c["similarity"], reverse=True)

        for c in candidates:
            idx = c["face_idx"]
            loc = c["bbox"]
            s = c["best_match"]
            sim = c["similarity"]

            if s is not None and sim >= tolerance and s["id"] not in assigned_students:
                assigned_students.add(s["id"])
                confidence = self.calculate_confidence_score(sim, threshold=tolerance)
                recognized.append({
                    "student_id": s["id"],
                    "student_name": s["name"],
                    "roll_number": s["roll_number"],
                    "bbox": list(loc),
                    "similarity": round(float(sim), 4),
                    "confidence": round(float(confidence), 1)
                })
            else:
                conf = self.calculate_confidence_score(sim, threshold=tolerance) if sim > 0.30 else 0.0
                unknown.append({
                    "bbox": list(loc),
                    "similarity": round(float(sim), 4) if sim > 0 else 0.0,
                    "confidence": round(float(conf), 1)
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
        Full End-to-End Standard Pipeline for a single photo.
        """
        target_img = image_path_or_bytes if image_path_or_bytes is not None else image_path
        target_students = registered_students if registered_students is not None else (enrolled_students or [])
        tol = tolerance if tolerance is not None else self.default_tolerance

        # 1. Ingest & Preprocess Image
        clean_rgb = self.load_and_orient_image(target_img)
        enhanced_rgb = self.preprocess_image(clean_rgb)
        h, w, _ = clean_rgb.shape

        # 2. YOLOv8 Face Detection (use enhanced for low-light boost, fallback to clean)
        raw_face_locations = self.detect_face_locations(enhanced_rgb)
        if not raw_face_locations:
            raw_face_locations = self.detect_face_locations(clean_rgb)

        live_locations = []
        spoofs = []

        # 3. Anti-Spoofing / Presentation Attack Check
        for f_i, loc in enumerate(raw_face_locations, 1):
            top, right, bottom, left = loc
            crop = clean_rgb[max(0, top):min(h, bottom), max(0, left):min(w, right)]

            is_live, liveness_score, reasons = self.evaluate_anti_spoofing(
                crop_rgb=crop,
                full_rgb=clean_rgb,
                bbox=loc,
                liveness_threshold=settings.SPOOF_CONFIDENCE_THRESHOLD
            )

            if not is_live:
                spoof_payload = {
                    "bbox": list(loc),
                    "is_live": False,
                    "is_spoof": True,
                    "liveness_score": float(liveness_score),
                    "spoof_reasons": reasons,
                    "source_photo_index": 0
                }
                spoofs.append(spoof_payload)
            else:
                live_locations.append(loc)

        # 4. ArcFace Embeddings on LIVE faces (using pristine natural colors)
        face_encodings = self.compute_face_encodings(clean_rgb, live_locations)

        # 5. Face Matching
        recognized, unknown = self.match_detected_faces(
            detected_encodings=face_encodings,
            detected_locations=live_locations,
            registered_students=target_students,
            tolerance=tol
        )

        # 6. Save unknown face crops (using pristine natural colors)
        for unk in unknown:
            try:
                crop_path = self.crop_and_save_face(clean_rgb, unk["bbox"], settings.UNKNOWN_FACES_DIR)
                unk["cropped_image_path"] = crop_path
            except Exception as e:
                logger.error(f"Error saving unknown face crop: {e}")
                unk["cropped_image_path"] = None

        # 7. Render annotated debug image (drawn on crisp, natural original photo)
        annotated_path = None
        try:
            import uuid
            output_filename = f"session_{session_id or 'anon'}_{uuid.uuid4().hex[:8]}_annotated.jpg"
            annotated_path = str(settings.SESSION_PHOTOS_DIR / output_filename)
            self.render_annotated_classroom_image(
                image_rgb=clean_rgb,
                recognized=recognized,
                unknown=unknown,
                spoofs=spoofs,
                output_path=annotated_path
            )
        except Exception as e:
            logger.error(f"Error rendering annotated image: {e}")

        logger.info(f"[StandardFaceAI] Session #{session_id or 'N/A'}: Detected={len(raw_face_locations)}, Recognized={len(recognized)}, Unknown={len(unknown)}, Spoofs={len(spoofs)}")

        return {
            "total_detected": len(raw_face_locations),
            "total_recognized": len(recognized),
            "total_unknown": len(unknown),
            "total_spoof": len(spoofs),
            "recognized": recognized,
            "unknown": unknown,
            "spoofs": spoofs,
            "processed_photo_path": annotated_path,
            "processed_photo_paths": [annotated_path] if annotated_path else [],
            "architecture": "STANDARD"
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
        Multi-Camera / Batch Classroom Attendance Processing (STANDARD Pipeline).
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

        all_recognized_map = {}
        all_unknown = []
        all_spoofs = []
        total_detected_count = 0
        assigned_students = set()

        def _process_single(idx_and_path):
            idx, path_item = idx_and_path
            res = self.process_classroom_session_photo(
                image_path_or_bytes=path_item,
                registered_students=target_students,
                tolerance=tol,
                session_id=session_id
            )
            return idx, res

        tasks = list(enumerate(target_paths))
        with ThreadPoolExecutor(max_workers=min(max_workers, len(tasks))) as executor:
            batch_results = list(executor.map(_process_single, tasks))

        batch_results.sort(key=lambda x: x[0])

        all_processed_paths = []
        for p_idx, res in batch_results:
            total_detected_count += res["total_detected"]
            all_spoofs.extend(res.get("spoofs", []))
            if res.get("processed_photo_path"):
                all_processed_paths.append(res["processed_photo_path"])

            for rec in res["recognized"]:
                s_id = rec["student_id"]
                if s_id not in all_recognized_map:
                    all_recognized_map[s_id] = rec
                    assigned_students.add(s_id)
                else:
                    if rec["similarity"] > all_recognized_map[s_id]["similarity"]:
                        all_recognized_map[s_id] = rec

            for unk in res["unknown"]:
                all_unknown.append(unk)

        final_recognized = list(all_recognized_map.values())
        first_processed_path = all_processed_paths[0] if all_processed_paths else None

        return {
            "total_detected": total_detected_count,
            "total_recognized": len(final_recognized),
            "total_unknown": len(all_unknown),
            "total_spoof": len(all_spoofs),
            "recognized": final_recognized,
            "unknown": all_unknown,
            "spoofs": all_spoofs,
            "processed_photo_path": first_processed_path,
            "processed_photo_paths": all_processed_paths,
            "total_photos_processed": len(target_paths),
            "architecture": "STANDARD"
        }
