import pytest
from unittest.mock import patch, MagicMock
from backend.app.db.models import Student, EmailSetting, EmailLog
from backend.app.services.email_service import (
    build_monthly_html_body,
    build_quarterly_html_body,
    send_single_student_report
)


def test_email_settings_endpoints(client, admin_user, admin_token):
    # 1. Get settings
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/email-reports/settings", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "smtp_host" in data
    assert "smtp_port" in data

    # 2. Update settings
    payload = {
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "smtp_user": "test.attendance@college.edu",
        "smtp_password": "testapppassword123",
        "smtp_from_name": "Test College Attendance Portal",
        "smtp_use_tls": True,
        "smtp_use_ssl": False,
        "is_email_enabled": True,
        "auto_monthly_dispatch": True,
        "monthly_dispatch_day": 30,
        "monthly_dispatch_hour": 18
    }
    res = client.put("/api/email-reports/settings", json=payload, headers=headers)
    assert res.status_code == 200
    updated = res.json()["settings"]
    assert updated["smtp_user"] == "test.attendance@college.edu"
    assert updated["has_password"] is True
    assert updated["auto_monthly_dispatch"] is True


def test_html_body_generators():
    # Test monthly HTML generation
    mock_summary = {
        "overall_stats": {
            "attendance_percentage": 85.5,
            "total_conducted": 40,
            "total_attended": 34,
            "total_absent": 6,
            "total_frozen": 2
        },
        "subject_breakdown": [
            {
                "course_name": "Data Structures",
                "course_code": "CS301",
                "conducted": 20,
                "attended": 18,
                "absent": 2,
                "frozen": 0,
                "attendance_percentage": 90.0
            }
        ]
    }

    html = build_monthly_html_body(
        student_name="Rahul Sharma",
        roll_number="BCA2301",
        program="BCA",
        division="A",
        summary=mock_summary,
        month_label="August 2026"
    )
    assert "Rahul Sharma" in html
    assert "BCA2301" in html
    assert "85.5%" in html
    assert "GOOD STANDING" in html
    assert "Data Structures" in html

    # Test quarterly HTML generation
    mock_quarterly = {
        "overall_stats": {
            "attendance_percentage": 78.0,
            "total_conducted": 120,
            "total_attended": 94,
            "total_absent": 26,
            "total_frozen": 4
        },
        "months": [
            {"month_name": "June", "percentage": 82.0, "attended": 33, "conducted": 40},
            {"month_name": "July", "percentage": 75.0, "attended": 30, "conducted": 40},
            {"month_name": "August", "percentage": 77.5, "attended": 31, "conducted": 40}
        ]
    }

    q_html = build_quarterly_html_body(
        student_name="Rahul Sharma",
        roll_number="BCA2301",
        program="BCA",
        division="A",
        quarterly_summary=mock_quarterly,
        quarter_label="June-August 2026 (3-Month Consolidated)"
    )
    assert "Rahul Sharma" in q_html
    assert "3-Month Aggregate" in q_html
    assert "June" in q_html
    assert "July" in q_html
    assert "August" in q_html


@patch("backend.app.services.email_service.send_raw_smtp_email")
def test_bulk_dispatch_and_status(mock_send, client, admin_user, admin_token, db_session):
    mock_send.return_value = (True, None)

    # Ensure at least one active student with email
    st = db_session.query(Student).first()
    if not st:
        st = Student(
            full_name="Test Student",
            roll_number="TST001",
            department="Computer",
            email="student.test@college.edu",
            is_active=True
        )
        db_session.add(st)
        db_session.commit()
    else:
        st.email = "student.test@college.edu"
        db_session.commit()

    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "year": 2026,
        "month": 8,
        "report_type": "MONTHLY"
    }

    res = client.post("/api/email-reports/dispatch-bulk", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "job_id" in data
    job_id = data["job_id"]

    # Poll status
    status_res = client.get(f"/api/email-reports/dispatch-status/{job_id}", headers=headers)
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["job_id"] == job_id


def test_email_logs_endpoint(client, admin_user, admin_token, db_session):
    # Insert a dummy log
    log = EmailLog(
        recipient_name="Test Student",
        recipient_email="student@college.edu",
        subject="Monthly Report",
        report_type="MONTHLY",
        period_label="August 2026",
        status="SUCCESS",
        has_attachment=True
    )
    db_session.add(log)
    db_session.commit()

    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/email-reports/logs?limit=10", headers=headers)
    assert res.status_code == 200
    logs = res.json()
    assert len(logs) > 0
    assert logs[0]["recipient_email"] == "student@college.edu"
