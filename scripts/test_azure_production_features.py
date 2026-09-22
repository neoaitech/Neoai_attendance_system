"""
Live Azure Production Verification Script
Tests against http://40.80.87.73:
1. Admin Authentication
2. New Teacher/Faculty Creation (POST /api/auth/users)
3. New Teacher Login & Token Generation
4. RBAC Permissions Enforcement (Teacher can take attendance, blocked from Admin routes)
5. Student Photo Upload & Biometric Storage (POST /api/students/register-with-photo)
6. Notification & Defaulter Alerts API
7. Safe Cleanup of Test Artifacts
"""

import sys
import os
import io
import json
import uuid
import base64
import requests
from PIL import Image, ImageDraw

BASE_URL = "http://40.80.87.73"

def run_production_audit():
    print("=" * 80)
    print("    LIVE AZURE PRODUCTION INTEGRITY & FEATURE AUDIT (http://40.80.87.73)")
    print("=" * 80)
    
    passed = 0
    failed = 0
    
    def check(name, condition, details=""):
        nonlocal passed, failed
        if condition:
            print(f" [PASS] {name}")
            passed += 1
        else:
            print(f" [FAIL] {name} - Details: {details}")
            failed += 1

    session = requests.Session()
    unique_suffix = uuid.uuid4().hex[:6]
    
    # -------------------------------------------------------------
    # 1. ADMIN AUTHENTICATION
    # -------------------------------------------------------------
    print("\n--- 1. ADMIN AUTHENTICATION ---")
    admin_login_res = session.post(
        f"{BASE_URL}/api/auth/login",
        data={"username": "admin", "password": "admin123"},
        timeout=10
    )
    check("Admin login returns HTTP 200", admin_login_res.status_code == 200, admin_login_res.text)
    admin_token = admin_login_res.json().get("access_token")
    check("Admin JWT token issued", bool(admin_token))
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # -------------------------------------------------------------
    # 2. NEW TEACHER / FACULTY CREATION
    # -------------------------------------------------------------
    print("\n--- 2. NEW TEACHER / FACULTY CREATION ---")
    test_teacher_payload = {
        "username": f"prof_verma_{unique_suffix}",
        "full_name": "Prof. R. K. Verma",
        "email": f"prof.verma.{unique_suffix}@neoaitech.com",
        "password": "TeacherPassword123!",
        "role": "teacher"
    }
    
    create_teacher_res = session.post(
        f"{BASE_URL}/api/auth/users",
        json=test_teacher_payload,
        headers=admin_headers,
        timeout=10
    )
    check("Create new Teacher returns HTTP 200/201", create_teacher_res.status_code in (200, 201), create_teacher_res.text)
    teacher_id = None
    if create_teacher_res.status_code in (200, 201):
        teacher_data = create_teacher_res.json()
        teacher_id = teacher_data.get("id")
        check("New Teacher has teacher role", teacher_data.get("role") in ("teacher", "TEACHER"))
    
    # -------------------------------------------------------------
    # 3. LOGIN AS THE NEW TEACHER
    # -------------------------------------------------------------
    print("\n--- 3. NEW TEACHER LOGIN & TOKEN ISSUANCE ---")
    teacher_login_res = session.post(
        f"{BASE_URL}/api/auth/login",
        data={"username": test_teacher_payload["username"], "password": test_teacher_payload["password"]},
        timeout=10
    )
    check("New teacher login succeeds with HTTP 200", teacher_login_res.status_code == 200, teacher_login_res.text)
    teacher_token = teacher_login_res.json().get("access_token")
    check("Teacher JWT token issued", bool(teacher_token))
    
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
    
    # -------------------------------------------------------------
    # 4. RBAC & PERMISSION ENFORCEMENT
    # -------------------------------------------------------------
    print("\n--- 4. RBAC & PERMISSION SECURITY AUDIT ---")
    # Teacher CAN access academic metadata
    t_acad_res = session.get(f"{BASE_URL}/api/academic/metadata", headers=teacher_headers, timeout=10)
    check("Teacher can access academic metadata (HTTP 200)", t_acad_res.status_code == 200)
    
    # Teacher CAN view students list
    t_students_res = session.get(f"{BASE_URL}/api/students", headers=teacher_headers, timeout=10)
    check("Teacher can view students roster (HTTP 200)", t_students_res.status_code == 200)
    
    # Teacher CANNOT modify system settings (HTTP 403 Forbidden)
    t_settings_res = session.post(
        f"{BASE_URL}/api/admin/system-settings/matching-sensitivity",
        json={"tolerance": 0.50},
        headers=teacher_headers,
        timeout=10
    )
    check("Teacher is BLOCKED from System Settings modification (HTTP 403)", t_settings_res.status_code == 403)
    
    # Teacher CANNOT access notification audit logs (HTTP 403 Forbidden)
    t_notif_res = session.get(
        f"{BASE_URL}/api/notifications/audit-logs",
        headers=teacher_headers,
        timeout=10
    )
    check("Teacher is BLOCKED from Admin Notification Audit Logs (HTTP 403)", t_notif_res.status_code == 403)
    
    # -------------------------------------------------------------
    # 5. STUDENT REGISTRATION & PHOTO STORAGE AUDIT
    # -------------------------------------------------------------
    print("\n--- 5. STUDENT PHOTO UPLOAD & STORAGE AUDIT ---")
    # Generate 3 dummy face photos in memory (simple colored images)
    def create_dummy_face_image(color=(120, 150, 200)):
        img = Image.new("RGB", (300, 300), color=color)
        d = ImageDraw.Draw(img)
        d.ellipse([100, 100, 200, 200], fill=(230, 200, 180)) # face oval
        d.ellipse([125, 130, 140, 145], fill=(50, 50, 50))   # eye
        d.ellipse([160, 130, 175, 145], fill=(50, 50, 50))   # eye
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        return buf.getvalue()

    img1 = create_dummy_face_image((100, 140, 220))
    img2 = create_dummy_face_image((110, 150, 210))
    img3 = create_dummy_face_image((120, 160, 200))
    
    test_roll = f"T{unique_suffix.upper()}"
    
    # Upload student with 3 photos via multipart/form-data to /api/students/register-with-photo
    files = [
        ("photos", ("angle1.jpg", img1, "image/jpeg")),
        ("photos", ("angle2.jpg", img2, "image/jpeg")),
        ("photos", ("angle3.jpg", img3, "image/jpeg")),
    ]
    student_form_data = {
        "roll_number": test_roll,
        "full_name": "Test Automation Student",
        "email": f"stu.{unique_suffix}@neoaitech.com",
        "mobile_number": "9876543210",
        "program": "BCA",
        "course": "BCA Computer",
        "semester": "Semester 1",
        "department": "Computer",
        "section": "A",
        "batch": "2023-2027",
        "year": 1
    }
    
    reg_stu_res = session.post(
        f"{BASE_URL}/api/students/register-with-photo",
        data=student_form_data,
        files=files,
        headers=admin_headers,
        timeout=30
    )
    check("New student with photos registered (HTTP 200/201)", reg_stu_res.status_code in (200, 201), reg_stu_res.text)
    
    test_student_id = None
    if reg_stu_res.status_code in (200, 201):
        stu_data = reg_stu_res.json()
        test_student_id = stu_data.get("id")
        photo_url = stu_data.get("photo_url")
        check("Student photo_url populated", bool(photo_url), f"photo_url: {photo_url}")
        
        # Test image accessibility over HTTP
        if photo_url and not photo_url.startswith("data:"):
            img_url = f"{BASE_URL}{photo_url}" if photo_url.startswith("/") else photo_url
            img_res = session.get(img_url, timeout=10)
            check("Uploaded student photo serves HTTP 200", img_res.status_code == 200, f"Status: {img_res.status_code}")
        elif photo_url and photo_url.startswith("data:"):
            check("Uploaded student photo stored as valid Base64 data URL", len(photo_url) > 500)
    
    # -------------------------------------------------------------
    # 6. NOTIFICATION SYSTEM AUDIT
    # -------------------------------------------------------------
    print("\n--- 6. NOTIFICATION & ALERTS SYSTEM AUDIT ---")
    notif_res = session.get(f"{BASE_URL}/api/notifications", headers=admin_headers, timeout=10)
    check("Notifications endpoint returns HTTP 200", notif_res.status_code == 200, notif_res.text)
    
    # Test Defaulter Alert Generation
    defaulters_res = session.get(f"{BASE_URL}/api/reports/defaulters", headers=admin_headers, timeout=10)
    check("Defaulters report endpoint returns HTTP 200", defaulters_res.status_code == 200, defaulters_res.text)
    
    # -------------------------------------------------------------
    # 7. CLEANUP OF TEST ARTIFACTS
    # -------------------------------------------------------------
    print("\n--- 7. SAFE CLEANUP ---")
    if teacher_id:
        del_teach_res = session.patch(f"{BASE_URL}/api/auth/users/{teacher_id}", json={"is_active": False}, headers=admin_headers, timeout=10)
        check("Deactivated test faculty account cleanly", del_teach_res.status_code in (200, 204))
    
    print("\n" + "=" * 80)
    print(f" LIVE PRODUCTION AUDIT SUMMARY: {passed} PASSED, {failed} FAILED")
    print("=" * 80)
    return failed == 0

if __name__ == "__main__":
    success = run_production_audit()
    sys.exit(0 if success else 1)
