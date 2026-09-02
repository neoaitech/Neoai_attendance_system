import json
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, Date, DateTime, ForeignKey, Table, Enum
)
from sqlalchemy.orm import relationship
from backend.app.db.session import Base
from backend.app.core.datetime_utils import format_iso_utc, format_ist_time, format_ist_datetime, format_ist_date

# Association Table: Student <-> ClassCourse (Many-to-Many with Status)
student_class_association = Table(
    "student_class_association",
    Base.metadata,
    Column("student_id", Integer, ForeignKey("students.id", ondelete="CASCADE"), primary_key=True),
    Column("class_id", Integer, ForeignKey("classes.id", ondelete="CASCADE"), primary_key=True),
    Column("status", String(20), default="Active"),  # "Active", "Dropped", "Completed", "Withdrawn"
    Column("enrolled_at", DateTime, default=datetime.utcnow)
)

# Association Table: Faculty <-> ClassCourse (Multiple Faculty per Course Offering)
course_faculty_association = Table(
    "course_faculty_association",
    Base.metadata,
    Column("class_id", Integer, ForeignKey("classes.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role", String(20), default="Primary"),  # "Primary", "Co-Faculty"
    Column("status", String(20), default="Active"),  # "Active", "Inactive"
    Column("assigned_at", DateTime, default=datetime.utcnow)
)

# Association Table: Role <-> Permission
role_permission_association = Table(
    "role_permission_association",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)  # "super_admin", "admin", "teacher", "faculty", custom
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    permissions = relationship("Permission", secondary=role_permission_association, back_populates="roles")
    users = relationship("User", back_populates="role_rel", foreign_keys="User.role_id")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "is_system": self.is_system,
            "is_active": self.is_active,
            "permissions_count": len(self.permissions) if self.permissions else 0,
            "permissions": [p.key for p in self.permissions] if self.permissions else [],
            "created_at": format_iso_utc(self.created_at)
        }

class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)  # e.g. "student.create"
    category = Column(String(50), nullable=False, index=True)  # e.g. "Student Management"
    name = Column(String(100), nullable=False)  # e.g. "Add Student"
    description = Column(Text, nullable=True)
    is_sensitive = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    roles = relationship("Role", secondary=role_permission_association, back_populates="permissions")

    def to_dict(self):
        return {
            "id": self.id,
            "key": self.key,
            "category": self.category,
            "name": self.name,
            "description": self.description,
            "is_sensitive": self.is_sensitive
        }

class UserPermissionOverride(Base):
    __tablename__ = "user_permission_overrides"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_key = Column(String(100), nullable=False, index=True)
    effect = Column(String(10), default="ALLOW", nullable=False)  # "ALLOW", "DENY"
    valid_from = Column(DateTime, nullable=True)
    valid_until = Column(DateTime, nullable=True)
    granted_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="permission_overrides")
    granted_by = relationship("User", foreign_keys=[granted_by_user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "permission_key": self.permission_key,
            "effect": self.effect,
            "valid_from": format_iso_utc(self.valid_from) if self.valid_from else None,
            "valid_until": format_iso_utc(self.valid_until) if self.valid_until else None,
            "granted_by_name": self.granted_by.full_name if self.granted_by else "System Administrator",
            "created_at": format_iso_utc(self.created_at)
        }

class UserAcademicScope(Base):
    __tablename__ = "user_academic_scopes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_key = Column(String(100), default="ALL", nullable=False)  # specific permission or "ALL"
    department = Column(String(100), default="ALL", nullable=False)
    program = Column(String(50), default="ALL", nullable=False)
    semester = Column(String(20), default="ALL", nullable=False)
    division = Column(String(10), default="ALL", nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)
    valid_from = Column(DateTime, nullable=True)
    valid_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="academic_scopes")
    course = relationship("ClassCourse")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "permission_key": self.permission_key,
            "department": self.department,
            "program": self.program,
            "semester": self.semester,
            "division": self.division,
            "class_id": self.class_id,
            "class_code": self.course.code if self.course else None,
            "class_name": self.course.name if self.course else None,
            "valid_from": format_iso_utc(self.valid_from) if self.valid_from else None,
            "valid_until": format_iso_utc(self.valid_until) if self.valid_until else None,
            "created_at": format_iso_utc(self.created_at)
        }

