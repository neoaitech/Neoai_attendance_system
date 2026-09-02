import os
import uuid
import json
import base64
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.db.session import get_db
from backend.app.db.models import AttendanceSession, AttendanceRecord, UnknownFace, ClassCourse, User, SystemSetting, Student
from backend.app.schemas.attendance import AttendanceSessionResponse
from backend.app.services.attendance_service import attendance_service
from backend.app.api.auth import get_current_user

router = APIRouter(prefix="/sessions", tags=["Attendance Sessions"])

@router.get("", response_model=List[AttendanceSessionResponse])
def get_sessions(
    class_id: Optional[int] = None,
    session_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(AttendanceSession)
    if class_id:
        query = query.filter(AttendanceSession.class_id == class_id)
    if session_date:
        query = query.filter(AttendanceSession.session_date == session_date)

    sessions = query.order_by(AttendanceSession.created_at.desc()).all()
    return [s.to_dict() for s in sessions]

@router.get("/{session_id}")
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    data = session.to_dict()
    data["records"] = [r.to_dict() for r in session.attendance_records]
    data["unknown_faces"] = [u.to_dict() for u in session.unknown_faces]

    # Enrich records and extra_candidates with live Student freeze status
    all_st_ids = [r["student_id"] for r in data["records"] if "student_id" in r]
    if data.get("extra_candidates"):
        all_st_ids.extend([c["student_id"] for c in data["extra_candidates"] if isinstance(c, dict) and "student_id" in c])
    
    if all_st_ids:
        students_map = {s.id: s for s in db.query(Student).filter(Student.id.in_(all_st_ids)).all()}
        for r in data["records"]:
            st_obj = students_map.get(r.get("student_id"))
            if st_obj:
                is_st_frozen = bool(st_obj.is_frozen or st_obj.attendance_status == "FROZEN" or r.get("status") == "FROZEN" or r.get("verification_type") == "FROZEN_STUDENT")
                r["is_frozen"] = is_st_frozen
                r["attendance_status"] = "FROZEN" if is_st_frozen else "ACTIVE"
                if is_st_frozen:
                    r["status"] = "FROZEN"
                    r["freeze_reason"] = st_obj.freeze_reason
                    r["freeze_until"] = st_obj.freeze_until.strftime("%Y-%m-%d") if st_obj.freeze_until else None

        if data.get("extra_candidates"):
            for cand in data["extra_candidates"]:
                if isinstance(cand, dict) and "student_id" in cand:
                    st_obj = students_map.get(cand["student_id"])
                    if st_obj:
                        is_st_frozen = bool(st_obj.is_frozen or st_obj.attendance_status == "FROZEN")
                        cand["is_frozen"] = is_st_frozen
                        cand["attendance_status"] = "FROZEN" if is_st_frozen else "ACTIVE"
                        cand["freeze_reason"] = st_obj.freeze_reason if is_st_frozen else None
                        cand["freeze_until"] = st_obj.freeze_until.strftime("%Y-%m-%d") if (is_st_frozen and st_obj.freeze_until) else None
    return data

@router.post("/create-and-process")
async def create_and_process_session(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates an attendance session and processes 1 to 4 classroom photos (e.g. left, center, right),
    deduplicating students across all photos so each student is recorded once.
    Robustly parses multipart form data for both single and multiple files.
    """
    form_data = await request.form()
    
    class_id_val = str(form_data.get("class_id") or "").strip()
    if not class_id_val:
        raise HTTPException(status_code=400, detail="Academic course (class_id) is required.")

    if class_id_val.upper() == "OTHER" or not class_id_val.isdigit():
        custom_code = str(form_data.get("custom_code") or "CUSTOM-01").strip().upper()
        custom_name = str(form_data.get("custom_name") or form_data.get("session_name") or "Ad-Hoc Session").strip()
        custom_dept = str(form_data.get("department") or "General").strip()
        custom_prog = str(form_data.get("program") or "General").strip()
        custom_sem = str(form_data.get("semester") or "AdHoc").strip()
        custom_sec = str(form_data.get("section") or "A").strip().upper()
        custom_ay = str(form_data.get("academic_year") or "2026-27").strip()

        # Look up existing matching class or create an ad-hoc class record
        existing_class = db.query(ClassCourse).filter(
            ClassCourse.code == custom_code,
            ClassCourse.section == custom_sec,
            ClassCourse.semester == custom_sem
        ).first()

        if existing_class:
            class_id = existing_class.id
        else:
            adhoc_course = ClassCourse(
                code=custom_code,
                name=custom_name,
                subject_name=custom_name,
                department=custom_dept,
                program=custom_prog,
                semester=custom_sem,
                section=custom_sec,
                academic_year=custom_ay,
                status="AdHoc",
                credits=0,
                teacher_id=current_user.id
            )
            db.add(adhoc_course)
            db.commit()
            db.refresh(adhoc_course)
            class_id = adhoc_course.id
    else:
        class_id = int(class_id_val)

    session_name = str(form_data.get("session_name") or f"Session - {date.today().isoformat()}")
    session_date_str = form_data.get("session_date")
    start_time = str(form_data.get("start_time") or "09:00 AM")
    end_time = str(form_data.get("end_time") or "10:30 AM")
    notes = form_data.get("notes")

    # Read institutional locked sensitivity threshold from SystemSetting if available
    locked_setting = db.query(SystemSetting).filter(SystemSetting.key == "matching_sensitivity").first()
    if locked_setting:
        try:
            tolerance = float(locked_setting.value)
        except Exception:
            tolerance = 0.50
    else:
        try:
            tolerance = float(form_data.get("tolerance") or 0.50)
        except Exception:
            tolerance = 0.50

    webcam_snapshots_json = form_data.get("webcam_snapshots_json")
    webcam_base64 = form_data.get("webcam_base64")

    saved_disk_paths = []
    seen_filenames = set()

    # 1. Collect all uploaded files across all common keys
    file_candidates = []
    for key in ["photos", "photo", "files", "file", "image", "images"]:
        items = form_data.getlist(key)
        for item in items:
            if hasattr(item, "filename") and item.filename and item.filename not in seen_filenames:
                seen_filenames.add(item.filename)
                file_candidates.append(item)

    for idx, p in enumerate(file_candidates, 1):
        filename = f"raw_session_{uuid.uuid4().hex[:8]}_p{idx}.jpg"
        filepath = settings.SESSION_PHOTOS_DIR / filename
        content = await p.read()
        if content:
            with open(filepath, "wb") as f:
                f.write(content)
            saved_disk_paths.append(str(filepath))

    # 2. Handle Webcam Snapshots (Multi-shot array or single base64)
    if webcam_snapshots_json:
        try:
            snaps = json.loads(webcam_snapshots_json)
            for idx, snap_str in enumerate(snaps, len(saved_disk_paths) + 1):
                if "," in snap_str:
                    snap_str = snap_str.split(",")[1]
                img_bytes = base64.b64decode(snap_str)
                filename = f"raw_session_{uuid.uuid4().hex[:8]}_cam{idx}.jpg"
                filepath = settings.SESSION_PHOTOS_DIR / filename
                with open(filepath, "wb") as f:
                    f.write(img_bytes)
                saved_disk_paths.append(str(filepath))
        except Exception:
            pass
    elif webcam_base64:
        if "," in webcam_base64:
            webcam_base64 = webcam_base64.split(",")[1]
        img_bytes = base64.b64decode(webcam_base64)
        filename = f"raw_session_{uuid.uuid4().hex[:8]}.jpg"
        filepath = settings.SESSION_PHOTOS_DIR / filename
        with open(filepath, "wb") as f:
            f.write(img_bytes)
        saved_disk_paths.append(str(filepath))

    if not saved_disk_paths:
        raise HTTPException(status_code=400, detail="No classroom photos provided. Please upload or capture 1 to 8 photos.")

    if len(saved_disk_paths) > 8:
        raise HTTPException(status_code=400, detail=f"Maximum 8 classroom photos allowed per attendance session. Received {len(saved_disk_paths)} photos.")

    # Parse date if provided
    parsed_date = None
    if session_date_str:
        try:
            parsed_date = date.fromisoformat(str(session_date_str))
        except Exception:
            parsed_date = date.today()

    # Parse optional multi-division class_ids list
    class_ids_val = form_data.get("class_ids")
    class_ids_list = []
    if class_ids_val:
        for item in str(class_ids_val).split(","):
            if item.strip().isdigit():
                class_ids_list.append(int(item.strip()))
    if class_id not in class_ids_list:
        class_ids_list.append(class_id)

    session = attendance_service.process_new_attendance_session(
        db=db,
        class_id=class_id,
        teacher_id=current_user.id,
        session_name=session_name,
        image_paths=saved_disk_paths,
        session_date=parsed_date,
        start_time=start_time,
        end_time=end_time,
        notes=str(notes) if notes else None,
        tolerance=tolerance,
        class_ids=class_ids_list if len(class_ids_list) > 1 else None
    )

    data = session.to_dict()
    data["records"] = [r.to_dict() for r in session.attendance_records]
    data["unknown_faces"] = [u.to_dict() for u in session.unknown_faces]
    return data

@router.delete("/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    db.delete(session)
    db.commit()
    return {"message": f"Session '{session.session_name}' deleted successfully."}
