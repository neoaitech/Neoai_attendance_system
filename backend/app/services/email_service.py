import os
import re
import smtplib
import ssl
import calendar
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.utils import formataddr, formatdate, make_msgid
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
            smtp_from_name="Neo AI Attendance Portal",
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
        sender_display = settings_obj.smtp_from_name or "Neo AI Attendance Portal"

        msg = MIMEMultipart("mixed")
        msg["From"] = formataddr((sender_display, from_email))
        msg["To"] = to_email
        msg["Subject"] = subject
        msg["Date"] = formatdate(localtime=True)
        domain = from_email.split("@")[-1] if "@" in from_email else "gmail.com"
        msg["Message-ID"] = make_msgid(domain=domain)
        msg["Reply-To"] = from_email
        msg["X-Mailer"] = "Neo AI Attendance Portal Mailer"
        msg["Auto-Submitted"] = "auto-generated"
        msg["X-Auto-Response-Suppress"] = "All"

        # Body: multipart/alternative (Plain-text fallback + HTML)
        body_part = MIMEMultipart("alternative")
        
        # Strip HTML to produce clean plain-text fallback (crucial for spam filter pass)
        plain_text = re.sub(r'<style.*?</style>', '', html_content, flags=re.DOTALL)
        plain_text = re.sub(r'<[^>]+>', ' ', plain_text)
        plain_text = re.sub(r'[ \t]+', ' ', plain_text)
        plain_text = re.sub(r'\n\s*\n', '\n\n', plain_text).strip()

        text_part = MIMEText(plain_text, "plain", "utf-8")
        body_part.attach(text_part)

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
                                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #c7d2fe; margin-bottom: 6px;">Neo AI Attendance Portal &bull; Monthly Attendance Report</div>
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
                                    This is an automated institutional notification generated by Neo AI Attendance Portal. For any discrepancies or medical leave exemption submissions, please contact your academic administrator.
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
                                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #ddd6fe; margin-bottom: 6px;">Neo AI Attendance Portal &bull; 3-Month Cumulative Dossier</div>
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
                                    This is an official institutional document generated by Neo AI Attendance Portal. Please review your cumulative standing.
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


# =========================================================================
# Faculty & Academic Operational Email Builders & Background Dispatchers
# =========================================================================

PORTAL_BASE_URL = os.getenv("PORTAL_URL", "http://40.80.87.73:8000")


def build_faculty_welcome_email(
    faculty_name: str,
    username: str,
    password: str,
    role_display: str,
    email: str,
    login_url: Optional[str] = None
) -> tuple[str, str]:
    """
    Builds a high-fidelity, responsive HTML welcome email for newly created faculty/admin accounts
    containing their User ID, Initial Password, Role, and Portal Login Link.
    """
    portal_link = login_url or PORTAL_BASE_URL
    subject = f"Neo AI Attendance Portal - Faculty Account Access Details for {faculty_name}"

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- Gradient Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3730a3 0%, #4f46e5 100%); padding: 36px 30px; text-align: center;">
              <div style="display: inline-block; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 999px; padding: 4px 14px; margin-bottom: 12px;">
                <span style="color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Neo AI Attendance Portal</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">Welcome to the Academic Portal</h1>
              <p style="color: #c7d2fe; margin: 8px 0 0; font-size: 13px;">Your official institutional login credentials have been provisioned.</p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px 30px;">
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #334155;">
                Dear <strong>{faculty_name}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #475569;">
                An institutional faculty account has been established for you on the <strong>Neo AI Attendance Portal</strong>. Below are your official system credentials to access your teaching dashboard and academic services.
              </p>

              <!-- Credentials Card -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="background: #eef2ff; padding: 12px 20px; border-bottom: 1px solid #e0e7ff;">
                    <span style="font-size: 12px; font-weight: 700; color: #3730a3; text-transform: uppercase; letter-spacing: 0.05em;">🔐 Official Account Credentials</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #64748b; width: 140px;">Institutional Role:</td>
                        <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: #4338ca;">
                          <span style="background: rgba(99,102,241,0.1); padding: 3px 10px; border-radius: 999px; border: 1px solid rgba(99,102,241,0.25);">{role_display}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 13px; color: #64748b;">User ID / Login ID:</td>
                        <td style="padding: 8px 0;">
                          <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 14px; font-weight: 700; color: #1e1b4b; background: #e0e7ff; padding: 4px 10px; border-radius: 6px; border: 1px solid #c7d2fe;">{username}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 13px; color: #64748b;">Temporary Password:</td>
                        <td style="padding: 8px 0;">
                          <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 14px; font-weight: 700; color: #065f46; background: #d1fae5; padding: 4px 10px; border-radius: 6px; border: 1px solid #a7f3d0;">{password}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Registered Email:</td>
                        <td style="padding: 6px 0; font-size: 13px; color: #0f172a; font-weight: 600;">{email}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Call To Action Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="{portal_link}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 700; letter-spacing: 0.02em; box-shadow: 0 4px 12px rgba(79,70,229,0.3);">
                      Sign In with Temporary Password &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #92400e;">
                  <strong>🛡️ First-Time Login Notice:</strong> The credential above is an initial temporary password. When you sign in to the portal for the first time, you will be prompted to set your personal permanent password.
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                If you encounter any issues logging in or require technical support, please contact the University System Administrator or IT Support Desk.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 30px; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 12px; font-weight: 600; color: #64748b;">Neo AI Attendance Portal &bull; AI Classroom Attendance & Analytics Platform</p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">This is an automated institutional service email dispatched by university administration. Please do not reply directly to this email address.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    return subject, html


