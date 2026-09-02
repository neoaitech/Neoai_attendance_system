import uuid
import calendar
import threading
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from backend.app.db.session import get_db
from backend.app.db.models import User, Student, EmailSetting, EmailLog
from backend.app.api.auth import get_current_user
from backend.app.services.email_service import (
    get_or_create_email_settings,
    send_raw_smtp_email,
    send_single_student_report,
    EmailDispatchTracker
)

router = APIRouter(prefix="/email-reports", tags=["Email Attendance Reports"])


class EmailSettingsPayload(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: Optional[str] = None  # If None, retain existing password
    smtp_from_name: str = "VisionAttend AI Attendance Portal"
    smtp_from_email: Optional[str] = None
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    is_email_enabled: bool = True
    auto_monthly_dispatch: bool = False
    monthly_dispatch_day: int = 30
    monthly_dispatch_hour: int = 18


class TestEmailPayload(BaseModel):
    recipient_email: str
    recipient_name: Optional[str] = "Academic Administrator"


class BulkDispatchPayload(BaseModel):
    year: int
    month: int
    report_type: str = "MONTHLY"  # "MONTHLY" or "QUARTERLY"
    department: Optional[str] = None
    program: Optional[str] = None
    section: Optional[str] = None
    semester: Optional[str] = None


@router.get("/settings")
def get_email_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve SMTP email configuration (Super Admin & Admin)."""
    settings_obj = get_or_create_email_settings(db)
    return settings_obj.to_dict()


@router.put("/settings")
def update_email_settings(
    payload: EmailSettingsPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update SMTP email configuration (Super Admin only)."""
    role = getattr(current_user, "role", "").upper()
    if role not in ["SUPER_ADMIN", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Only administrators can configure email settings.")

    settings_obj = get_or_create_email_settings(db)
    settings_obj.smtp_host = payload.smtp_host.strip()
    settings_obj.smtp_port = payload.smtp_port
    settings_obj.smtp_user = payload.smtp_user.strip()
    if payload.smtp_password is not None and len(payload.smtp_password.strip()) > 0:
        settings_obj.smtp_password = payload.smtp_password.strip()
    settings_obj.smtp_from_name = payload.smtp_from_name.strip()
    settings_obj.smtp_from_email = (payload.smtp_from_email or payload.smtp_user).strip()
    settings_obj.smtp_use_tls = payload.smtp_use_tls
    settings_obj.smtp_use_ssl = payload.smtp_use_ssl
    settings_obj.is_email_enabled = payload.is_email_enabled
    settings_obj.auto_monthly_dispatch = payload.auto_monthly_dispatch
    settings_obj.monthly_dispatch_day = payload.monthly_dispatch_day
    settings_obj.monthly_dispatch_hour = payload.monthly_dispatch_hour
    settings_obj.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(settings_obj)
    return {"message": "Email settings updated successfully.", "settings": settings_obj.to_dict()}


@router.post("/test-connection")
def test_email_connection(
    payload: TestEmailPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sends a verification test email to ensure SMTP credentials work."""
    settings_obj = get_or_create_email_settings(db)
    if not settings_obj.smtp_host or not settings_obj.smtp_user or not settings_obj.smtp_password:
        raise HTTPException(status_code=400, detail="SMTP credentials are not configured. Please fill in Host, Username and App Password.")

    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")
    test_html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; background-color: #f8fafc; padding: 25px; color: #0f172a;">
        <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="background: #4f46e5; color: white; padding: 12px 18px; border-radius: 8px; font-weight: bold; font-size: 16px; margin-bottom: 16px;">
                ✅ VisionAttend AI &bull; SMTP Verification Test
            </div>
            <p>Hello <b>{payload.recipient_name}</b>,</p>
            <p>Your SMTP mail configuration on <b>VisionAttend AI Attendance Portal</b> is functioning perfectly!</p>
            <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 13px; margin: 15px 0;">
                <div><b>SMTP Host:</b> {settings_obj.smtp_host}:{settings_obj.smtp_port}</div>
                <div><b>Sender Account:</b> {settings_obj.smtp_user}</div>
                <div><b>Timestamp:</b> {now_str}</div>
            </div>
            <p style="font-size: 12px; color: #64748b;">You can now safely dispatch automated monthly and quarterly student attendance dossiers.</p>
        </div>
    </body>
    </html>
    """

    success, error = send_raw_smtp_email(
        settings_obj=settings_obj,
        to_email=payload.recipient_email.strip(),
        subject="✅ VisionAttend AI: SMTP Mail Server Connection Test",
        html_content=test_html
    )

    if not success:
        raise HTTPException(status_code=400, detail=f"SMTP Error: {error}")

    return {"status": "success", "message": f"Test email successfully sent to {payload.recipient_email}."}


def _run_bulk_email_dispatch(
    job_id: str,
    student_ids: List[int],
    year: int,
    month: int,
    report_type: str,
    period_label: str
):
    """Background worker function that iterates over students and dispatches emails."""
    from backend.app.db.session import SessionLocal
    db = SessionLocal()
    try:
        settings_obj = get_or_create_email_settings(db)
        students = db.query(Student).filter(Student.id.in_(student_ids)).all()

        for st in students:
            if not st.email or not st.email.strip():
                EmailDispatchTracker.update_progress(
                    job_id=job_id,
                    sent=False,
                    skipped=True,
                    student_name=st.full_name,
                    error="No email registered"
                )
                continue

            try:
                success, error = send_single_student_report(
                    db=db,
                    student=st,
                    year=year,
                    month=month,
                    report_type=report_type,
                    settings_obj=settings_obj
                )
                EmailDispatchTracker.update_progress(
                    job_id=job_id,
                    sent=success,
                    skipped=False,
                    student_name=st.full_name,
                    error=error
                )
            except Exception as e:
                EmailDispatchTracker.update_progress(
                    job_id=job_id,
                    sent=False,
                    skipped=False,
                    student_name=st.full_name,
                    error=str(e)
                )

        EmailDispatchTracker.finish_job(job_id)
    finally:
        db.close()


@router.post("/dispatch-bulk")
def dispatch_bulk_emails(
    payload: BulkDispatchPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Triggers an asynchronous bulk dispatch of Monthly or 3-Month attendance reports to enrolled students.
    Returns a job_id for real-time progress polling.
    """
    settings_obj = get_or_create_email_settings(db)
    if not settings_obj.is_email_enabled:
        raise HTTPException(status_code=400, detail="Email dispatch is disabled in system settings.")

    if not settings_obj.smtp_host or not settings_obj.smtp_user or not settings_obj.smtp_password:
        raise HTTPException(status_code=400, detail="SMTP credentials are not configured. Please configure SMTP in Settings.")

    # Filter target students
    query = db.query(Student).filter(Student.is_active == True)
    if payload.department:
        query = query.filter(Student.department == payload.department)
    if payload.program:
        query = query.filter(Student.program == payload.program)
    if payload.section:
        query = query.filter(Student.section == payload.section)
    if payload.semester:
        query = query.filter(Student.semester == payload.semester)

    target_students = query.all()
    if not target_students:
        raise HTTPException(status_code=404, detail="No active students found matching the selected filters.")

    month_name = calendar.month_name[payload.month]
    if payload.report_type == "QUARTERLY":
        q_start = max(1, payload.month - 2)
        period_label = f"{calendar.month_name[q_start]}-{month_name} {payload.year} (3-Month)"
    else:
        period_label = f"{month_name} {payload.year}"

    job_id = f"job_{uuid.uuid4().hex[:10]}"
    student_ids = [s.id for s in target_students]

    # Initialize tracker
    EmailDispatchTracker.create_job(
        job_id=job_id,
        total_students=len(student_ids),
        report_type=payload.report_type,
        period_label=period_label
    )

    # Spawn background worker thread
    thread = threading.Thread(
        target=_run_bulk_email_dispatch,
        args=(job_id, student_ids, payload.year, payload.month, payload.report_type, period_label),
        daemon=True
    )
    thread.start()

    return {
        "status": "started",
        "job_id": job_id,
        "total_target_students": len(student_ids),
        "period_label": period_label,
        "report_type": payload.report_type,
        "message": f"Email dispatch job started for {len(student_ids)} students."
    }


@router.get("/dispatch-status/{job_id}")
def get_dispatch_status(
    job_id: str,
    current_user: User = Depends(get_current_user)
):
    """Polls real-time progress for an ongoing or completed email dispatch job."""
    status = EmailDispatchTracker.get_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Dispatch job ID not found or expired.")
    return status


@router.get("/logs")
def get_email_logs(
    limit: int = Query(50, ge=1, le=200),
    report_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve audit history of dispatched attendance emails."""
    query = db.query(EmailLog).order_by(EmailLog.sent_at.desc())
    if report_type:
        query = query.filter(EmailLog.report_type == report_type)
    if status:
        query = query.filter(EmailLog.status == status)

    logs = query.limit(limit).all()
    return [log.to_dict() for log in logs]
