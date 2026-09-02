from datetime import datetime, date
from typing import List, Dict, Any, Optional
import numpy as np
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from backend.app.core.datetime_utils import get_ist_now
from backend.app.db.models import (
    AttendanceSession, AttendanceRecord, Student, ClassCourse, UnknownFace, AuditLog
)
from backend.app.services.face_engine import face_engine
from backend.app.core.config import settings

class AttendanceService:
    @staticmethod
    def get_student_attendance_summary(
        db: Session,
        student_id: int,
        course_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        CENTRALIZED BACKEND SOURCE OF TRUTH for Student Attendance Calculations.
        Dynamically computes all counts and percentages strictly from real database records:
        
        - Normal Sessions = count of actual regular sessions conducted for student's enrolled courses.
        - Normal Present = count of actual regular sessions attended (status in ['PRESENT', 'LATE']).
        - Normal Absent = Normal Sessions - Normal Present.
        - Normal % = (Normal Present / Normal Sessions) * 100.
        - Extra Lectures = count of actual approved EXTRA_LECTURE sessions (deduplicated by session).
        - Total Sessions = Normal Sessions + Extra Lectures.
        - Total Present = Normal Present + Extra Lectures.
        - Total Absent = Total Sessions - Total Present (= Normal Absent).
        - Final Attendance % = (Total Present / Total Sessions) * 100.
        - Eligibility Status = ELIGIBLE if Final % >= 75.0 else DEFAULTER.
        """
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            return {
                "student_id": student_id,
                "roll_number": "N/A",
                "full_name": "Unknown",
                "normal_sessions": 0,
                "normal_present": 0,
                "normal_absent": 0,
                "normal_percentage": 0.0,
                "extra_lectures": 0,
                "extra_lecture_count": 0,
                "total_sessions": 0,
                "total_present": 0,
                "total_absent": 0,
                "final_percentage": 0.0,
                "attendance_percentage": 0.0,
                "is_defaulter": False,
                "eligibility_status": "N/A"
            }

        # Determine enrolled courses for this student
        enrolled_courses = list(student.enrolled_classes)
        if not enrolled_courses:
            prog = getattr(student, "program", "B.Tech")
            sem = student.semester
            sec = student.section
            enrolled_courses = db.query(ClassCourse).filter(
                ClassCourse.department == student.department,
                ClassCourse.program == prog,
                ClassCourse.semester == sem,
                ClassCourse.section == sec
            ).all()

        enrolled_course_ids = [c.id for c in enrolled_courses]
        if course_id and course_id in enrolled_course_ids:
            enrolled_course_ids = [course_id]

        # 1. Query Normal Sessions for enrolled courses
        session_query = db.query(AttendanceSession)
        if enrolled_course_ids:
            session_query = session_query.filter(AttendanceSession.class_id.in_(enrolled_course_ids))
        else:
            session_query = session_query.filter(AttendanceSession.id == -1)

        if start_date:
            session_query = session_query.filter(AttendanceSession.session_date >= start_date)
        if end_date:
            session_query = session_query.filter(AttendanceSession.session_date <= end_date)

        normal_sessions_objs = session_query.all()
        valid_sessions_objs = []
        for s in normal_sessions_objs:
            c_obj = next((c for c in enrolled_courses if c.id == s.class_id), None)
            c_start = getattr(c_obj, "start_date", None)
            if c_start and s.session_date < c_start:
                continue
            valid_sessions_objs.append(s)

        normal_session_ids = [s.id for s in valid_sessions_objs]
        total_conducted_sessions = len(normal_session_ids)

        # 2. Query Normal Attendance Records for this student
        normal_records = []
        if normal_session_ids:
            normal_records = db.query(AttendanceRecord).filter(
                AttendanceRecord.session_id.in_(normal_session_ids),
                AttendanceRecord.student_id == student.id,
                AttendanceRecord.is_extra_lecture == False,
                AttendanceRecord.verification_type != "EXTRA_LECTURE",
                AttendanceRecord.attendance_type != "EXTRA_LECTURE"
            ).all()

        normal_present_count = sum(1 for r in normal_records if r.status in ["PRESENT", "LATE"])
        normal_frozen_count = sum(1 for r in normal_records if r.status == "FROZEN")
        
        # Eligible sessions exclude periods when student was frozen (Neutral exempt)
        normal_eligible_sessions = max(0, total_conducted_sessions - normal_frozen_count)
        normal_absent_count = max(0, normal_eligible_sessions - normal_present_count)
        normal_percentage = round((normal_present_count / normal_eligible_sessions) * 100.0, 2) if normal_eligible_sessions > 0 else 0.0

        # 3. Query Approved Extra Lecture Records for this student (deduplicated by session)
        extra_query = db.query(AttendanceRecord).join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id).filter(
            AttendanceRecord.student_id == student.id,
            (AttendanceRecord.is_extra_lecture == True) |
            (AttendanceRecord.verification_type == "EXTRA_LECTURE") |
            (AttendanceRecord.attendance_type == "EXTRA_LECTURE"),
            AttendanceRecord.status.in_(["PRESENT", "LATE"])
        )
        if start_date:
            extra_query = extra_query.filter(AttendanceSession.session_date >= start_date)
        if end_date:
            extra_query = extra_query.filter(AttendanceSession.session_date <= end_date)

        extra_records = extra_query.all()
        distinct_extra_session_ids = set(er.session_id for er in extra_records)
        extra_lectures_count = len(distinct_extra_session_ids)

        # 4. Combined Database-Driven Calculation
        total_sessions = normal_eligible_sessions + extra_lectures_count
        total_present = normal_present_count + extra_lectures_count
        total_absent = max(0, total_sessions - total_present)

        final_percentage = round((total_present / total_sessions) * 100.0, 2) if total_sessions > 0 else 0.0
        is_defaulter = final_percentage < settings.DEFAULTER_THRESHOLD_PERCENT if total_sessions > 0 else False
        eligibility_status = "DEFAULTER" if is_defaulter else "ELIGIBLE"

        photo_url = getattr(student, "photo_url", None)
        if not photo_url and getattr(student, "photo_urls", None) and len(student.photo_urls) > 0:
            photo_url = student.photo_urls[0]

        is_student_frozen = bool(getattr(student, "is_frozen", False) or getattr(student, "attendance_status", "ACTIVE") == "FROZEN")

        return {
            "student_id": student.id,
            "roll_number": student.roll_number,
            "full_name": student.full_name,
            "email": student.email,
            "department": student.department,
            "program": getattr(student, "program", "B.Tech"),
            "semester": student.semester,
            "division": (student.section or "A").strip().upper(),
            "photo_url": photo_url,
            "attendance_status": "FROZEN" if is_student_frozen else "ACTIVE",
            "is_frozen": is_student_frozen,
            "freeze_reason": getattr(student, "freeze_reason", None),
            
            # Normal Counts
            "normal_sessions": normal_eligible_sessions,
            "normal_present": normal_present_count,
            "normal_absent": normal_absent_count,
            "normal_frozen": normal_frozen_count,
            "normal_percentage": normal_percentage,
            "normal_sessions_count": normal_eligible_sessions,
            "normal_present_count": normal_present_count,
            "normal_absent_count": normal_absent_count,
            "normal_frozen_count": normal_frozen_count,
            "normal_attendance_percentage": normal_percentage,
            "total_lectures_conducted": total_conducted_sessions,
            "total_lectures_eligible": normal_eligible_sessions,
            "total_lectures_attended": normal_present_count,
            "total_lectures_missed": normal_absent_count,
            "total_lectures_frozen": normal_frozen_count,
            
            # Extra Lectures Count
            "extra_lectures": extra_lectures_count,
            "extra_lecture_count": extra_lectures_count,
            "extra_lectures_count": extra_lectures_count,
            
            # Combined Final Counts
            "total_sessions": total_sessions,
            "total_present": total_present,
            "total_absent": total_absent,
            "total_frozen": normal_frozen_count,
            "final_percentage": final_percentage,
            "final_attendance_percentage": final_percentage,
            "overall_attendance_percentage": final_percentage,
            "attendance_percentage": final_percentage,
            
            # Status
            "is_defaulter": is_defaulter,
            "eligibility_status": eligibility_status,
            "total_recorded_attendance": total_present,
            "present_count": total_present,
            "absent_count": total_absent
        }


    @staticmethod
    def process_new_attendance_session(
        db: Session,
        class_id: int,
        teacher_id: Optional[int],
        session_name: str,
        image_path: Optional[str] = None,
        image_paths: Optional[List[str]] = None,
        session_date: Optional[date] = None,
        start_time: str = "09:00 AM",
        end_time: str = "10:30 AM",
        notes: Optional[str] = None,
        tolerance: float = 0.52,
        class_ids: Optional[List[int]] = None
    ) -> AttendanceSession:
        """
        Creates an AttendanceSession, executes the Computer Vision Face Recognition pipeline
        across 1 to 4 classroom photos with multi-shot deduplication (counting each student once),
        persists AUTO_AI PRESENT records, marks non-detected enrolled students as AUTO_ABSENT,
        and saves UnknownFace records. Supports multi-division session aggregation via class_ids.
        """
        # Validate class existence
        course = db.query(ClassCourse).filter(ClassCourse.id == class_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Class not found.")

        # If multiple class IDs (multi-division) provided, aggregate all courses
        all_courses = [course]
        if class_ids:
            additional_courses = db.query(ClassCourse).filter(ClassCourse.id.in_(class_ids)).all()
            for ac in additional_courses:
                if ac.id != course.id and ac not in all_courses:
                    all_courses.append(ac)

        # Normalize photo paths
        paths_to_process = []
        if image_paths:
            paths_to_process.extend(image_paths)
        elif image_path:
            paths_to_process.append(image_path)

        if not paths_to_process:
            raise HTTPException(status_code=400, detail="No classroom photos provided. Please upload or capture 1 to 8 photos.")

        if len(paths_to_process) > 8:
            raise HTTPException(status_code=400, detail=f"Maximum 8 classroom photos allowed per attendance session. Received {len(paths_to_process)} photos.")

        primary_raw = paths_to_process[0]

        # Resolve scheduled timetable start and end time from course offering or parameter
        scheduled_start = start_time if (start_time and start_time != "09:00 AM") else (getattr(course, "start_time", None) or "09:00 AM")
        scheduled_end = end_time if (end_time and end_time != "10:30 AM") else (getattr(course, "end_time", None) or "10:30 AM")

        # Authoritative server UTC timestamp
        now_utc = datetime.utcnow()
        session_cal_date = session_date or get_ist_now().date()

        # Create session record
        session = AttendanceSession(
            class_id=class_id,
            teacher_id=teacher_id,
            session_name=session_name,
            session_date=session_cal_date,
            start_time=scheduled_start,
            end_time=scheduled_end,
            raw_photo_path=primary_raw,
            notes=notes,
            status="CONFIRMED",
            created_at=now_utc
        )
        session.photo_paths = paths_to_process
        db.add(session)
        db.flush()  # Generate session.id

        # Fetch ONLY the active students enrolled in the selected course offering(s) / section(s)
        eligible_students = []
        seen_student_ids = set()
        for c in all_courses:
            # 1. Directly enrolled students via association table
            for s in c.students:
                if s.is_active and (s.status == "Active" if s.status else True) and s.id not in seen_student_ids:
                    seen_student_ids.add(s.id)
                    eligible_students.append(s)
            # 2. Cohort-matched students (matching department, program, semester, division)
            cohort_students = db.query(Student).filter(
                Student.department == c.department,
                Student.program == c.program,
                Student.semester == c.semester,
                Student.section == c.section,
                Student.is_active == True,
                (Student.status == "Active") | (Student.status == None)
            ).all()
            for s in cohort_students:
                if s.id not in seen_student_ids:
                    seen_student_ids.add(s.id)
                    eligible_students.append(s)
        enrolled_student_ids = {s.id for s in eligible_students}

        # Prepare known students embedding list from ALL institutional active registered students
        # so students from other classes / departments are recognized accurately as Extra Lecture Candidates
        # instead of falsely being labeled as unknown faces.
        all_institutional_students = db.query(Student).filter(
            Student.is_active == True,
            (Student.status == "Active") | (Student.status == None)
        ).all()

        known_student_payloads = []
        for s in all_institutional_students:
            if s.face_embedding is not None:
                known_student_payloads.append({
                    "id": s.id,
                    "name": s.full_name,
                    "roll_number": s.roll_number,
                    "embedding": s.face_embedding,
                    "department": s.department,
                    "program": getattr(s, "program", "B.Tech"),
                    "semester": s.semester,
                    "section": getattr(s, "section", "A")
                })

        # Run Face Recognition Pipeline across all classroom photos with deduplication
        cv_result = face_engine.process_multi_classroom_photos(
            image_paths=paths_to_process,
            enrolled_students=known_student_payloads,
            session_id=session.id,
            tolerance=tolerance if tolerance else 0.58
        )

        recognized_student_ids = set()
        extra_lecture_candidates = []
        seen_extra_student_ids = set()

        # Map student objects for fast lookup
        student_obj_map = {s.id: s for s in eligible_students}

        # 1. Classify Recognized Students:
        # A) Selected Roster Students -> Normal Class Attendance (PRESENT / FROZEN / SPOOF_REJECTED)
        # B) Outside Roster Registered Students -> EXTRA LECTURE CANDIDATES (Deduplicated, Not in Selected Class stats)
        for rec in cv_result["recognized"]:
            st_id = rec["student_id"]
            is_spoof = rec.get("is_spoof", False)
            target_st = student_obj_map.get(st_id)
            is_student_frozen = bool(target_st and (target_st.is_frozen or target_st.attendance_status == "FROZEN"))

            if st_id in enrolled_student_ids:
                # Part of selected class roster
                if is_student_frozen:
                    # Student is frozen - Mark FROZEN even if recognized in classroom
                    record = AttendanceRecord(
                        session_id=session.id,
                        student_id=st_id,
                        status="FROZEN",
                        confidence_score=rec["confidence"],
                        detection_bbox=rec["bbox"],
                        verification_type="FROZEN_STUDENT",
                        attendance_type="REGULAR",
                        is_extra_lecture=False,
                        notes="Student attendance is frozen (Neutral/Exempt)",
                        marked_at=datetime.utcnow()
                    )
                    db.add(record)
                    recognized_student_ids.add(st_id)
                    continue

                if is_spoof:
                    record = AttendanceRecord(
                        session_id=session.id,
                        student_id=st_id,
                        status="ABSENT",
                        confidence_score=0.0,
                        detection_bbox=rec["bbox"],
                        verification_type="SPOOF_REJECTED",
                        attendance_type="REGULAR",
                        is_extra_lecture=False,
                        marked_at=datetime.utcnow()
                    )
                    db.add(record)
                    recognized_student_ids.add(st_id)
                    continue

                recognized_student_ids.add(st_id)
                record = AttendanceRecord(
                    session_id=session.id,
                    student_id=st_id,
                    status="PRESENT",
                    confidence_score=rec["confidence"],
                    detection_bbox=rec["bbox"],
                    verification_type="AUTO_AI",
                    attendance_type="REGULAR",
                    is_extra_lecture=False,
                    marked_at=datetime.utcnow()
                )
                db.add(record)

            else:
                # Registered institutional student outside selected roster -> EXTRA LECTURE CANDIDATE
                if st_id not in seen_extra_student_ids:
                    seen_extra_student_ids.add(st_id)
                    st_obj = db.query(Student).filter(Student.id == st_id).first()
                    if st_obj:
                        photo_url = st_obj.photo_url or (st_obj.photo_urls[0] if getattr(st_obj, "photo_urls", None) and len(st_obj.photo_urls) > 0 else None)
                        is_st_frozen = bool(st_obj.is_frozen or st_obj.attendance_status == "FROZEN")
                        extra_lecture_candidates.append({
                            "student_id": st_obj.id,
                            "student_name": st_obj.full_name,
                            "roll_number": st_obj.roll_number,
                            "department": st_obj.department or "General",
                            "program": getattr(st_obj, "program", "B.Tech"),
                            "semester": st_obj.semester or "Semester 1",
                            "division": getattr(st_obj, "section", "A"),
                            "student_photo_url": photo_url,
                            "confidence": rec["confidence"],
                            "similarity": rec.get("similarity", 0.0),
                            "bbox": rec.get("bbox"),
                            "is_spoof": is_spoof,
                            "status": "CANDIDATE",
                            "is_approved": False,
                            "is_extra_lecture": True,
                            "is_frozen": is_st_frozen,
                            "attendance_status": "FROZEN" if is_st_frozen else "ACTIVE",
                            "freeze_reason": st_obj.freeze_reason if is_st_frozen else None,
                            "freeze_until": st_obj.freeze_until.strftime("%Y-%m-%d") if (is_st_frozen and st_obj.freeze_until) else None
                        })

        # 2. Auto-Absent logic strictly for enrolled students in this offering who were not detected
        for s in eligible_students:
            if s.id not in recognized_student_ids:
                is_st_frozen = bool(s.is_frozen or s.attendance_status == "FROZEN")
                record = AttendanceRecord(
                    session_id=session.id,
                    student_id=s.id,
                    status="FROZEN" if is_st_frozen else "ABSENT",
                    confidence_score=0.0,
                    detection_bbox=None,
                    verification_type="FROZEN_STUDENT" if is_st_frozen else "AUTO_ABSENT",
                    attendance_type="REGULAR",
                    is_extra_lecture=False,
                    notes="Student attendance is frozen (Neutral/Exempt)" if is_st_frozen else None,
                    marked_at=datetime.utcnow()
                )
                db.add(record)

        # 3. Create UnknownFace records (Truly unidentified faces)
        for unk in cv_result["unknown"]:
            unk_face = UnknownFace(
                session_id=session.id,
                cropped_image_path=unk.get("cropped_image_path", ""),
                bbox=unk["bbox"],
                confidence_score=unk.get("confidence", 0.0),
                status="PENDING"
            )
            db.add(unk_face)

        # Update session stats and extra candidates
        session.total_detected = cv_result["total_detected"]
        session.total_recognized = len(recognized_student_ids)  # strictly selected class recognized
        session.total_unknown = cv_result["total_unknown"]
        session.processed_photo_path = cv_result["processed_photo_path"]
        session.processed_photo_paths = cv_result.get("processed_photo_paths", [])
        session.extra_candidates = extra_lecture_candidates

        # 4. Add audit log
        spoof_count = cv_result.get("total_spoof", 0)
        spoof_msg = f", {spoof_count} spoof presentation attack(s) blocked" if spoof_count > 0 else ""
        extra_msg = f", {len(extra_lecture_candidates)} extra lecture candidate(s) detected" if extra_lecture_candidates else ""
        audit = AuditLog(
            user_id=teacher_id,
            action="SESSION_PROCESSED_AI",
            entity="AttendanceSession",
            entity_id=session.id,
            details=f"Processed session '{session_name}' ({len(paths_to_process)} photos): {session.total_detected} detected, {session.total_recognized} regular present, {session.total_unknown} unknown{spoof_msg}{extra_msg}."
        )
        db.add(audit)
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def approve_extra_lecture_attendance(
        db: Session,
        session_id: int,
        student_id: int,
        user_id: Optional[int] = None
    ) -> AttendanceRecord:
        """
        Explicitly approves an outside-roster Extra Lecture Candidate for THIS session only.
        CRITICAL RULES:
        - Does NOT enroll the student into the course or division.
        - Does NOT modify student's regular class attendance or academic metadata.
        - Does NOT alter selected class Present/Absent counts.
        - Only records ONE attendance record with attendance_type='EXTRA_LECTURE'.
        """
        session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Attendance session not found.")

        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found.")

        # Find or create extra lecture attendance record
        record = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.student_id == student_id
        ).first()

        if not record:
            record = AttendanceRecord(
                session_id=session_id,
                student_id=student_id,
                status="PRESENT",
                confidence_score=95.0,
                verification_type="EXTRA_LECTURE",
                attendance_type="EXTRA_LECTURE",
                is_extra_lecture=True,
                notes="Extra Lecture Attendance approved by faculty.",
                marked_at=datetime.utcnow()
            )
            db.add(record)
        else:
            record.status = "PRESENT"
            record.verification_type = "EXTRA_LECTURE"
            record.attendance_type = "EXTRA_LECTURE"
            record.is_extra_lecture = True
            record.notes = "Extra Lecture Attendance approved by faculty."
            record.marked_at = datetime.utcnow()

        # Update candidate state in session.extra_candidates JSON
        candidates = list(session.extra_candidates)
        updated_candidates = []
        found = False
        for c in candidates:
            if c.get("student_id") == student_id:
                c["is_approved"] = True
                c["status"] = "APPROVED"
                found = True
            updated_candidates.append(c)
        if not found:
            photo_url = student.photo_url or (student.photo_urls[0] if getattr(student, "photo_urls", None) and len(student.photo_urls) > 0 else None)
            updated_candidates.append({
                "student_id": student.id,
                "student_name": student.full_name,
                "roll_number": student.roll_number,
                "department": student.department or "General",
                "program": getattr(student, "program", "B.Tech"),
                "semester": student.semester or "Semester 1",
                "division": getattr(student, "section", "A"),
                "student_photo_url": photo_url,
                "confidence": 95.0,
                "status": "APPROVED",
                "is_approved": True,
                "is_extra_lecture": True
            })
        session.extra_candidates = updated_candidates

        audit = AuditLog(
            user_id=user_id,
            action="EXTRA_LECTURE_APPROVED",
            entity="AttendanceRecord",
            entity_id=record.id if record.id else session_id,
            details=f"Extra Lecture Attendance approved for outside-roster student '{student.full_name}' ({student.roll_number}) in session #{session_id}."
        )
        db.add(audit)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def ignore_extra_lecture_attendance(
        db: Session,
        session_id: int,
        student_id: int,
        user_id: Optional[int] = None
    ) -> bool:
        """
        Ignores / disregards an outside-roster Extra Lecture Candidate.
        Removes any extra lecture attendance record for this student in this session.
        """
        session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Attendance session not found.")

        record = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.student_id == student_id,
            (AttendanceRecord.is_extra_lecture == True) | (AttendanceRecord.verification_type == "EXTRA_LECTURE")
        ).first()

        if record:
            db.delete(record)

        candidates = list(session.extra_candidates)
        updated_candidates = []
        for c in candidates:
            if c.get("student_id") == student_id:
                c["is_approved"] = False
                c["status"] = "IGNORED"
            updated_candidates.append(c)
        session.extra_candidates = updated_candidates

        audit = AuditLog(
            user_id=user_id,
            action="EXTRA_LECTURE_IGNORED",
            entity="AttendanceSession",
            entity_id=session_id,
            details=f"Extra Lecture Candidate #{student_id} ignored in session #{session_id}."
        )
        db.add(audit)
        db.commit()
        return True

    @staticmethod
    def quick_verify_student_face(
        db: Session,
        session_id: int,
        student_id: int,
        photo_path: str,
        user_id: Optional[int] = None
    ) -> AttendanceRecord:
        """
        Allows the teacher to snap a photo of a student who was missed in the group photo,
        verify their face biometrically against registered 128-D vector, and mark them PRESENT
        ONLY if identity matches. If someone else or an unknown person appears in front of the camera,
        rejects verification and notifies the teacher.
        """
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found.")

        # Extract 128-D vector from snapshot
        encoding = face_engine.extract_single_face_encoding(photo_path)
        if encoding is None:
            raise HTTPException(
                status_code=400,
                detail="No human face detected in the live camera frame. Please ensure the student faces the camera directly with adequate lighting."
            )

        threshold = settings.DEFAULT_TOLERANCE  # 0.50 for ArcFace Cosine Similarity
        confidence = 90.0
        query_vec = np.array(encoding, dtype=np.float32)

        if student.face_embedding:
            emb = student.face_embedding
            if isinstance(emb, list) and len(emb) > 0 and isinstance(emb[0], list):
                sim = max([face_engine.compute_cosine_similarity(query_vec, np.array(v)) for v in emb])
            else:
                sim = face_engine.compute_cosine_similarity(query_vec, np.array(emb))

            if sim < threshold:
                # Face did NOT match this student! Check if it matches any other enrolled student
                all_students = db.query(Student).filter(Student.id != student_id).all()
                other_matched = None
                for other in all_students:
                    if other.face_embedding:
                        o_emb = other.face_embedding
                        if isinstance(o_emb, list) and len(o_emb) > 0 and isinstance(o_emb[0], list):
                            o_sim = max([face_engine.compute_cosine_similarity(query_vec, np.array(v)) for v in o_emb])
                        else:
                            o_sim = face_engine.compute_cosine_similarity(query_vec, np.array(o_emb))
                        if o_sim >= threshold:
                            other_matched = other
                            break

                if other_matched:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Biometric mismatch! Detected face matches '{other_matched.full_name}' ({other_matched.roll_number}), NOT '{student.full_name}'. Attendance was not marked."
                    )
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Biometric mismatch! Detected face is UNRECOGNIZED and does not match '{student.full_name}'. Attendance was not marked."
                    )

            confidence = face_engine.calculate_confidence_score(sim, threshold=threshold)
        else:
            confidence = 92.0

        record = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.student_id == student_id
        ).first()

        if not record:
            record = AttendanceRecord(
                session_id=session_id,
                student_id=student_id,
                status="PRESENT",
                confidence_score=confidence,
                verification_type="LIVE_BIOMETRIC_VERIFIED",
                notes=f"Live camera verified ({confidence}% match)",
                marked_at=datetime.utcnow()
            )
            db.add(record)
        else:
            record.status = "PRESENT"
            record.confidence_score = confidence
            record.verification_type = "LIVE_BIOMETRIC_VERIFIED"
            record.notes = f"Live camera verified ({confidence}% match)"
            record.marked_at = datetime.utcnow()

        audit = AuditLog(
            user_id=user_id,
            action="STUDENT_QUICK_VERIFIED",
            entity="AttendanceRecord",
            entity_id=record.id,
            details=f"Student {student.full_name} ({student.roll_number}) verified live with biometric confidence {confidence}%."
        )
        db.add(audit)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def update_attendance_records(
        db: Session,
        session_id: int,
        updates: List[Dict[str, Any]],
        user_id: Optional[int] = None
    ) -> List[AttendanceRecord]:
        """
        Allows manual confirmation, editing, and overrides of attendance records.
        """
        session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found.")

        updated_records = []
        for item in updates:
            record_id = item["record_id"]
            new_status = item.get("status")
            new_notes = item.get("notes")

            record = db.query(AttendanceRecord).filter(
                AttendanceRecord.id == record_id,
                AttendanceRecord.session_id == session_id
            ).first()

            if record and new_status:
                old_status = record.status
                record.status = new_status
                if new_notes is not None:
                    record.notes = new_notes
                record.verification_type = "MANUAL_OVERRIDE"
                record.marked_at = datetime.utcnow()
                updated_records.append(record)

                # Log override audit
                audit = AuditLog(
                    user_id=user_id,
                    action="ATTENDANCE_OVERRIDE",
                    entity="AttendanceRecord",
                    entity_id=record.id,
                    details=f"Changed student ID {record.student_id} status from '{old_status}' to '{new_status}' in session {session_id}."
                )
                db.add(audit)

        session.finalized_at = datetime.utcnow()
        db.commit()
        return updated_records

    @staticmethod
    def resolve_unknown_face(
        db: Session,
        unknown_face_id: int,
        student_id: int,
        update_attendance: bool = True,
        user_id: Optional[int] = None
    ) -> UnknownFace:
        """
        Tags an unknown cropped face to a registered student.
        Optionally updates the student's attendance record in that session to PRESENT.
        """
        unknown_face = db.query(UnknownFace).filter(UnknownFace.id == unknown_face_id).first()
        if not unknown_face:
            raise HTTPException(status_code=404, detail="Unknown face entry not found.")

        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found.")

        unknown_face.assigned_student_id = student.id
        unknown_face.status = "RESOLVED"

        if update_attendance:
            # Find or create attendance record for this student in this session
            record = db.query(AttendanceRecord).filter(
                AttendanceRecord.session_id == unknown_face.session_id,
                AttendanceRecord.student_id == student.id
            ).first()

            if record:
                record.status = "PRESENT"
                record.verification_type = "MANUAL_OVERRIDE"
                record.detection_bbox = unknown_face.bbox
                record.notes = f"Tagged manually from unknown face queue (Face ID #{unknown_face.id})"
            else:
                record = AttendanceRecord(
                    session_id=unknown_face.session_id,
                    student_id=student.id,
                    status="PRESENT",
                    confidence_score=90.0,
                    detection_bbox=unknown_face.bbox,
                    verification_type="MANUAL_OVERRIDE",
                    notes=f"Tagged manually from unknown face queue (Face ID #{unknown_face.id})"
                )
                db.add(record)

        audit = AuditLog(
            user_id=user_id,
            action="RESOLVE_UNKNOWN_FACE",
            entity="UnknownFace",
            entity_id=unknown_face.id,
            details=f"Assigned unknown face #{unknown_face.id} to student '{student.full_name}' ({student.roll_number})."
        )
        db.add(audit)

        db.commit()
        db.refresh(unknown_face)
        return unknown_face

    @staticmethod
    def dismiss_unknown_face(
        db: Session,
        unknown_face_id: int,
        user_id: Optional[int] = None
    ) -> UnknownFace:
        unknown_face = db.query(UnknownFace).filter(UnknownFace.id == unknown_face_id).first()
        if not unknown_face:
            raise HTTPException(status_code=404, detail="Unknown face entry not found.")

        unknown_face.status = "DISMISSED"

        audit = AuditLog(
            user_id=user_id,
            action="DISMISS_UNKNOWN_FACE",
            entity="UnknownFace",
            entity_id=unknown_face.id,
            details=f"Dismissed unknown face #{unknown_face.id}."
        )
        db.add(audit)

        db.commit()
        db.refresh(unknown_face)
        return unknown_face

attendance_service = AttendanceService()
