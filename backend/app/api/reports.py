import os
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.db.models import ClassCourse, User
from backend.app.services.report_service import report_service
from backend.app.api.auth import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports & Exports"])

@router.get("/filters")
def get_report_filters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns available filter parameters: courses, semesters, departments, divisions, and date range.
    """
    return report_service.get_available_filters(db)

@router.get("/advanced-data")
def get_advanced_report_data(
    class_id: Optional[int] = Query(None, description="Course / Subject ID"),
    class_ids: Optional[str] = Query(None, description="Comma-separated class IDs"),
    department: Optional[str] = Query(None, description="Department name"),
    departments: Optional[str] = Query(None, description="Comma-separated department names"),
    program: Optional[str] = Query(None, description="Program name"),
    programs: Optional[str] = Query(None, description="Comma-separated program names e.g. 'B.Tech,MCA'"),
    semester: Optional[str] = Query(None, description="Semester e.g. 'Semester 5'"),
    semesters: Optional[str] = Query(None, description="Comma-separated semesters e.g. 'Semester 5,Semester 7'"),
    division: Optional[str] = Query(None, description="Division e.g. 'A'"),
    divisions: Optional[str] = Query(None, description="Comma-separated divisions e.g. 'A,B'"),
    attendance_type: Optional[str] = Query(None, description="Filter: 'ALL', 'REGULAR', 'EXTRA_LECTURE'"),
    start_date: Optional[date] = Query(None, description="Filter Start Date YYYY-MM-DD"),
    end_date: Optional[date] = Query(None, description="Filter End Date YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns comprehensive attendance breakdown with multi-program, multi-semester,
    and multi-division rosters, and custom date range.
    """
    return report_service.get_advanced_report_data(
        db=db,
        class_id=class_id,
        class_ids=class_ids,
        department=department or departments,
        programs=programs or program,
        semesters=semesters or semester,
        divisions=divisions or division,
        attendance_type=attendance_type,
        start_date=start_date,
        end_date=end_date
    )

@router.get("/export/excel")
def export_advanced_excel_report(
    class_id: Optional[int] = Query(None),
    class_ids: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    departments: Optional[str] = Query(None),
    program: Optional[str] = Query(None),
    programs: Optional[str] = Query(None),
    semester: Optional[str] = Query(None),
    semesters: Optional[str] = Query(None),
    division: Optional[str] = Query(None),
    divisions: Optional[str] = Query(None),
    attendance_type: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Exports enterprise multi-sheet Excel (.xlsx) workbook:
    - Sheet 1: Executive Summary & Division comparison
    - Sheet 2: Division A (Attendance Matrix & daily lecture checks)
    - Sheet 3: Division B (Attendance Matrix for Division B)
    - Sheet 4+: Subsequent Divisions & Extra Lecture Records...
    """
    try:
        filepath = report_service.export_advanced_excel(
            db=db,
            class_id=class_id,
            class_ids=class_ids,
            department=department or departments,
            programs=programs or program,
            semesters=semesters or semester,
            divisions=divisions or division,
            attendance_type=attendance_type,
            start_date=start_date,
            end_date=end_date
        )
        filename = os.path.basename(filepath)
        return FileResponse(
            path=filepath,
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel report: {str(e)}")

@router.get("/export/pdf")
def export_advanced_pdf_report(
    class_id: Optional[int] = Query(None),
    class_ids: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    departments: Optional[str] = Query(None),
    program: Optional[str] = Query(None),
    programs: Optional[str] = Query(None),
    semester: Optional[str] = Query(None),
    semesters: Optional[str] = Query(None),
    division: Optional[str] = Query(None),
    divisions: Optional[str] = Query(None),
    attendance_type: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Exports official institutional PDF dossier with division rosters and custom date range.
    """
    try:
        filepath = report_service.export_advanced_pdf(
            db=db,
            class_id=class_id,
            class_ids=class_ids,
            department=department or departments,
            programs=programs or program,
            semesters=semesters or semester,
            divisions=divisions or division,
            attendance_type=attendance_type,
            start_date=start_date,
            end_date=end_date
        )
        filename = os.path.basename(filepath)
        return FileResponse(
            path=filepath,
            filename=filename,
            media_type="application/pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF report: {str(e)}")

# =========================================================================
# INDIVIDUAL STUDENT DEEP-DIVE & BUNK LOG ENDPOINTS
# =========================================================================
@router.get("/student/{student_id}")
def get_student_report(
    student_id: int,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns complete attendance audit for an individual student:
    profile, overall attendance %, subject-by-subject metrics, and chronological lecture/bunk log.
    """
    data = report_service.get_student_detailed_report(
        db=db,
        student_id=student_id,
        start_date=start_date,
        end_date=end_date
    )
    if not data:
        raise HTTPException(status_code=404, detail="Student not found.")
    return data

@router.get("/student/{student_id}/export/pdf")
def export_student_pdf_report(
    student_id: int,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Exports official Student Attendance Transcript & Bunk Log PDF.
    """
    try:
        filepath = report_service.export_student_pdf(
            db=db,
            student_id=student_id,
            start_date=start_date,
            end_date=end_date
        )
        filename = os.path.basename(filepath)
        return FileResponse(
            path=filepath,
            filename=filename,
            media_type="application/pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate student PDF: {str(e)}")

# Legacy compatibility endpoints
@router.get("/class/{class_id}")
def get_class_report(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    summary = report_service.get_class_summary_data(db, class_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Class not found.")
    return summary

@router.get("/defaulters")
def get_defaulters_list(
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    defaulters = report_service.get_all_defaulters(db, class_id)
    return {
        "count": len(defaulters),
        "threshold_percentage": 75.0,
        "defaulters": defaulters
    }

@router.get("/export/excel/{class_id}")
def export_excel_report_legacy(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.query(ClassCourse).filter(ClassCourse.id == class_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Class not found.")

    try:
        filepath = report_service.export_excel(db, class_id)
        filename = os.path.basename(filepath)
        return FileResponse(
            path=filepath,
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel report: {str(e)}")

@router.get("/export/pdf/{class_id}")
def export_pdf_report_legacy(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.query(ClassCourse).filter(ClassCourse.id == class_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Class not found.")

    try:
        filepath = report_service.export_pdf(db, class_id)
        filename = os.path.basename(filepath)
        return FileResponse(
            path=filepath,
            filename=filename,
            media_type="application/pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF report: {str(e)}")

