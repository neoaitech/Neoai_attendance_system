import io
import time
import concurrent.futures
import pytest
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db.session import Base, engine, SessionLocal
from backend.app.db.models import User, Student, ClassCourse
from backend.app.core.security import get_password_hash, create_access_token

def _generate_synthetic_face_jpeg(color=(120, 140, 160)):
    arr = np.full((120, 120, 3), color, dtype=np.uint8)
    arr[30:50, 35:50] = (20, 20, 20)
    arr[30:50, 70:85] = (20, 20, 20)
    arr[75:85, 45:75] = (180, 50, 50)
    img = Image.fromarray(arr)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    buf.seek(0)
    return buf.getvalue()

@pytest.fixture(scope="module")
def setup_multi_device_env():
    db = SessionLocal()
    try:
        users_data = [
            ("dev_superadmin", "superadmin@univ.edu", "super_admin", "Super Admin Master"),
            ("dev_admin", "admin@univ.edu", "admin", "Academic Dean"),
            ("dev_faculty_a", "faculty_a@univ.edu", "teacher", "Prof. Alice Computer"),
            ("dev_faculty_b", "faculty_b@univ.edu", "teacher", "Prof. Bob Networks"),
        ]
        created_users = {}
        for username, email, role, full_name in users_data:
            u = db.query(User).filter(User.username == username).first()
            if not u:
                u = User(
                    username=username,
                    email=email,
                    hashed_password=get_password_hash("pass123"),
                    full_name=full_name,
                    role=role,
                    is_active=True
                )
                db.add(u)
                db.commit()
                db.refresh(u)
            created_users[username] = u

        c_ai = db.query(ClassCourse).filter(ClassCourse.code == "DEV-CS-101").first()
        if not c_ai:
            c_ai = ClassCourse(
                name="Cloud Computing & AI",
                code="DEV-CS-101",
                department="Computer Science",
                section="A",
                semester="Semester 5",
                teacher_id=created_users["dev_faculty_a"].id
            )
            db.add(c_ai)

        c_net = db.query(ClassCourse).filter(ClassCourse.code == "DEV-CS-102").first()
        if not c_net:
            c_net = ClassCourse(
                name="Cybersecurity & Protocols",
                code="DEV-CS-102",
                department="Computer Science",
                section="B",
                semester="Semester 5",
                teacher_id=created_users["dev_faculty_b"].id
            )
            db.add(c_net)
        db.commit()

        s1 = db.query(Student).filter(Student.roll_number == "DEV-STU-01").first()
        if not s1:
            s1 = Student(
                full_name="Alex Mercer",
                roll_number="DEV-STU-01",
                email="alex@univ.edu",
                department="Computer Science",
                program="B.Tech",
                semester="Semester 5",
                section="A"
            )
            db.add(s1)
        db.commit()

        yield {
            "users": created_users,
            "course_a": c_ai,
            "course_b": c_net
        }
    finally:
        db.close()

