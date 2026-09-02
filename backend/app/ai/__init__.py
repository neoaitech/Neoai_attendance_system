"""
VisionAttend AI Core Module
- Detection: YOLOv8-Face multi-scale CNN face localization
- Recognition: ArcFace ResNet-50 512-D angular hypersphere embeddings
- Metric: Normalized Cosine Similarity with Ambiguity Margin Protection
- Liveness Guard: 2D FFT Frequency Lattice & Specular Glare Anti-Spoofing
"""
from backend.app.ai.base_engine import FaceAIEngine
from backend.app.ai.face_engine import FaceEngine, FACE_RECOGNITION_AVAILABLE
from backend.app.ai.standard_engine import StandardFaceAIEngine
from backend.app.ai.advanced_engine import AdvancedFaceAIEngine
from backend.app.ai.router import FaceAIRouter, face_ai_router, face_ai_router as face_engine

__all__ = [
    "FaceAIEngine",
    "FaceEngine",
    "face_engine",
    "FACE_RECOGNITION_AVAILABLE",
    "StandardFaceAIEngine",
    "AdvancedFaceAIEngine",
    "FaceAIRouter",
    "face_ai_router"
]