def build_faculty_password_reset_email(
    faculty_name: str,
    username: str,
    new_password: str,
    actor_name: str,
    login_url: Optional[str] = None
) -> tuple[str, str]:
    """
    Builds a secure HTML notification email informing faculty that their login credentials/password have been updated.
    """
    portal_link = login_url or PORTAL_BASE_URL
    subject = f"Neo AI Attendance Portal - Account Security & Password Updated"
    from backend.app.core.datetime_utils import format_ist_datetime, get_utc_now
    timestamp_ist = format_ist_datetime(get_utc_now())

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- Gradient Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px 30px; text-align: center;">
              <div style="display: inline-block; background: rgba(245,158,11,0.2); border: 1px solid rgba(245,158,11,0.4); border-radius: 999px; padding: 4px 14px; margin-bottom: 10px;">
                <span style="color: #fcd34d; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Security Alert &bull; Credentials Update</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">Password Reset Notice</h1>
              <p style="color: #94a3b8; margin: 6px 0 0; font-size: 12px;">Your institutional account password was recently updated.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 14px; font-size: 15px; color: #334155;">
                Dear <strong>{faculty_name}</strong>,
              </p>
              <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.6; color: #475569;">
                This notice confirms that your login password for the Neo AI Attendance Portal was updated on <strong>{timestamp_ist}</strong> by <strong>{actor_name}</strong>.
              </p>

              <!-- Credentials Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; margin-bottom: 22px;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #64748b; width: 140px;">Login ID / Username:</td>
                        <td style="padding: 6px 0;">
                          <span style="font-family: monospace; font-size: 14px; font-weight: 700; color: #3730a3; background: #e0e7ff; padding: 3px 8px; border-radius: 5px;">{username}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">New Password:</td>
                        <td style="padding: 6px 0;">
                          <span style="font-family: monospace; font-size: 14px; font-weight: 700; color: #065f46; background: #d1fae5; padding: 3px 8px; border-radius: 5px;">{new_password}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 22px;">
                <tr>
                  <td align="center">
                    <a href="{portal_link}" target="_blank" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 700;">
                      Sign In with New Password &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #991b1b;">
                  <strong>⚠️ Unauthorized Activity:</strong> If you did not request or expect this change, please report this immediately to your university IT administrator.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 30px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">Neo AI Attendance Portal &bull; Institutional Security Center</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    return subject, html


