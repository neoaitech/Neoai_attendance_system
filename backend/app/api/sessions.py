from __future__ import annotations

from datetime import date
from pathlib import Path
from uuid import uuid4

import cv2
import numpy as np

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.session_model import AttendanceSession
from app.models.student_model import Student
from app.services.face_detection import detect_and_save
from app.services.face_recognition_service import (
    encode_image,
    find_best_match,
)
from app.services.attendance_service import mark_attendance


router = APIRouter(
    prefix="/sessions",
    tags=["Sessions"],
)


# Development-only local upload storage.
UPLOAD_ROOT = (
    Path(__file__).resolve().parents[2]
    / "uploads"
    / "sessions"
)

MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024

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


def _validate_image_header(
    data: bytes,
    extension: str,
) -> bool:
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


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _resolve_stored_path(relative_path: str) -> Path:
    """
    Convert a database-relative path such as
    uploads/sessions/1/photo.jpg
    into an absolute project path.
    """

    project_root = _project_root()

    path = Path(relative_path)

    if path.is_absolute():
        return path

    return project_root / path


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


@router.post(
    "/{session_id}/photo",
    status_code=201,
)
async def upload_photo(
    session_id: int,
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a classroom photo, save it locally,
    run OpenCV face detection, and persist the
    uploaded path when the session exists.
    """

    if session_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="session_id must be a positive integer",
        )

    extension = ALLOWED_TYPES.get(
        photo.content_type or ""
    )

    if extension is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported image type. "
                "Allowed types: JPEG, PNG, WEBP"
            ),
        )

    data = await photo.read(
        MAX_PHOTO_SIZE_BYTES + 1
    )

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

    if not _validate_image_header(
        data,
        extension,
    ):
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is not a valid image",
        )

    session_dir = (
        UPLOAD_ROOT / str(session_id)
    )

    session_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    stored_name = (
        f"{uuid4().hex}{extension}"
    )

    stored_path = (
        session_dir / stored_name
    )

    stored_path.write_bytes(data)

    relative_path = (
        stored_path
        .relative_to(UPLOAD_ROOT.parent.parent)
        .as_posix()
    )

    # Run existing OpenCV detection.
    detected_name = (
        f"{stored_path.stem}_detected.jpg"
    )

    detected_path = (
        session_dir / detected_name
    )

    try:
        detected_faces = detect_and_save(
            data,
            detected_path,
        )
    except (
        OSError,
        ValueError,
        RuntimeError,
    ):
        detected_faces = []
        detected_relative_path = None
    else:
        detected_relative_path = (
            detected_path
            .relative_to(
                UPLOAD_ROOT.parent.parent
            )
            .as_posix()
        )

    # Persist the uploaded photo path if
    # the session already exists.
    session = (
        db.query(AttendanceSession)
        .filter(
            AttendanceSession.session_id
            == session_id
        )
        .first()
    )

    if session is not None:
        session.photo_uploaded_path = relative_path
        db.commit()

    return {
        "session_id": session_id,
        "message": (
            "Classroom photo uploaded "
            "and face detection completed"
        ),
        "photo": {
            "original_filename": Path(
                photo.filename
                or "uploaded_photo"
            ).name,
            "stored_filename": stored_name,
            "content_type": photo.content_type,
            "size_bytes": len(data),
            "path": relative_path,
        },
        "detection": {
            "face_count": len(detected_faces),
            "faces": detected_faces,
            "annotated_path": (
                detected_relative_path
            ),
        },
    }


@router.post("/{session_id}/recognize")
def recognize_session(
    session_id: int,
    db: Session = Depends(get_db),
):
    """
    Detect and recognize faces from the classroom
    photo belonging to the requested session.

    Recognized active students are automatically
    marked present for the session.
    """

    if session_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="session_id must be a positive integer",
        )

    session = (
        db.query(AttendanceSession)
        .filter(
            AttendanceSession.session_id
            == session_id
        )
        .first()
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found",
        )

    if not session.photo_uploaded_path:
        raise HTTPException(
            status_code=400,
            detail=(
                "No classroom photo is available "
                "for this session"
            ),
        )

    photo_path = _resolve_stored_path(
        session.photo_uploaded_path
    )

    if not photo_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Session photo file not found",
        )

    data = photo_path.read_bytes()

    encoded = np.frombuffer(
        data,
        dtype=np.uint8,
    )

    image = cv2.imdecode(
        encoded,
        cv2.IMREAD_COLOR,
    )

    if image is None:
        raise HTTPException(
            status_code=422,
            detail="Unable to decode session photo",
        )

    # face_recognition expects RGB.
    rgb_image = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2RGB,
    )

    try:
        candidate_encodings = encode_image(
            rgb_image
        )
    except (
        RuntimeError,
        ValueError,
    ) as exc:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Face recognition failed: {exc}"
            ),
        ) from exc

    students = (
        db.query(Student)
        .filter(
            Student.class_id == session.class_id,
            Student.is_active.is_(True),
            Student.face_encoding.is_not(None),
        )
        .order_by(Student.student_id)
        .all()
    )

    recognized_faces = []
    unknown_faces = []

    for face_index, candidate_encoding in enumerate(
        candidate_encodings
    ):

        student, distance = find_best_match(
            candidate_encoding,
            students,
        )

        if student is None:
            unknown_faces.append(
                {
                    "face_index": face_index,
                    "status": "unknown",
                }
            )
            continue

        distance_value = float(
            distance
        )

        # This is a normalized similarity indicator,
        # while the actual recognition decision is based
        # on the face-distance tolerance.
        confidence = max(
            0.0,
            min(
                1.0,
                1.0 - distance_value,
            ),
        )

        recognized_faces.append(
            {
                "face_index": face_index,
                "student_id": student.student_id,
                "roll_no": student.roll_no,
                "full_name": student.full_name,
                "distance": round(
                    distance_value,
                    4,
                ),
                "confidence": round(
                    confidence,
                    4,
                ),
                "status": "recognized",
            }
        )

        # Automatically mark the recognized student
        # as present for this attendance session.
        mark_attendance(
            db,
            session_id=session_id,
            student_id=student.student_id,
            status="present",
            confidence_score=confidence,
        )

    return {
        "session_id": session_id,
        "face_count": len(
            candidate_encodings
        ),
        "recognized_count": len(
            recognized_faces
        ),
        "unknown_count": len(
            unknown_faces
        ),
        "recognized_faces": recognized_faces,
        "unknown_faces": unknown_faces,
    }