class PermissionRequest(Base):
    __tablename__ = "permission_requests"

    id = Column(Integer, primary_key=True, index=True)
    requester_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission_key = Column(String(100), nullable=False)
    action_type = Column(String(100), nullable=False)  # "ENROLL_UNKNOWN_STUDENT", "DELETE_STUDENT", etc.
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(Integer, nullable=True)
    scope_data = Column(Text, nullable=True)  # JSON
    payload_data = Column(Text, nullable=True)  # JSON
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="PENDING", index=True)  # "PENDING", "APPROVED", "REJECTED"
    reviewer_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewer_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    requester = relationship("User", foreign_keys=[requester_user_id], back_populates="permission_requests")
    reviewer = relationship("User", foreign_keys=[reviewer_user_id])

    def to_dict(self):
        scope = {}
        if self.scope_data:
            try:
                scope = json.loads(self.scope_data)
            except Exception:
                scope = {}
        payload = {}
        if self.payload_data:
            try:
                payload = json.loads(self.payload_data)
            except Exception:
                payload = {}
        return {
            "id": self.id,
            "requester_user_id": self.requester_user_id,
            "requester_name": self.requester.full_name if self.requester else "Unknown Faculty",
            "requester_email": self.requester.email if self.requester else None,
            "permission_key": self.permission_key,
            "action_type": self.action_type,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "scope_data": scope,
            "payload_data": payload,
            "reason": self.reason,
            "status": self.status,
            "reviewer_user_id": self.reviewer_user_id,
            "reviewer_name": self.reviewer.full_name if self.reviewer else None,
            "reviewed_at": format_iso_utc(self.reviewed_at) if self.reviewed_at else None,
            "reviewer_notes": self.reviewer_notes,
            "created_at": format_iso_utc(self.created_at)
        }

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), default="teacher", nullable=False)  # "super_admin", "admin", "teacher" / "faculty"
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    department = Column(String(100), default="Computer Science & Engineering", nullable=True)
    status = Column(String(20), default="Active")  # "Active", "Suspended", "Deactivated"
    photo_url = Column(String(255), nullable=True)
    _face_embedding = Column("face_embedding", Text, nullable=True)
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    classes = relationship("ClassCourse", back_populates="teacher")
    assigned_classes = relationship("ClassCourse", secondary=course_faculty_association, back_populates="teachers")
    sessions = relationship("AttendanceSession", back_populates="teacher")
    role_rel = relationship("Role", back_populates="users", foreign_keys=[role_id])
    permission_overrides = relationship("UserPermissionOverride", back_populates="user", cascade="all, delete-orphan", foreign_keys="UserPermissionOverride.user_id")
    academic_scopes = relationship("UserAcademicScope", back_populates="user", cascade="all, delete-orphan")
    permission_requests = relationship("PermissionRequest", back_populates="requester", cascade="all, delete-orphan", foreign_keys="PermissionRequest.requester_user_id")

    @property
    def face_embedding(self):
        if self._face_embedding:
            try:
                return json.loads(self._face_embedding)
            except Exception:
                return None
        return None

    @face_embedding.setter
    def face_embedding(self, value):
        if value is not None:
            self._face_embedding = json.dumps(value)
        else:
            self._face_embedding = None

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "role_id": self.role_id,
            "role_display": "Super Administrator" if self.role in ("super_admin", "superadmin") else ("Administrator" if self.role == "admin" else "Faculty"),
            "department": self.department or "Computer Science & Engineering",
            "status": self.status or ("Active" if self.is_active else "Deactivated"),
            "photo_url": self.photo_url,
            "has_face_embedding": bool(self._face_embedding),
            "is_active": self.is_active,
            "last_login_at": format_iso_utc(self.last_login_at) if self.last_login_at else None,
            "assigned_classes_count": len(self.assigned_classes) if self.assigned_classes else (len(self.classes) if self.classes else 0),
            "permissions_count": len(self.permission_overrides) if self.permission_overrides else 0,
            "scopes_count": len(self.academic_scopes) if self.academic_scopes else 0,
            "created_at": format_iso_utc(self.created_at)
        }

