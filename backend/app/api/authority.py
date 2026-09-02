import json
from datetime import datetime
from typing import List, Dict, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.db.session import get_db
from backend.app.db.models import (
    User, Role, Permission, UserPermissionOverride, UserAcademicScope,
    PermissionRequest, AuditLog, Notification, ClassCourse
)
from backend.app.api.auth import get_current_user
from backend.app.services.permission_service import permission_service, ALL_PERMISSIONS
from backend.app.core.datetime_utils import format_iso_utc

router = APIRouter(prefix="/authority", tags=["Authority & Permissions"])

def require_permission_manage(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    """Dependency requiring permissions.manage permission."""
    if not permission_service.has_permission(db, current_user, "permissions.manage"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You lack 'permissions.manage' authority to access this administration module."
        )
    return current_user

@router.get("/my-authority")
def get_my_authority(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns effective permissions, overrides, and academic scopes for currently logged-in user."""
    return permission_service.get_user_effective_permissions(db, current_user)

@router.get("/users")
def list_users_authority(
    search: Optional[str] = None,
    role: Optional[str] = None,
    status_filter: Optional[str] = None,
    department: Optional[str] = None,
    current_user: User = Depends(require_permission_manage),
    db: Session = Depends(get_db)
):
    """Lists all institutional users with authority summary and active academic scopes."""
    query = db.query(User)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter((User.full_name.ilike(s)) | (User.username.ilike(s)) | (User.email.ilike(s)))
    if role and role != "ALL":
        query = query.filter(User.role == role)
    if status_filter and status_filter != "ALL":
        query = query.filter(User.status == status_filter)
    if department and department != "ALL":
        query = query.filter(User.department == department)

    users = query.order_by(User.id.asc()).all()

    result = []
    for u in users:
        scopes = u.academic_scopes or []
        scope_summaries = []
        for sc in scopes[:3]:
            sec = f"Div {sc.division}" if sc.division != "ALL" else "All Divs"
            scope_summaries.append(f"{sc.program} • {sc.semester} • {sec}")
        if len(scopes) > 3:
            scope_summaries.append(f"+{len(scopes) - 3} more")

        overrides = u.permission_overrides or []
        granted_overrides = sum(1 for ov in overrides if ov.effect == "ALLOW")
        denied_overrides = sum(1 for ov in overrides if ov.effect == "DENY")

        result.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "role_display": "Super Administrator" if u.role in ("super_admin", "superadmin") else ("Administrator" if u.role == "admin" else "Faculty"),
            "department": u.department or "Computer Science & Engineering",
            "status": u.status or ("Active" if u.is_active else "Deactivated"),
            "is_active": u.is_active,
            "photo_url": u.photo_url,
            "last_login_at": format_iso_utc(u.last_login_at) if u.last_login_at else None,
            "permissions_count": len(overrides),
            "granted_overrides_count": granted_overrides,
            "denied_overrides_count": denied_overrides,
            "scopes_count": len(scopes),
            "scope_summaries": scope_summaries,
            "assigned_classes_count": len(u.assigned_classes) if u.assigned_classes else (len(u.classes) if u.classes else 0),
            "created_at": format_iso_utc(u.created_at)
        })

    return result

@router.get("/users/{user_id}/authority")
def get_user_authority_profile(
    user_id: int,
    current_user: User = Depends(require_permission_manage),
    db: Session = Depends(get_db)
):
    """Fetches complete authority drawer payload for a specific user."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    effective_data = permission_service.get_user_effective_permissions(db, target_user)
    roles = db.query(Role).filter(Role.is_active == True).all()
    all_perms = db.query(Permission).order_by(Permission.category, Permission.name).all()

    # Categorize permissions
    categories: Dict[str, List[Dict[str, Any]]] = {}
    for p in all_perms:
        cat = p.category or "General"
        if cat not in categories:
            categories[cat] = []
        categories[cat].append({
            "id": p.id,
            "key": p.key,
            "name": p.name,
            "description": p.description,
            "is_sensitive": p.is_sensitive,
            "is_effective": effective_data["effective_permissions"].get(p.key, False),
            "override_effect": next((ov["effect"] for ov in effective_data["overrides"] if ov["permission_key"] == p.key), None)
        })

    # Recent audit trail for this user
    recent_audits = db.query(AuditLog).filter(
        (AuditLog.target_user_id == user_id) | (AuditLog.user_id == user_id)
    ).order_by(desc(AuditLog.timestamp)).limit(10).all()

    return {
        "user": target_user.to_dict(),
        "roles": [r.to_dict() for r in roles],
        "categories": categories,
        "effective_permissions": effective_data["effective_permissions"],
        "overrides": effective_data["overrides"],
        "academic_scopes": effective_data["academic_scopes"],
        "audit_logs": [a.to_dict() for a in recent_audits]
    }

@router.put("/users/{user_id}/authority")
def update_user_authority_profile(
    user_id: int,
    payload: Dict[str, Any],
    current_user: User = Depends(require_permission_manage),
    db: Session = Depends(get_db)
):
    """
    Updates user role, account status, granular permission overrides, and academic scopes.
    Includes Last Super Admin Safety and Self-Demotion protection.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    new_role = payload.get("role")
    new_status = payload.get("status")
    new_department = payload.get("department")

    # 1. Last Super Admin Protection Check
    is_current_super = permission_service.is_super_admin(target_user)
    if is_current_super:
        will_lose_super = (new_role and new_role not in ("super_admin", "superadmin")) or (new_status in ("Suspended", "Deactivated"))
        if will_lose_super:
            active_super_count = db.query(User).filter(
                User.role.in_(["super_admin", "superadmin"]),
                User.is_active == True,
                User.status == "Active",
                User.id != user_id
            ).count()
            if active_super_count == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Security Protection: Cannot demote or deactivate the last remaining Super Administrator."
                )

    # 2. Self-Protection: Don't allow current user to lock themselves out of permissions.manage
    if current_user.id == target_user.id:
        if new_status in ("Suspended", "Deactivated"):
            raise HTTPException(status_code=400, detail="Cannot deactivate your own administrator account.")

    # 3. Update Role & Status
    prev_role = target_user.role
    prev_status = target_user.status or "Active"

    if new_role and new_role != target_user.role:
        target_user.role = new_role
        role_obj = db.query(Role).filter(Role.name == new_role).first()
        target_user.role_id = role_obj.id if role_obj else None

    if new_status:
        target_user.status = new_status
        target_user.is_active = (new_status == "Active")

    if new_department:
        target_user.department = new_department

    # 4. Update Permission Overrides
    if "overrides" in payload:
        submitted_overrides = payload["overrides"]  # Dict: { [perm_key]: "ALLOW" | "DENY" | "DEFAULT" }
        for perm_key, effect in submitted_overrides.items():
            if effect in ("ALLOW", "DENY"):
                permission_service.grant_user_permission(
                    db=db,
                    user_id=user_id,
                    permission_key=perm_key,
                    actor=current_user,
                    effect=effect
                )
            elif effect == "DEFAULT":
                permission_service.revoke_user_permission(
                    db=db,
                    user_id=user_id,
                    permission_key=perm_key,
                    actor=current_user
                )

    # 5. Log Overall Authority Update Audit Record
    audit = AuditLog(
        user_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="UPDATED_USER_AUTHORITY",
        entity="User",
        entity_id=user_id,
        target_user_id=user_id,
        target_name=target_user.full_name,
        previous_value=f"Role: {prev_role}, Status: {prev_status}",
        new_value=f"Role: {target_user.role}, Status: {target_user.status}",
        result="SUCCESS",
        details=f"Administrator {current_user.full_name} updated authority settings for {target_user.full_name}."
    )
    db.add(audit)

    # Dispatch Notification
    notif = Notification(
        recipient_user_id=user_id,
        actor_user_id=current_user.id,
        notification_type="AUTHORITY_UPDATED",
        priority="INFO",
        category="Security",
        title="Institutional Authority Profile Updated",
        message=f"Your institutional permissions and role ({target_user.role.capitalize()}) were updated by {current_user.full_name}.",
        entity_type="User",
        entity_id=user_id,
        action_view="profile"
    )
    db.add(notif)
    db.commit()

    return {"status": "success", "message": f"Authority profile for {target_user.full_name} updated successfully."}

@router.post("/users/{user_id}/scopes")
def add_academic_scope(
    user_id: int,
    payload: Dict[str, Any],
    current_user: User = Depends(require_permission_manage),
    db: Session = Depends(get_db)
):
    """Adds a new academic scope to a user."""
    try:
        scope = permission_service.add_user_scope(
            db=db,
            user_id=user_id,
            scope_data=payload,
            actor=current_user
        )
        return scope.to_dict()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/scopes/{scope_id}")
def remove_academic_scope(
    scope_id: int,
    current_user: User = Depends(require_permission_manage),
    db: Session = Depends(get_db)
):
    """Deletes an academic scope from a user."""
    success = permission_service.remove_user_scope(db, scope_id, current_user)
    if not success:
        raise HTTPException(status_code=404, detail="Scope not found.")
    return {"status": "success", "message": "Academic scope removed successfully."}

@router.get("/matrix")
def get_permission_matrix(
    current_user: User = Depends(require_permission_manage),
    db: Session = Depends(get_db)
):
    """Returns complete Role-Permission matrix across all categories."""
    roles = db.query(Role).order_by(Role.id.asc()).all()
    permissions = db.query(Permission).order_by(Permission.category, Permission.name).all()

    categories: Dict[str, List[Dict[str, Any]]] = {}
    for p in permissions:
        cat = p.category or "General"
        if cat not in categories:
            categories[cat] = []

        role_mappings = {}
        for r in roles:
            if r.name in ("super_admin", "superadmin"):
                role_mappings[r.name] = True
            else:
                role_mappings[r.name] = any(rp.id == p.id for rp in r.permissions)

        categories[cat].append({
            "id": p.id,
            "key": p.key,
            "name": p.name,
            "description": p.description,
            "is_sensitive": p.is_sensitive,
            "roles": role_mappings
        })

    return {
        "roles": [r.to_dict() for r in roles],
        "categories": categories
    }

@router.put("/roles/{role_name}/permissions")
def update_role_permissions(
    role_name: str,
    payload: Dict[str, Any],
    current_user: User = Depends(require_permission_manage),
    db: Session = Depends(get_db)
):
    """Updates default permission assignments for a role."""
    if role_name in ("super_admin", "superadmin"):
        raise HTTPException(status_code=400, detail="Cannot alter Super Administrator base permissions.")

    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found.")

    permission_keys = payload.get("permission_keys", [])
    perms = db.query(Permission).filter(Permission.key.in_(permission_keys)).all()
    role.permissions = perms

    audit = AuditLog(
        user_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="UPDATED_ROLE_PERMISSIONS",
        entity="Role",
        entity_id=role.id,
        new_value=json.dumps(permission_keys),
        result="SUCCESS",
        details=f"Administrator {current_user.full_name} updated role '{role.display_name}' permissions ({len(perms)} perms)."
    )
    db.add(audit)
    db.commit()

    return {"status": "success", "message": f"Permissions for role '{role.display_name}' updated successfully."}

@router.get("/requests")
def list_permission_requests(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists permission and sensitive action approval requests."""
    query = db.query(PermissionRequest)

    is_admin = permission_service.has_permission(db, current_user, "permissions.manage")
    if not is_admin:
        # Normal faculty can only see their own requests
        query = query.filter(PermissionRequest.requester_user_id == current_user.id)

    if status_filter and status_filter != "ALL":
        query = query.filter(PermissionRequest.status == status_filter.upper())

    requests = query.order_by(desc(PermissionRequest.created_at)).all()
    return [r.to_dict() for r in requests]

@router.post("/requests")
def submit_permission_request(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submits a permission escalation or sensitive action approval request."""
    permission_key = payload.get("permission_key")
    action_type = payload.get("action_type") or permission_key
    reason = payload.get("reason")
    scope_data = payload.get("scope")
    payload_data = payload.get("payload")

    if not permission_key:
        raise HTTPException(status_code=400, detail="permission_key is required.")

    req = permission_service.submit_permission_request(
        db=db,
        user=current_user,
        permission_key=permission_key,
        action_type=action_type,
        reason=reason,
        scope_data=scope_data,
        payload_data=payload_data
    )
    return req.to_dict()

@router.post("/requests/{request_id}/review")
def review_permission_request(
    request_id: int,
    payload: Dict[str, Any],
    current_user: User = Depends(require_permission_manage),
    db: Session = Depends(get_db)
):
    """Reviews (Approve / Reject) a pending permission request."""
    review_status = payload.get("status", "APPROVED").upper()
    notes = payload.get("notes")
    scope_data = payload.get("grant_scope")

    if review_status not in ("APPROVED", "REJECTED"):
        raise HTTPException(status_code=400, detail="Status must be APPROVED or REJECTED.")

    try:
        req = permission_service.review_permission_request(
            db=db,
            request_id=request_id,
            reviewer=current_user,
            status=review_status,
            reviewer_notes=notes,
            grant_scope=scope_data
        )
        return req.to_dict()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/bulk-assign")
def bulk_assign_permissions(
    payload: Dict[str, Any],
    current_user: User = Depends(require_permission_manage),
    db: Session = Depends(get_db)
):
    """Bulk assigns permissions or scopes to multiple faculty members."""
    user_ids = payload.get("user_ids", [])
    permission_key = payload.get("permission_key")
    effect = payload.get("effect", "ALLOW")
    scope_data = payload.get("scope")

    if not user_ids:
        raise HTTPException(status_code=400, detail="user_ids array cannot be empty.")

    applied_count = 0
    for uid in user_ids:
        if permission_key:
            permission_service.grant_user_permission(
                db=db,
                user_id=uid,
                permission_key=permission_key,
                actor=current_user,
                effect=effect
            )
        if scope_data:
            permission_service.add_user_scope(
                db=db,
                user_id=uid,
                scope_data=scope_data,
                actor=current_user
            )
        applied_count += 1

    return {
        "status": "success",
        "message": f"Successfully configured authority for {applied_count} faculty members."
    }

@router.get("/audit-logs")
def query_security_audit_logs(
    search: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    current_user: User = Depends(require_permission_manage),
    db: Session = Depends(get_db)
):
    """Queries institutional security and authority audit trail."""
    query = db.query(AuditLog)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (AuditLog.actor_name.ilike(s)) |
            (AuditLog.target_name.ilike(s)) |
            (AuditLog.action.ilike(s)) |
            (AuditLog.details.ilike(s))
        )
    if action and action != "ALL":
        query = query.filter(AuditLog.action == action)

    total = query.count()
    logs = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "logs": [l.to_dict() for l in logs]
    }
