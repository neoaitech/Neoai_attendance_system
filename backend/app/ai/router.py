import logging
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.ai.base_engine import FaceAIEngine
from backend.app.ai.standard_engine import StandardFaceAIEngine

logger = logging.getLogger("FaceAIRouter")


class FaceAIRouter(FaceAIEngine):
    """
    Dynamic Face AI Architecture Router.
    Routes inference requests to the active architecture (STANDARD or ADVANCED)
    with on-demand lazy model loading and zero downtime hot-switching.
    """

    def __init__(self):
        super().__init__()
        self._active_architecture: str = "STANDARD"
        self._engines: Dict[str, Optional[FaceAIEngine]] = {
            "STANDARD": None,
            "ADVANCED": None
        }

    def get_active_architecture(self, db: Optional[Session] = None) -> str:
        """
        Retrieves the currently configured architecture name from DB (or memory).
        Defaults to STANDARD if unconfigured.
        """
        if db is not None:
            try:
                from backend.app.db.models import SystemSetting
                setting = db.query(SystemSetting).filter(SystemSetting.key == "face_ai_architecture").first()
                if setting and setting.value in ["STANDARD", "ADVANCED"]:
                    self._active_architecture = setting.value
            except Exception as e:
                logger.warning(f"Could not read face_ai_architecture from DB: {e}")

        return self._active_architecture

    def set_active_architecture(self, architecture: str, db: Optional[Session] = None) -> str:
        """
        Hot-switches the active architecture.
        """
        arch_upper = str(architecture).strip().upper()
        if arch_upper not in ["STANDARD", "ADVANCED"]:
            raise ValueError(f"Invalid Face AI Architecture: '{architecture}'. Allowed values: STANDARD, ADVANCED")

        self._active_architecture = arch_upper
        logger.info(f"[FaceAI] Switched active architecture to: {self._active_architecture}")

        # Pre-warm/validate target engine
        self.get_engine(self._active_architecture)

        return self._active_architecture

    def get_engine(self, architecture: Optional[str] = None, db: Optional[Session] = None) -> FaceAIEngine:
        """
        Resolves and returns the active FaceAIEngine instance, lazy-loading models on demand.
        """
        arch = architecture.upper() if architecture else self.get_active_architecture(db)

        if arch not in ["STANDARD", "ADVANCED"]:
            arch = "STANDARD"

        # Lazy loading
        if self._engines[arch] is None:
            if arch == "STANDARD":
                logger.info("[FaceAI] Initializing STANDARD Architecture engine...")
                self._engines["STANDARD"] = StandardFaceAIEngine()
            elif arch == "ADVANCED":
                logger.info("[FaceAI] Initializing ADVANCED Architecture engine...")
                try:
                    from backend.app.ai.advanced_engine import AdvancedFaceAIEngine
                    self._engines["ADVANCED"] = AdvancedFaceAIEngine()
                except Exception as e:
                    err_msg = (
                        "Advanced Face AI Architecture could not be initialized.\n"
                        "One or more required AI components are unavailable.\n"
                        f"Details: {e}\n"
                        "Please verify the Advanced AI dependencies and model files."
                    )
                    logger.error(err_msg)
                    raise RuntimeError(err_msg)

        return self._engines[arch]

    # ================= Proxy Delegate Methods =================

    def detect_face_locations(self, image_rgb: Any) -> List[Tuple[int, int, int, int]]:
        return self.get_engine().detect_face_locations(image_rgb)

    def compute_face_encodings(self, image_rgb: Any, face_locations: Optional[List[Tuple[int, int, int, int]]] = None) -> List[Any]:
        return self.get_engine().compute_face_encodings(image_rgb, face_locations)

    def extract_single_face_encoding(self, image_path_or_bytes: Any) -> Optional[List[float]]:
        return self.get_engine().extract_single_face_encoding(image_path_or_bytes)

    def evaluate_anti_spoofing(self, crop_rgb: Any, full_rgb: Any, bbox: Tuple[int, int, int, int], liveness_threshold: float = 0.50) -> Tuple[bool, float, List[str]]:
        return self.get_engine().evaluate_anti_spoofing(crop_rgb, full_rgb, bbox, liveness_threshold)

    def match_detected_faces(self, *args, **kwargs) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        return self.get_engine().match_detected_faces(*args, **kwargs)

    def process_classroom_session_photo(self, *args, **kwargs) -> Dict[str, Any]:
        return self.get_engine().process_classroom_session_photo(*args, **kwargs)

    def process_multi_classroom_photos(self, *args, **kwargs) -> Dict[str, Any]:
        return self.get_engine().process_multi_classroom_photos(*args, **kwargs)


# Global singleton router instance
face_ai_router = FaceAIRouter()