class ClassCourse(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), index=True, nullable=False)  # e.g., "CS-301", "520"
    name = Column(String(100), nullable=False)  # e.g., "Computer Vision & AI", "MONGODB"
    subject_name = Column(String(100), nullable=True)  # Detailed subject name
    department = Column(String(50), nullable=False)  # e.g., "Computer Science"
    program = Column(String(50), default="B.Tech", nullable=False)  # e.g., "B.Tech", "MCA", "BCA", "M.Tech"
    semester = Column(String(20), default="Semester 5")
    section = Column(String(10), default="A")
    academic_year = Column(String(20), default="2026-27")
    term = Column(String(20), default="Semester 7")
    credits = Column(Integer, default=4)
    room = Column(String(50), nullable=True)
    day = Column(String(20), nullable=True)
    start_time = Column(String(20), nullable=True)
    end_time = Column(String(20), nullable=True)
    start_date = Column(Date, nullable=True)  # Course commencement date
    status = Column(String(20), default="Active")  # "Active", "Archived"
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    teacher = relationship("User", back_populates="classes")
    teachers = relationship("User", secondary=course_faculty_association, back_populates="assigned_classes")
    students = relationship("Student", secondary=student_class_association, back_populates="enrolled_classes")
    sessions = relationship("AttendanceSession", back_populates="course", cascade="all, delete-orphan")

    def to_dict(self):
        # Merge primary teacher and co-faculty list
        all_teachers = []
        seen_teacher_ids = set()
        if self.teacher:
            all_teachers.append({"id": self.teacher.id, "name": self.teacher.full_name, "email": self.teacher.email, "role": "Primary"})
            seen_teacher_ids.add(self.teacher.id)
        if self.teachers:
            for t in self.teachers:
                if t.id not in seen_teacher_ids:
                    all_teachers.append({"id": t.id, "name": t.full_name, "email": t.email, "role": "Co-Faculty"})
                    seen_teacher_ids.add(t.id)

        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "subject_name": self.subject_name or self.name,
            "department": self.department,
            "program": self.program,
            "semester": self.semester,
            "section": self.section,
            "academic_year": self.academic_year or "2026-27",
            "term": self.term or self.semester,
            "credits": self.credits or 4,
            "room": self.room,
            "day": self.day,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "status": self.status or "Active",
            "teacher_id": self.teacher_id,
            "teacher_name": self.teacher.full_name if self.teacher else (all_teachers[0]["name"] if all_teachers else "Unassigned"),
            "teachers": all_teachers,
            "enrolled_students_count": len(self.students) if self.students else 0,
            "created_at": format_iso_utc(self.created_at)
        }

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    roll_number = Column(String(30), unique=True, index=True, nullable=False)  # e.g., "CS2026-001"
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    mobile_number = Column(String(20), nullable=True)
    dob = Column(String(20), nullable=True)
    gender = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    status = Column(String(20), default="Active")  # "Active", "Inactive", "Graduated", "Transferred", "Suspended"
    program = Column(String(50), default="B.Tech", nullable=False)  # e.g., "B.Tech", "MCA", "BCA"
    other_program = Column(String(100), nullable=True)
    course = Column(String(100), default="B.Tech Computer Science")
    semester = Column(String(20), default="Semester 5")
    specialization = Column(String(100), default="Artificial Intelligence & Data Science")
    department = Column(String(50), nullable=False)
    other_department = Column(String(100), nullable=True)
    academic_year = Column(String(20), default="2026-27")
    admission_year = Column(Integer, default=2023)
    batch = Column(String(20), default="2023-2027")
    year = Column(Integer, default=3)
    section = Column(String(10), default="A")
    photo_url = Column(String(255), nullable=True)
    _photo_urls = Column("photo_urls", Text, nullable=True)  # JSON list of multiple angle photos
    _face_embedding = Column("face_embedding", Text, nullable=True)  # JSON list or list of lists (multi-angle 128D vectors)
    attendance_status = Column(String(20), default="ACTIVE")  # "ACTIVE", "FROZEN"
    is_frozen = Column(Boolean, default=False)
    frozen_at = Column(DateTime, nullable=True)
    unfrozen_at = Column(DateTime, nullable=True)
    freeze_reason = Column(String(255), nullable=True)
    freeze_until = Column(DateTime, nullable=True)  # Auto-unfreeze date (optional)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    enrolled_classes = relationship("ClassCourse", secondary=student_class_association, back_populates="students")
    attendance_records = relationship("AttendanceRecord", back_populates="student", cascade="all, delete-orphan")
    resolved_unknown_faces = relationship("UnknownFace", back_populates="assigned_student")
    freeze_logs = relationship("StudentFreezeLog", back_populates="student", cascade="all, delete-orphan", order_by="desc(StudentFreezeLog.created_at)")

    @property
    def photo_urls(self):
        if self._photo_urls:
            try:
                return json.loads(self._photo_urls)
            except Exception:
                return [self.photo_url] if self.photo_url else []
        return [self.photo_url] if self.photo_url else []

    @photo_urls.setter
    def photo_urls(self, value):
        if value is not None:
            self._photo_urls = json.dumps(value)
        else:
            self._photo_urls = None

    @property
    def face_embedding(self):
        if self._face_embedding:
            try:
                return json.loads(self._face_embedding)
            except Exception:
                return None
        return None

    @face_embedding.setter
    def face_embedding(self, value):
        if value is not None:
            self._face_embedding = json.dumps(value)
        else:
            self._face_embedding = None

    def to_dict(self, include_embedding=False):
        effective_att_status = "FROZEN" if (self.is_frozen or self.attendance_status == "FROZEN") else "ACTIVE"
        data = {
            "id": self.id,
            "roll_number": self.roll_number,
            "full_name": self.full_name,
            "email": self.email,
            "mobile_number": self.mobile_number,
            "dob": self.dob,
            "gender": self.gender,
            "address": self.address,
            "status": self.status or ("Active" if self.is_active else "Inactive"),
            "attendance_status": effective_att_status,
            "is_frozen": effective_att_status == "FROZEN",
            "frozen_at": format_iso_utc(self.frozen_at) if self.frozen_at else None,
            "unfrozen_at": format_iso_utc(self.unfrozen_at) if self.unfrozen_at else None,
            "freeze_reason": self.freeze_reason,
            "freeze_until": self.freeze_until.strftime("%Y-%m-%d") if self.freeze_until else None,
            "program": self.program,
            "other_program": self.other_program,
            "course": self.course,
            "semester": self.semester,
            "specialization": self.specialization,
            "department": self.department,
            "other_department": self.other_department,
            "academic_year": self.academic_year or "2026-27",
            "admission_year": self.admission_year or 2023,
            "batch": self.batch or "2023-2027",
            "year": self.year,
            "section": self.section,
            "photo_url": self.photo_url,
            "photo_urls": self.photo_urls,
            "photos_count": len(self.photo_urls),
            "has_face_embedding": bool(self._face_embedding),
            "is_active": self.is_active and (self.status == "Active" if self.status else True),
            "created_at": format_iso_utc(self.created_at),
            "enrolled_classes": [
                {
                    "id": c.id,
                    "code": c.code,
                    "name": c.name,
                    "program": c.program,
                    "section": c.section,
                    "start_date": c.start_date.isoformat() if getattr(c, "start_date", None) else None,
                    "academic_year": getattr(c, "academic_year", "2026-27"),
                    "status": "Active"
                } for c in self.enrolled_classes
            ] if self.enrolled_classes else [],
            "classes": [
                {
                    "id": c.id,
                    "code": c.code,
                    "name": c.name,
                    "program": c.program,
                    "section": c.section,
                    "start_date": c.start_date.isoformat() if getattr(c, "start_date", None) else None,
                    "academic_year": getattr(c, "academic_year", "2026-27"),
                    "status": "Active"
                } for c in self.enrolled_classes
            ] if self.enrolled_classes else []
        }
        if include_embedding:
            data["face_embedding"] = self.face_embedding
        return data

