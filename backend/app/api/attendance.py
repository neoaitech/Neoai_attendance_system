from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, status, Form, File, UploadFile
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.db.models import AttendanceRecord, AttendanceSession, Student, User, AuditLog
from backend.app.schemas.attendance import BulkAttendanceUpdateRequest, AttendanceRecordResponse, AttendanceRecordUpdate
from backend.app.services.attendance_service import attendance_service
from backend.app.api.auth import get_current_user

router = APIRouter(prefix="/attendance", tags=["Attendance Records"])

@router.post("/bulk-update", response_model=List[AttendanceRecordResponse])
def bulk_update_attendance(
    payload: BulkAttendanceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    updates = [item.model_dump() for item in payload.updates]
    updated = attendance_service.update_attendance_records(
        db=db,
        session_id=payload.session_id,
        updates=updates,
        user_id=current_user.id
    )
    return [r.to_dict() for r in updated]

@router.put("/records/{record_id}", response_model=AttendanceRecordResponse)
def update_single_attendance_record(
    record_id: int,
    payload: AttendanceRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found.")

    old_status = record.status
    record.status = payload.status
    if payload.notes is not None:
        record.notes = payload.notes
    record.verification_type = "MANUAL_OVERRIDE"
    record.marked_at = datetime.utcnow()

    # Log audit
    audit = AuditLog(
        user_id=current_user.id,
        action="ATTENDANCE_OVERRIDE_SINGLE",
        entity="AttendanceRecord",
        entity_id=record.id,
        details=f"Overrode attendance for student ID {record.student_id} from '{old_status}' to '{payload.status}'."
    )
    db.add(audit)
    db.commit()
    db.refresh(record)
    return record.to_dict()

@router.post("/session/{session_id}/extra-lecture/approve")
async def approve_extra_lecture(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Approves Extra Lecture attendance for a recognized outside-roster student for this session only.
    """
    student_id = None
    try:
        body = await request.json()
        student_id = body.get("student_id")
    except Exception:
        pass
    
    if not student_id:
        form = await request.form()
        student_id = form.get("student_id")

    if not student_id:
        raise HTTPException(status_code=400, detail="student_id is required.")

    record = attendance_service.approve_extra_lecture_attendance(
        db=db,
        session_id=session_id,
        student_id=int(student_id),
        user_id=current_user.id
    )

    student = record.student
    session = record.session
    course = session.course if session else None

    return {
        "success": True,
        "message": f"Extra lecture attendance approved for student #{student_id}.",
        "attendance_id": record.id,
        "student_id": record.student_id,
        "session_id": record.session_id,
        "status": record.status,
        "attendance_type": record.attendance_type or "EXTRA_LECTURE",
        "is_extra_lecture": True,
        "student_name": student.full_name if student else "Student",
        "roll_number": student.roll_number if student else "N/A",
        "course_code": course.code if course else "N/A",
        "course_name": course.name if course else "N/A",
        "session_name": session.session_name if session else "N/A",
        "session_date": session.session_date.isoformat() if session and session.session_date else None,
        "record": record.to_dict()
    }

@router.post("/session/{session_id}/extra-lecture/ignore")
async def ignore_extra_lecture(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ignores an outside-roster Extra Lecture candidate for this session.
    """
    student_id = None
    try:
        body = await request.json()
        student_id = body.get("student_id")
    except Exception:
        pass
    
    if not student_id:
        form = await request.form()
        student_id = form.get("student_id")

    if not student_id:
        raise HTTPException(status_code=400, detail="student_id is required.")

    attendance_service.ignore_extra_lecture_attendance(
        db=db,
        session_id=session_id,
        student_id=int(student_id),
        user_id=current_user.id
    )
    return {
        "success": True,
        "message": f"Candidate #{student_id} ignored for session #{session_id}."
    }

@router.get("/student/{student_id}")
def get_student_attendance_history(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    summary = AttendanceService.get_student_attendance_summary(db, student_id)
    records = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == student_id).all()

    summary["records"] = [
        {
            "id": r.id,
            "session_id": r.session_id,
            "session_name": r.session.session_name if r.session else "N/A",
            "session_date": r.session.session_date.isoformat() if r.session and r.session.session_date else "N/A",
            "course_code": r.session.course.code if (r.session and r.session.course) else "N/A",
            "course_name": r.session.course.name if (r.session and r.session.course) else "N/A",
            "status": r.status,
            "confidence_score": r.confidence_score,
            "verification_type": r.verification_type,
            "attendance_type": "EXTRA_LECTURE" if (r.is_extra_lecture or r.attendance_type == "EXTRA_LECTURE" or r.verification_type == "EXTRA_LECTURE") else "REGULAR",
            "is_extra_lecture": bool(r.is_extra_lecture or r.attendance_type == "EXTRA_LECTURE" or r.verification_type == "EXTRA_LECTURE"),
            "notes": r.notes
        }
        for r in records
    ]
    return summary

@router.post("/quick-verify", response_model=AttendanceRecordResponse)
async def quick_verify_student(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Snap a photo of a student, verify their face biometrically against registered 128-D vector,
    and mark them PRESENT only if identity matches.
    If face belongs to someone else or is unknown, rejects with detailed mismatch message.
    """
    import uuid, base64
    from backend.app.core.config import settings

    content_type = request.headers.get("content-type", "")
    session_id = None
    student_id = None
    photo_file = None
    webcam_base64 = None

    if "application/json" in content_type:
        body = await request.json()
        session_id = body.get("session_id")
        student_id = body.get("student_id")
        webcam_base64 = body.get("webcam_base64") or body.get("snapshot_data")
    else:
        form = await request.form()
        session_id = form.get("session_id")
        student_id = form.get("student_id")
        photo_file = form.get("photo")
        webcam_base64 = form.get("webcam_base64") or form.get("snapshot_data")

    if not session_id or not student_id:
        raise HTTPException(status_code=400, detail="session_id and student_id are required.")

    session_id = int(session_id)
    student_id = int(student_id)

    filename = f"quick_verify_{student_id}_{uuid.uuid4().hex[:6]}.jpg"
    filepath = settings.STUDENT_PHOTOS_DIR / filename

    if photo_file and hasattr(photo_file, "read"):
        content = await photo_file.read()
        with open(filepath, "wb") as f:
            f.write(content)
    elif webcam_base64:
        if "," in webcam_base64:
            webcam_base64 = webcam_base64.split(",")[1]
        img_bytes = base64.b64decode(webcam_base64)
        with open(filepath, "wb") as f:
            f.write(img_bytes)
    else:
        raise HTTPException(status_code=400, detail="Photo or webcam snapshot required for verification.")

    record = attendance_service.quick_verify_student_face(
        db=db,
        session_id=session_id,
        student_id=student_id,
        photo_path=str(filepath),
        user_id=current_user.id
    )
    return record.to_dict()

