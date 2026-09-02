import os
import base64
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.datetime_utils import format_iso_utc
from backend.app.db.session import get_db
from backend.app.db.models import User, AuditLog, SystemSetting
from backend.app.services.backup_service import backup_service
from backend.app.services.face_engine import face_engine
from backend.app.api.auth import get_current_user, require_admin
from backend.app.services.notification_service import notification_service

router = APIRouter(prefix="/admin", tags=["Admin & System Health"])

class TeacherPhotoPayload(BaseModel):
    photo_base64: str

@router.get("/health")
def get_system_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    integrity = backup_service.verify_database_integrity(db)
    return {
        "status": "HEALTHY" if integrity["is_healthy"] else "DEGRADED",
        "database": integrity,
        "environment": "Production / Industry-Ready",
        "api_version": "1.0.0"
    }

@router.post("/backup")
def trigger_database_backup(
    current_user: User = Depends(get_current_user)
):
    try:
        backup_file = backup_service.create_database_backup()
        return {
            "message": "Database backup created successfully.",
            "backup_file": os.path.basename(backup_file),
            "backup_path": backup_file
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")

@router.get("/export-json")
def export_database_json(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    data = backup_service.export_full_database_json(db)
    return data

@router.get("/audit-logs")
def get_audit_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return [l.to_dict() for l in logs]

@router.post("/teachers/{teacher_id}/photo")
async def enroll_teacher_face_photo(
    teacher_id: int,
    payload: TeacherPhotoPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Enroll a teacher's face biometric photo.
    Accepts a base64-encoded image, saves it, and extracts 128-D face embedding.
    """
    teacher = db.query(User).filter(User.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found.")

    # Decode and save the photo
    photo_data = payload.photo_base64
    if "," in photo_data:
        photo_data = photo_data.split(",")[1]

    try:
        img_bytes = base64.b64decode(photo_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data.")

    # Save to teachers folder
    teachers_dir = settings.UPLOAD_DIR / "teachers"
    teachers_dir.mkdir(parents=True, exist_ok=True)
    filename = f"teacher_{teacher_id}_{uuid.uuid4().hex[:8]}.jpg"
    filepath = teachers_dir / filename

    with open(str(filepath), "wb") as f:
        f.write(img_bytes)

    # Extract face embedding
    embedding = face_engine.extract_single_face_encoding(str(filepath))

    # Store photo_url and embedding on the User model
    try:
        teacher.photo_url = f"/uploads/teachers/{filename}"
        if embedding:
            teacher.face_embedding = embedding
    except Exception:
        pass

    db.commit()
    return {
        "message": "Teacher face photo enrolled successfully.",
        "teacher_id": teacher_id,
        "photo_url": f"/uploads/teachers/{filename}",
        "has_face_embedding": bool(embedding)
    }

class FacultyCreatePayload(BaseModel):
    full_name: str
    email: str
    username: str
    password: str
    role: Optional[str] = "teacher"
    is_active: Optional[bool] = True
    photo_base64: Optional[str] = None

class FacultyUpdatePayload(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

@router.get("/faculty")
def get_all_faculty(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    users = db.query(User).all()
    result = []
    for u in users:
        data = u.to_dict()
        # Collect distinct assigned offerings
        offerings = []
        for c in (u.assigned_classes or []):
            offerings.append({
                "id": c.id,
                "code": c.code,
                "name": c.name,
                "program": c.program,
                "semester": c.semester,
                "section": c.section,
                "academic_year": getattr(c, "academic_year", "2026-27"),
                "students_count": len(c.students) if c.students else 0
            })
        for c in (u.classes or []):
            if not any(o["id"] == c.id for o in offerings):
                offerings.append({
                    "id": c.id,
                    "code": c.code,
                    "name": c.name,
                    "program": c.program,
                    "semester": c.semester,
                    "section": c.section,
                    "academic_year": getattr(c, "academic_year", "2026-27"),
                    "students_count": len(c.students) if c.students else 0
                })
        data["teaching_assignments"] = offerings
        result.append(data)
    return result

@router.post("/faculty")
def create_faculty_user(
    payload: FacultyCreatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    from backend.app.core.security import get_password_hash
    existing = db.query(User).filter(
        (User.username == payload.username) | (User.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Faculty with this Login ID / Username or Email already exists.")

    is_super = current_user.role in ("super_admin", "superadmin")
    assigned_role = payload.role or "teacher"
    if is_super and assigned_role not in ("teacher", "faculty"):
        assigned_role = "teacher"

    new_user = User(
        username=payload.username.strip(),
        email=payload.email.strip(),
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name.strip(),
        role=assigned_role,
        is_active=payload.is_active if payload.is_active is not None else True
    )

    # Optional photo biometrics
    if payload.photo_base64:
        try:
            photo_data = payload.photo_base64
            if "," in photo_data:
                photo_data = photo_data.split(",")[1]
            img_bytes = base64.b64decode(photo_data)
            teachers_dir = settings.UPLOAD_DIR / "teachers"
            teachers_dir.mkdir(parents=True, exist_ok=True)
            filename = f"teacher_{payload.username}_{uuid.uuid4().hex[:8]}.jpg"
            filepath = teachers_dir / filename
            with open(str(filepath), "wb") as f:
                f.write(img_bytes)
            new_user.photo_url = f"/uploads/teachers/{filename}"
            emb = face_engine.extract_single_face_encoding(str(filepath))
            if emb:
                new_user.face_embedding = emb
        except Exception:
            pass

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user.to_dict()

@router.put("/faculty/{faculty_id}")
def update_faculty_user(
    faculty_id: int,
    payload: FacultyUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    from backend.app.core.security import get_password_hash
    target = db.query(User).filter(User.id == faculty_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Faculty user not found.")

    is_super = current_user.role in ("super_admin", "superadmin")
    if is_super:
        # Rule: Super Admin cannot edit or modify Administrator profiles
        if target.role == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Security Protection: Super Administrators cannot modify Administrator profiles."
            )
        # Rule: Super Admin cannot promote anyone to Admin or Super Admin
        if payload.role and payload.role not in ("teacher", "faculty"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Security Protection: Super Administrators can only assign Faculty role."
            )

    updated_fields = []
    if payload.full_name is not None and payload.full_name.strip() != target.full_name:
        updated_fields.append("full_name")
        target.full_name = payload.full_name.strip()
    if payload.email is not None and payload.email.strip() != target.email:
        updated_fields.append("email")
        target.email = payload.email.strip()
    if payload.role is not None and payload.role != target.role:
        updated_fields.append("role")
        target.role = payload.role
    if payload.is_active is not None and payload.is_active != target.is_active:
        updated_fields.append("is_active")
        target.is_active = payload.is_active
    if payload.password:
        updated_fields.append("password")
        target.hashed_password = get_password_hash(payload.password)

    db.commit()
    db.refresh(target)

    if updated_fields:
        notification_service.notify_faculty_profile_updated(
            db=db,
            faculty_user=target,
            updated_fields=updated_fields,
            actor=current_user
        )

    return target.to_dict()

class MatchingSensitivityPayload(BaseModel):
    tolerance: float
    label: Optional[str] = None
    notes: Optional[str] = None

@router.get("/system-settings/matching-sensitivity")
def get_matching_sensitivity_setting(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    setting = db.query(SystemSetting).filter(SystemSetting.key == "matching_sensitivity").first()
    if not setting:
        return {
            "key": "matching_sensitivity",
            "tolerance": 0.50,
            "label": "Standard Balanced (0.50 - Recommended)",
            "is_locked": True,
            "updated_at": None,
            "updated_by": "System Default (0.50)"
        }
    
    try:
        val = float(setting.value)
    except Exception:
        val = 0.50

    return {
        "key": setting.key,
        "tolerance": val,
        "label": setting.label or "Standard Balanced (0.50 - Recommended)",
        "is_locked": True,
        "updated_at": format_iso_utc(setting.updated_at),
        "updated_by": setting.updated_by.full_name if setting.updated_by else "System Administrator"
    }

@router.post("/system-settings/matching-sensitivity")
def update_matching_sensitivity_setting(
    payload: MatchingSensitivityPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if payload.tolerance < 0.20 or payload.tolerance > 0.90:
        raise HTTPException(status_code=400, detail="Tolerance must be between 0.20 and 0.90.")

    setting = db.query(SystemSetting).filter(SystemSetting.key == "matching_sensitivity").first()
    
    label_map = {
        0.50: "Standard Balanced (0.50 - Recommended)",
        0.58: "Strict High Security (0.58)",
        0.42: "Flexible / Low Light (0.42)"
    }
    label = payload.label or label_map.get(round(payload.tolerance, 2), f"Custom Threshold ({payload.tolerance:.2f})")

    if not setting:
        setting = SystemSetting(
            key="matching_sensitivity",
            value=str(round(payload.tolerance, 2)),
            label=label,
            description="System-wide institutional facial verification cosine similarity threshold.",
            updated_by_user_id=current_user.id
        )
        db.add(setting)
    else:
        setting.value = str(round(payload.tolerance, 2))
        setting.label = label
        setting.updated_by_user_id = current_user.id
        setting.updated_at = datetime.utcnow()

    # Log audit
    audit = AuditLog(
        user_id=current_user.id,
        action="UPDATE_SYSTEM_SENSITIVITY",
        entity="SystemSetting",
        entity_id=setting.id if setting.id else 1,
        details=f"Locked institutional ArcFace matching threshold to {payload.tolerance:.2f} ({label})."
    )
    db.add(audit)
    db.commit()
    db.refresh(setting)

    return {
        "success": True,
        "message": f"Institutional Matching Sensitivity locked to {label} for all faculty.",
        "tolerance": float(setting.value),
        "label": setting.label,
        "is_locked": True,
        "updated_at": format_iso_utc(setting.updated_at),
        "updated_by": current_user.full_name
    }


class FaceAIArchitecturePayload(BaseModel):
    architecture: str


@router.get("/system-settings/face-ai-architecture")
def get_face_ai_architecture_setting(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from backend.app.ai.router import face_ai_router
    setting = db.query(SystemSetting).filter(SystemSetting.key == "face_ai_architecture").first()
    if not setting:
        return {
            "key": "face_ai_architecture",
            "architecture": "STANDARD",
            "label": "Standard (YOLOv8-Face + MiniFASNetV2 + ArcFace ResNet-50)",
            "updated_at": None,
            "updated_by": "System Default (STANDARD)"
        }

    arch = setting.value if setting.value in ["STANDARD", "ADVANCED"] else "STANDARD"
    # Ensure router is synchronized
    face_ai_router.set_active_architecture(arch, db=db)

    label_map = {
        "STANDARD": "Standard (YOLOv8-Face + MiniFASNetV2 + ArcFace ResNet-50)",
        "ADVANCED": "Advanced (YOLOv8-Face + Quality Assessment + MiniFASNetV2 + ArcFace + Robust Matching)"
    }

    return {
        "key": setting.key,
        "architecture": arch,
        "label": setting.label or label_map.get(arch, arch),
        "updated_at": format_iso_utc(setting.updated_at),
        "updated_by": setting.updated_by.full_name if setting.updated_by else "System Administrator"
    }


@router.post("/system-settings/face-ai-architecture")
@router.put("/system-settings/face-ai-architecture")
def update_face_ai_architecture_setting(
    payload: FaceAIArchitecturePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    arch = payload.architecture.strip().upper()
    if arch not in ["STANDARD", "ADVANCED"]:
        raise HTTPException(status_code=400, detail="Invalid architecture. Allowed values: 'STANDARD', 'ADVANCED'.")

    from backend.app.ai.router import face_ai_router

    try:
        # Pre-validate / switch architecture in router
        face_ai_router.set_active_architecture(arch, db=db)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Advanced Face AI Architecture could not be initialized. One or more required AI components are unavailable. Please verify the Advanced AI dependencies and model files. (Error: {str(e)})"
        )

    label_map = {
        "STANDARD": "Standard (YOLOv8-Face + MiniFASNetV2 + ArcFace ResNet-50)",
        "ADVANCED": "Advanced (YOLOv8-Face + Quality Assessment + MiniFASNetV2 + ArcFace + Robust Matching)"
    }
    label = label_map.get(arch, arch)

    setting = db.query(SystemSetting).filter(SystemSetting.key == "face_ai_architecture").first()
    if not setting:
        setting = SystemSetting(
            key="face_ai_architecture",
            value=arch,
            label=label,
            description="System-wide biometric face recognition architecture (STANDARD vs ADVANCED).",
            updated_by_user_id=current_user.id
        )
        db.add(setting)
    else:
        setting.value = arch
        setting.label = label
        setting.updated_by_user_id = current_user.id
        setting.updated_at = datetime.utcnow()

    # Log audit
    audit = AuditLog(
        user_id=current_user.id,
        action="UPDATE_FACE_AI_ARCHITECTURE",
        entity="SystemSetting",
        entity_id=setting.id if setting.id else 1,
        details=f"Switched system Face AI Architecture to {arch} ({label})."
    )
    db.add(audit)
    db.commit()
    db.refresh(setting)

    return {
        "success": True,
        "message": f"Face AI Architecture successfully updated to {arch}.",
        "architecture": arch,
        "label": setting.label,
        "updated_at": format_iso_utc(setting.updated_at),
        "updated_by": current_user.full_name
    }
