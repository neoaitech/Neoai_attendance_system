from datetime import date

from fastapi import APIRouter, UploadFile, File

from app.api._utils import not_implemented

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.post("")
def create_session():
    return not_implemented("Session creation is planned but not implemented in Day 5.")


@router.get("")
def list_sessions(class_id: int | None = None, session_date: date | None = None):
    return not_implemented("Session listing is planned but not implemented in Day 5.")


@router.get("/{session_id}")
def get_session(session_id: int):
    return not_implemented("Session retrieval is planned but not implemented in Day 5.")


@router.post("/{session_id}/photo")
def upload_photo(session_id: int, photo: UploadFile = File(...)):
    return not_implemented("Photo upload is planned for the 25-Aug implementation milestone.")


@router.post("/{session_id}/recognize")
def recognize_session(session_id: int):
    return not_implemented("Face recognition is planned for a later Phase-2 milestone.")