def test_multi_device_simultaneous_requests(setup_multi_device_env):
    env = setup_multi_device_env
    client = TestClient(app)

    token_super = create_access_token(subject="dev_superadmin", role="super_admin")
    token_admin = create_access_token(subject="dev_admin", role="admin")
    token_fac_a = create_access_token(subject="dev_faculty_a", role="teacher")
    token_fac_b = create_access_token(subject="dev_faculty_b", role="teacher")

    def device_1_admin_laptop():
        headers = {
            "Authorization": f"Bearer {token_super}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0",
            "X-Forwarded-For": "192.168.1.10"
        }
        res_health = client.get("/api/admin/health", headers=headers)
        res_arch = client.get("/api/admin/system-settings/face-ai-architecture", headers=headers)
        res_logs = client.get("/api/admin/audit-logs", headers=headers)
        res_auth = client.get("/api/authority/my-authority", headers=headers)
        return {
            "device": "Admin Laptop",
            "health_status": res_health.status_code,
            "arch_status": res_arch.status_code,
            "logs_status": res_logs.status_code,
            "auth_status": res_auth.status_code
        }

    def device_2_faculty_mobile():
        headers = {
            "Authorization": f"Bearer {token_fac_a}",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X)",
            "X-Forwarded-For": "192.168.1.45"
        }
        res_meta = client.get("/api/academic/metadata", headers=headers)
        res_courses = client.get("/api/classes", headers=headers)
        photo1 = _generate_synthetic_face_jpeg((100, 120, 140))
        photo2 = _generate_synthetic_face_jpeg((110, 130, 150))
        files = [
            ("photos", ("cam_angle1.jpg", io.BytesIO(photo1), "image/jpeg")),
            ("photos", ("cam_angle2.jpg", io.BytesIO(photo2), "image/jpeg")),
        ]
        data = {
            "class_id": str(env["course_a"].id),
            "session_name": "Cloud AI - Parallel Mobile Lecture",
            "department": "Computer Science",
            "program": "B.Tech",
            "semester": "Semester 5",
            "section": "A"
        }
        res_session = client.post("/api/sessions/create-and-process", headers=headers, data=data, files=files)
        return {
            "device": "Faculty Mobile Phone",
            "meta_status": res_meta.status_code,
            "courses_status": res_courses.status_code,
            "session_status": res_session.status_code,
            "session_id": res_session.json().get("id") if res_session.status_code in [200, 201] else None
        }

    def device_3_faculty_tablet():
        headers = {
            "Authorization": f"Bearer {token_fac_b}",
            "User-Agent": "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)",
            "X-Forwarded-For": "192.168.1.82"
        }
        res_meta = client.get("/api/academic/metadata", headers=headers)
        p1 = _generate_synthetic_face_jpeg((120, 100, 140))
        p2 = _generate_synthetic_face_jpeg((130, 110, 150))
        p3 = _generate_synthetic_face_jpeg((140, 120, 160))
        files = [
            ("photos", ("tab_angle1.jpg", io.BytesIO(p1), "image/jpeg")),
            ("photos", ("tab_angle2.jpg", io.BytesIO(p2), "image/jpeg")),
            ("photos", ("tab_angle3.jpg", io.BytesIO(p3), "image/jpeg")),
        ]
        data = {
            "class_id": str(env["course_b"].id),
            "session_name": "Cybersecurity - Tablet Concurrent Session",
            "department": "Computer Science",
            "program": "B.Tech",
            "semester": "Semester 5",
            "section": "B"
        }
        res_session = client.post("/api/sessions/create-and-process", headers=headers, data=data, files=files)
        return {
            "device": "Faculty Tablet",
            "meta_status": res_meta.status_code,
            "session_status": res_session.status_code,
            "session_id": res_session.json().get("id") if res_session.status_code in [200, 201] else None
        }

    def device_4_hod_reports():
        headers = {
            "Authorization": f"Bearer {token_admin}",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "X-Forwarded-For": "192.168.1.99"
        }
        res_overview = client.get("/api/analytics/dashboard", headers=headers)
        res_perf = client.get("/api/analytics/model-performance", headers=headers)
        res_defaulters = client.get("/api/reports/defaulters?threshold=75", headers=headers)
        res_report = client.get(f"/api/reports/class/{env['course_a'].id}", headers=headers)
        return {
            "device": "HOD Workstation",
            "overview_status": res_overview.status_code,
            "perf_status": res_perf.status_code,
            "defaulters_status": res_defaulters.status_code,
            "report_status": res_report.status_code
        }

    start_time = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        f1 = executor.submit(device_1_admin_laptop)
        f2 = executor.submit(device_2_faculty_mobile)
        f3 = executor.submit(device_3_faculty_tablet)
        f4 = executor.submit(device_4_hod_reports)

        r1 = f1.result()
        r2 = f2.result()
        r3 = f3.result()
        r4 = f4.result()

    elapsed = time.time() - start_time

    assert r1["health_status"] == 200
    assert r1["arch_status"] == 200
    assert r1["logs_status"] == 200
    assert r1["auth_status"] == 200

    assert r2["meta_status"] == 200
    assert r2["courses_status"] == 200
    assert r2["session_status"] == 200
    assert r2["session_id"] is not None

    assert r3["meta_status"] == 200
    assert r3["session_status"] == 200
    assert r3["session_id"] is not None
    assert r3["session_id"] != r2["session_id"]

    assert r4["overview_status"] == 200
    assert r4["perf_status"] == 200
    assert r4["defaulters_status"] == 200
    assert r4["report_status"] == 200

    print(f"[Multi-Device Concurrency Test Passed] 4 devices concurrently served in {elapsed:.2f}s with zero DB locks!")
