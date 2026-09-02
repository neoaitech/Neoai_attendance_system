import os
import smtplib
import ssl
import calendar
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime, date
from typing import Dict, Any, List, Optional
import threading

from sqlalchemy.orm import Session
from backend.app.db.models import EmailSetting, EmailLog, Student
from backend.app.services.report_service import ReportService


class EmailDispatchTracker:
    """In-memory thread-safe progress tracker for bulk email dispatch jobs."""
    _lock = threading.Lock()
    _jobs: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def create_job(cls, job_id: str, total_students: int, report_type: str, period_label: str):
        with cls._lock:
            cls._jobs[job_id] = {
                "job_id": job_id,
                "total": total_students,
                "processed": 0,
                "sent": 0,
                "failed": 0,
                "skipped": 0,
                "report_type": report_type,
                "period_label": period_label,
                "is_completed": False,
                "current_student": "",
                "errors": [],
                "started_at": datetime.utcnow().isoformat(),
                "completed_at": None
            }

    @classmethod
    def update_progress(cls, job_id: str, sent: bool, skipped: bool = False, student_name: str = "", error: str = None):
        with cls._lock:
            if job_id in cls._jobs:
                job = cls._jobs[job_id]
                job["processed"] += 1
                job["current_student"] = student_name
                if skipped:
                    job["skipped"] += 1
                elif sent:
                    job["sent"] += 1
                else:
                    job["failed"] += 1
                    if error:
                        job["errors"].append({"student": student_name, "error": error})

    @classmethod
    def finish_job(cls, job_id: str):
        with cls._lock:
            if job_id in cls._jobs:
                cls._jobs[job_id]["is_completed"] = True
                cls._jobs[job_id]["completed_at"] = datetime.utcnow().isoformat()

    @classmethod
    def get_status(cls, job_id: str) -> Optional[Dict[str, Any]]:
        with cls._lock:
            return cls._jobs.get(job_id)


def get_or_create_email_settings(db: Session) -> EmailSetting:
    """Retrieve existing SMTP configuration or create default row."""
    settings_obj = db.query(EmailSetting).first()
    if not settings_obj:
        settings_obj = EmailSetting(
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            smtp_user="",
            smtp_password="",
            smtp_from_name="VisionAttend AI Attendance Portal",
            smtp_from_email="",
            smtp_use_tls=True,
            smtp_use_ssl=False,
            is_email_enabled=True,
            auto_monthly_dispatch=False,
            monthly_dispatch_day=30,
            monthly_dispatch_hour=18
        )
        db.add(settings_obj)
        db.commit()
        db.refresh(settings_obj)
    return settings_obj


