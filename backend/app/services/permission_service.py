import json
from datetime import datetime
from typing import List, Dict, Optional, Any, Tuple
from sqlalchemy.orm import Session

from backend.app.db.models import (
    User, Role, Permission, UserPermissionOverride, UserAcademicScope,
    PermissionRequest, AuditLog, Notification, ClassCourse, Student
)
from backend.app.core.datetime_utils import format_iso_utc

# All standard institutional permission definitions
ALL_PERMISSIONS = [
    # 1. Student Management
    {"key": "student.view", "category": "Student Management", "name": "View Students", "description": "View enrolled student profiles and directory", "is_sensitive": False},
    {"key": "student.create", "category": "Student Management", "name": "Add Student", "description": "Register and enroll new students into curriculum", "is_sensitive": False},
    {"key": "student.edit", "category": "Student Management", "name": "Edit Student", "description": "Modify student academic context, roll number, and contact details", "is_sensitive": False},
    {"key": "student.deactivate", "category": "Student Management", "name": "Deactivate Student", "description": "Deactivate student access while preserving historical attendance", "is_sensitive": True},
    {"key": "student.delete", "category": "Student Management", "name": "Delete Student", "description": "Permanently remove a student record from database", "is_sensitive": True},
    {"key": "student.import", "category": "Student Management", "name": "Import Students", "description": "Bulk import students from CSV / Excel spreadsheets", "is_sensitive": False},
    {"key": "student.export", "category": "Student Management", "name": "Export Students", "description": "Export student rosters to CSV or spreadsheet files", "is_sensitive": False},
    {"key": "student.upload_photos", "category": "Student Management", "name": "Upload Photos", "description": "Upload reference multi-angle face photos for students", "is_sensitive": False},
    {"key": "student.edit_biometric", "category": "Student Management", "name": "Replace Biometrics", "description": "Regenerate and replace 512-D ArcFace facial embeddings", "is_sensitive": True},
    {"key": "student.enroll_biometric", "category": "Student Management", "name": "Enroll Biometrics", "description": "Perform initial multi-angle biometric feature extraction", "is_sensitive": True},

    # 2. Faculty Management
    {"key": "faculty.view", "category": "Faculty Management", "name": "View Faculty", "description": "View institutional faculty members and instructors", "is_sensitive": False},
    {"key": "faculty.create", "category": "Faculty Management", "name": "Add Faculty", "description": "Create new instructor and faculty accounts", "is_sensitive": True},
    {"key": "faculty.edit", "category": "Faculty Management", "name": "Edit Faculty", "description": "Update faculty contact, department, and teaching assignments", "is_sensitive": False},
    {"key": "faculty.deactivate", "category": "Faculty Management", "name": "Deactivate Faculty", "description": "Suspend or deactivate faculty account access", "is_sensitive": True},
    {"key": "faculty.delete", "category": "Faculty Management", "name": "Delete Faculty", "description": "Permanently delete faculty account from institutional database", "is_sensitive": True},
    {"key": "faculty.assign_courses", "category": "Faculty Management", "name": "Assign Courses", "description": "Assign primary and co-faculty instructors to course offerings", "is_sensitive": False},
    {"key": "faculty.manage_permissions", "category": "Faculty Management", "name": "Manage Permissions", "description": "Grant or revoke authority and granular permissions for faculty", "is_sensitive": True},
    {"key": "faculty.manage_biometric", "category": "Faculty Management", "name": "Faculty Biometrics", "description": "Configure faculty face recognition and biometric verification", "is_sensitive": False},

    # 3. Course Management
    {"key": "course.view", "category": "Course Management", "name": "View Courses", "description": "View master curricula catalog and course offerings", "is_sensitive": False},
    {"key": "course.create", "category": "Course Management", "name": "Create Course", "description": "Define master curriculum subjects and create course sections", "is_sensitive": True},
    {"key": "course.edit", "category": "Course Management", "name": "Edit Course", "description": "Update course offering parameters, schedule, and room allocation", "is_sensitive": False},
    {"key": "course.delete", "category": "Course Management", "name": "Delete Course", "description": "Remove or archive course offerings and curricula records", "is_sensitive": True},
    {"key": "course.assign_faculty", "category": "Course Management", "name": "Assign Instructors", "description": "Allocate instructors to specific course offering sections", "is_sensitive": False},
    {"key": "course.assign_students", "category": "Course Management", "name": "Manage Roster", "description": "Enroll or unenroll students from course offering rosters", "is_sensitive": False},
    {"key": "course.create_custom", "category": "Course Management", "name": "Create Custom Course", "description": "Create on-the-fly custom seminar or workshop course in scanner", "is_sensitive": False},

    # 4. Attendance Operations
    {"key": "attendance.view", "category": "Attendance", "name": "View Attendance", "description": "Inspect classroom attendance sessions and lecture logs", "is_sensitive": False},
    {"key": "attendance.take", "category": "Attendance", "name": "Take Attendance", "description": "Launch AI scanner and capture panoramic attendance snapshots", "is_sensitive": False},
    {"key": "attendance.manual_override", "category": "Attendance", "name": "Manual Override", "description": "Manually flip individual student attendance between Present and Absent", "is_sensitive": False},
    {"key": "attendance.mark_absent", "category": "Attendance", "name": "Mark Absent", "description": "Explicitly mark students as absent in session inspector", "is_sensitive": False},
    {"key": "attendance.recapture", "category": "Attendance", "name": "Recapture Camera", "description": "Recapture or resubmit classroom frame for AI processing", "is_sensitive": False},
    {"key": "attendance.finalize", "category": "Attendance", "name": "Finalize Attendance", "description": "Lock and finalize verified attendance session into official transcript", "is_sensitive": False},
    {"key": "attendance.edit", "category": "Attendance", "name": "Edit Past Records", "description": "Modify historical attendance records post-finalization", "is_sensitive": True},

    # 5. Unknown Faces Resolution Queue
    {"key": "unknown_face.view", "category": "Unknown Faces", "name": "View Unknown Queue", "description": "Inspect unrecognized face crops detected by YOLO", "is_sensitive": False},
    {"key": "unknown_face.review", "category": "Unknown Faces", "name": "Review Faces", "description": "Inspect AI bounding boxes and confidence scores of unknown detections", "is_sensitive": False},
    {"key": "unknown_face.link_existing_student", "category": "Unknown Faces", "name": "Tag Student", "description": "Match and tag an unknown crop to an existing registered student", "is_sensitive": False},
    {"key": "unknown_face.enroll_new_student", "category": "Unknown Faces", "name": "Enroll New Student", "description": "Create brand new student record directly from unknown face crop", "is_sensitive": True},
    {"key": "unknown_face.dismiss", "category": "Unknown Faces", "name": "Dismiss Detection", "description": "Dismiss false positive or irrelevant background face crop", "is_sensitive": False},

    # 6. Extra Lectures & Bunk Mitigation
    {"key": "extra_lecture.view", "category": "Extra Lectures", "name": "View Extra Lectures", "description": "View extra lecture requests and defaulter mitigation logs", "is_sensitive": False},
    {"key": "extra_lecture.create", "category": "Extra Lectures", "name": "Create Extra Lecture", "description": "Conduct compensatory extra lectures for academic credits", "is_sensitive": False},
    {"key": "extra_lecture.approve", "category": "Extra Lectures", "name": "Approve Credit", "description": "Authorize and credit extra lecture attendance to defaulters", "is_sensitive": True},
    {"key": "extra_lecture.reject", "category": "Extra Lectures", "name": "Reject Credit", "description": "Reject extra lecture mitigation claim with justification notes", "is_sensitive": False},
    {"key": "extra_lecture.credit", "category": "Extra Lectures", "name": "Credit Attendance", "description": "Apply attendance credit directly to student eligibility dossier", "is_sensitive": True},

    # 7. Reports & Official Dossiers
    {"key": "report.view", "category": "Reports", "name": "View Reports", "description": "View course analytics and defaulter thresholds (<75%)", "is_sensitive": False},
    {"key": "report.export_excel", "category": "Reports", "name": "Export Excel", "description": "Generate and download multi-tab Excel attendance rosters", "is_sensitive": False},
    {"key": "report.download_pdf", "category": "Reports", "name": "Download PDF", "description": "Generate official institutional attendance certificates & PDF dossiers", "is_sensitive": False},
    {"key": "report.print", "category": "Reports", "name": "Print Roster", "description": "Print official classroom attendance sheets and reports", "is_sensitive": False},

    # 8. System & Governance
    {"key": "dashboard.view", "category": "System", "name": "View Dashboard", "description": "Access institutional intelligence telemetry dashboard", "is_sensitive": False},
    {"key": "notification.view", "category": "System", "name": "View Notifications", "description": "View real-time institutional and authority alerts", "is_sensitive": False},
    {"key": "notification.manage", "category": "System", "name": "Manage Notifications", "description": "Mark notifications as read or clear notification inbox", "is_sensitive": False},
    {"key": "settings.view", "category": "System", "name": "View Settings", "description": "Inspect institutional AI and database parameters", "is_sensitive": False},
    {"key": "settings.manage", "category": "System", "name": "Manage Settings", "description": "Configure ArcFace threshold, liveness sensitivity, and lock policies", "is_sensitive": True},
    {"key": "permissions.manage", "category": "System", "name": "Authority & Permissions", "description": "Access and manage authority, roles, academic scopes, and approval rules", "is_sensitive": True},
    {"key": "audit_log.view", "category": "System", "name": "View Audit Trail", "description": "Inspect immutable institutional security and authority audit trail", "is_sensitive": True},
]

