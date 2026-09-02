import os
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import cv2
import json
import uuid
import numpy as np
from datetime import datetime, date, timedelta
from typing import Tuple, List, Dict, Optional
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.security import get_password_hash
from backend.app.db.session import engine, SessionLocal, Base
from backend.app.db.models import (
    User, ClassCourse, Student, AttendanceSession, AttendanceRecord, UnknownFace, AuditLog, Notification
)
from backend.app.services.face_engine import face_engine

def generate_student_portrait(name: str, roll_no: str, skin_bgr: tuple, hair_bgr: tuple, idx: int) -> Tuple[np.ndarray, str]:
    """
    Creates a clear, high-contrast student portrait with distinct facial features
    that trigger face detectors reliably.
    """
    img = np.ones((400, 400, 3), dtype=np.uint8) * 240

    # Face contour
    center = (200, 210)
    axes = (85, 115)
    cv2.ellipse(img, center, axes, 0, 0, 360, skin_bgr, -1)
    cv2.ellipse(img, center, axes, 0, 0, 360, (max(0, skin_bgr[0]-25), max(0, skin_bgr[1]-25), max(0, skin_bgr[2]-25)), 2)

    # Hair
    cv2.ellipse(img, (200, 145), (90, 68), 0, 180, 360, hair_bgr, -1)

    # Eyes & Eyeballs
    cv2.circle(img, (160, 195), 14, (255, 255, 255), -1)
    cv2.circle(img, (240, 195), 14, (255, 255, 255), -1)
    cv2.circle(img, (160, 195), 7, (30, 40, 50), -1)
    cv2.circle(img, (240, 195), 7, (30, 40, 50), -1)
    cv2.circle(img, (162, 193), 2, (255, 255, 255), -1)
    cv2.circle(img, (242, 193), 2, (255, 255, 255), -1)

    # Eyebrows
    cv2.line(img, (140, 172), (180, 172), hair_bgr, 5)
    cv2.line(img, (220, 172), (260, 172), hair_bgr, 5)

    # Nose
    cv2.line(img, (200, 190), (196, 235), (max(0, skin_bgr[0]-40), max(0, skin_bgr[1]-40), max(0, skin_bgr[2]-40)), 3)
    cv2.ellipse(img, (200, 238), (14, 6), 0, 0, 180, (max(0, skin_bgr[0]-40), max(0, skin_bgr[1]-40), max(0, skin_bgr[2]-40)), 2)

    # Mouth
    cv2.ellipse(img, (200, 268), (28, 12), 0, 0, 180, (70, 70, 170), -1)
    cv2.line(img, (172, 268), (228, 268), (50, 50, 120), 2)

    # Text Banner at bottom
    cv2.rectangle(img, (0, 360), (400, 400), (30, 41, 59), -1)
    cv2.putText(img, f"{name} ({roll_no})", (15, 385), cv2.FONT_HERSHEY_DUPLEX, 0.45, (255, 255, 255), 1)

    filename = f"portrait_{roll_no}.jpg"
    filepath = settings.STUDENT_PHOTOS_DIR / filename
    cv2.imwrite(str(filepath), img)
    return img, str(filepath)

