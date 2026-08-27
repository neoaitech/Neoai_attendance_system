from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.report_service import build_daily_report

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/daily")
def daily_report(
    class_id: int = Query(..., gt=0),
    report_date: date = Query(...),
    db: Session = Depends(get_db),
):
    try:
        return build_daily_report(
            db,
            class_id=class_id,
            report_date=report_date,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc


@router.get("/summary")
def summary_report():
    from app.api._utils import not_implemented

    return not_implemented("Summary reporting is planned but not implemented in Day 5.")


@router.get("/low-attendance")
def low_attendance_report():
    from app.api._utils import not_implemented

    return not_implemented("Low-attendance reporting is planned but not implemented in Day 5.")


@router.get("/unknown-faces")
def unknown_faces_report():
    from app.api._utils import not_implemented

    return not_implemented("Unknown-face reporting is planned but not implemented in Day 5.")


@router.get("/roster")
def roster_report():
    from app.api._utils import not_implemented

    return not_implemented("Roster reporting is planned but not implemented in Day 5.")


@router.get("/recognition-accuracy")
def recognition_accuracy_report():
    from app.api._utils import not_implemented

    return not_implemented("Recognition-accuracy reporting is planned but not implemented in Day 5.")
