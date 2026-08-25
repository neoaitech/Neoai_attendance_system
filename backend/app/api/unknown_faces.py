from fastapi import APIRouter

from app.api._utils import not_implemented

router = APIRouter(prefix="", tags=["Unknown Faces"])


@router.get("/sessions/{session_id}/unknown-faces")
def list_unknown_faces(session_id: int):
    return not_implemented("Unknown-face listing is planned but not implemented in Day 5.")


@router.put("/unknown-faces/{unknown_face_id}")
def update_unknown_face(unknown_face_id: int):
    return not_implemented("Unknown-face resolution is planned but not implemented in Day 5.")