def create_classroom_composite(portraits: list, output_filename: str = "classroom_sample_group_1.jpg") -> str:
    """
    Creates a composite classroom group photo containing multiple student portraits on a blackboard grid.
    """
    canvas = np.ones((700, 1000, 3), dtype=np.uint8) * 230

    # Header Blackboard
    cv2.rectangle(canvas, (40, 20), (960, 100), (25, 45, 30), -1)
    cv2.rectangle(canvas, (40, 20), (960, 100), (110, 75, 40), 4)
    cv2.putText(canvas, "CS-301: Computer Vision & AI - Classroom Attendance Session", (80, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (240, 240, 240), 2)

    # Desk Positions (2 rows of 4 students = 8 students)
    positions = [
        (60, 140), (290, 140), (520, 140), (750, 140),
        (60, 400), (290, 400), (520, 400), (750, 400),
    ]

    for idx, (x, y) in enumerate(positions):
        if idx < len(portraits):
            p_img = portraits[idx]
            p_resized = cv2.resize(p_img, (190, 210))
            canvas[y:y+210, x:x+190] = p_resized
            cv2.rectangle(canvas, (x, y), (x+190, y+210), (140, 140, 140), 2)

    filepath = settings.SESSION_PHOTOS_DIR / output_filename
    cv2.imwrite(str(filepath), canvas)
    return str(filepath)

def seed_database(force_reseed: bool = False):
    if force_reseed:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if not force_reseed and db.query(User).count() > 0:
            print("Database already initialized.")
            return

        print("--> Seeding Initial Database...")

        # 1. Create Default Users
        admin_user = User(
            username="admin",
            email="admin@visionattend.edu",
            hashed_password=get_password_hash("admin123"),
            full_name="Administrator",
            role="admin",
            is_active=True
        )
        teacher_user = User(
            username="dr_sharma",
            email="sharma@visionattend.edu",
            hashed_password=get_password_hash("teacher123"),
            full_name="Dr. Rajesh Sharma",
            role="teacher",
            is_active=True
        )
        db.add_all([admin_user, teacher_user])
        db.flush()

        # 2. Create Courses with Program Distinction
        course_cv = ClassCourse(
            code="CS-301",
            name="Computer Vision & Deep Learning",
            department="Computer Science",
            program="B.Tech",
            semester="Semester 5",
            section="A",
            teacher_id=teacher_user.id
        )
        course_ai = ClassCourse(
            code="AI-201",
            name="Applied Artificial Intelligence",
            department="AI & Data Science",
            program="B.Tech",
            semester="Semester 5",
            section="B",
            teacher_id=teacher_user.id
        )
        course_btech_mongo = ClassCourse(
            code="520",
            name="MONGODB",
            department="Computer Science",
            program="B.Tech",
            semester="Semester 7",
            section="A",
            teacher_id=teacher_user.id
        )
        course_mca_mongo = ClassCourse(
            code="520",
            name="MONGODB",
            department="Computer Science",
            program="MCA",
            semester="Semester 7",
            section="A",
            teacher_id=teacher_user.id
        )
        db.add_all([course_cv, course_ai, course_btech_mongo, course_mca_mongo])
        db.flush()

        # 3. Create Sample Students (6 B.Tech + 4 MCA = 10 students)
        student_configs = [
            # 6 B.Tech Students
            ("Aarav Patel", "CS2026-001", "aarav.p@univ.edu", "Computer Science", "B.Tech", "Semester 7", (180, 210, 235), (20, 20, 25)),
            ("Ananya Sharma", "CS2026-002", "ananya.s@univ.edu", "Computer Science", "B.Tech", "Semester 7", (190, 220, 240), (15, 15, 20)),
            ("Rohan Verma", "CS2026-003", "rohan.v@univ.edu", "Computer Science", "B.Tech", "Semester 7", (170, 200, 230), (30, 30, 35)),
            ("Sneha Kulkarni", "CS2026-004", "sneha.k@univ.edu", "Computer Science", "B.Tech", "Semester 7", (185, 215, 238), (25, 25, 30)),
            ("Vikram Malhotra", "CS2026-005", "vikram.m@univ.edu", "Computer Science", "B.Tech", "Semester 7", (165, 195, 225), (35, 35, 40)),
            ("Devansh Gupta", "CS2026-006", "devansh.g@univ.edu", "Computer Science", "B.Tech", "Semester 7", (175, 205, 232), (28, 28, 32)),
            # 4 MCA Students
            ("Prathviraj Chavan", "MCA2026-001", "prathviraj.c@univ.edu", "Computer Science", "MCA", "Semester 7", (195, 225, 245), (10, 10, 15)),
            ("Ishita Sen", "MCA2026-002", "ishita.s@univ.edu", "Computer Science", "MCA", "Semester 7", (188, 218, 240), (22, 22, 26)),
            ("Kavya Reddy", "MCA2026-003", "kavya.r@univ.edu", "Computer Science", "MCA", "Semester 7", (172, 202, 230), (18, 18, 22)),
            ("Tanmay Joshi", "MCA2026-004", "tanmay.j@univ.edu", "Computer Science", "MCA", "Semester 7", (168, 198, 228), (40, 40, 45)),
        ]

        btech_students = []
        mca_students = []
        students_list = []
        portraits = []

        for idx, (name, roll, email, dept, prog, sem, skin, hair) in enumerate(student_configs):
            img, filepath = generate_student_portrait(name, roll, skin, hair, idx)
            portraits.append(img)

            # Compute 512-D ArcFace embedding
            encoding = face_engine.extract_single_face_encoding(filepath)
            if not encoding:
                encoding = face_engine.compute_fallback_512d_descriptor(img[90:310, 110:290]).tolist()

            student = Student(
                roll_number=roll,
                full_name=name,
                email=email,
                program=prog,
                course=f"{prog} Computer Science",
                semester=sem,
                department=dept,
                year=3 if prog == "B.Tech" else 2,
                section="A",
                photo_url=f"/uploads/students/{os.path.basename(filepath)}",
                is_active=True
            )
            student.face_embedding = encoding
            students_list.append(student)
            if prog == "B.Tech":
                btech_students.append(student)
            else:
                mca_students.append(student)
            db.add(student)

        db.flush()

        # Enroll strictly in respective course offerings:
        # B.Tech MongoDB has 6 B.Tech students
        for s in btech_students:
            course_btech_mongo.students.append(s)
            course_cv.students.append(s)

        # MCA MongoDB has 4 MCA students
        for s in mca_students:
            course_mca_mongo.students.append(s)

        # Generate sample classroom group photo
        sample_photo_path = create_classroom_composite(portraits, "classroom_sample_group_1.jpg")

        # 4. Seed Past Attendance Sessions
        today = date.today()
        dates = [today - timedelta(days=i*2) for i in range(4, 0, -1)]

        for sess_idx, s_date in enumerate(dates, 1):
            sess = AttendanceSession(
                class_id=course_cv.id,
                teacher_id=teacher_user.id,
                session_name=f"Lecture {sess_idx}: Neural Architecture & Vision",
                session_date=s_date,
                start_time="09:00 AM",
                end_time="10:30 AM",
                raw_photo_path=sample_photo_path,
                processed_photo_path=sample_photo_path,
                total_detected=8,
                total_recognized=7,
                total_unknown=1,
                status="CONFIRMED"
            )
            db.add(sess)
            db.flush()

            for s_idx, s in enumerate(students_list):
                is_present = True
                if s.roll_number in ["CS2026-008", "CS2026-010"] and sess_idx in [2, 3, 4]:
                    is_present = False

                rec = AttendanceRecord(
                    session_id=sess.id,
                    student_id=s.id,
                    status="PRESENT" if is_present else "ABSENT",
                    confidence_score=95.0 if is_present else 0.0,
                    detection_bbox=[140, 250, 350, 60] if is_present else None,
                    verification_type="AUTO_AI" if is_present else "AUTO_ABSENT",
                    marked_at=datetime.combine(s_date, datetime.min.time()) + timedelta(hours=9, minutes=15)
                )
                db.add(rec)

            unk = UnknownFace(
                session_id=sess.id,
                cropped_image_path=f"/uploads/students/portrait_{students_list[0].roll_number}.jpg",
                bbox=[140, 250, 350, 60],
                confidence_score=40.0,
                status="PENDING" if sess_idx == 4 else "RESOLVED",
                assigned_student_id=None if sess_idx == 4 else students_list[0].id
            )
            db.add(unk)

        # Seed realistic initial notifications
        n1 = Notification(
            recipient_user_id=teacher_user.id,
            actor_user_id=admin_user.id,
            notification_type="COURSE_ASSIGNED",
            priority="SUCCESS",
            category="Assignments",
            title="Course Assigned to You",
            message="You have been assigned as Primary Faculty for Computer Vision & AI (CS-301) for B.Tech Semester 5, Division(s) A.",
            entity_type="ClassCourse",
            entity_id=class_1.id,
            action_view="classes",
            action_params=json.dumps({"class_id": class_1.id}),
            details_json=json.dumps({
                "course_id": class_1.id,
                "course_code": "CS-301",
                "course_name": "Computer Vision & AI",
                "department": "Computer Science",
                "program": "B.Tech",
                "semester": "Semester 5",
                "divisions": ["A"],
                "faculty_role": "Primary Faculty",
                "academic_year": "2026-27",
                "assigned_by": "Administrator"
            }),
            is_read=False,
            created_at=datetime.utcnow() - timedelta(hours=3)
        )
        db.add(n1)

        n2 = Notification(
            recipient_user_id=teacher_user.id,
            actor_user_id=admin_user.id,
            notification_type="COURSE_ASSIGNED",
            priority="SUCCESS",
            category="Assignments",
            title="Course Assigned to You",
            message="You have been assigned as Co-Faculty for Deep Learning & Neural Nets (CS-402) for B.Tech Semester 7, Division(s) A.",
            entity_type="ClassCourse",
            entity_id=class_2.id,
            action_view="classes",
            action_params=json.dumps({"class_id": class_2.id}),
            details_json=json.dumps({
                "course_id": class_2.id,
                "course_code": "CS-402",
                "course_name": "Deep Learning & Neural Nets",
                "department": "Computer Science",
                "program": "B.Tech",
                "semester": "Semester 7",
                "divisions": ["A"],
                "faculty_role": "Co-Faculty",
                "academic_year": "2026-27",
                "assigned_by": "Administrator"
            }),
            is_read=False,
            created_at=datetime.utcnow() - timedelta(hours=1, minutes=30)
        )
        db.add(n2)

        n3 = Notification(
            recipient_user_id=teacher_user.id,
            actor_user_id=None,
            notification_type="UNKNOWN_FACES_DETECTED",
            priority="WARNING",
            category="Attendance",
            title="1 Unknown Face Detected",
            message="1 unidentified face was detected during the Computer Vision & AI attendance session.",
            entity_type="AttendanceSession",
            entity_id=sess.id,
            action_view="unknown_faces",
            action_params=json.dumps({"session_id": sess.id}),
            details_json=json.dumps({
                "session_id": sess.id,
                "course_code": "CS-301",
                "course_name": "Computer Vision & AI",
                "program": "B.Tech",
                "semester": "Semester 5",
                "division": "A",
                "unknown_count": 1
            }),
            is_read=False,
            created_at=datetime.utcnow() - timedelta(minutes=25)
        )
        db.add(n3)

        n4 = Notification(
            recipient_user_id=admin_user.id,
            actor_user_id=admin_user.id,
            notification_type="SYSTEM_ALERT",
            priority="INFO",
            category="System",
            title="System Diagnostics & Biometric Model Ready",
            message="YOLOv8 face detector, MiniFASNetV2 anti-spoofing, and ArcFace 512-D models loaded and verified successfully.",
            entity_type="System",
            action_view="model_benchmark",
            details_json=json.dumps({
                "status": "OPERATIONAL",
                "models": ["YOLOv8", "MiniFASNetV2", "ArcFace 512-D"]
            }),
            is_read=False,
            created_at=datetime.utcnow() - timedelta(minutes=10)
        )
        db.add(n4)

        db.commit()
        print("--> Database seeded successfully with notifications.")
    except Exception as e:
        db.rollback()
        print(f"Seed error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database(force_reseed=True)