def send_raw_smtp_email(
    settings_obj: EmailSetting,
    to_email: str,
    subject: str,
    html_content: str,
    attachments: Optional[List[Dict[str, Any]]] = None
) -> tuple[bool, Optional[str]]:
    """
    Sends an email using standard Python smtplib with TLS/SSL support.
    Returns: (success: bool, error_message: Optional[str])
    """
    if not settings_obj.is_email_enabled:
        return False, "Email dispatch is disabled in system settings."

    if not settings_obj.smtp_host or not settings_obj.smtp_user or not settings_obj.smtp_password:
        return False, "SMTP configuration is incomplete. Please configure Host, User, and App Password in Admin Settings."

    try:
        from_email = settings_obj.smtp_from_email or settings_obj.smtp_user
        from_header = f"{settings_obj.smtp_from_name} <{from_email}>"

        msg = MIMEMultipart("mixed")
        msg["From"] = from_header
        msg["To"] = to_email
        msg["Subject"] = subject

        # HTML Body
        body_part = MIMEMultipart("alternative")
        html_part = MIMEText(html_content, "html", "utf-8")
        body_part.attach(html_part)
        msg.attach(body_part)

        # Attachments
        if attachments:
            for att in attachments:
                fname = att.get("filename", "report.pdf")
                content = att.get("content")
                if content:
                    part = MIMEApplication(content, Name=fname)
                    part["Content-Disposition"] = f'attachment; filename="{fname}"'
                    msg.attach(part)

        # Connect to SMTP Server
        if settings_obj.smtp_use_ssl:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings_obj.smtp_host, settings_obj.smtp_port, context=context, timeout=20) as server:
                server.login(settings_obj.smtp_user, settings_obj.smtp_password)
                server.sendmail(from_email, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(settings_obj.smtp_host, settings_obj.smtp_port, timeout=20) as server:
                server.ehlo()
                if settings_obj.smtp_use_tls:
                    context = ssl.create_default_context()
                    server.starttls(context=context)
                    server.ehlo()
                server.login(settings_obj.smtp_user, settings_obj.smtp_password)
                server.sendmail(from_email, [to_email], msg.as_string())

        return True, None
    except Exception as e:
        return False, str(e)


def build_monthly_html_body(student_name: str, roll_number: str, program: str, division: str, summary: Dict[str, Any], month_label: str) -> str:
    """Builds a beautiful responsive HTML email body for single monthly attendance report."""
    if not summary:
        summary = {}

    pct = summary.get("final_percentage") if summary.get("final_percentage") is not None else summary.get("overall_stats", {}).get("attendance_percentage", 0.0)
    conducted = summary.get("normal_conducted") if summary.get("normal_conducted") is not None else (summary.get("total_sessions") if summary.get("total_sessions") is not None else summary.get("overall_stats", {}).get("total_conducted", 0))
    attended = summary.get("total_present") if summary.get("total_present") is not None else summary.get("overall_stats", {}).get("total_attended", 0)
    absent = summary.get("total_absent") if summary.get("total_absent") is not None else summary.get("overall_stats", {}).get("total_absent", 0)
    frozen = summary.get("normal_frozen") if summary.get("normal_frozen") is not None else (summary.get("total_frozen") if summary.get("total_frozen") is not None else summary.get("overall_stats", {}).get("total_frozen", 0))

    # Color tokens
    if pct >= 75.0:
        status_badge_bg = "#ecfdf5"
        status_badge_border = "#a7f3d0"
        status_badge_text = "#065f46"
        status_title = "GOOD STANDING (>=75%)"
        status_desc = "Congratulations! Your attendance meets the institutional criteria. Keep up the regular attendance!"
    elif pct >= 65.0:
        status_badge_bg = "#fffbeb"
        status_badge_border = "#fde68a"
        status_badge_text = "#92400e"
        status_title = "WARNING ZONE (65% - 74.9%)"
        status_desc = "Notice: Your attendance is slightly below the mandatory 75% threshold. Please attend upcoming lectures to avoid defaulter penalty."
    else:
        status_badge_bg = "#fef2f2"
        status_badge_border = "#fecaca"
        status_badge_text = "#991b1b"
        status_title = "CRITICAL DEFAULTER (<65%)"
        status_desc = "Urgent: Your attendance is severely low. Please meet your Class Coordinator / HOD immediately to resolve your attendance shortage."

    # Subject breakdown table rows
    subjects = summary.get("subjects_breakdown") or summary.get("subject_breakdown", [])
    subject_rows_html = ""
    for sub in subjects:
        s_pct = sub.get("attendance_percentage", 0.0)
        s_cond = sub.get("total_lectures") if sub.get("total_lectures") is not None else sub.get("conducted", 0)
        s_att = sub.get("present_count") if sub.get("present_count") is not None else sub.get("attended", 0)
        s_abs = sub.get("absent_count") if sub.get("absent_count") is not None else sub.get("absent", 0)
        s_froz = sub.get("frozen_count", 0) if sub.get("frozen_count") is not None else sub.get("frozen", 0)
        s_color = "#15803d" if s_pct >= 75.0 else ("#b45309" if s_pct >= 65.0 else "#b91c1c")

        subject_rows_html += f"""
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">{sub.get('course_name', 'Subject')} <span style="color: #64748b; font-size: 11px; font-weight: normal;">({sub.get('course_code', '')})</span></td>
            <td style="padding: 10px 12px; text-align: center; color: #475569;">{s_cond}</td>
            <td style="padding: 10px 12px; text-align: center; color: #15803d; font-weight: bold;">{s_att}</td>
            <td style="padding: 10px 12px; text-align: center; color: #dc2626;">{s_abs}</td>
            <td style="padding: 10px 12px; text-align: center; color: #0891b2;">{s_froz}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: bold; color: {s_color};">{s_pct}%</td>
        </tr>
        """

    if not subject_rows_html:
        subject_rows_html = """<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8;">No class attendance sessions recorded for this month.</td></tr>"""

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Monthly Attendance Report - {month_label}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 30px 15px;">
            <tr>
                <td align="center">
                    <table width="100%" max-width="650" style="max-width: 650px; background-color: #ffffff; border-radius: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; overflow: hidden;" cellpadding="0" cellspacing="0">
                        
                        <!-- Header Banner -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); padding: 28px 30px; text-align: left;">
                                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #c7d2fe; margin-bottom: 6px;">VisionAttend AI &bull; Monthly Attendance Report</div>
                                <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800;">{month_label} Academic Attendance Summary</h1>
                            </td>
                        </tr>

                        <!-- Student Meta Strip -->
                        <tr>
                            <td style="padding: 20px 30px; background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td>
                                            <div style="font-size: 15px; font-weight: 700; color: #0f172a;">{student_name}</div>
                                            <div style="font-size: 12px; color: #475569; margin-top: 2px;">Roll Number: <b>{roll_number}</b> &bull; Program: <b>{program}</b> &bull; Div: <b>{division}</b></div>
                                        </td>
                                        <td align="right">
                                            <div style="font-size: 28px; font-weight: 900; color: {'#15803d' if pct >= 75.0 else ('#b45309' if pct >= 65.0 else '#dc2626')}; font-family: monospace;">{pct}%</div>
                                            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b;">Monthly Aggregate</div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Advisory Status Card -->
                        <tr>
                            <td style="padding: 24px 30px 10px;">
                                <div style="background-color: {status_badge_bg}; border: 1px solid {status_badge_border}; border-radius: 10px; padding: 14px 18px;">
                                    <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: {status_badge_text}; margin-bottom: 4px;">{status_title}</div>
                                    <div style="font-size: 13px; color: {status_badge_text}; line-height: 1.4;">{status_desc}</div>
                                </div>
                            </td>
                        </tr>

                        <!-- 4 Stat Metric Cards -->
                        <tr>
                            <td style="padding: 15px 30px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td width="23%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                                            <div style="font-size: 11px; color: #64748b; font-weight: 600;">Conducted</div>
                                            <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px;">{conducted}</div>
                                        </td>
                                        <td width="3%"></td>
                                        <td width="23%" style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px; text-align: center;">
                                            <div style="font-size: 11px; color: #065f46; font-weight: 600;">Attended</div>
                                            <div style="font-size: 18px; font-weight: 800; color: #15803d; margin-top: 2px;">{attended}</div>
                                        </td>
                                        <td width="3%"></td>
                                        <td width="23%" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center;">
                                            <div style="font-size: 11px; color: #991b1b; font-weight: 600;">Absent</div>
                                            <div style="font-size: 18px; font-weight: 800; color: #dc2626; margin-top: 2px;">{absent}</div>
                                        </td>
                                        <td width="3%"></td>
                                        <td width="23%" style="background-color: #ecfeff; border: 1px solid #a5f3fc; border-radius: 8px; padding: 12px; text-align: center;">
                                            <div style="font-size: 11px; color: #0e7490; font-weight: 600;">Exempt/Frozen</div>
                                            <div style="font-size: 18px; font-weight: 800; color: #0891b2; margin-top: 2px;">{frozen}</div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Subject-wise Breakdown Table -->
                        <tr>
                            <td style="padding: 10px 30px 24px;">
                                <div style="font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px;">Subject-wise Monthly Breakdown</div>
                                <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; font-size: 12px;">
                                    <thead>
                                        <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                            <th style="padding: 10px 12px; text-align: left; color: #475569; font-weight: 700;">Subject / Course</th>
                                            <th style="padding: 10px 12px; text-align: center; color: #475569; font-weight: 700;">Total</th>
                                            <th style="padding: 10px 12px; text-align: center; color: #15803d; font-weight: 700;">Present</th>
                                            <th style="padding: 10px 12px; text-align: center; color: #dc2626; font-weight: 700;">Absent</th>
                                            <th style="padding: 10px 12px; text-align: center; color: #0891b2; font-weight: 700;">Exempt</th>
                                            <th style="padding: 10px 12px; text-align: right; color: #475569; font-weight: 700;">%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subject_rows_html}
                                    </tbody>
                                </table>
                            </td>
                        </tr>

                        <!-- Attachment Notice & Disclaimer -->
                        <tr>
                            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 30px;">
                                <div style="font-size: 12px; color: #475569; margin-bottom: 6px;">
                                    <b>📎 Attachment Included:</b> A complete official signed PDF report for <b>{month_label}</b> is attached to this email for your academic records.
                                </div>
                                <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">
                                    This is an automated institutional notification generated by VisionAttend AI Attendance System. For any discrepancies or medical leave exemption submissions, please contact your academic administrator.
                                </div>
                            </td>
                        </tr>

                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