# Default permissions allocated to Faculty / Teacher role
FACULTY_DEFAULT_PERMISSIONS = {
    "dashboard.view",
    "notification.view",
    "notification.manage",
    "attendance.view",
    "attendance.take",
    "attendance.manual_override",
    "attendance.mark_absent",
    "attendance.recapture",
    "attendance.finalize",
    "student.view",
    "student.create",
    "student.edit",
    "student.upload_photos",
    "course.view",
    "unknown_face.view",
    "unknown_face.review",
    "unknown_face.link_existing_student",
    "extra_lecture.view",
    "extra_lecture.create",
    "report.view",
    "report.download_pdf",
    "report.export_excel",
    "report.print",
}

class PermissionService:
    """
    Production-grade Authority, Role, Permission & Academic Scope Engine for VisionAttend.
    Evaluates:
      Precedence: Explicit DENY > Explicit ALLOW > Role Default > System Default (False).
      Super Administrator unconditionally bypasses all permission restrictions.
    """

    def seed_default_roles_and_permissions(self, db: Session):
        """
        Seeds standard permissions, roles, and default mappings in an idempotent manner.
        """
        # 1. Seed / Update Permissions
        perm_map = {}
        for pdata in ALL_PERMISSIONS:
            perm = db.query(Permission).filter(Permission.key == pdata["key"]).first()
            if not perm:
                perm = Permission(
                    key=pdata["key"],
                    category=pdata["category"],
                    name=pdata["name"],
                    description=pdata["description"],
                    is_sensitive=pdata["is_sensitive"]
                )
                db.add(perm)
                db.flush()
            else:
                perm.category = pdata["category"]
                perm.name = pdata["name"]
                perm.description = pdata["description"]
                perm.is_sensitive = pdata["is_sensitive"]
            perm_map[perm.key] = perm

        # 2. Seed Roles (Super Administrator, Administrator, Faculty)
        super_admin_role = db.query(Role).filter(Role.name == "super_admin").first()
        if not super_admin_role:
            super_admin_role = Role(
                name="super_admin",
                display_name="Super Administrator",
                description="Full unconditional access across all institutional settings and permissions.",
                is_system=True,
                is_active=True
            )
            db.add(super_admin_role)
            db.flush()

        admin_role = db.query(Role).filter(Role.name == "admin").first()
        if not admin_role:
            admin_role = Role(
                name="admin",
                display_name="Administrator",
                description="Institutional administration with full operational and academic authority.",
                is_system=True,
                is_active=True
            )
            db.add(admin_role)
            db.flush()

        faculty_role = db.query(Role).filter((Role.name == "faculty") | (Role.name == "teacher")).first()
        if not faculty_role:
            faculty_role = Role(
                name="faculty",
                display_name="Faculty",
                description="Course faculty and teaching staff with attendance and academic scope authority.",
                is_system=True,
                is_active=True
            )
            db.add(faculty_role)
            db.flush()

        # 3. Associate Permissions with Roles
        # Admin (Root Institutional Administrator) gets all permissions including permissions.manage
        admin_role.permissions = list(perm_map.values())
        # Super Admin gets all operational permissions EXCEPT permissions.manage (Authority & Permissions Matrix)
        super_admin_role.permissions = [p for k, p in perm_map.items() if k != "permissions.manage"]
        # Faculty gets default faculty permissions
        faculty_perms = [p for k, p in perm_map.items() if k in FACULTY_DEFAULT_PERMISSIONS]
        faculty_role.permissions = faculty_perms

        # 4. Map existing users to role objects
        users = db.query(User).all()
        for u in users:
            if u.role in ("super_admin", "superadmin"):
                u.role_id = super_admin_role.id
            elif u.role == "admin":
                u.role_id = admin_role.id
            else:
                u.role_id = faculty_role.id
            
            if not u.status:
                u.status = "Active" if u.is_active else "Deactivated"

        db.commit()

    def is_super_admin(self, user: User) -> bool:
        """Returns true if user is a Super Administrator."""
        if not user or not user.is_active or user.status == "Deactivated":
            return False
        return str(user.role).lower() in ("super_admin", "superadmin")

    def is_admin(self, user: User) -> bool:
        """Returns true if user is the primary Institutional Administrator."""
        if not user or not user.is_active or user.status == "Deactivated":
            return False
        return str(user.role).lower() == "admin"

    def has_permission(
        self,
        db: Session,
        user: User,
        permission_key: str,
        scope: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Core authorization check:
        1. Check user account active status.
        2. Institutional Administrator (admin) -> True (Full Unconditional Bypass).
        3. Super Administrator (super_admin) -> True for all operational permissions (Except permissions.manage).
        4. Check User Explicit Overrides (DENY > ALLOW).
        5. Check Role Default Permissions.
        6. If permission is granted, evaluate Academic Scope constraints if scope is provided.
        """
        if not user or not user.is_active or user.status in ("Suspended", "Deactivated"):
            return False

        # Institutional Administrator has unconditional full access to everything
        if self.is_admin(user):
            return True

        # Super Administrator has full access to operational permissions, but NO access to permissions.manage
        if self.is_super_admin(user):
            if permission_key == "permissions.manage":
                return False
            return True

        # Check user explicit permission overrides
        overrides = db.query(UserPermissionOverride).filter(
            UserPermissionOverride.user_id == user.id,
            UserPermissionOverride.permission_key == permission_key
        ).all()

        now = datetime.utcnow()
        active_overrides = []
        for ov in overrides:
            if ov.valid_from and ov.valid_from > now:
                continue
            if ov.valid_until and ov.valid_until < now:
                continue
            active_overrides.append(ov)

        # Explicit DENY has highest precedence
        if any(ov.effect == "DENY" for ov in active_overrides):
            return False

        has_explicit_allow = any(ov.effect == "ALLOW" for ov in active_overrides)
        has_role_permission = False

        if not has_explicit_allow:
            # Check user role permissions
            role = user.role_rel
            if not role and user.role:
                role = db.query(Role).filter((Role.name == user.role) | (Role.id == user.role_id)).first()

            if role and role.is_active:
                has_role_permission = any(p.key == permission_key for p in role.permissions)
            elif user.role == "admin":
                has_role_permission = True
            elif user.role in ("teacher", "faculty") and permission_key in FACULTY_DEFAULT_PERMISSIONS:
                has_role_permission = True

        if not (has_explicit_allow or has_role_permission):
            return False

        # If granted, check academic scope if scope context was provided
        if scope:
            return self.check_academic_scope(db, user, permission_key, scope)

        return True

    def check_academic_scope(
        self,
        db: Session,
        user: User,
        permission_key: str,
        scope: Dict[str, Any]
    ) -> bool:
        """
        Evaluates user's assigned academic scopes.
        If user has NO specific scopes assigned, they have unconstrained access within their permission.
        If user has 1+ scopes assigned, the target action MUST match AT LEAST ONE assigned scope.
        """
        if self.is_super_admin(user):
            return True

        user_scopes = db.query(UserAcademicScope).filter(
            UserAcademicScope.user_id == user.id
        ).all()

        # Filter out expired scopes
        now = datetime.utcnow()
        active_scopes = [
            s for s in user_scopes
            if (not s.valid_from or s.valid_from <= now) and (not s.valid_until or s.valid_until >= now)
        ]

        if not active_scopes:
            # No scope restrictions applied -> Unconstrained within permission
            return True

        target_dept = (scope.get("department") or "").strip().lower()
        target_prog = (scope.get("program") or "").strip().lower()
        target_sem = (scope.get("semester") or "").strip().lower().replace("semester", "").strip()
        target_div = (scope.get("division") or scope.get("section") or "").strip().upper()
        target_class_id = scope.get("class_id")

        for s in active_scopes:
            # Scope permission check
            if s.permission_key != "ALL" and s.permission_key != permission_key:
                continue

            # Class ID exact match check
            if s.class_id and target_class_id and s.class_id == target_class_id:
                return True

            # Department match
            dept_match = (
                s.department == "ALL" or not target_dept or
                s.department.lower() in target_dept or target_dept in s.department.lower()
            )

            # Program match
            prog_match = (
                s.program == "ALL" or not target_prog or
                s.program.lower() == target_prog or s.program.lower() in target_prog
            )

            # Semester match
            sem_clean = s.semester.lower().replace("semester", "").strip()
            sem_match = (
                s.semester == "ALL" or not target_sem or
                sem_clean == target_sem or s.semester.lower() == target_sem
            )

            # Division match
            div_match = (
                s.division == "ALL" or not target_div or
                s.division.upper() == target_div
            )

            if dept_match and prog_match and sem_match and div_match:
                return True

        return False

    def get_user_effective_permissions(self, db: Session, user: User) -> Dict[str, Any]:
        """
        Returns full breakdown of user's effective permissions, explicit overrides,
        and active academic scopes for UI and client-side authorization state.
        """
        is_super = self.is_super_admin(user)
        all_perms = db.query(Permission).all()

        overrides = db.query(UserPermissionOverride).filter(
            UserPermissionOverride.user_id == user.id
        ).all()

        now = datetime.utcnow()
        override_map = {}
        for ov in overrides:
            if (not ov.valid_from or ov.valid_from <= now) and (not ov.valid_until or ov.valid_until >= now):
                override_map[ov.permission_key] = ov.effect

        role = user.role_rel
        if not role and user.role:
            role = db.query(Role).filter((Role.name == user.role) | (Role.id == user.role_id)).first()

        role_perms = set(p.key for p in role.permissions) if role else set()
        if not role and user.role == "admin":
            role_perms = set(p.key for p in all_perms)
        elif not role and user.role in ("teacher", "faculty"):
            role_perms = set(FACULTY_DEFAULT_PERMISSIONS)

        is_admin_user = self.is_admin(user)
        is_super = self.is_super_admin(user)

        effective = {}
        for p in all_perms:
            if is_admin_user:
                effective[p.key] = True
            elif is_super:
                effective[p.key] = (p.key != "permissions.manage")
            elif p.key in override_map:
                effective[p.key] = (override_map[p.key] == "ALLOW")
            elif p.key in role_perms:
                effective[p.key] = True
            else:
                effective[p.key] = False

        scopes = db.query(UserAcademicScope).filter(
            UserAcademicScope.user_id == user.id
        ).all()

        return {
            "user_id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "role_display": "Super Administrator" if is_super else ("Administrator" if user.role == "admin" else "Faculty"),
            "status": user.status or ("Active" if user.is_active else "Deactivated"),
            "is_super_admin": is_super,
            "effective_permissions": effective,
            "granted_keys": [k for k, v in effective.items() if v],
            "overrides": [ov.to_dict() for ov in overrides],
            "academic_scopes": [s.to_dict() for s in scopes]
        }

    def grant_user_permission(
        self,
        db: Session,
        user_id: int,
        permission_key: str,
        actor: User,
        valid_from: Optional[datetime] = None,
        valid_until: Optional[datetime] = None,
        effect: str = "ALLOW"
    ) -> UserPermissionOverride:
        """
        Grants explicit permission override to a specific user and dispatches audit + notification.
        """
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise ValueError(f"User #{user_id} not found.")

        # Update or create override
        override = db.query(UserPermissionOverride).filter(
            UserPermissionOverride.user_id == user_id,
            UserPermissionOverride.permission_key == permission_key
        ).first()

        prev_val = override.effect if override else "NONE"

        if not override:
            override = UserPermissionOverride(
                user_id=user_id,
                permission_key=permission_key,
                effect=effect,
                valid_from=valid_from,
                valid_until=valid_until,
                granted_by_user_id=actor.id if actor else None
            )
            db.add(override)
        else:
            override.effect = effect
            override.valid_from = valid_from
            override.valid_until = valid_until
            override.granted_by_user_id = actor.id if actor else None

        # Log Audit Record
        audit = AuditLog(
            user_id=actor.id if actor else None,
            actor_name=actor.full_name if actor else "System Administrator",
            actor_role=actor.role if actor else "admin",
            action="GRANTED_PERMISSION" if effect == "ALLOW" else "DENIED_PERMISSION",
            entity="UserPermissionOverride",
            entity_id=user_id,
            target_user_id=user_id,
            target_name=target_user.full_name,
            permission_key=permission_key,
            previous_value=prev_val,
            new_value=effect,
            result="SUCCESS",
            details=f"{'Granted' if effect == 'ALLOW' else 'Explicitly denied'} permission '{permission_key}' to {target_user.full_name}."
        )
        db.add(audit)

        # Dispatch Notification to target user
        notif = Notification(
            recipient_user_id=user_id,
            actor_user_id=actor.id if actor else None,
            notification_type="PERMISSION_GRANTED" if effect == "ALLOW" else "PERMISSION_RESTRICTED",
            priority="INFO",
            category="Security",
            title="Authority & Permission Updated",
            message=f"You have been {'granted' if effect == 'ALLOW' else 'restricted from'} permission: {permission_key.replace('_', ' ').title()} by {actor.full_name if actor else 'Administrator'}.",
            entity_type="User",
            entity_id=user_id,
            action_view="profile"
        )
        db.add(notif)
        db.commit()
        db.refresh(override)
        return override

    def revoke_user_permission(
        self,
        db: Session,
        user_id: int,
        permission_key: str,
        actor: User
    ) -> bool:
        """
        Revokes explicit permission override from a user.
        """
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise ValueError(f"User #{user_id} not found.")

        # Self-permission removal protection for permissions.manage
        if actor and actor.id == user_id and permission_key == "permissions.manage":
            admin_count = db.query(User).filter(
                (User.role.in_(["admin", "super_admin", "superadmin"])),
                User.is_active == True,
                User.status == "Active"
            ).count()
            if admin_count <= 1:
                raise ValueError("Cannot revoke 'permissions.manage' from yourself as you are the sole active Administrator.")

        override = db.query(UserPermissionOverride).filter(
            UserPermissionOverride.user_id == user_id,
            UserPermissionOverride.permission_key == permission_key
        ).first()

        if override:
            db.delete(override)

            audit = AuditLog(
                user_id=actor.id if actor else None,
                actor_name=actor.full_name if actor else "System Administrator",
                actor_role=actor.role if actor else "admin",
                action="REVOKED_PERMISSION",
                entity="UserPermissionOverride",
                entity_id=user_id,
                target_user_id=user_id,
                target_name=target_user.full_name,
                permission_key=permission_key,
                previous_value=override.effect,
                new_value="DEFAULT",
                result="SUCCESS",
                details=f"Revoked permission override '{permission_key}' from {target_user.full_name}."
            )
            db.add(audit)

            notif = Notification(
                recipient_user_id=user_id,
                actor_user_id=actor.id if actor else None,
                notification_type="PERMISSION_REVOKED",
                priority="WARNING",
                category="Security",
                title="Permission Override Revoked",
                message=f"Your explicit permission '{permission_key}' was removed by {actor.full_name if actor else 'Administrator'}.",
                entity_type="User",
                entity_id=user_id,
                action_view="profile"
            )
            db.add(notif)
            db.commit()
            return True
        return False

    def add_user_scope(
        self,
        db: Session,
        user_id: int,
        scope_data: Dict[str, Any],
        actor: User
    ) -> UserAcademicScope:
        """
        Assigns an academic scope to a user and logs audit record.
        """
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise ValueError(f"User #{user_id} not found.")

        scope = UserAcademicScope(
            user_id=user_id,
            permission_key=scope_data.get("permission_key", "ALL"),
            department=scope_data.get("department", "ALL"),
            program=scope_data.get("program", "ALL"),
            semester=scope_data.get("semester", "ALL"),
            division=scope_data.get("division", "ALL"),
            class_id=scope_data.get("class_id"),
            valid_from=scope_data.get("valid_from"),
            valid_until=scope_data.get("valid_until")
        )
        db.add(scope)

        scope_summary = f"{scope.department} • {scope.program} • {scope.semester} • Div {scope.division}"

        audit = AuditLog(
            user_id=actor.id if actor else None,
            actor_name=actor.full_name if actor else "System Administrator",
            actor_role=actor.role if actor else "admin",
            action="ADDED_ACADEMIC_SCOPE",
            entity="UserAcademicScope",
            entity_id=user_id,
            target_user_id=user_id,
            target_name=target_user.full_name,
            scope_json=json.dumps(scope_data),
            result="SUCCESS",
            details=f"Assigned academic scope [{scope_summary}] to {target_user.full_name}."
        )
        db.add(audit)

        notif = Notification(
            recipient_user_id=user_id,
            actor_user_id=actor.id if actor else None,
            notification_type="ACADEMIC_SCOPE_ADDED",
            priority="INFO",
            category="Assignments",
            title="Academic Scope Assigned",
            message=f"Your authorized academic scope has been updated to include: {scope_summary}.",
            entity_type="User",
            entity_id=user_id,
            action_view="profile"
        )
        db.add(notif)
        db.commit()
        db.refresh(scope)
        return scope

    def remove_user_scope(self, db: Session, scope_id: int, actor: User) -> bool:
        """
        Removes an academic scope from a user.
        """
        scope = db.query(UserAcademicScope).filter(UserAcademicScope.id == scope_id).first()
        if not scope:
            return False

        target_user = db.query(User).filter(User.id == scope.user_id).first()
        scope_summary = f"{scope.department} • {scope.program} • {scope.semester} • Div {scope.division}"

        audit = AuditLog(
            user_id=actor.id if actor else None,
            actor_name=actor.full_name if actor else "System Administrator",
            actor_role=actor.role if actor else "admin",
            action="REMOVED_ACADEMIC_SCOPE",
            entity="UserAcademicScope",
            entity_id=scope_id,
            target_user_id=scope.user_id,
            target_name=target_user.full_name if target_user else "Faculty",
            result="SUCCESS",
            details=f"Removed academic scope [{scope_summary}] from {target_user.full_name if target_user else 'Faculty'}."
        )
        db.add(audit)
        db.delete(scope)
        db.commit()
        return True

    def submit_permission_request(
        self,
        db: Session,
        user: User,
        permission_key: str,
        action_type: str,
        reason: Optional[str] = None,
        scope_data: Optional[Dict[str, Any]] = None,
        payload_data: Optional[Dict[str, Any]] = None
    ) -> PermissionRequest:
        """
        Submits a permission escalation or sensitive action approval request.
        Dispatches notification to all active administrators.
        """
        req = PermissionRequest(
            requester_user_id=user.id,
            permission_key=permission_key,
            action_type=action_type,
            reason=reason,
            scope_data=json.dumps(scope_data) if scope_data else None,
            payload_data=json.dumps(payload_data) if payload_data else None,
            status="PENDING"
        )
        db.add(req)
        db.flush()

        # Notify Administrators
        admins = db.query(User).filter(
            User.role.in_(["admin", "super_admin", "superadmin"]),
            User.is_active == True
        ).all()

        for adm in admins:
            notif = Notification(
                recipient_user_id=adm.id,
                actor_user_id=user.id,
                notification_type="PERMISSION_REQUEST_SUBMITTED",
                priority="WARNING",
                category="Security",
                title="Authority Approval Request",
                message=f"Faculty {user.full_name} requested authority for '{action_type}': {reason or 'No reason provided'}.",
                entity_type="PermissionRequest",
                entity_id=req.id,
                action_view="permissions",
                action_params=json.dumps({"tab": "requests", "requestId": req.id})
            )
            db.add(notif)

        db.commit()
        db.refresh(req)
        return req

    def review_permission_request(
        self,
        db: Session,
        request_id: int,
        reviewer: User,
        status: str,
        reviewer_notes: Optional[str] = None,
        grant_scope: Optional[Dict[str, Any]] = None
    ) -> PermissionRequest:
        """
        Reviews (Approve / Reject) a pending permission request.
        """
        req = db.query(PermissionRequest).filter(PermissionRequest.id == request_id).first()
        if not req:
            raise ValueError(f"Permission request #{request_id} not found.")

        req.status = status.upper()
        req.reviewer_user_id = reviewer.id
        req.reviewed_at = datetime.utcnow()
        req.reviewer_notes = reviewer_notes

        if req.status == "APPROVED":
            # Automatically grant the requested permission to user
            self.grant_user_permission(
                db=db,
                user_id=req.requester_user_id,
                permission_key=req.permission_key,
                actor=reviewer,
                effect="ALLOW"
            )
            if grant_scope:
                self.add_user_scope(
                    db=db,
                    user_id=req.requester_user_id,
                    scope_data=grant_scope,
                    actor=reviewer
                )

        audit = AuditLog(
            user_id=reviewer.id,
            actor_name=reviewer.full_name,
            actor_role=reviewer.role,
            action=f"REQUEST_{req.status}",
            entity="PermissionRequest",
            entity_id=req.id,
            target_user_id=req.requester_user_id,
            target_name=req.requester.full_name if req.requester else None,
            permission_key=req.permission_key,
            result="SUCCESS",
            details=f"Reviewed permission request #{req.id} for {req.action_type}: {req.status}. Notes: {reviewer_notes or 'None'}"
        )
        db.add(audit)

        notif = Notification(
            recipient_user_id=req.requester_user_id,
            actor_user_id=reviewer.id,
            notification_type="PERMISSION_REQUEST_REVIEWED",
            priority="SUCCESS" if req.status == "APPROVED" else "WARNING",
            category="Security",
            title=f"Permission Request {req.status.capitalize()}",
            message=f"Your authority request for '{req.action_type}' was {req.status.lower()} by {reviewer.full_name}. Notes: {reviewer_notes or 'Approved.'}",
            entity_type="PermissionRequest",
            entity_id=req.id,
            action_view="profile"
        )
        db.add(notif)
        db.commit()
        db.refresh(req)
        return req

permission_service = PermissionService()
