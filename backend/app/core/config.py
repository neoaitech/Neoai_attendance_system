import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Root directory resolution
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BACKEND_DIR.parent

class Settings(BaseSettings):
    PROJECT_ROOT: Path = PROJECT_ROOT
    BACKEND_DIR: Path = BACKEND_DIR
    BASE_DIR: Path = BACKEND_DIR
    PROJECT_NAME: str = "VisionAttend Pro - AI Classroom Attendance System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "super-secret-key-vision-attend-pro-2026-production-ready"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 8 * 60  # 8 hours

    # Database
    DATABASE_DIR: Path = PROJECT_ROOT / "database"
    DATABASE_URL: str = f"sqlite:///{PROJECT_ROOT / 'database' / 'attendance.db' if (PROJECT_ROOT / 'database' / 'attendance.db').exists() else BACKEND_DIR / 'attendance.db'}"

    # Data & Storage
    DATA_DIR: Path = PROJECT_ROOT / "data"
    UPLOAD_DIR: Path = (PROJECT_ROOT / "data" / "uploads") if (PROJECT_ROOT / "data" / "uploads").exists() else (BACKEND_DIR / "uploads")
    STUDENT_PHOTOS_DIR: Path = UPLOAD_DIR / "students"
    SESSION_PHOTOS_DIR: Path = UPLOAD_DIR / "sessions"
    UNKNOWN_FACES_DIR: Path = UPLOAD_DIR / "unknown_faces"
    REPORTS_DIR: Path = (PROJECT_ROOT / "data" / "reports_cache") if (PROJECT_ROOT / "data" / "reports_cache").exists() else (BACKEND_DIR / "reports_cache")
    BACKUPS_DIR: Path = DATABASE_DIR / "backups"

    # AI Model Weights
    MODELS_DIR: Path = PROJECT_ROOT / "models"
    YOLO_FACE_MODEL_PATH: Path = (PROJECT_ROOT / "models" / "yolo" / "yolov8n-face.pt") if (PROJECT_ROOT / "models" / "yolo" / "yolov8n-face.pt").exists() else (BACKEND_DIR / "app" / "models" / "yolov8n-face.pt")
    SCRFD_MODEL_PATH: Path = (PROJECT_ROOT / "models" / "scrfd" / "scrfd_2.5g_bnkps.onnx") if (PROJECT_ROOT / "models" / "scrfd" / "scrfd_2.5g_bnkps.onnx").exists() else (BACKEND_DIR / "app" / "models" / "scrfd_2.5g_bnkps.onnx")
    MINIFASNET_MODEL_PATH: Path = (PROJECT_ROOT / "models" / "minifasnet" / "minifasnetv2.pth") if (PROJECT_ROOT / "models" / "minifasnet" / "minifasnetv2.pth").exists() else (BACKEND_DIR / "app" / "models" / "minifasnetv2.pth")
    ARCFACE_MODEL_PATH: Path = (PROJECT_ROOT / "models" / "arcface" / "arcface_w600k_r50.onnx") if (PROJECT_ROOT / "models" / "arcface" / "arcface_w600k_r50.onnx").exists() else (BACKEND_DIR / "app" / "models" / "arcface_w600k_r50.onnx")

    # Computer Vision Settings
    DEFAULT_TOLERANCE: float = 0.50
    STRICT_TOLERANCE: float = 0.58
    RELAXED_TOLERANCE: float = 0.42
    MIN_FACE_SIZE: int = 20
    EMBEDDING_DIMENSION: int = 512
    DETECTION_MODEL: str = "yolov8-face"
    ANTI_SPOOFING_MODEL: str = "MiniFASNetV2"
    FACE_AI_ARCHITECTURE: str = "STANDARD"  # STANDARD | ADVANCED
    SPOOF_CONFIDENCE_THRESHOLD: float = 0.65
    DEFAULTER_THRESHOLD_PERCENT: float = 75.0

    model_config = SettingsConfigDict(case_sensitive=True, extra="allow")

settings = Settings()

# Ensure directories exist
for directory in [
    settings.DATABASE_DIR,
    settings.DATA_DIR,
    settings.UPLOAD_DIR,
    settings.STUDENT_PHOTOS_DIR,
    settings.SESSION_PHOTOS_DIR,
    settings.UNKNOWN_FACES_DIR,
    settings.REPORTS_DIR,
    settings.BACKUPS_DIR,
    settings.MODELS_DIR,
]:
    directory.mkdir(parents=True, exist_ok=True)