def build_quarterly_html_body(student_name: str, roll_number: str, program: str, division: str, quarterly_summary: Dict[str, Any], quarter_label: str) -> str:
    """Builds a comprehensive responsive HTML email body for 3-month (quarterly) cumulative attendance report."""
    if not quarterly_summary:
        quarterly_summary = {}

    pct = quarterly_summary.get("final_percentage") if quarterly_summary.get("final_percentage") is not None else quarterly_summary.get("overall_stats", {}).get("attendance_percentage", 0.0)

    # Monthly breakdown blocks
    months_list = quarterly_summary.get("months", [])
    month_cards_html = ""
    for m in months_list:
        m_name = m.get("month_name", "Month")
        m_pct = m.get("percentage", 0.0)
        m_att = m.get("attended", 0)
        m_tot = m.get("conducted", 0)
        m_col = "#15803d" if m_pct >= 75.0 else ("#b45309" if m_pct >= 65.0 else "#dc2626")

        month_cards_html += f"""
        <td width="31%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">{m_name}</div>
            <div style="font-size: 18px; font-weight: 900; color: {m_col}; margin: 3px 0;">{m_pct}%</div>
            <div style="font-size: 10px; color: #64748b;">{m_att} / {m_tot} Lectures</div>
        </td>
        <td width="3%"></td>
        """

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Quarterly Attendance Dossier - {quarter_label}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 30px 15px;">
            <tr>
                <td align="center">
                    <table width="100%" max-width="650" style="max-width: 650px; background-color: #ffffff; border-radius: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; overflow: hidden;" cellpadding="0" cellspacing="0">
                        
                        <!-- Header Banner -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #7c3aed 0%, #4338ca 100%); padding: 28px 30px; text-align: left;">
                                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #ddd6fe; margin-bottom: 6px;">VisionAttend AI &bull; 3-Month Cumulative Dossier</div>
                                <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800;">{quarter_label} Attendance Performance</h1>
                            </td>
                        </tr>

                        <!-- Student Meta Strip -->
                        <tr>
                            <td style="padding: 20px 30px; background-color: #f5f3ff; border-bottom: 1px solid #ede9fe;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td>
                                            <div style="font-size: 15px; font-weight: 700; color: #0f172a;">{student_name}</div>
                                            <div style="font-size: 12px; color: #475569; margin-top: 2px;">Roll Number: <b>{roll_number}</b> &bull; Program: <b>{program}</b> &bull; Div: <b>{division}</b></div>
                                        </td>
                                        <td align="right">
                                            <div style="font-size: 28px; font-weight: 900; color: {'#15803d' if pct >= 75.0 else ('#b45309' if pct >= 65.0 else '#dc2626')}; font-family: monospace;">{pct}%</div>
                                            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6d28d9;">3-Month Aggregate</div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- 3-Month Progress Cards -->
                        <tr>
                            <td style="padding: 24px 30px 10px;">
                                <div style="font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 12px;">Month-by-Month Progress Matrix</div>
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        {month_cards_html}
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Attachment Notice & Disclaimer -->
                        <tr>
                            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 30px; margin-top: 15px;">
                                <div style="font-size: 12px; color: #475569; margin-bottom: 6px;">
                                    <b>📎 2 PDF Attachments Included:</b>
                                    <ul style="margin: 4px 0 0 16px; padding: 0;">
                                        <li>Current Month Detailed Attendance Report</li>
                                        <li>Consolidated 3-Month Cumulative Quarterly Performance Dossier</li>
                                    </ul>
                                </div>
                                <div style="font-size: 11px; color: #94a3b8; line-height: 1.4; margin-top: 10px;">
                                    This is an official institutional document generated by VisionAttend AI Attendance System. Please review your cumulative standing.
                                </div>
                            </td>
                        </tr>

                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


