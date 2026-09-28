import random
import string
import threading
from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.security import get_password_hash
from backend.app.db.models import User, Role, Student, EmailSetting, EmailLog
from backend.app.db.session import SessionLocal
from backend.app.services.email_service import send_raw_smtp_email, get_or_create_email_settings


def generate_secure_parent_password() -> str:
    """Generates a secure, memorable default password for new parent accounts."""
    return "Parent@123"


def build_parent_welcome_html(
    student: Student,
    parent_user: User,
    plain_password: str,
    portal_url: str
) -> str:
    """
    Constructs an enterprise-grade, mobile-responsive HTML welcome email
    for parents with student details, portal credentials, and PWA installation instructions.
    """
    student_name = student.full_name or "Your Ward"
    roll_number = student.roll_number or "N/A"
    program_sem = f"{student.program or 'Curriculum'} • {student.semester or 'Current Semester'}"
    dept = student.department or "Academic Department"
    div_sec = f"Division / Section {student.section}" if student.section else ""
    download_apk_url = portal_url.replace("/parent", "").rstrip("/") + "/api/parent/download-apk"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to NeoAI Parent Portal</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      color: #1e293b;
    }}
    .email-container {{
      max-width: 620px;
      margin: 24px auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
    }}
    .email-header {{
      background: radial-gradient(circle at 80% 20%, #1e1b4b 0%, #0f172a 80%);
      padding: 32px 32px 28px 32px;
      color: #ffffff;
      text-align: center;
    }}
    .brand-tag {{
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #34d399;
      margin-bottom: 8px;
    }}
    .header-title {{
      font-size: 24px;
      font-weight: 800;
      margin: 0 0 6px 0;
      letter-spacing: -0.02em;
    }}
    .header-subtitle {{
      font-size: 14px;
      color: #cbd5e1;
      margin: 0;
      font-weight: 400;
    }}
    .email-body {{
      padding: 32px;
    }}
    .greeting {{
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 12px;
    }}
    .intro-text {{
      font-size: 14px;
      color: #475569;
      line-height: 1.6;
      margin-bottom: 24px;
    }}
    .card-box {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }}
    .card-title {{
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #4f46e5;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 6px;
    }}
    .info-row {{
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      padding: 6px 0;
      border-bottom: 1px solid #edf2f7;
    }}
    .info-row:last-child {{
      border-bottom: none;
    }}
    .info-label {{
      color: #64748b;
      font-weight: 600;
    }}
    .info-value {{
      color: #0f172a;
      font-weight: 700;
      text-align: right;
    }}
    .credentials-box {{
      background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
      color: #ffffff;
      border-radius: 12px;
      padding: 22px;
      margin-bottom: 28px;
    }}
    .cred-title {{
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #a5b4fc;
      margin-bottom: 14px;
    }}
    .cred-row {{
      margin-bottom: 10px;
      font-size: 14px;
    }}
    .cred-key {{
      color: #94a3b8;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 2px;
    }}
    .cred-val {{
      font-family: 'Courier New', Courier, monospace;
      font-size: 15px;
      font-weight: 700;
      color: #38bdf8;
      background: rgba(255,255,255,0.08);
      padding: 6px 12px;
      border-radius: 6px;
      display: inline-block;
      margin-top: 2px;
    }}
    .cta-btn {{
      display: block;
      background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
      color: #ffffff !important;
      text-align: center;
      padding: 14px 28px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
      margin: 24px 0;
    }}
    .feature-list {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 24px;
    }}
    .feature-item {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 12px;
      border-radius: 8px;
      font-size: 12px;
      color: #334155;
      line-height: 1.4;
    }}
    .feature-icon {{
      font-size: 16px;
      margin-bottom: 4px;
      display: block;
    }}
    .pwa-tip {{
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 10px;
      padding: 14px;
      font-size: 12px;
      color: #065f46;
      line-height: 1.5;
    }}
    .email-footer {{
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 20px 32px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
    }}
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <div class="brand-tag">● NEOAI TECHNOLOGIES • PARENT PORTAL</div>
      <h1 class="header-title">VisionAttend for Parents</h1>
      <p class="header-subtitle">Real-Time Daily Classroom Attendance &amp; Academic Intelligence</p>
    </div>

    <div class="email-body">
      <div class="greeting">Dear {parent_user.full_name or 'Parent / Guardian'},</div>
      <p class="intro-text">
        Welcome to the <strong>NeoAI VisionAttend Parent Portal</strong>. Your ward <strong>{student_name}</strong> has been successfully registered in our autonomous biometric attendance system.
      </p>

      <!-- Student Card -->
      <div class="card-box">
        <div class="card-title">🎓 Student Academic Profile</div>
        <div class="info-row">
          <span class="info-label">Full Name:</span>
          <span class="info-value">{student_name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Roll Number:</span>
          <span class="info-value">{roll_number}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Curriculum:</span>
          <span class="info-value">{program_sem}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Department:</span>
          <span class="info-value">{dept}</span>
        </div>
        {f'<div class="info-row"><span class="info-label">Section:</span><span class="info-value">{div_sec}</span></div>' if div_sec else ''}
      </div>

      <!-- Credentials Box -->
      <div class="credentials-box">
        <div class="cred-title">🔐 Your Parent Portal Login Credentials</div>
        <div class="cred-row">
          <div class="cred-key">Portal Access URL:</div>
          <div style="font-size: 13px; color: #cbd5e1; word-break: break-all;">{portal_url}</div>
        </div>
        <div class="cred-row" style="margin-top: 10px;">
          <div class="cred-key">Login Email (Username):</div>
          <div class="cred-val">{parent_user.email}</div>
        </div>
        <div class="cred-row" style="margin-top: 10px;">
          <div class="cred-key">Secure Password:</div>
          <div class="cred-val">{plain_password}</div>
        </div>
      </div>

      <!-- Call to Action Buttons: Direct APK Download & Web App -->
      <div style="margin: 22px 0 24px;">
        <a href="{download_apk_url}" class="cta-btn" style="background: linear-gradient(135deg, #10b981, #059669); margin-bottom: 12px; display: block; text-decoration: none;" target="_blank">
          📥 Download Parent Android App (.APK) &rarr;
        </a>
        <a href="{portal_url}" class="cta-btn" style="background: linear-gradient(135deg, #4f46e5, #4338ca); display: block; text-decoration: none;" target="_blank">
          🌐 Open Mobile Portal &rarr;
        </a>
      </div>

      <!-- Key App Features -->
      <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 10px;">
        What you can track live in the Parent App:
      </div>
      <div class="feature-list">
        <div class="feature-item">
          <span class="feature-icon">📅</span>
          <strong>Today's Live Timeline:</strong> See lecture-by-lecture presence/absence updated live during class.
        </div>
        <div class="feature-item">
          <span class="feature-icon">📸</span>
          <strong>Live Photo Proof:</strong> View biometric verification snapshot captured during attendance.
        </div>
        <div class="feature-item">
          <span class="feature-icon">📊</span>
          <strong>Attendance Meter:</strong> Real-time overall percentage gauge to ensure ward stays above 75%.
        </div>
        <div class="feature-item">
          <span class="feature-icon">👶</span>
          <strong>Multi-Child Switcher:</strong> Switch between siblings in one single parent login.
        </div>
      </div>

      <!-- PWA Tip -->
      <div class="pwa-tip">
        <strong>📱 Mobile App Tip:</strong> When you open the portal link on your phone (Chrome / Safari), tap your browser menu and choose <strong>"Add to Home Screen"</strong> to use NeoAI Attend like a native mobile app!
      </div>
    </div>

    <div class="email-footer">
      This is an automated notification from NeoAI Technologies &amp; Institutional Biometric Administration.<br>
      For queries, please contact your university department or administration.
    </div>
  </div>
</body>
</html>"""


def build_parent_ward_linked_html(
    student: Student,
    parent_user: User,
    portal_url: str
) -> str:
    """
    Constructs an email notification when an existing parent account
    is linked to a newly registered child (multi-child support).
    """
    student_name = student.full_name or "Your Ward"
    roll_number = student.roll_number or "N/A"
    program_sem = f"{student.program or 'Curriculum'} • {student.semester or 'Current Semester'}"
    dept = student.department or "Academic Department"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Ward Linked to NeoAI Parent Portal</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0; padding: 0; background-color: #f1f5f9; color: #1e293b;
    }}
    .email-container {{
      max-width: 620px; margin: 24px auto; background: #ffffff; border-radius: 16px;
      overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;
    }}
    .email-header {{
      background: radial-gradient(circle at 80% 20%, #1e1b4b 0%, #0f172a 80%);
      padding: 30px; color: #ffffff; text-align: center;
    }}
    .brand-tag {{
      display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 0.12em;
      text-transform: uppercase; color: #34d399; margin-bottom: 8px;
    }}
    .email-body {{ padding: 32px; }}
    .card-box {{
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 18px; margin: 20px 0;
    }}
    .info-row {{
      display: flex; justify-content: space-between; font-size: 13px;
      padding: 6px 0; border-bottom: 1px solid #edf2f7;
    }}
    .info-row:last-child {{ border-bottom: none; }}
    .cta-btn {{
      display: block; background: #4f46e5; color: #ffffff !important;
      text-align: center; padding: 14px 28px; border-radius: 10px; font-size: 15px;
      font-weight: 700; text-decoration: none; margin: 24px 0;
    }}
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <div class="brand-tag">● NEOAI TECHNOLOGIES • PARENT PORTAL</div>
      <h2 style="margin: 0; font-size: 22px;">New Ward Added to Your Account</h2>
    </div>
    <div class="email-body">
      <p style="font-size: 15px; font-weight: 700;">Dear {parent_user.full_name or 'Parent / Guardian'},</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.6;">
        A new ward, <strong>{student_name}</strong>, has been registered in the institutional attendance system and automatically linked to your existing <strong>NeoAI Parent Portal</strong> account.
      </p>

      <div class="card-box">
        <div style="font-weight: 800; font-size: 13px; color: #4f46e5; margin-bottom: 10px;">🎓 Ward Details</div>
        <div class="info-row"><span style="color:#64748b;">Name:</span><strong>{student_name}</strong></div>
        <div class="info-row"><span style="color:#64748b;">Roll Number:</span><strong>{roll_number}</strong></div>
        <div class="info-row"><span style="color:#64748b;">Curriculum:</span><strong>{program_sem}</strong></div>
        <div class="info-row"><span style="color:#64748b;">Department:</span><strong>{dept}</strong></div>
      </div>

      <p style="font-size: 13px; color: #475569; line-height: 1.6;">
        You can log in using your <strong>existing parent email and password</strong> ({parent_user.email}). Inside the portal, use the <strong>Child Switcher</strong> at the top to toggle between your children effortlessly.
      </p>

      <a href="{portal_url}" class="cta-btn" target="_blank">
        Open Parent Portal &rarr;
      </a>
    </div>
  </div>
</body>
</html>"""


def _send_parent_email_worker(
    student_id: int,
    parent_user_id: int,
    plain_password: Optional[str],
    is_new: bool,
    portal_url: str
):
    """Background worker thread to dispatch parent onboarding / ward-linked emails asynchronously."""
    db = SessionLocal()
    try:
        student = db.query(Student).filter(Student.id == student_id).first()
        parent_user = db.query(User).filter(User.id == parent_user_id).first()
        if not student or not parent_user or not parent_user.email:
            return

        settings_obj = get_or_create_email_settings(db)

        if is_new and plain_password:
            subject = f"🎓 Welcome to NeoAI Parent Portal — Student Profile & Login Access for {student.full_name}"
            html_body = build_parent_welcome_html(student, parent_user, plain_password, portal_url)
            report_type = "PARENT_WELCOME"
        else:
            subject = f"🎓 New Ward Linked to your NeoAI Parent Portal — {student.full_name}"
            html_body = build_parent_ward_linked_html(student, parent_user, portal_url)
            report_type = "WARD_LINKED"

        success, err = send_raw_smtp_email(
            settings_obj=settings_obj,
            to_email=parent_user.email,
            subject=subject,
            html_content=html_body
        )

        log = EmailLog(
            student_id=student.id,
            recipient_name=parent_user.full_name or student.parent_name or "Parent / Guardian",
            recipient_email=parent_user.email,
            subject=subject,
            report_type=report_type,
            period_label="Onboarding",
            status="SENT" if success else "FAILED",
            error_message=err,
            has_attachment=False,
            sent_at=datetime.utcnow()
        )
        db.add(log)
        db.commit()
    except Exception as e:
        print(f"[ParentService] Background email worker exception: {e}")
    finally:
        db.close()


def link_or_create_parent_account(
    db: Session,
    student: Student,
    send_welcome_email: bool = True
) -> Tuple[Optional[User], bool, Optional[str]]:
    """
    Checks if parent_email is present on the student.
    - If user exists: links student.parent_user_id and sends ward-linked email.
    - If user does not exist: creates a new parent User with strong auto-generated password
      and sends full onboarding credentials email.
    Returns: (parent_user, is_new_account, plain_password)
    """
    if not student.parent_email or not student.parent_email.strip():
        return None, False, None

    parent_email = student.parent_email.strip().lower()
    parent_name = student.parent_name or f"Parent of {student.full_name}"
    portal_url = getattr(settings, "PARENT_PORTAL_URL", "https://attendance.neoaitech.com/parent")

    # 1. Check if user already exists
    parent_user = db.query(User).filter(
        (User.email == parent_email) | (User.username == parent_email)
    ).first()

    is_new = False
    plain_password = None

    if parent_user:
        # Existing parent account: link this student
        student.parent_user_id = parent_user.id
        if student.parent_name and not parent_user.full_name:
            parent_user.full_name = student.parent_name
        db.commit()
    else:
        # New parent account: create credentials
        is_new = True
        plain_password = generate_secure_parent_password()
        hashed = get_password_hash(plain_password)

        parent_role = db.query(Role).filter(Role.name == "parent").first()
        role_id = parent_role.id if parent_role else 4

        parent_user = User(
            username=parent_email,
            email=parent_email,
            full_name=parent_name,
            hashed_password=hashed,
            role="parent",
            role_id=role_id,
            department=student.department or "General",
            status="Active",
            is_active=True,
            must_change_password=False,
            created_at=datetime.utcnow()
        )
        db.add(parent_user)
        db.commit()
        db.refresh(parent_user)

        student.parent_user_id = parent_user.id
        db.commit()

    # 2. Trigger asynchronous background onboarding email
    if send_welcome_email and parent_user:
        thread = threading.Thread(
            target=_send_parent_email_worker,
            args=(student.id, parent_user.id, plain_password, is_new, portal_url),
            daemon=True
        )
        thread.start()

    return parent_user, is_new, plain_password
