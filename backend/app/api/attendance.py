from typing import List, Optional
from datetime import datetime, date as dt_date
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Request, status, Form, File, UploadFile
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.db.models import AttendanceRecord, AttendanceSession, Student, User, AuditLog, ClassCourse
from backend.app.schemas.attendance import BulkAttendanceUpdateRequest, AttendanceRecordResponse, AttendanceRecordUpdate
from backend.app.services.attendance_service import attendance_service
from backend.app.api.auth import get_current_user, require_admin

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

# =========================================================================
# ON-DUTY (OD) & ATTENDANCE REQUISITION REGULARIZATION ENDPOINTS
# =========================================================================

class AttendanceRequisitionPayload(BaseModel):
    student_id: int
    date: str
    session_ids: List[int]
    status: Optional[str] = "PRESENT"
    reason: Optional[str] = "Attendance Requisition / OD Approval"
    event_name: Optional[str] = "College Activity / Event Duty"
    approved_by: Optional[str] = None

@router.get("/student-day-lectures")
def get_student_day_lectures(
    student_id: int,
    date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all lecture sessions conducted on a specific date for the student's enrolled courses,
    along with the student's current attendance status for each session.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    try:
        query_date = dt_date.fromisoformat(date)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    # 1. Determine student's enrolled courses
    s_prog = (getattr(student, "program", None) or "").strip().upper()
    s_enrolled = [
        c for c in student.enrolled_classes
        if not s_prog or not getattr(c, "program", None) or c.program.strip().upper() in ["ALL", "*", "ANY", s_prog]
    ] if getattr(student, "enrolled_classes", None) and len(student.enrolled_classes) > 0 else []

    if not s_enrolled:
        cq = db.query(ClassCourse)
        if student.department and student.department.upper() != "ALL":
            cq = cq.filter(ClassCourse.department == student.department)
        if student.program:
            cq = cq.filter(ClassCourse.program == student.program)
        if student.semester:
            cq = cq.filter(ClassCourse.semester == student.semester)
        if student.section:
            cq = cq.filter(ClassCourse.section.in_([student.section, "ALL", "BOTH", "*"]))
        s_enrolled = cq.all()

    enrolled_course_ids = [c.id for c in s_enrolled]

    # 2. Find all sessions on that date for those courses
    sessions = db.query(AttendanceSession).filter(
        AttendanceSession.class_id.in_(enrolled_course_ids) if enrolled_course_ids else AttendanceSession.id == -1,
        AttendanceSession.session_date == query_date,
        AttendanceSession.finalized_at.isnot(None)
    ).order_by(AttendanceSession.created_at.asc(), AttendanceSession.id.asc()).all()

    # 3. Find existing attendance records for this student on those sessions
    session_ids = [s.id for s in sessions]
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id.in_(session_ids),
        AttendanceRecord.student_id == student.id
    ).all() if session_ids else []
    record_map = {r.session_id: r for r in records}

    result = []
    course_map = {c.id: c for c in s_enrolled}
    for sess in sessions:
        rec = record_map.get(sess.id)
        c = course_map.get(sess.class_id)
        
        c_code = c.code if c else (sess.class_code or "CRS")
        c_name = c.name if c else (sess.class_name or "Classroom Course")
        t_name = sess.teacher_name or (c.teacher.full_name if c and c.teacher else "Faculty Coordinator")
        
        status_val = rec.status if rec else "ABSENT"
        is_present = status_val in ["PRESENT", "LATE"]
        
        result.append({
            "session_id": sess.id,
            "record_id": rec.id if rec else None,
            "course_id": sess.class_id,
            "course_code": c_code,
            "course_name": c_name,
            "topic": sess.session_name or "Classroom Lecture",
            "start_time": sess.start_time or "09:00 AM",
            "end_time": sess.end_time or "10:30 AM",
            "teacher_name": t_name,
            "current_status": status_val,
            "is_present": is_present,
            "verification_type": rec.verification_type if rec else "AUTO_ABSENT",
            "notes": rec.notes if rec else None
        })

    return {
        "student_id": student.id,
        "student_name": student.full_name,
        "roll_number": student.roll_number,
        "date": date,
        "total_lectures": len(result),
        "present_count": sum(1 for item in result if item["is_present"]),
        "absent_count": sum(1 for item in result if not item["is_present"]),
        "lectures": result
    }

@router.post("/regularize-requisition")
def regularize_attendance_requisition(
    payload: AttendanceRequisitionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)  # STRICTLY RESTRICTED TO ADMIN & SUPER ADMIN!
):
    """
    Grants OD / Requisition Attendance for a student across selected lecture sessions conducted on a specific date.
    Strictly restricted to Administrators and Super Administrators.
    """
    student = db.query(Student).filter(Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    if not payload.session_ids:
        raise HTTPException(status_code=400, detail="At least one lecture session must be selected.")

    approver = payload.approved_by or current_user.full_name or current_user.username
    reason_note = f"OD Approved: {payload.reason} | Event: {payload.event_name} | Approved by {approver} ({current_user.role.upper()})"

    updated_count = 0
    for sess_id in payload.session_ids:
        session = db.query(AttendanceSession).filter(AttendanceSession.id == sess_id).first()
        if not session:
            continue

        record = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == sess_id,
            AttendanceRecord.student_id == student.id
        ).first()

        if record:
            record.status = payload.status or "PRESENT"
            record.verification_type = "OD_REQUISITION"
            record.notes = reason_note
            record.marked_at = datetime.utcnow()
        else:
            # Create attendance record if not existing in session
            record = AttendanceRecord(
                session_id=sess_id,
                student_id=student.id,
                status=payload.status or "PRESENT",
                confidence_score=100.0,
                verification_type="OD_REQUISITION",
                attendance_type="REGULAR",
                is_extra_lecture=False,
                notes=reason_note,
                marked_at=datetime.utcnow()
            )
            db.add(record)

        updated_count += 1

    # Log audit entry
    audit = AuditLog(
        user_id=current_user.id,
        actor_name=current_user.full_name or current_user.username,
        actor_role=current_user.role,
        action="ATTENDANCE_OD_REQUISITION_GRANTED",
        entity="Student",
        entity_id=student.id,
        target_user_id=None,
        target_name=student.full_name,
        details=f"Granted OD Attendance for {updated_count} lecture(s) on {payload.date}. Event: {payload.event_name}. Ref: {payload.reason}."
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": f"Successfully granted OD Attendance for {updated_count} lecture(s) on {payload.date}.",
        "student_name": student.full_name,
        "roll_number": student.roll_number,
        "updated_lectures_count": updated_count
    }