class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    session_name = Column(String(100), nullable=False)  # e.g., "Lecture 14 - Neural Networks"
    session_date = Column(Date, default=date.today, nullable=False)
    start_time = Column(String(10), nullable=True)  # e.g. "09:00 AM"
    end_time = Column(String(10), nullable=True)    # e.g. "10:30 AM"
    raw_photo_path = Column(String(255), nullable=True)
    _photo_paths = Column("photo_paths", Text, nullable=True)  # JSON list of multiple raw classroom photos
    processed_photo_path = Column(String(255), nullable=True)
    _processed_photo_paths = Column("processed_photo_paths", Text, nullable=True)  # JSON list of multiple annotated photos
    _extra_candidates = Column("extra_candidates", Text, nullable=True)  # JSON list of outside-roster extra lecture candidates
    total_detected = Column(Integer, default=0)
    total_recognized = Column(Integer, default=0)
    total_unknown = Column(Integer, default=0)
    status = Column(String(20), default="CONFIRMED")  # "CONFIRMED", "REVIEW_REQUIRED", "DISMISSED"
    notes = Column(Text, nullable=True)
    finalized_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    course = relationship("ClassCourse", back_populates="sessions")
    teacher = relationship("User", back_populates="sessions")
    attendance_records = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")
    unknown_faces = relationship("UnknownFace", back_populates="session", cascade="all, delete-orphan")

    @property
    def extra_candidates(self):
        if self._extra_candidates:
            try:
                return json.loads(self._extra_candidates)
            except Exception:
                return []
        return []

    @extra_candidates.setter
    def extra_candidates(self, value):
        if value is not None:
            self._extra_candidates = json.dumps(value)
        else:
            self._extra_candidates = None

    @property
    def photo_paths(self):
        if self._photo_paths:
            try:
                return json.loads(self._photo_paths)
            except Exception:
                return [self.raw_photo_path] if self.raw_photo_path else []
        return [self.raw_photo_path] if self.raw_photo_path else []

    @photo_paths.setter
    def photo_paths(self, value):
        if value is not None:
            self._photo_paths = json.dumps(value)
        else:
            self._photo_paths = None

    @property
    def processed_photo_paths(self):
        if self._processed_photo_paths:
            try:
                return json.loads(self._processed_photo_paths)
            except Exception:
                return [self.processed_photo_path] if self.processed_photo_path else []
        return [self.processed_photo_path] if self.processed_photo_path else []

    @processed_photo_paths.setter
    def processed_photo_paths(self, value):
        if value is not None:
            self._processed_photo_paths = json.dumps(value)
        else:
            self._processed_photo_paths = None

    def to_dict(self, include_records=False):
        # Scheduled timetable info (from course offering)
        scheduled_start = self.start_time or (self.course.start_time if self.course else None)
        scheduled_end = self.end_time or (self.course.end_time if self.course else None)

        # Actual attendance session event timestamps (Authoritative server timestamp)
        actual_time_iso = format_iso_utc(self.created_at)
        actual_time_ist = format_ist_time(self.created_at)
        actual_datetime_ist = format_ist_datetime(self.created_at)
        finalized_time_iso = format_iso_utc(self.finalized_at) if getattr(self, "finalized_at", None) else None

        data = {
            "id": self.id,
            "class_id": self.class_id,
            "class_code": self.course.code if self.course else "N/A",
            "class_name": self.course.name if self.course else "N/A",
            "department": self.course.department if self.course else "N/A",
            "program": getattr(self.course, "program", "B.Tech"),
            "semester": self.course.semester if self.course else "N/A",
            "section": self.course.section if self.course else "N/A",
            "teacher_id": self.teacher_id,
            "teacher_name": self.teacher.full_name if self.teacher else "Unassigned",
            "session_name": self.session_name,
            "session_date": self.session_date.isoformat() if self.session_date else None,
            "scheduled_start_time": scheduled_start,
            "scheduled_end_time": scheduled_end,
            "start_time": scheduled_start,
            "end_time": scheduled_end,
            "actual_time": actual_time_ist,
            "actual_datetime": actual_datetime_ist,
            "created_at": actual_time_iso,
            "finalized_at": finalized_time_iso,
            "raw_photo_path": self.raw_photo_path,
            "photo_paths": self.photo_paths,
            "processed_photo_path": self.processed_photo_path,
            "processed_photo_paths": self.processed_photo_paths,
            "extra_candidates": self.extra_candidates,
            "total_detected": self.total_detected,
            "total_recognized": self.total_recognized,
            "total_unknown": self.total_unknown,
            "status": self.status,
            "notes": self.notes
        }
        if include_records:
            data["records"] = [r.to_dict() for r in self.attendance_records]
            data["unknown_faces"] = [u.to_dict() for u in self.unknown_faces]
        return data

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="ABSENT", nullable=False)  # "PRESENT", "ABSENT", "LATE", "EXCUSED"
    confidence_score = Column(Float, default=0.0)  # 0.0 to 100.0%
    _detection_bbox = Column("detection_bbox", Text, nullable=True)  # JSON [top, right, bottom, left]
    verification_type = Column(String(30), default="AUTO_AI")  # "AUTO_AI", "MANUAL_OVERRIDE", "AUTO_ABSENT", "EXTRA_LECTURE"
    attendance_type = Column(String(30), default="REGULAR")  # "REGULAR", "EXTRA_LECTURE"
    is_extra_lecture = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    marked_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("AttendanceSession", back_populates="attendance_records")
    student = relationship("Student", back_populates="attendance_records")

    @property
    def detection_bbox(self):
        if self._detection_bbox:
            try:
                return json.loads(self._detection_bbox)
            except Exception:
                return None
        return None

    @detection_bbox.setter
    def detection_bbox(self, value):
        if value is not None:
            self._detection_bbox = json.dumps(value)
        else:
            self._detection_bbox = None

    def to_dict(self):
        photo_url = None
        if self.student:
            if getattr(self.student, "photo_url", None):
                photo_url = self.student.photo_url
            elif getattr(self.student, "photo_urls", None) and len(self.student.photo_urls) > 0:
                photo_url = self.student.photo_urls[0]

        is_extra = bool(self.is_extra_lecture or self.verification_type == "EXTRA_LECTURE" or self.attendance_type == "EXTRA_LECTURE")

        is_st_frozen = bool(self.status == "FROZEN" or self.verification_type == "FROZEN_STUDENT" or (self.student and (self.student.is_frozen or self.student.attendance_status == "FROZEN")))

        return {
            "id": self.id,
            "session_id": self.session_id,
            "student_id": self.student_id,
            "student_name": self.student.full_name if self.student else "Unknown",
            "roll_number": self.student.roll_number if self.student else "N/A",
            "program": getattr(self.student, "program", "B.Tech"),
            "semester": getattr(self.student, "semester", "Semester 7"),
            "section": getattr(self.student, "section", "A"),
            "department": getattr(self.student, "department", "Computer Science"),
            "student_photo_url": photo_url,
            "status": "FROZEN" if is_st_frozen else self.status,
            "is_frozen": is_st_frozen,
            "attendance_status": "FROZEN" if is_st_frozen else "ACTIVE",
            "freeze_reason": self.student.freeze_reason if (self.student and is_st_frozen) else None,
            "freeze_until": self.student.freeze_until.strftime("%Y-%m-%d") if (self.student and is_st_frozen and self.student.freeze_until) else None,
            "confidence_score": round(self.confidence_score, 2),
            "detection_bbox": self.detection_bbox,
            "verification_type": "FROZEN_STUDENT" if is_st_frozen else self.verification_type,
            "attendance_type": "EXTRA_LECTURE" if is_extra else "REGULAR",
            "is_extra_lecture": is_extra,
            "notes": self.notes,
            "marked_at": format_iso_utc(self.marked_at)
        }

