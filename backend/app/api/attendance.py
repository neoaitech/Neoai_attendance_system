from fastapi import APIRouter

from app.api._utils import not_implemented

router = APIRouter(prefix="", tags=["Attendance"])


@router.get("/sessions/{session_id}/attendance")
def get_session_attendance(session_id: int):
    return not_implemented("Attendance results are planned but not implemented in Day 5.")


@router.put("/attendance/{attendance_id}")
def update_attendance(attendance_id: int):
    return not_implemented("Attendance review/correction is planned but not implemented in Day 5.")


@router.post("/attendance/{attendance_id}/verify")
def verify_attendance(attendance_id: int):
    return not_implemented("Attendance verification is planned but not implemented in Day 5.")
