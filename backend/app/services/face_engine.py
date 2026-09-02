"""
FaceEngine Service Facade (Backward-Compatible Architecture Router)
Routes calls dynamically to the active architecture (STANDARD vs ADVANCED).
"""
from backend.app.ai.router import face_ai_router as face_engine
from backend.app.ai.face_engine import FaceEngine, FACE_RECOGNITION_AVAILABLE

__all__ = ["FaceEngine", "face_engine", "FACE_RECOGNITION_AVAILABLE"]