class UnknownFace(Base):
    __tablename__ = "unknown_faces"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False)
    cropped_image_path = Column(String(255), nullable=False)
    _bbox = Column("bbox", Text, nullable=False)  # JSON [top, right, bottom, left]
    confidence_score = Column(Float, default=0.0)  # Best match confidence if any, or 0.0
    status = Column(String(20), default="PENDING")  # "PENDING", "RESOLVED", "DISMISSED"
    assigned_student_id = Column(Integer, ForeignKey("students.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("AttendanceSession", back_populates="unknown_faces")
    assigned_student = relationship("Student", back_populates="resolved_unknown_faces")

    @property
    def bbox(self):
        if self._bbox:
            try:
                return json.loads(self._bbox)
            except Exception:
                return None
        return None

    @bbox.setter
    def bbox(self, value):
        if value is not None:
            self._bbox = json.dumps(value)
        else:
            self._bbox = None

    def to_dict(self):
        photo_url = None
        if self.cropped_image_path:
            import os
            norm_path = str(self.cropped_image_path).replace("\\", "/")
            photo_url = f"/uploads/unknown_faces/{os.path.basename(norm_path)}"

        return {
            "id": self.id,
            "session_id": self.session_id,
            "session_name": self.session.session_name if self.session else "N/A",
            "cropped_image_path": self.cropped_image_path,
            "photo_url": photo_url,
            "crop_image_path": photo_url,
            "bbox": self.bbox,
            "confidence_score": round(self.confidence_score, 2),
            "status": self.status,
            "assigned_student_id": self.assigned_student_id,
            "assigned_student_name": self.assigned_student.full_name if self.assigned_student else None,
            "created_at": format_iso_utc(self.created_at)
        }

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    actor_name = Column(String(100), nullable=True)
    actor_role = Column(String(50), nullable=True)
    action = Column(String(100), nullable=False)  # e.g., "GRANTED_PERMISSION", "REVOKED_PERMISSION", "MANUAL_ATTENDANCE_OVERRIDE"
    entity = Column(String(50), nullable=False)   # e.g., "User", "AttendanceRecord", "Student", "ClassCourse"
    entity_id = Column(Integer, nullable=True)
    target_user_id = Column(Integer, nullable=True)
    target_name = Column(String(100), nullable=True)
    permission_key = Column(String(100), nullable=True)
    scope_json = Column(Text, nullable=True)
    previous_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    result = Column(String(20), default="SUCCESS")  # "SUCCESS", "DENIED", "FAILED"
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        scope = {}
        if self.scope_json:
            try:
                scope = json.loads(self.scope_json)
            except Exception:
                scope = {}
        return {
            "id": self.id,
            "user_id": self.user_id,
            "actor_name": self.actor_name or "System Administrator",
            "actor_role": self.actor_role or "admin",
            "action": self.action,
            "entity": self.entity,
            "entity_id": self.entity_id,
            "target_user_id": self.target_user_id,
            "target_name": self.target_name,
            "permission_key": self.permission_key,
            "scope": scope,
            "previous_value": self.previous_value,
            "new_value": self.new_value,
            "result": self.result,
            "details": self.details,
            "timestamp": format_iso_utc(self.timestamp)
        }


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notification_type = Column(String(50), nullable=False, index=True)
    priority = Column(String(20), default="INFO")  # "INFO", "SUCCESS", "WARNING", "CRITICAL"
    category = Column(String(50), default="Assignments")  # "Assignments", "Attendance", "System", "Security", "Administrative"
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    entity_type = Column(String(50), nullable=True)  # "ClassCourse", "User", "AttendanceSession", "UnknownFace"
    entity_id = Column(Integer, nullable=True)
    action_view = Column(String(50), nullable=True)  # e.g., "classes", "review", "unknown_faces", "profile"
    action_params = Column(Text, nullable=True)  # JSON string of parameters
    details_json = Column(Text, nullable=True)  # JSON string of structured details
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    recipient = relationship("User", foreign_keys=[recipient_user_id])
    actor = relationship("User", foreign_keys=[actor_user_id])

    def to_dict(self):
        details = {}
        if self.details_json:
            try:
                details = json.loads(self.details_json)
            except Exception:
                details = {}

        params = {}
        if self.action_params:
            try:
                params = json.loads(self.action_params)
            except Exception:
                params = {}

        return {
            "id": self.id,
            "recipient_user_id": self.recipient_user_id,
            "recipient_name": self.recipient.full_name if self.recipient else None,
            "actor_user_id": self.actor_user_id,
            "actor_name": self.actor.full_name if self.actor else "System Administrator",
            "notification_type": self.notification_type,
            "priority": self.priority,
            "category": self.category,
            "title": self.title,
            "message": self.message,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "action_view": self.action_view,
            "action_params": params,
            "details": details,
            "is_read": self.is_read,
            "read_at": format_iso_utc(self.read_at),
            "created_at": format_iso_utc(self.created_at)
        }

class AcademicDepartment(Base):
    __tablename__ = "academic_departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "is_active": self.is_active
        }

class AcademicProgram(Base):
    __tablename__ = "academic_programs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    department_id = Column(Integer, ForeignKey("academic_departments.id", ondelete="SET NULL"), nullable=True)
    duration_years = Column(Integer, default=4)
    total_semesters = Column(Integer, default=8)
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "department_id": self.department_id,
            "duration_years": self.duration_years,
            "total_semesters": self.total_semesters,
            "is_active": self.is_active
        }

