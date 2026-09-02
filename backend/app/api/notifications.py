from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.db.session import get_db
from backend.app.db.models import Notification, AuditLog, User
from backend.app.api.auth import get_current_user, require_admin

router = APIRouter(prefix="/notifications", tags=["Institutional Notifications & Activity"])

@router.get("")
def get_notifications(
    category: Optional[str] = None,
    unread_only: bool = False,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns user-scoped notifications for the authenticated user.
    Enforces strict recipient targeting and ownership.
    """
    query = db.query(Notification).filter(Notification.recipient_user_id == current_user.id)

    if category and category.lower() != "all":
        query = query.filter(Notification.category.ilike(category))

    if unread_only:
        query = query.filter(Notification.is_read == False)

    total_count = query.count()
    unread_count = db.query(Notification).filter(
        Notification.recipient_user_id == current_user.id,
        Notification.is_read == False
    ).count()

    notifications = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "total": total_count,
        "unread_count": unread_count,
        "limit": limit,
        "offset": offset,
        "notifications": [n.to_dict() for n in notifications]
    }

@router.get("/unread-count")
def get_unread_notification_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fast query returning the total unread notification count for the authenticated user.
    """
    count = db.query(Notification).filter(
        Notification.recipient_user_id == current_user.id,
        Notification.is_read == False
    ).count()
    return {"unread_count": count}

@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Marks a single notification as read. Enforces that the notification belongs to the authenticated user.
    """
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    if notif.recipient_user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied: You do not own this notification.")

    if not notif.is_read:
        notif.is_read = True
        notif.read_at = datetime.utcnow()
        db.commit()
        db.refresh(notif)

    return {"message": "Notification marked as read.", "notification": notif.to_dict()}

@router.patch("/read-all")
def mark_all_notifications_read(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Marks all unread notifications for the authenticated user as read.
    """
    query = db.query(Notification).filter(
        Notification.recipient_user_id == current_user.id,
        Notification.is_read == False
    )
    if category and category.lower() != "all":
        query = query.filter(Notification.category.ilike(category))

    now = datetime.utcnow()
    updated_rows = query.update({"is_read": True, "read_at": now}, synchronize_session=False)
    db.commit()

    return {
        "message": f"Marked {updated_rows} notifications as read.",
        "unread_count": 0
    }

@router.get("/audit-logs")
def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Administrator-only audit log endpoint for administrative activity and system event logs.
    """
    total = db.query(AuditLog).count()
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "audit_logs": [l.to_dict() for l in logs]
    }
