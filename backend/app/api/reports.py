from fastapi import APIRouter

from app.api._utils import not_implemented

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/daily")
def daily_report():
    return not_implemented("Daily reporting is planned but not implemented in Day 5.")


@router.get("/summary")
def summary_report():
    return not_implemented("Summary reporting is planned but not implemented in Day 5.")


@router.get("/low-attendance")
def low_attendance_report():
    return not_implemented("Low-attendance reporting is planned but not implemented in Day 5.")


@router.get("/unknown-faces")
def unknown_faces_report():
    return not_implemented("Unknown-face reporting is planned but not implemented in Day 5.")


@router.get("/roster")
def roster_report():
    return not_implemented("Roster reporting is planned but not implemented in Day 5.")


@router.get("/recognition-accuracy")
def recognition_accuracy_report():
    return not_implemented("Recognition-accuracy reporting is planned but not implemented in Day 5.")