class AcademicYear(Base):
    __tablename__ = "academic_years"

    id = Column(Integer, primary_key=True, index=True)
    year_code = Column(String(20), unique=True, nullable=False)  # e.g., "2026-27"
    is_current = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "year_code": self.year_code,
            "is_current": self.is_current
        }

class CourseMaster(Base):
    __tablename__ = "course_masters"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, index=True, nullable=False)  # e.g. "520", "CS-301"
    title = Column(String(100), nullable=False)  # e.g. "MongoDB", "Computer Vision"
    subject_name = Column(String(100), nullable=True)
    credits = Column(Integer, default=4)
    description = Column(Text, nullable=True)
    department = Column(String(50), nullable=True)
    status = Column(String(20), default="Active")  # "Active", "Archived"

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "title": self.title,
            "subject_name": self.subject_name or self.title,
            "credits": self.credits,
            "description": self.description,
            "department": self.department,
            "status": self.status
        }

class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, index=True, nullable=False)
    value = Column(Text, nullable=False)
    label = Column(String(100), nullable=True)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    updated_by = relationship("User", foreign_keys=[updated_by_user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "key": self.key,
            "value": self.value,
            "label": self.label,
            "description": self.description,
            "updated_at": format_iso_utc(self.updated_at),
            "updated_by": self.updated_by.full_name if self.updated_by else "System Administrator"
        }

class StudentFreezeLog(Base):
    __tablename__ = "student_freeze_logs"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(20), nullable=False)  # "FREEZE", "UNFREEZE"
    reason = Column(String(255), nullable=True)
    action_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    frozen_at = Column(DateTime, nullable=True)
    unfrozen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    student = relationship("Student", back_populates="freeze_logs")
    action_by = relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "action": self.action,
            "reason": self.reason,
            "action_by_id": self.action_by_user_id,
            "action_by_name": self.action_by.full_name if self.action_by else "System Administrator",
            "frozen_at": format_iso_utc(self.frozen_at) if self.frozen_at else None,
            "unfrozen_at": format_iso_utc(self.unfrozen_at) if self.unfrozen_at else None,
            "created_at": format_iso_utc(self.created_at)
        }