def build_course_allocation_email(
    faculty_name: str,
    course_code: str,
    course_name: str,
    department: str,
    program: str,
    semester: str,
    divisions: List[str],
    role: str = "Primary Faculty",
    academic_year: str = "2026-27",
    assigned_by: str = "Administrator",
    login_url: Optional[str] = None
) -> tuple[str, str]:
    """
    Builds a comprehensive HTML email detailing a new course/subject allocation to a faculty member.
    """
    portal_link = login_url or PORTAL_BASE_URL
    div_str = ", ".join(sorted(divisions)) if divisions else "A"
    subject = f"Neo AI Attendance Portal - Teaching Schedule: {course_code} ({course_name})"

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 34px 30px; text-align: center;">
              <div style="display: inline-block; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 999px; padding: 4px 14px; margin-bottom: 10px;">
                <span style="color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Neo AI Attendance Portal &bull; Academic Allocation</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 23px; font-weight: 800; letter-spacing: -0.02em;">New Course Teaching Allocation</h1>
              <p style="color: #a7f3d0; margin: 6px 0 0; font-size: 13px;">Official subject & division assignment confirmation.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 14px; font-size: 15px; color: #334155;">
                Dear <strong>{faculty_name}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #475569;">
                You have been assigned to teach the following academic course offering by <strong>{assigned_by}</strong>. You can now conduct AI face biometric attendance sessions and manage student rosters for this course.
              </p>

              <!-- Course Metadata Table -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td colspan="2" style="background: #f1f5f9; padding: 12px 18px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.05em;">📖 Course Offering Details</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 18px; font-size: 13px; color: #64748b; width: 150px; border-bottom: 1px solid #f1f5f9;">Course Name:</td>
                  <td style="padding: 10px 18px; font-size: 14px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">{course_name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 18px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Course Code:</td>
                  <td style="padding: 10px 18px; font-size: 13px; font-family: monospace; font-weight: 700; color: #4338ca; border-bottom: 1px solid #f1f5f9;">{course_code}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 18px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Department:</td>
                  <td style="padding: 10px 18px; font-size: 13px; color: #334155; font-weight: 600; border-bottom: 1px solid #f1f5f9;">{department}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 18px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Degree / Program:</td>
                  <td style="padding: 10px 18px; font-size: 13px; color: #334155; font-weight: 600; border-bottom: 1px solid #f1f5f9;">{program} &bull; {semester}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 18px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Division(s) Allocated:</td>
                  <td style="padding: 10px 18px; font-size: 13px; font-weight: 700; color: #047857; border-bottom: 1px solid #f1f5f9;">Division {div_str}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 18px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Assigned Role:</td>
                  <td style="padding: 10px 18px; font-size: 13px; font-weight: 700; color: #4338ca; border-bottom: 1px solid #f1f5f9;">
                    <span style="background: rgba(99,102,241,0.1); padding: 3px 10px; border-radius: 999px;">{role}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 18px; font-size: 13px; color: #64748b;">Academic Year:</td>
                  <td style="padding: 10px 18px; font-size: 13px; color: #334155; font-weight: 600;">{academic_year}</td>
                </tr>
              </table>

              <!-- Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <a href="{portal_link}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; padding: 13px 30px; border-radius: 8px; font-size: 14px; font-weight: 700; box-shadow: 0 4px 12px rgba(5,150,105,0.3);">
                      Open My Courses in Portal &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                You can now log in to the portal to view your enrolled student list, generate QR attendance sessions, or conduct automated live camera scans.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 30px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">Neo AI Attendance Portal &bull; Office of Academic Administration</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    return subject, html


def send_email_in_background(
    to_email: str,
    subject: str,
    html_content: str,
    recipient_name: str,
    report_type: str,
    student_id: Optional[int] = None
):
    """
    Dispatches an HTML email asynchronously in a background daemon thread with automatic EmailLog tracking.
    Never blocks or throws exceptions to the caller.
    """
    if not to_email or "@" not in to_email:
        return

    def _worker():
        from backend.app.db.session import SessionLocal
        db = SessionLocal()
        try:
            settings_obj = get_or_create_email_settings(db)
            if not settings_obj.is_email_enabled or not settings_obj.smtp_user or not settings_obj.smtp_password:
                log = EmailLog(
                    student_id=student_id,
                    recipient_name=recipient_name,
                    recipient_email=to_email.strip(),
                    subject=subject,
                    report_type=report_type,
                    period_label=datetime.utcnow().strftime("%B %Y"),
                    status="SKIPPED",
                    error_message="SMTP configuration is incomplete. Configure Host, User, and App Password in Admin Settings.",
                    has_attachment=False,
                    sent_at=datetime.utcnow()
                )
                db.add(log)
                db.commit()
                return

            success, error = send_raw_smtp_email(
                settings_obj=settings_obj,
                to_email=to_email.strip(),
                subject=subject,
                html_content=html_content
            )

            log = EmailLog(
                student_id=student_id,
                recipient_name=recipient_name,
                recipient_email=to_email.strip(),
                subject=subject,
                report_type=report_type,
                period_label=datetime.utcnow().strftime("%B %Y"),
                status="SUCCESS" if success else "FAILED",
                error_message=error,
                has_attachment=False,
                sent_at=datetime.utcnow()
            )
            db.add(log)
            db.commit()
        except Exception as e:
            print(f"[EmailService] Background email worker error: {e}")
        finally:
            db.close()

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def send_faculty_welcome_email_async(
    faculty_name: str,
    username: str,
    password: str,
    role_display: str,
    email: str,
    login_url: Optional[str] = None
):
    """Asynchronously dispatches the welcome email with credentials."""
    subject, html_body = build_faculty_welcome_email(
        faculty_name=faculty_name,
        username=username,
        password=password,
        role_display=role_display,
        email=email,
        login_url=login_url
    )
    send_email_in_background(
        to_email=email,
        subject=subject,
        html_content=html_body,
        recipient_name=faculty_name,
        report_type="FACULTY_WELCOME"
    )


def send_faculty_password_reset_email_async(
    faculty_name: str,
    username: str,
    new_password: str,
    actor_name: str,
    email: str,
    login_url: Optional[str] = None
):
    """Asynchronously dispatches the password reset notice email."""
    subject, html_body = build_faculty_password_reset_email(
        faculty_name=faculty_name,
        username=username,
        new_password=new_password,
        actor_name=actor_name,
        login_url=login_url
    )
    send_email_in_background(
        to_email=email,
        subject=subject,
        html_content=html_body,
        recipient_name=faculty_name,
        report_type="PASSWORD_RESET"
    )


def send_course_allocation_email_async(
    faculty_name: str,
    email: str,
    course_code: str,
    course_name: str,
    department: str,
    program: str,
    semester: str,
    divisions: List[str],
    role: str = "Primary Faculty",
    academic_year: str = "2026-27",
    assigned_by: str = "Administrator",
    login_url: Optional[str] = None
):
    """Asynchronously dispatches the course allocation email."""
    subject, html_body = build_course_allocation_email(
        faculty_name=faculty_name,
        course_code=course_code,
        course_name=course_name,
        department=department,
        program=program,
        semester=semester,
        divisions=divisions,
        role=role,
        academic_year=academic_year,
        assigned_by=assigned_by,
        login_url=login_url
    )
    send_email_in_background(
        to_email=email,
        subject=subject,
        html_content=html_body,
        recipient_name=faculty_name,
        report_type="COURSE_ALLOCATION"
    )


def build_faculty_permanent_password_confirmation_email(
    faculty_name: str,
    username: str,
    permanent_password: str,
    email: str,
    login_url: Optional[str] = None
) -> tuple[str, str]:
    """
    Builds a clean, responsive HTML email confirming that the faculty user has
    successfully established their permanent account password, providing their
    User ID and Permanent Password for future reference.
    """
    portal_link = login_url or PORTAL_BASE_URL
    subject = f"Neo AI Attendance Portal - Permanent Password Set Successfully for {faculty_name}"
    from backend.app.core.datetime_utils import format_ist_datetime, get_utc_now
    timestamp_ist = format_ist_datetime(get_utc_now())

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- Gradient Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 34px 30px; text-align: center;">
              <div style="display: inline-block; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 999px; padding: 4px 14px; margin-bottom: 10px;">
                <span style="color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Security Confirmation &bull; Account Activated</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 23px; font-weight: 800; letter-spacing: -0.02em;">Permanent Password Established</h1>
              <p style="color: #a7f3d0; margin: 6px 0 0; font-size: 13px;">Your personal login credentials are now active.</p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px 30px;">
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #334155;">
                Dear <strong>{faculty_name}</strong>,
              </p>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #475569;">
                You have successfully set your personal permanent password on <strong>{timestamp_ist}</strong>. Your institutional account is now fully confirmed. Please retain the permanent credentials below for all future sign-ins.
              </p>

              <!-- Credentials Card -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="background: #ecfdf5; padding: 12px 20px; border-bottom: 1px solid #d1fae5;">
                    <span style="font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.05em;">Your Permanent Login Credentials</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0; font-size: 13px; color: #64748b; width: 140px;">User ID / Login ID:</td>
                        <td style="padding: 8px 0;">
                          <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 14px; font-weight: 700; color: #1e1b4b; background: #e0e7ff; padding: 4px 10px; border-radius: 6px; border: 1px solid #c7d2fe;">{username}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 13px; color: #64748b;">Permanent Password:</td>
                        <td style="padding: 8px 0;">
                          <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 14px; font-weight: 700; color: #065f46; background: #d1fae5; padding: 4px 10px; border-radius: 6px; border: 1px solid #a7f3d0;">{permanent_password}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Registered Email:</td>
                        <td style="padding: 6px 0; font-size: 13px; color: #0f172a; font-weight: 600;">{email}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Account Status:</td>
                        <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: #059669;">Active & Confirmed</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Call To Action Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="{portal_link}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 700; letter-spacing: 0.02em; box-shadow: 0 4px 12px rgba(5,150,105,0.3);">
                      Access Teaching Workspace &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                You can now log in using your permanent password anytime to conduct classroom biometric scans and review student records.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 30px; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 12px; font-weight: 600; color: #64748b;">Neo AI Attendance Portal &bull; AI Classroom Attendance & Analytics Platform</p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">This is an automated institutional service email dispatched by university administration. Please do not reply directly to this email address.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    return subject, html


def send_faculty_permanent_password_email_async(
    faculty_name: str,
    username: str,
    permanent_password: str,
    email: str,
    login_url: Optional[str] = None
):
    """Asynchronously dispatches the permanent password confirmation email."""
    subject, html_body = build_faculty_permanent_password_confirmation_email(
        faculty_name=faculty_name,
        username=username,
        permanent_password=permanent_password,
        email=email,
        login_url=login_url
    )
    send_email_in_background(
        to_email=email,
        subject=subject,
        html_content=html_body,
        recipient_name=faculty_name,
        report_type="PERMANENT_PASSWORD"
    )

