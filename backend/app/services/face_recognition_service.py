from __future__ import annotations

from typing import Iterable

import numpy as np

try:
    import face_recognition
except ImportError:
    face_recognition = None


DEFAULT_TOLERANCE = 0.50
ENCODING_SIZE = 128


def _require_face_recognition() -> None:
    if face_recognition is None:
        raise RuntimeError(
            "face_recognition package is not installed."
        )


def encode_image(image: np.ndarray) -> list[np.ndarray]:
    """
    Detect faces and generate 128-dimensional face encodings.
    """
    _require_face_recognition()

    if image is None or image.size == 0:
        return []

    locations = face_recognition.face_locations(image)

    return face_recognition.face_encodings(
        image,
        known_face_locations=locations,
    )


def encoding_to_bytes(encoding: np.ndarray) -> bytes:
    """
    Convert a face encoding to bytes for SQLite LargeBinary storage.
    """
    array = np.asarray(encoding, dtype=np.float64)

    if array.shape != (ENCODING_SIZE,):
        raise ValueError(
            f"Expected face encoding with shape "
            f"({ENCODING_SIZE},), got {array.shape}"
        )

    return array.tobytes()


def bytes_to_encoding(data: bytes) -> np.ndarray:
    """
    Convert stored SQLite bytes back into a face encoding.
    """
    encoding = np.frombuffer(
        data,
        dtype=np.float64,
    )

    if encoding.shape != (ENCODING_SIZE,):
        raise ValueError(
            f"Invalid stored face encoding. "
            f"Expected {ENCODING_SIZE} values, got {encoding.size}"
        )

    return encoding


def compare_encoding(
    known_encoding: bytes | np.ndarray,
    candidate_encoding: np.ndarray,
    tolerance: float = DEFAULT_TOLERANCE,
) -> tuple[bool, float]:
    """
    Compare a stored student encoding with a detected face.

    Returns:
        (is_match, distance)

    Lower distance means a better match.
    """

    _require_face_recognition()

    if isinstance(known_encoding, bytes):
        known = bytes_to_encoding(known_encoding)
    else:
        known = np.asarray(
            known_encoding,
            dtype=np.float64,
        )

    candidate = np.asarray(
        candidate_encoding,
        dtype=np.float64,
    )

    if known.shape != (ENCODING_SIZE,):
        raise ValueError("Invalid known face encoding")

    if candidate.shape != (ENCODING_SIZE,):
        raise ValueError("Invalid candidate face encoding")

    distance = float(
        face_recognition.face_distance(
            [known],
            candidate,
        )[0]
    )

    return distance <= tolerance, distance


def find_best_match(
    candidate_encoding: np.ndarray,
    known_students: Iterable,
    tolerance: float = DEFAULT_TOLERANCE,
):
    """
    Find the closest matching active student.

    Only students with a stored face_encoding are considered.

    Returns:
        (student, distance)

    If no student matches:
        (None, None)
    """

    best_student = None
    best_distance = None

    for student in known_students:

        if not getattr(student, "is_active", True):
            continue

        stored_encoding = getattr(
            student,
            "face_encoding",
            None,
        )

        if not stored_encoding:
            continue

        try:
            is_match, distance = compare_encoding(
                stored_encoding,
                candidate_encoding,
                tolerance=tolerance,
            )
        except (ValueError, TypeError):
            continue

        if is_match and (
            best_distance is None
            or distance < best_distance
        ):
            best_student = student
            best_distance = distance

    return best_student, best_distance