class EmailSetting(Base):
    __tablename__ = "email_settings"

    id = Column(Integer, primary_key=True, index=True)
    smtp_host = Column(String(120), default="smtp.gmail.com")
    smtp_port = Column(Integer, default=587)
    smtp_user = Column(String(120), default="")
    smtp_password = Column(String(255), default="")
    smtp_from_name = Column(String(120), default="VisionAttend AI Attendance Portal")
    smtp_from_email = Column(String(120), default="")
    smtp_use_tls = Column(Boolean, default=True)
    smtp_use_ssl = Column(Boolean, default=False)
    is_email_enabled = Column(Boolean, default=True)
    auto_monthly_dispatch = Column(Boolean, default=False)
    monthly_dispatch_day = Column(Integer, default=30)  # 28-31 or last day
    monthly_dispatch_hour = Column(Integer, default=18)  # 18:00 IST
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        # Mask password for secure UI display
        has_pwd = bool(self.smtp_password and len(self.smtp_password.strip()) > 0)
        return {
            "id": self.id,
            "smtp_host": self.smtp_host,
            "smtp_port": self.smtp_port,
            "smtp_user": self.smtp_user,
            "has_password": has_pwd,
            "smtp_from_name": self.smtp_from_name,
            "smtp_from_email": self.smtp_from_email or self.smtp_user,
            "smtp_use_tls": self.smtp_use_tls,
            "smtp_use_ssl": self.smtp_use_ssl,
            "is_email_enabled": self.is_email_enabled,
            "auto_monthly_dispatch": self.auto_monthly_dispatch,
            "monthly_dispatch_day": self.monthly_dispatch_day,
            "monthly_dispatch_hour": self.monthly_dispatch_hour,
            "updated_at": format_iso_utc(self.updated_at)
        }

class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=True)
    recipient_name = Column(String(120), nullable=True)
    recipient_email = Column(String(120), nullable=False)
    subject = Column(String(255), nullable=False)
    report_type = Column(String(50), default="MONTHLY")  # "MONTHLY", "QUARTERLY", "TEST"
    period_label = Column(String(50), nullable=True)  # e.g. "August 2026" or "Q3 2026"
    status = Column(String(20), default="SUCCESS")  # "SUCCESS", "FAILED"
    error_message = Column(Text, nullable=True)
    has_attachment = Column(Boolean, default=True)
    sent_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    student = relationship("Student")

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "recipient_name": self.recipient_name or (self.student.full_name if self.student else "Student"),
            "roll_number": self.student.roll_number if self.student else "N/A",
            "recipient_email": self.recipient_email,
            "subject": self.subject,
            "report_type": self.report_type,
            "period_label": self.period_label,
            "status": self.status,
            "error_message": self.error_message,
            "has_attachment": self.has_attachment,
            "sent_at": format_iso_utc(self.sent_at)
        }