def send_single_student_report(
    db: Session,
    student: Student,
    year: int,
    month: int,
    report_type: str = "MONTHLY",
    settings_obj: EmailSetting = None
) -> tuple[bool, Optional[str]]:
    """
    Computes data, generates PDF attachment(s), builds HTML body, and sends email to a student.
    """
    if not student.email or not student.email.strip():
        return False, "Student does not have a registered email address."

    if not settings_obj:
        settings_obj = get_or_create_email_settings(db)

    # Date range for selected month
    _, num_days = calendar.monthrange(year, month)
    start_date = date(year, month, 1)
    end_date = date(year, month, num_days)
    month_name = calendar.month_name[month]
    month_label = f"{month_name} {year}"

    # 1. Fetch Month Data
    month_summary = ReportService.get_student_detailed_report(
        db=db,
        student_id=student.id,
        start_date=start_date,
        end_date=end_date
    )

    attachments = []

    # Generate Month PDF
    try:
        month_pdf_path = ReportService.export_student_pdf(
            db=db,
            student_id=student.id,
            start_date=start_date,
            end_date=end_date
        )
        if os.path.exists(month_pdf_path):
            with open(month_pdf_path, "rb") as f:
                attachments.append({
                    "filename": f"Attendance_{student.roll_number}_{month_name}_{year}.pdf",
                    "content": f.read(),
                    "content_type": "application/pdf"
                })
    except Exception as e:
        print(f"[EmailService] Error creating month PDF for {student.full_name}: {e}")

    # If Quarterly / 3-Month:
    if report_type == "QUARTERLY":
        # Compute previous 2 months start date
        q_month_start = max(1, month - 2)
        q_start_date = date(year, q_month_start, 1)
        quarter_label = f"{calendar.month_name[q_month_start]}-{month_name} {year} (3-Month Consolidated)"

        # Generate Quarterly PDF
        try:
            quarterly_pdf_path = ReportService.export_student_pdf(
                db=db,
                student_id=student.id,
                start_date=q_start_date,
                end_date=end_date
            )
            if os.path.exists(quarterly_pdf_path):
                with open(quarterly_pdf_path, "rb") as f:
                    attachments.append({
                        "filename": f"Consolidated_3Month_{student.roll_number}_{year}.pdf",
                        "content": f.read(),
                        "content_type": "application/pdf"
                    })
        except Exception as e:
            print(f"[EmailService] Error creating quarterly PDF for {student.full_name}: {e}")

        # Compute quarterly summary data
        quarterly_full_summary = ReportService.get_student_detailed_report(
            db=db,
            student_id=student.id,
            start_date=q_start_date,
            end_date=end_date
        )

        # Build month list for 3-month cards
        months_list = []
        for m_idx in range(q_month_start, month + 1):
            _, m_days = calendar.monthrange(year, m_idx)
            m_data = ReportService.get_student_detailed_report(db, student.id, date(year, m_idx, 1), date(year, m_idx, m_days))
            m_stats = m_data.get("overall_stats", {})
            months_list.append({
                "month_name": calendar.month_name[m_idx],
                "percentage": m_stats.get("attendance_percentage", 0.0),
                "attended": m_stats.get("total_attended", 0),
                "conducted": m_stats.get("total_conducted", 0)
            })

        quarterly_full_summary["months"] = months_list

        subject = f"📊 3-Month Attendance Dossier: {student.full_name} ({quarter_label})"
        html_body = build_quarterly_html_body(
            student_name=student.full_name,
            roll_number=student.roll_number,
            program=getattr(student, "program", "B.Tech"),
            division=getattr(student, "section", "A"),
            quarterly_summary=quarterly_full_summary,
            quarter_label=quarter_label
        )
        period_str = quarter_label
    else:
        subject = f"📅 Monthly Attendance Report: {student.full_name} ({month_label})"
        html_body = build_monthly_html_body(
            student_name=student.full_name,
            roll_number=student.roll_number,
            program=getattr(student, "program", "B.Tech"),
            division=getattr(student, "section", "A"),
            summary=month_summary,
            month_label=month_label
        )
        period_str = month_label

    # Send SMTP Email
    success, error = send_raw_smtp_email(
        settings_obj=settings_obj,
        to_email=student.email.strip(),
        subject=subject,
        html_content=html_body,
        attachments=attachments
    )

    # Log in DB
    try:
        log = EmailLog(
            student_id=student.id,
            recipient_name=student.full_name,
            recipient_email=student.email.strip(),
            subject=subject,
            report_type=report_type,
            period_label=period_str,
            status="SUCCESS" if success else "FAILED",
            error_message=error,
            has_attachment=len(attachments) > 0,
            sent_at=datetime.utcnow()
        )
        db.add(log)
        db.commit()
    except Exception as e:
        print(f"[EmailService] Failed to save EmailLog: {e}")

    return success, error
