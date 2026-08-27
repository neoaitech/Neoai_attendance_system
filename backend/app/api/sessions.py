from datetime import date
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.face_detection import detect_and_save

router = APIRouter(prefix="/sessions", tags=["Sessions"])

# Development-only storage for uploaded classroom/group photos.
# Database persistence is intentionally deferred to the database integration milestone.
UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "sessions"

MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

MAGIC_HEADERS = {
    ".jpg": (b"\xff\xd8\xff",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".webp": (b"RIFF",),
}


def _validate_image_header(data: bytes, extension: str) -> bool:
    if extension == ".webp":
        return (
            len(data) >= 12
            and data[:4] == b"RIFF"
            and data[8:12] == b"WEBP"
        )

    return any(
        data.startswith(header)
        for header in MAGIC_HEADERS[extension]
    )


@router.post("")
def create_session():
    from app.api._utils import not_implemented

    return not_implemented(
        "Session creation is planned but not implemented in Day 5."
    )


@router.get("")
def list_sessions(
    class_id: int | None = None,
    session_date: date | None = None,
):
    from app.api._utils import not_implemented

    return not_implemented(
        "Session listing is planned but not implemented in Day 5."
    )


@router.get("/{session_id}")
def get_session(session_id: int):
    from app.api._utils import not_implemented

    return not_implemented(
        "Session retrieval is planned but not implemented in Day 5."
    )


@router.post("/{session_id}/photo", status_code=201)
async def upload_photo(
    session_id: int,
    photo: UploadFile = File(...),
):
    """Store and validate a classroom/group photo.

    The uploaded photo is stored locally first. Face detection is then
    attempted using the existing OpenCV detection service.

    If the uploaded file passes the endpoint's image-header validation but
    cannot be decoded by the detection service, the original upload is still
    considered successful and an empty face list is returned.
    """

    if session_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="session_id must be a positive integer",
        )

    extension = ALLOWED_TYPES.get(photo.content_type or "")

    if extension is None:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image type. Allowed types: JPEG, PNG, WEBP",
        )

    data = await photo.read(MAX_PHOTO_SIZE_BYTES + 1)

    if not data:
        raise HTTPException(
            status_code=400,
            detail="Uploaded photo is empty",
        )

    if len(data) > MAX_PHOTO_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Uploaded photo exceeds the 10 MB limit",
        )

    if not _validate_image_header(data, extension):
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is not a valid image",
        )

    # Create session-specific upload directory.
    session_dir = UPLOAD_ROOT / str(session_id)
    session_dir.mkdir(parents=True, exist_ok=True)

    # Save original uploaded photo.
    stored_name = f"{uuid4().hex}{extension}"
    stored_path = session_dir / stored_name
    stored_path.write_bytes(data)

    relative_path = stored_path.relative_to(
        UPLOAD_ROOT.parent.parent
    ).as_posix()

    # Run existing face-detection service.
    detected_name = f"{stored_path.stem}_detected.jpg"
    detected_path = session_dir / detected_name

    try:
        detected_faces = detect_and_save(
            data,
            detected_path,
        )
    except (OSError, ValueError, RuntimeError):
        # Upload itself succeeded, but the image could not be decoded
        # by the face-detection service.
        detected_faces = []
        detected_relative_path = None
    else:
        detected_relative_path = detected_path.relative_to(
            UPLOAD_ROOT.parent.parent
        ).as_posix()

    return {
        "session_id": session_id,
        "message": "Classroom photo uploaded and face detection completed",
        "photo": {
            "original_filename": Path(
                photo.filename or "uploaded_photo"
            ).name,
            "stored_filename": stored_name,
            "content_type": photo.content_type,
            "size_bytes": len(data),
            "path": relative_path,
        },
        "detection": {
            "face_count": len(detected_faces),
            "faces": detected_faces,
            "annotated_path": detected_relative_path,
        },
    }


@router.post("/{session_id}/recognize")
def recognize_session(session_id: int):
    from app.api._utils import not_implemented

    return not_implemented(
        "Face recognition is planned for a later Phase-2 milestone."
    )
