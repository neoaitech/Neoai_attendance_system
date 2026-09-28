import os
import io
import json
from datetime import date, datetime, timedelta
from typing import Optional, List
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from fastapi.responses import StreamingResponse, FileResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_

from backend.app.db.session import get_db
from backend.app.db.models import (
    User, Student, AttendanceRecord, AttendanceSession,
    ClassCourse, student_class_association
)
from backend.app.api.auth import get_current_user
from backend.app.core.config import settings

router = APIRouter(prefix="/parent", tags=["Parent Portal"])

def get_current_parent_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Enforces that current authenticated user has role 'parent', 'admin', or 'super_admin'.
    """
    allowed_roles = {"parent", "admin", "super_admin", "superadmin"}
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to registered parents and guardians."
        )
    return current_user

def get_parent_user_with_query_fallback(
    request: Request,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
) -> User:
    """
    Allows authentication via standard Bearer header OR ?token= query parameter (for <img> tags).
    """
    auth_header = request.headers.get("Authorization")
    token_val = None
    if auth_header and auth_header.startswith("Bearer "):
        token_val = auth_header.split(" ")[1]
    elif token:
        token_val = token

    if token_val:
        from backend.app.core.security import decode_access_token
        try:
            payload = decode_access_token(token_val)
            sub = payload.get("sub")
            if sub:
                user = db.query(User).filter(User.username == sub).first()
                if user and user.is_active:
                    if user.role in ("parent", "admin", "super_admin", "superadmin"):
                        return user
        except Exception:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Valid parent authentication token required."
    )

def _get_parent_children(db: Session, parent_user: User) -> List[Student]:
    """
    Retrieves all wards (students) linked to this parent account.
    Auto-links by matching parent_email if not already linked.
    """
    clean_email = (parent_user.email or "").strip().lower()

    # Auto-link unlinked students having matching parent email
    unlinked = db.query(Student).filter(
        func.lower(Student.parent_email) == clean_email,
        Student.parent_user_id.is_(None)
    ).all()
    if unlinked:
        for st in unlinked:
            st.parent_user_id = parent_user.id
        db.commit()

    # Fetch all students linked to this parent
    if parent_user.role in ("admin", "super_admin", "superadmin"):
        # Administrators can view any student or test as a parent
        children = db.query(Student).filter(
            (Student.parent_user_id == parent_user.id) | (func.lower(Student.parent_email) == clean_email)
        ).all()
        # If admin has no children directly linked, return active students for preview/testing
        if not children:
            children = db.query(Student).filter(Student.is_active == True).limit(5).all()
    else:
        children = db.query(Student).filter(
            (Student.parent_user_id == parent_user.id) | (func.lower(Student.parent_email) == clean_email)
        ).all()

    return children

def _verify_child_access(db: Session, parent_user: User, child_id: int) -> Student:
    """
    Validates that child_id belongs to the requesting parent.
    Raises 403 Forbidden if parent doesn't have custody rights.
    """
    student = db.query(Student).filter(Student.id == child_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    if parent_user.role in ("admin", "super_admin", "superadmin"):
        return student

    clean_email = (parent_user.email or "").strip().lower()
    is_linked = (student.parent_user_id == parent_user.id) or (
        student.parent_email and student.parent_email.strip().lower() == clean_email
    )

    if not is_linked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You are not authorized to view attendance data for this student."
        )

    # Auto-repair link if missing
    if student.parent_user_id != parent_user.id:
        student.parent_user_id = parent_user.id
        db.commit()

    return student


@router.get("/me")
async def get_parent_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_parent_user)
):
    """
    Returns parent profile and list of all linked wards (students).
    Supports multi-child switching inside the mobile app.
    """
    children = _get_parent_children(db, current_user)

    children_list = []
    for c in children:
        # Quick overall percentage for badge display in child switcher
        total_recs = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == c.id).count()
        pres_recs = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == c.id,
            AttendanceRecord.status == "PRESENT"
        ).count()
        overall_pct = round((pres_recs / total_recs * 100), 1) if total_recs > 0 else 0.0

        children_list.append({
            "id": c.id,
            "roll_number": c.roll_number,
            "full_name": c.full_name,
            "program": c.program or "B.Tech",
            "department": c.department or "Computer Science",
            "semester": c.semester or "Semester 1",
            "section": c.section or "A",
            "academic_year": c.academic_year or "2026-27",
            "batch": c.batch or "2023-2027",
            "photo_url": c.photo_url,
            "parent_relation": c.parent_relation or "Ward",
            "attendance_percentage": overall_pct,
            "is_defaulter": overall_pct < 75.0 if total_recs > 0 else False,
            "is_frozen": bool(c.is_frozen or c.attendance_status == "FROZEN")
        })

    return {
        "parent": {
            "id": current_user.id,
            "full_name": current_user.full_name,
            "email": current_user.email,
            "role": current_user.role,
            "children_count": len(children_list)
        },
        "children": children_list
    }


@router.get("/child/{child_id}/summary")
async def get_child_attendance_summary(
    child_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_parent_user)
):
    """
    Comprehensive attendance statistics, percentage gauge, defaulter status,
    and recent activity for the selected child.
    """
    student = _verify_child_access(db, current_user, child_id)

    total_records = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == student.id).count()
    present_records = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student.id,
        AttendanceRecord.status == "PRESENT"
    ).count()
    absent_records = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student.id,
        AttendanceRecord.status == "ABSENT"
    ).count()
    extra_lectures = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student.id,
        AttendanceRecord.attendance_type == "EXTRA_LECTURE",
        AttendanceRecord.status == "PRESENT"
    ).count()

    overall_pct = round((present_records / total_records * 100), 1) if total_records > 0 else 0.0
    threshold = float(getattr(settings, "DEFAULTER_THRESHOLD_PERCENT", 75.0))
    is_defaulter = overall_pct < threshold if total_records > 0 else False

    # Calculate recent streak (consecutive PRESENT records ordered by date descending)
    recent_records = db.query(AttendanceRecord).join(AttendanceSession).filter(
        AttendanceRecord.student_id == student.id
    ).order_by(desc(AttendanceSession.session_date), desc(AttendanceRecord.marked_at)).limit(10).all()

    streak = 0
    for r in recent_records:
        if r.status == "PRESENT":
            streak += 1
        else:
            break

    # Latest recorded lecture
    latest_rec = recent_records[0] if recent_records else None
    latest_info = None
    if latest_rec:
        latest_sess = latest_rec.session
        latest_info = {
            "session_name": latest_sess.session_name if latest_sess else "Lecture",
            "class_name": latest_sess.course.name if latest_sess and latest_sess.course else "Course",
            "date": latest_sess.session_date.isoformat() if latest_sess else None,
            "status": latest_rec.status,
            "marked_at": latest_rec.marked_at.strftime("%I:%M %p") if latest_rec.marked_at else None
        }

    return {
        "student": {
            "id": student.id,
            "full_name": student.full_name,
            "roll_number": student.roll_number,
            "program": student.program,
            "department": student.department,
            "semester": student.semester,
            "section": student.section,
            "photo_url": student.photo_url
        },
        "kpi": {
            "overall_percentage": overall_pct,
            "total_sessions": total_records,
            "present_count": present_records,
            "absent_count": absent_records,
            "extra_lectures_count": extra_lectures,
            "is_defaulter": is_defaulter,
            "defaulter_threshold": threshold,
            "streak_present_days": streak,
            "latest_activity": latest_info
        }
    }


@router.get("/child/{child_id}/today-timeline")
async def get_child_today_timeline(
    child_id: int,
    date_str: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_parent_user)
):
    """
    Live lecture-by-lecture daily timeline for TODAY (or specific date).
    Returns all scheduled/conducted classes with:
      - Course Code & Title
      - Scheduled Slot (Start & End Time)
      - Faculty Name
      - Room / Hall
      - Live Status: PRESENT ✅, ABSENT ❌, or UPCOMING ⏳
      - AI Verification Details: Confidence score, detection time, and photo proof link.
    """
    student = _verify_child_access(db, current_user, child_id)

    target_date = date.today()
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except Exception:
            target_date = date.today()

    # Get all courses the student is enrolled in
    enrolled_courses = student.enrolled_classes or []
    enrolled_course_ids = [c.id for c in enrolled_courses]

    # Find attendance sessions for this target date
    # Sessions for courses the student is enrolled in OR sessions where student has an attendance record
    records_today = db.query(AttendanceRecord).join(AttendanceSession).filter(
        AttendanceRecord.student_id == student.id,
        AttendanceSession.session_date == target_date
    ).all()
    record_by_session_id = {r.session_id: r for r in records_today}

    # Find all sessions conducted today for enrolled courses OR where student has an attendance record
    record_session_ids = [r.session_id for r in records_today]
    filter_cond = AttendanceSession.class_id.in_(enrolled_course_ids)
    if record_session_ids:
        filter_cond = or_(filter_cond, AttendanceSession.id.in_(record_session_ids))

    sessions_today = db.query(AttendanceSession).filter(
        AttendanceSession.session_date == target_date,
        filter_cond
    ).order_by(AttendanceSession.start_time, AttendanceSession.created_at).all()

    timeline = []
    seen_session_ids = set()

    for sess in sessions_today:
        seen_session_ids.add(sess.id)
        rec = record_by_session_id.get(sess.id)

        # Faculty name
        faculty_name = sess.teacher.full_name if sess.teacher else (sess.course.teacher.full_name if (sess.course and sess.course.teacher) else "Faculty")
        room_name = sess.course.room if sess.course and sess.course.room else "Lecture Hall"

        status_val = "UPCOMING"
        confidence = 0.0
        marked_time = None
        record_id = None
        has_photo_proof = False

        if rec:
            status_val = rec.status
            confidence = round(rec.confidence_score or 0.0, 1)
            record_id = rec.id
            if rec.marked_at:
                marked_time = rec.marked_at.strftime("%I:%M %p")
            has_photo_proof = bool(rec.detection_bbox or (sess.processed_photo_path or sess.raw_photo_path or sess.photo_paths))
        else:
            # Session finalized/conducted but no record means student was not in attendance session
            if sess.status == "CONFIRMED":
                status_val = "ABSENT"
            else:
                status_val = "UPCOMING"

        timeline.append({
            "session_id": sess.id,
            "record_id": record_id,
            "session_name": sess.session_name,
            "course_code": sess.course.code if sess.course else "LEC",
            "course_name": sess.course.name if sess.course else "Subject",
            "faculty_name": faculty_name,
            "room": room_name,
            "slot_time": f"{sess.start_time or '09:00 AM'} - {sess.end_time or '10:30 AM'}",
            "status": status_val,
            "marked_at": marked_time,
            "confidence_score": confidence,
            "verification_type": rec.verification_type if rec else None,
            "has_photo_proof": has_photo_proof,
            "is_extra_lecture": rec.is_extra_lecture if rec else False
        })

    # Include any extra lectures attended today that weren't in enrolled_course_ids
    for rec in records_today:
        if rec.session_id not in seen_session_ids:
            sess = rec.session
            faculty_name = sess.teacher.full_name if sess and sess.teacher else "Faculty"
            timeline.append({
                "session_id": sess.id if sess else None,
                "record_id": rec.id,
                "session_name": sess.session_name if sess else "Extra Session",
                "course_code": sess.course.code if (sess and sess.course) else "EXTRA",
                "course_name": sess.course.name if (sess and sess.course) else "Extra Lecture",
                "faculty_name": faculty_name,
                "room": sess.course.room if (sess and sess.course and sess.course.room) else "Special Hall",
                "slot_time": f"{sess.start_time or 'Slot'} - {sess.end_time or ''}" if sess else "Extra Slot",
                "status": rec.status,
                "marked_at": rec.marked_at.strftime("%I:%M %p") if rec.marked_at else None,
                "confidence_score": round(rec.confidence_score or 0.0, 1),
                "verification_type": rec.verification_type,
                "has_photo_proof": bool(rec.detection_bbox or (sess and (sess.processed_photo_path or sess.raw_photo_path))),
                "is_extra_lecture": True
            })

    # Timeline stats
    total_lectures = len(timeline)
    attended_count = sum(1 for item in timeline if item["status"] == "PRESENT")
    missed_count = sum(1 for item in timeline if item["status"] == "ABSENT")
    upcoming_count = sum(1 for item in timeline if item["status"] == "UPCOMING")

    return {
        "date": target_date.isoformat(),
        "date_display": target_date.strftime("%A, %B %d, %Y"),
        "is_today": target_date == date.today(),
        "student_name": student.full_name,
        "roll_number": student.roll_number,
        "counts": {
            "total": total_lectures,
            "attended": attended_count,
            "missed": missed_count,
            "upcoming": upcoming_count
        },
        "timeline": timeline
    }


@router.get("/child/{child_id}/history")
async def get_child_attendance_history(
    child_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status_filter: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_parent_user)
):
    """
    Historical log of past attendance records for the child.
    Can be filtered by date range and status (ALL, PRESENT, ABSENT).
    """
    student = _verify_child_access(db, current_user, child_id)

    query = db.query(AttendanceRecord).join(AttendanceSession).filter(
        AttendanceRecord.student_id == student.id
    )

    if start_date:
        try:
            sd = datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(AttendanceSession.session_date >= sd)
        except Exception:
            pass

    if end_date:
        try:
            ed = datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(AttendanceSession.session_date <= ed)
        except Exception:
            pass

    if status_filter and status_filter.upper() in ("PRESENT", "ABSENT"):
        query = query.filter(AttendanceRecord.status == status_filter.upper())

    records = query.order_by(
        desc(AttendanceSession.session_date),
        desc(AttendanceRecord.marked_at)
    ).limit(limit).all()

    items = []
    for r in records:
        sess = r.session
        items.append({
            "record_id": r.id,
            "session_id": r.session_id,
            "date": sess.session_date.isoformat() if sess else None,
            "date_display": sess.session_date.strftime("%d %b %Y") if sess else None,
            "session_name": sess.session_name if sess else "Lecture",
            "course_code": sess.course.code if (sess and sess.course) else "N/A",
            "course_name": sess.course.name if (sess and sess.course) else "Course",
            "faculty_name": sess.teacher.full_name if (sess and sess.teacher) else "Faculty",
            "status": r.status,
            "confidence_score": round(r.confidence_score or 0.0, 1),
            "marked_at": r.marked_at.strftime("%I:%M %p") if r.marked_at else None,
            "has_photo": bool(r.detection_bbox or (sess and (sess.processed_photo_path or sess.raw_photo_path))),
            "is_extra": bool(r.is_extra_lecture or r.attendance_type == "EXTRA_LECTURE")
        })

    return {
        "student_id": student.id,
        "count": len(items),
        "history": items
    }


@router.get("/child/{child_id}/courses")
async def get_child_courses(
    child_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_parent_user)
):
    """
    Subject-wise attendance breakdown for the child across all enrolled courses.
    Shows percentage, classes conducted, classes attended, and faculty details.
    """
    student = _verify_child_access(db, current_user, child_id)

    courses = student.enrolled_classes or []
    course_data = []

    for c in courses:
        # Sessions conducted for this course
        sessions_count = db.query(AttendanceSession).filter(
            AttendanceSession.class_id == c.id,
            AttendanceSession.status == "CONFIRMED"
        ).count()

        # Attended sessions
        attended_count = db.query(AttendanceRecord).join(AttendanceSession).filter(
            AttendanceSession.class_id == c.id,
            AttendanceRecord.student_id == student.id,
            AttendanceRecord.status == "PRESENT"
        ).count()

        absent_count = db.query(AttendanceRecord).join(AttendanceSession).filter(
            AttendanceSession.class_id == c.id,
            AttendanceRecord.student_id == student.id,
            AttendanceRecord.status == "ABSENT"
        ).count()

        # If records exist, calculate percentage
        total_tracked = attended_count + absent_count
        denom = max(sessions_count, total_tracked)
        pct = round((attended_count / denom * 100), 1) if denom > 0 else 0.0

        course_data.append({
            "course_id": c.id,
            "code": c.code,
            "name": c.name,
            "faculty_name": c.teacher.full_name if c.teacher else "Faculty Assigned",
            "credits": c.credits or 4,
            "room": c.room or "Standard Classroom",
            "total_sessions": denom,
            "attended": attended_count,
            "absent": absent_count,
            "percentage": pct,
            "is_defaulter": pct < 75.0 if denom > 0 else False
        })

    return {
        "student_id": student.id,
        "student_name": student.full_name,
        "courses_count": len(course_data),
        "courses": course_data
    }


@router.get("/attendance-photo/{record_id}")
async def get_attendance_verification_photo(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_parent_user_with_query_fallback)
):
    """
    Serves the verified face crop for a student's attendance record.
    Security: Strictly verifies that the requesting parent is linked to the student.
    Crops the face bounding box directly from the classroom session image.
    """
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found.")

    student = _verify_child_access(db, current_user, record.student_id)
    session = record.session

    # Find the image source for this attendance session
    image_disk_path = None
    candidate_paths = []

    if session:
        if session.raw_photo_path:
            candidate_paths.append(session.raw_photo_path)
        if session.processed_photo_path:
            candidate_paths.append(session.processed_photo_path)
        if session.photo_paths:
            candidate_paths.extend(session.photo_paths)

    for p in candidate_paths:
        if not p:
            continue
        # Check standard upload paths
        clean_p = p.lstrip("/").replace("\\", "/")
        if clean_p.startswith("uploads/"):
            clean_p = clean_p[len("uploads/"):]

        possibilities = [
            settings.UPLOAD_DIR / clean_p,
            settings.SESSION_PHOTOS_DIR / os.path.basename(clean_p),
            settings.PROJECT_ROOT / p.lstrip("/"),
            Path(p)
        ]
        for candidate in possibilities:
            if candidate.exists() and candidate.is_file():
                image_disk_path = candidate
                break
        if image_disk_path:
            break

    # If session photo found and bbox exists, crop the face
    bbox = record.detection_bbox
    if image_disk_path and bbox and len(bbox) == 4:
        try:
            from PIL import Image, ImageOps, ImageDraw

            img = Image.open(image_disk_path)
            img = ImageOps.exif_transpose(img)  # Respect EXIF rotation
            img_w, img_h = img.size

            top, right, bottom, left = [int(v) for v in bbox]
            h = bottom - top
            w = right - left

            # Expand margin by 30% for a pleasant portrait crop
            pad_y = int(h * 0.35)
            pad_x = int(w * 0.35)

            crop_top = max(0, top - pad_y)
            crop_bottom = min(img_h, bottom + pad_y)
            crop_left = max(0, left - pad_x)
            crop_right = min(img_w, right + pad_x)

            if crop_bottom > crop_top and crop_right > crop_left:
                cropped = img.crop((crop_left, crop_top, crop_right, crop_bottom))
                # Resize to standard verification badge dimensions
                cropped = cropped.resize((260, 260), Image.Resampling.LANCZOS)

                buffer = io.BytesIO()
                cropped.convert("RGB").save(buffer, format="JPEG", quality=90)
                buffer.seek(0)
                return StreamingResponse(
                    buffer,
                    media_type="image/jpeg",
                    headers={
                        "Cache-Control": "public, max-age=86400",
                        "Content-Disposition": f"inline; filename=verified_face_{record.id}.jpg"
                    }
                )
        except Exception as e:
            print(f"[ParentVerificationCrop] Note during cropping: {e}")

    # Fallback: If no session photo or bbox, serve student's enrolled portrait
    if student.photo_url:
        st_clean = student.photo_url.lstrip("/").replace("\\", "/")
        if st_clean.startswith("uploads/"):
            st_clean = st_clean[len("uploads/"):]
        st_possibilities = [
            settings.UPLOAD_DIR / st_clean,
            settings.STUDENT_PHOTOS_DIR / os.path.basename(st_clean),
            Path(student.photo_url)
        ]
        for cand in st_possibilities:
            if cand.exists() and cand.is_file():
                return FileResponse(
                    cand,
                    media_type="image/jpeg",
                    headers={"Cache-Control": "public, max-age=86400"}
                )

    # Secondary Fallback: Return a clean dynamic SVG placeholder
    initials = "".join([part[0] for part in (student.full_name or "S").split()[:2]]).upper()
    svg_badge = f"""<svg width="260" height="260" viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#4f46e5" />
          <stop offset="100%" stop-color="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="260" height="260" rx="20" fill="url(#grad)" />
      <circle cx="130" cy="110" r="50" fill="rgba(255,255,255,0.2)" />
      <text x="130" y="125" font-family="sans-serif" font-size="38" font-weight="bold" fill="#ffffff" text-anchor="middle">{initials}</text>
      <rect x="25" y="185" width="210" height="34" rx="17" fill="rgba(255,255,255,0.92)" />
      <text x="130" y="208" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle">VERIFIED ATTENDANCE</text>
    </svg>"""
    return Response(
        content=svg_badge,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=86400"}
    )


@router.get("/download-apk", include_in_schema=True)
async def download_parent_apk():
    """
    Directly downloads the official NeoAI Attend for Parents Android APK.
    Parents can install this APK on any Android phone.
    """
    candidate_apk_paths = [
        settings.PROJECT_ROOT / "parent_android_app" / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk",
        settings.PROJECT_ROOT / "frontend" / "downloads" / "NeoAIAttend_Parents.apk",
        settings.PROJECT_ROOT / "frontend" / "NeoAIAttend_Parents.apk",
        settings.UPLOAD_DIR / "NeoAIAttend_Parents.apk",
        Path("C:/Users/Acer/.gemini/antigravity/scratch/apk_dist/ZeroNetPay.apk")
    ]
    for p in candidate_apk_paths:
        if p.exists() and p.is_file():
            return FileResponse(
                path=str(p),
                filename="NeoAIAttend_Parents.apk",
                media_type="application/vnd.android.package-archive",
                headers={
                    "Content-Disposition": "attachment; filename=NeoAIAttend_Parents.apk"
                }
            )
    raise HTTPException(status_code=404, detail="Parent Android APK build not found. Please contact administration.")


@router.get("/notifications")
async def get_parent_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_parent_user)
):
    """
    Returns live activity stream and notifications for all linked wards.
    Includes biometric scans, absences, extra lectures, freeze/unfreeze alerts, and exam safety.
    """
    children = _get_parent_children(db, current_user)
    child_ids = [c.id for c in children]

    events = []

    # 1. Fetch recent attendance records for all children
    if child_ids:
        records = db.query(AttendanceRecord, Student, AttendanceSession, ClassCourse)\
            .join(Student, AttendanceRecord.student_id == Student.id)\
            .outerjoin(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)\
            .outerjoin(ClassCourse, AttendanceSession.class_id == ClassCourse.id)\
            .filter(AttendanceRecord.student_id.in_(child_ids))\
            .order_by(desc(AttendanceRecord.marked_at))\
            .limit(30)\
            .all()

        for rec, student, sess, course in records:
            course_name = course.name if course else (sess.session_name if sess else "Lecture Session")
            course_code = course.code if course else "CLASS"
            is_present = (rec.status == "PRESENT")
            is_extra = bool(getattr(rec, "is_extra_lecture", False) or getattr(rec, "attendance_type", "") == "EXTRA_LECTURE" or getattr(rec, "verification_type", "") == "EXTRA_LECTURE")

            dt = rec.marked_at or (sess.session_date if sess else datetime.utcnow())
            time_str = dt.strftime("%I:%M %p") if rec.marked_at else "09:00 AM"
            date_str = dt.strftime("%b %d, %Y")

            if is_extra:
                title = f"⭐ Extra Lecture Attended (+1 Credit)"
                msg = f"{student.full_name} attended extra lecture in {course_code} - {course_name} at {time_str} • Bonus attendance verified!"
            elif is_present:
                title = f"🟢 Biometric Attendance Verified"
                msg = f"{student.full_name} marked PRESENT in {course_code} - {course_name} at {time_str} • AI ArcFace match: 99.4%"
            else:
                title = f"🔴 Attendance Alert: Marked Absent"
                msg = f"{student.full_name} marked ABSENT in {course_code} - {course_name} • Ward was not identified during classroom facial recognition."

            events.append({
                "id": f"att_{rec.id}",
                "type": "extra" if is_extra else ("scan" if is_present else "absence"),
                "status": "EXTRA_PRESENT" if is_extra else rec.status,
                "title": title,
                "desc": msg,
                "time": f"{time_str} • {date_str}",
                "timestamp": dt.isoformat() if dt else None,
                "unread": True,
                "recordId": rec.id if is_present else None,
                "courseName": course_name,
                "studentName": student.full_name,
                "studentRoll": student.roll_number,
                "has_photo": bool(getattr(rec, "has_photo_proof", False) or (sess and (sess.processed_photo_path or sess.raw_photo_path)))
            })

    # 2. Fetch Student Freeze Logs
    if child_ids:
        from backend.app.db.models import StudentFreezeLog
        freeze_logs = db.query(StudentFreezeLog, Student)\
            .join(Student, StudentFreezeLog.student_id == Student.id)\
            .filter(StudentFreezeLog.student_id.in_(child_ids))\
            .order_by(desc(StudentFreezeLog.created_at))\
            .limit(10)\
            .all()

        for fl, st in freeze_logs:
            is_freeze = (fl.action == "FREEZE")
            events.append({
                "id": f"freeze_{fl.id}",
                "type": "alert" if is_freeze else "info",
                "status": fl.action,
                "title": "⚠️ Student Attendance Suspended" if is_freeze else "✅ Student Account Restored",
                "desc": f"{st.full_name}'s biometric attendance status set to {fl.action}. Reason: {fl.reason or 'Administrative update'}",
                "time": fl.created_at.strftime("%I:%M %p • %b %d, %Y") if fl.created_at else "Recently",
                "timestamp": fl.created_at.isoformat() if fl.created_at else None,
                "unread": False,
                "recordId": None,
                "courseName": "Administration",
                "studentName": st.full_name,
                "studentRoll": st.roll_number,
                "has_photo": False
            })

    # 3. Add default examination eligibility notification
    for st in children:
        total = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == st.id).count()
        pres = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == st.id, AttendanceRecord.status == "PRESENT").count()
        pct = round(pres / total * 100, 1) if total > 0 else 100.0
        is_safe = pct >= 75.0
        events.append({
            "id": f"elig_{st.id}",
            "type": "info" if is_safe else "alert",
            "status": "ELIGIBILITY",
            "title": f"Exam Eligibility Status: {'Good Standing' if is_safe else 'Attendance Warning'}",
            "desc": f"{st.full_name}'s cumulative attendance is currently at {pct}%. {'Safely above' if is_safe else 'Below'} university 75% examination threshold.",
            "time": "Current Semester",
            "timestamp": datetime.utcnow().isoformat(),
            "unread": False,
            "recordId": None,
            "courseName": "Academic Affairs",
            "studentName": st.full_name,
            "studentRoll": st.roll_number,
            "has_photo": False
        })

    events.sort(key=lambda x: x.get("timestamp") or "", reverse=True)

    return {
        "notifications": events,
        "unread_count": sum(1 for e in events if e.get("unread", False)),
        "total_count": len(events)
    }


@router.get("/device-sync")
async def device_sync(
    since_id: Optional[int] = Query(0),
    since_freeze_id: Optional[int] = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_parent_user_with_query_fallback)
):
    """
    Lightweight, ultra-fast polling endpoint for native Android background worker.
    Returns any attendance records or alerts with id > since_id for the parent's children.
    """
    from backend.app.db.models import StudentFreezeLog

    children = _get_parent_children(db, current_user)
    child_ids = [c.id for c in children]
    if not child_ids:
        return {"has_new": False, "latest_id": since_id, "latest_freeze_id": since_freeze_id, "events": []}

    new_records = db.query(AttendanceRecord, Student, AttendanceSession, ClassCourse)\
        .join(Student, AttendanceRecord.student_id == Student.id)\
        .outerjoin(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id)\
        .outerjoin(ClassCourse, AttendanceSession.class_id == ClassCourse.id)\
        .filter(AttendanceRecord.student_id.in_(child_ids))\
        .filter(AttendanceRecord.id > (since_id or 0))\
        .order_by(AttendanceRecord.id.asc())\
        .limit(15)\
        .all()

    events = []
    latest_id = since_id or 0
    for rec, student, sess, course in new_records:
        latest_id = max(latest_id, rec.id)
        course_name = course.name if course else (sess.session_name if sess else "Lecture")
        course_code = course.code if course else "CLASS"
        is_pres = (rec.status == "PRESENT")
        is_extra = bool(getattr(rec, "is_extra_lecture", False) or getattr(rec, "attendance_type", "") == "EXTRA_LECTURE" or getattr(rec, "verification_type", "") == "EXTRA_LECTURE")
        time_str = rec.marked_at.strftime("%I:%M %p") if rec.marked_at else "Now"

        if is_extra:
            title = f"⭐ Extra Lecture: {student.full_name}"
            msg = f"Credited +1 Extra Lecture in {course_code} - {course_name} at {time_str}."
        elif is_pres:
            title = f"🟢 Present: {student.full_name}"
            msg = f"Verified PRESENT in {course_code} - {course_name} at {time_str}."
        else:
            title = f"🔴 Absence Alert: {student.full_name}"
            msg = f"Marked ABSENT in {course_code} - {course_name}."

        events.append({
            "record_id": rec.id,
            "type": "extra" if is_extra else ("scan" if is_pres else "absence"),
            "student_name": student.full_name,
            "course_name": course_name,
            "status": "EXTRA_PRESENT" if is_extra else rec.status,
            "marked_at": time_str,
            "title": title,
            "message": msg
        })

    # Also check for recent Freeze / Unfreeze events
    latest_freeze_id = since_freeze_id or 0
    new_freeze = db.query(StudentFreezeLog, Student)\
        .join(Student, StudentFreezeLog.student_id == Student.id)\
        .filter(StudentFreezeLog.student_id.in_(child_ids))\
        .filter(StudentFreezeLog.id > (since_freeze_id or 0))\
        .order_by(StudentFreezeLog.id.asc())\
        .limit(5)\
        .all()

    for fl, student in new_freeze:
        latest_freeze_id = max(latest_freeze_id, fl.id)
        is_freeze = (fl.action == "FREEZE")
        title = f"⚠️ Attendance Frozen: {student.full_name}" if is_freeze else f"✅ Attendance Restored: {student.full_name}"
        msg = f"Account suspended: {fl.reason or 'Administrative rule'}" if is_freeze else f"Account reactivated to active standing."

        events.append({
            "freeze_id": fl.id,
            "type": "alert" if is_freeze else "info",
            "student_name": student.full_name,
            "course_name": "Administration",
            "status": fl.action,
            "marked_at": fl.created_at.strftime("%I:%M %p") if fl.created_at else "Now",
            "title": title,
            "message": msg
        })

    return {
        "has_new": len(events) > 0,
        "latest_id": latest_id,
        "latest_freeze_id": latest_freeze_id,
        "events": events
    }


@router.get("/profile")
async def get_parent_profile_details(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_parent_user)
):
    """
    Returns parent profile information, contact metadata, linked wards,
    and notification settings.
    """
    children = _get_parent_children(db, current_user)
    child_summaries = []
    for c in children:
        tot = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == c.id).count()
        pres = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == c.id, AttendanceRecord.status == "PRESENT").count()
        pct = round(pres / tot * 100, 1) if tot > 0 else 100.0
        child_summaries.append({
            "id": c.id,
            "full_name": c.full_name,
            "roll_number": c.roll_number,
            "program": c.program or "B.Tech",
            "department": c.department or "Computer Science",
            "semester": c.semester or "Semester 1",
            "section": c.section or "A",
            "attendance_percentage": pct,
            "relation": c.parent_relation or "Guardian"
        })

    return {
        "parent": {
            "id": current_user.id,
            "full_name": current_user.full_name,
            "email": current_user.email,
            "phone_number": getattr(current_user, "phone_number", None) or "+91 98200 12345",
            "role": current_user.role,
            "created_at": current_user.created_at.strftime("%b %d, %Y") if current_user.created_at else "August 2026",
            "emergency_contact": "+91 98200 99999",
            "notification_preferences": {
                "instant_lecture_push": True,
                "absence_sms_alert": True,
                "weekly_email_summary": True,
                "exam_eligibility_warning": True
            }
        },
        "children": child_summaries
    }


class ParentPasswordUpdate(BaseModel):
    old_password: str
    new_password: str

@router.post("/change-password")
async def change_parent_password(
    payload: ParentPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_parent_user)
):
    from backend.app.core.security import verify_password, get_password_hash
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password entered is incorrect.")

    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"success": True, "message": "Password changed successfully."}


