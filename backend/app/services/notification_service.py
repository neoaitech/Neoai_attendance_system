import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.db.models import Notification, AuditLog, User, ClassCourse
from backend.app.core.datetime_utils import format_iso_utc, format_ist_datetime, get_utc_now

class NotificationService:
    def create_notification(
        self,
        db: Session,
        recipient_user_id: int,
        notification_type: str,
        title: str,
        message: str,
        category: str = "Assignments",
        priority: str = "INFO",
        actor_user_id: Optional[int] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        action_view: Optional[str] = None,
        action_params: Optional[Dict[str, Any]] = None,
        details: Optional[Dict[str, Any]] = None,
        commit: bool = True
    ) -> Optional[Notification]:
        """
        Creates a recipient-scoped notification with duplicate prevention and audit logging.
        """
        if not recipient_user_id:
            return None

        # Verify recipient user exists and is active
        recipient = db.query(User).filter(User.id == recipient_user_id).first()
        if not recipient:
            return None

        # Idempotency / Duplicate Prevention: Avoid creating duplicate notifications in short window (15s)
        window = datetime.utcnow() - timedelta(seconds=15)
        duplicate = db.query(Notification).filter(
            Notification.recipient_user_id == recipient_user_id,
            Notification.notification_type == notification_type,
            Notification.entity_type == entity_type,
            Notification.entity_id == entity_id,
            Notification.title == title,
            Notification.created_at >= window
        ).first()

        if duplicate:
            return duplicate

        notif = Notification(
            recipient_user_id=recipient_user_id,
            actor_user_id=actor_user_id,
            notification_type=notification_type,
            priority=priority,
            category=category,
            title=title,
            message=message,
            entity_type=entity_type,
            entity_id=entity_id,
            action_view=action_view or "dashboard",
            action_params=json.dumps(action_params or {}),
            details_json=json.dumps(details or {}),
            is_read=False,
            created_at=datetime.utcnow()
        )
        db.add(notif)

        if commit:
            try:
                db.commit()
                db.refresh(notif)
            except Exception:
                db.rollback()
                return None

        return notif

    def record_audit_log(
        self,
        db: Session,
        action: str,
        entity: str,
        entity_id: Optional[int] = None,
        user_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
        commit: bool = True
    ) -> AuditLog:
        """
        Records an administrative audit event. (Never stores passwords, tokens, or biometric embeddings).
        """
        clean_details = {}
        if details and isinstance(details, dict):
            for k, v in details.items():
                if k in ["password", "hashed_password", "token", "access_token", "face_embedding", "_face_embedding"]:
                    clean_details[k] = "[REDACTED]"
                else:
                    clean_details[k] = v

        audit = AuditLog(
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            details=json.dumps(clean_details),
            timestamp=datetime.utcnow()
        )
        db.add(audit)
        if commit:
            try:
                db.commit()
                db.refresh(audit)
            except Exception:
                db.rollback()
        return audit

    def notify_course_assignment(
        self,
        db: Session,
        faculty_id: int,
        course: ClassCourse,
        divisions: List[str],
        role: str = "Primary Faculty",
        actor: Optional[User] = None
    ) -> Optional[Notification]:
        """
        Notifies a single faculty member about a new course assignment with full academic context.
        """
        actor_name = actor.full_name if actor else "Administrator"
        div_str = ", ".join(sorted(divisions)) if divisions else (course.section or "A")
        
        title = "Course Assigned to You"
        message = f"You have been assigned as {role} for {course.name} ({course.code}) for {course.program} {course.semester}, Division(s) {div_str}."

        details = {
            "course_id": course.id,
            "course_code": course.code,
            "course_name": course.name,
            "subject_name": course.subject_name or course.name,
            "department": course.department,
            "program": course.program,
            "semester": course.semester,
            "divisions": sorted(divisions) if divisions else [course.section or "A"],
            "academic_year": getattr(course, "academic_year", "2026-27"),
            "faculty_role": role,
            "assigned_by": actor_name,
            "assigned_at": format_ist_datetime(get_utc_now()),
            "assigned_at_iso": format_iso_utc(get_utc_now())
        }

        # Also log audit trail
        self.record_audit_log(
            db=db,
            action="FACULTY_ASSIGNED_TO_COURSE",
            entity="ClassCourse",
            entity_id=course.id,
            user_id=actor.id if actor else None,
            details={
                "faculty_id": faculty_id,
                "course_code": course.code,
                "course_name": course.name,
                "role": role,
                "divisions": divisions
            },
            commit=False
        )

        return self.create_notification(
            db=db,
            recipient_user_id=faculty_id,
            notification_type="COURSE_ASSIGNED",
            priority="SUCCESS",
            category="Assignments",
            title=title,
            message=message,
            actor_user_id=actor.id if actor else None,
            entity_type="ClassCourse",
            entity_id=course.id,
            action_view="classes",
            action_params={"class_id": course.id},
            details=details,
            commit=True
        )

    def notify_course_assignment_updated(
        self,
        db: Session,
        faculty_id: int,
        course: ClassCourse,
        prev_divisions: List[str],
        updated_divisions: List[str],
        prev_role: str,
        updated_role: str,
        actor: Optional[User] = None
    ) -> Optional[Notification]:
        """
        Notifies a faculty member when their existing course assignment details (divisions or role) are modified.
        """
        actor_name = actor.full_name if actor else "Administrator"
        prev_div_str = ", ".join(sorted(prev_divisions)) if prev_divisions else "A"
        new_div_str = ", ".join(sorted(updated_divisions)) if updated_divisions else (course.section or "A")

        title = "Course Assignment Updated"
        message = f"Your {course.name} ({course.code}) teaching assignment has been updated by {actor_name}."

        details = {
            "course_id": course.id,
            "course_code": course.code,
            "course_name": course.name,
            "department": course.department,
            "program": course.program,
            "semester": course.semester,
            "previous_divisions": sorted(prev_divisions),
            "updated_divisions": sorted(updated_divisions),
            "previous_role": prev_role,
            "updated_role": updated_role,
            "academic_year": getattr(course, "academic_year", "2026-27"),
            "updated_by": actor_name,
            "updated_at": format_ist_datetime(get_utc_now()),
            "updated_at_iso": format_iso_utc(get_utc_now())
        }

        self.record_audit_log(
            db=db,
            action="FACULTY_COURSE_ASSIGNMENT_UPDATED",
            entity="ClassCourse",
            entity_id=course.id,
            user_id=actor.id if actor else None,
            details=details,
            commit=False
        )

        return self.create_notification(
            db=db,
            recipient_user_id=faculty_id,
            notification_type="COURSE_UPDATED",
            priority="INFO",
            category="Assignments",
            title=title,
            message=message,
            actor_user_id=actor.id if actor else None,
            entity_type="ClassCourse",
            entity_id=course.id,
            action_view="classes",
            action_params={"class_id": course.id},
            details=details,
            commit=True
        )

    def notify_course_assignment_removed(
        self,
        db: Session,
        faculty_id: int,
        course_code: str,
        course_name: str,
        program: str,
        semester: str,
        division: str,
        actor: Optional[User] = None
    ) -> Optional[Notification]:
        """
        Notifies a faculty member when they are unassigned/removed from a course offering.
        """
        actor_name = actor.full_name if actor else "Administrator"
        title = "Course Assignment Removed"
        message = f"You are no longer assigned to teach {course_name} ({course_code}) for {program} {semester} Division {division}."

        details = {
            "course_code": course_code,
            "course_name": course_name,
            "program": program,
            "semester": semester,
            "division": division,
            "removed_by": actor_name,
            "removed_at": format_ist_datetime(get_utc_now()),
            "removed_at_iso": format_iso_utc(get_utc_now())
        }

        self.record_audit_log(
            db=db,
            action="FACULTY_REMOVED_FROM_COURSE",
            entity="ClassCourse",
            user_id=actor.id if actor else None,
            details={
                "faculty_id": faculty_id,
                "course_code": course_code,
                "course_name": course_name,
                "division": division
            },
            commit=False
        )

        return self.create_notification(
            db=db,
            recipient_user_id=faculty_id,
            notification_type="COURSE_REMOVED",
            priority="WARNING",
            category="Assignments",
            title=title,
            message=message,
            actor_user_id=actor.id if actor else None,
            entity_type="ClassCourse",
            action_view="classes",
            details=details,
            commit=True
        )

    def notify_faculty_profile_updated(
        self,
        db: Session,
        faculty_user: User,
        updated_fields: List[str],
        actor: Optional[User] = None
    ) -> Optional[Notification]:
        """
        Notifies faculty when their profile, role, or account status is updated by an administrator.
        """
        actor_name = actor.full_name if actor else "Administrator"
        
        # Check if status changed
        if "is_active" in updated_fields:
            if faculty_user.is_active:
                title = "Your Faculty Account Was Activated"
                msg = f"Your institutional faculty account has been activated by {actor_name}."
                prio = "SUCCESS"
            else:
                title = "Your Faculty Account Was Deactivated"
                msg = f"Your institutional faculty account has been deactivated by {actor_name}."
                prio = "CRITICAL"
        elif "role" in updated_fields:
            title = "Your Institutional Role Was Updated"
            role_label = "System Administrator" if faculty_user.role == "admin" else "Course Faculty"
            msg = f"Your institutional role has been updated to '{role_label}' by {actor_name}."
            prio = "INFO"
        else:
            title = "Your Faculty Profile Was Updated"
            msg = f"Your institutional profile was updated by an administrator."
            prio = "INFO"

        details = {
            "faculty_id": faculty_user.id,
            "faculty_name": faculty_user.full_name,
            "updated_fields": [f.replace("_", " ").title() for f in updated_fields],
            "updated_by": actor_name,
            "updated_at": format_ist_datetime(get_utc_now()),
            "updated_at_iso": format_iso_utc(get_utc_now())
        }

        self.record_audit_log(
            db=db,
            action="FACULTY_PROFILE_UPDATED",
            entity="User",
            entity_id=faculty_user.id,
            user_id=actor.id if actor else None,
            details=details,
            commit=False
        )

        return self.create_notification(
            db=db,
            recipient_user_id=faculty_user.id,
            notification_type="FACULTY_PROFILE_UPDATED",
            priority=prio,
            category="Security",
            title=title,
            message=msg,
            actor_user_id=actor.id if actor else None,
            entity_type="User",
            entity_id=faculty_user.id,
            action_view="profile",
            details=details,
            commit=True
        )

    def notify_unknown_faces_detected(
        self,
        db: Session,
        session_id: int,
        course: ClassCourse,
        unknown_count: int,
        session_date: str,
        session_time: str
    ) -> List[Notification]:
        """
        Notifies ONLY the faculty members responsible for this specific course offering about detected unknown faces.
        """
        if unknown_count <= 0:
            return []

        # Find responsible faculty for this course
        faculty_recipients = set()
        if course.teacher_id:
            faculty_recipients.add(course.teacher_id)
        if course.teachers:
            for t in course.teachers:
                faculty_recipients.add(t.id)

        notifs = []
        for fid in faculty_recipients:
            title = f"{unknown_count} Unknown Face{'s' if unknown_count > 1 else ''} Detected"
            msg = f"{unknown_count} unidentified face{'s were' if unknown_count > 1 else ' was'} detected during the {course.name} ({course.code}) attendance session on {session_date}."
            
            details = {
                "session_id": session_id,
                "course_code": course.code,
                "course_name": course.name,
                "program": course.program,
                "semester": course.semester,
                "division": course.section,
                "session_date": session_date,
                "session_time": session_time,
                "unknown_count": unknown_count
            }

            n = self.create_notification(
                db=db,
                recipient_user_id=fid,
                notification_type="UNKNOWN_FACES_DETECTED",
                priority="WARNING",
                category="Attendance",
                title=title,
                message=msg,
                entity_type="AttendanceSession",
                entity_id=session_id,
                action_view="unknown_faces",
                action_params={"session_id": session_id},
                details=details,
                commit=False
            )
            if n:
                notifs.append(n)

        if notifs:
            try:
                db.commit()
            except Exception:
                db.rollback()

        return notifs

notification_service = NotificationService()
