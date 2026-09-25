import os
import re
import time
import uuid
import json
import base64
import logging
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.db.session import get_db
from backend.app.db.models import User
from backend.app.api.auth import get_current_user
from backend.app.services.face_engine import face_engine

logger = logging.getLogger("StagingAPI")

router = APIRouter(prefix="/staging", tags=["Staging"])

# In-memory staging cache for fast retrieval of pre-extracted embeddings
# Key: staging_id -> dict
STAGING_CACHE: Dict[str, Dict[str, Any]] = {}


def prune_expired_staging_files(max_age_seconds: int = 3600):
    """
    Deletes staging files and metadata older than max_age_seconds (default 1 hour)
    to guarantee zero disk bloat from abandoned browser sessions.
    """
    try:
        staging_dir = settings.STAGING_PHOTOS_DIR
        if not staging_dir.exists():
            return
        now = time.time()
        removed_count = 0
        for entry in os.scandir(staging_dir):
            if entry.is_file():
                try:
                    if now - entry.stat().st_mtime > max_age_seconds:
                        os.remove(entry.path)
                        removed_count += 1
                except Exception:
                    pass
        
        # Also clean in-memory cache
        expired_keys = [
            k for k, v in STAGING_CACHE.items()
            if now - v.get("created_at", now) > max_age_seconds
        ]
        for k in expired_keys:
            STAGING_CACHE.pop(k, None)

        if removed_count > 0:
            logger.info(f"[StagingCleanup] Pruned {removed_count} expired staging files.")
    except Exception as e:
        logger.warning(f"[StagingCleanup] Prune warning: {e}")


@router.post("/upload")
async def upload_staged_photo(
    file: Optional[UploadFile] = File(None),
    base64_data: Optional[str] = Form(None),
    purpose: str = Form("student"),
    client_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """
    Instagram-style optimistic pre-upload endpoint.
    Uploads an image in the background while the user continues typing / interacting.
    - Saves photo into staging directory.
    - If purpose == 'student', pre-computes 512-D ArcFace face embedding so form submission is instantaneous.
    - Returns staging_id, disk path, preview URL, and face detection flag.
    """
    # Opportunistic cleanup (prune files older than 1 hour)
    try:
        prune_expired_staging_files(max_age_seconds=3600)
    except Exception:
        pass

    staging_dir = settings.STAGING_PHOTOS_DIR
    staging_dir.mkdir(parents=True, exist_ok=True)

    staging_id = uuid.uuid4().hex[:16]
    image_bytes = None
    ext = "jpg"

    if file and hasattr(file, "read"):
        orig_name = getattr(file, "filename", "") or "photo.jpg"
        if "." in orig_name:
            ext = orig_name.split(".")[-1].lower()
            if ext not in ["jpg", "jpeg", "png", "webp"]:
                ext = "jpg"
        image_bytes = await file.read()
    elif base64_data:
        raw_b64 = base64_data
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        try:
            image_bytes = base64.b64decode(raw_b64)
            ext = "jpg"
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 image data.")
    
    if not image_bytes or len(image_bytes) < 100:
        raise HTTPException(status_code=400, detail="No valid image content received for staging.")

    # Guard file size (max 20MB per photo)
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image size exceeds 20MB limit.")

    safe_filename = f"{staging_id}_{purpose}.{ext}"
    disk_path = staging_dir / safe_filename
    meta_path = staging_dir / f"{staging_id}.meta.json"

    try:
        with open(disk_path, "wb") as f:
            f.write(image_bytes)
    except Exception as e:
        logger.error(f"[StagingUpload] Error writing staged file: {e}")
        raise HTTPException(status_code=500, detail="Failed to save staged photo on server.")

    face_detected = False
    face_encoding = None

    # For student enrollment photos, pre-extract 512-D ArcFace face embedding immediately
    if purpose == "student":
        try:
            enc = face_engine.extract_single_face_encoding(str(disk_path))
            if enc is not None:
                face_detected = True
                face_encoding = enc if isinstance(enc, list) else (enc.tolist() if hasattr(enc, "tolist") else list(enc))
        except Exception as e:
            logger.warning(f"[StagingUpload] Pre-extraction note: {e}")

    meta = {
        "staging_id": staging_id,
        "filename": safe_filename,
        "disk_path": str(disk_path),
        "url": f"/uploads/staging/{safe_filename}",
        "purpose": purpose,
        "client_id": client_id,
        "face_detected": face_detected,
        "face_encoding": face_encoding,
        "created_at": time.time()
    }

    # Store in memory cache
    STAGING_CACHE[staging_id] = meta

    # Write companion meta to disk so staging survives worker process restarts
    try:
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump({k: v for k, v in meta.items() if k != "face_encoding"}, f)
    except Exception:
        pass

    return {
        "success": True,
        "staging_id": staging_id,
        "file_path": str(disk_path),
        "preview_url": meta["url"],
        "purpose": purpose,
        "face_detected": face_detected,
        "has_embedding": bool(face_encoding is not None)
    }


@router.delete("/{staging_id}")
async def cancel_and_delete_staged_photo(
    staging_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Instant retake / cancel endpoint.
    Deletes the staged file from the server disk immediately (0 leftover files)
    when a user clicks "Retake" or removes a photo thumbnail from the UI.
    """
    # Strict validation to prevent path traversal
    if not re.match(r"^[a-zA-Z0-9_\-]+$", staging_id):
        raise HTTPException(status_code=400, detail="Invalid staging ID format.")

    staging_dir = settings.STAGING_PHOTOS_DIR
    deleted_files = []

    # 1. Remove from in-memory cache
    cached = STAGING_CACHE.pop(staging_id, None)
    if cached and cached.get("disk_path"):
        try:
            p = Path(cached["disk_path"])
            if p.exists() and p.is_file():
                p.unlink(missing_ok=True)
                deleted_files.append(str(p.name))
        except Exception as e:
            logger.warning(f"[StagingDelete] Could not delete cached file: {e}")

    # 2. Prune any matching disk files starting with staging_id
    if staging_dir.exists():
        try:
            for entry in os.scandir(staging_dir):
                if entry.name.startswith(staging_id):
                    try:
                        os.remove(entry.path)
                        deleted_files.append(entry.name)
                    except Exception as e:
                        logger.warning(f"[StagingDelete] Could not remove {entry.name}: {e}")
        except Exception as e:
            logger.warning(f"[StagingDelete] Directory scan warning: {e}")

    return {
        "success": True,
        "staging_id": staging_id,
        "deleted_files": deleted_files,
        "message": "Staged photo permanently deleted from server."
    }


def get_staged_photo_info(staging_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves metadata and disk path for a staged photo by ID.
    Checks memory cache first, then disk fallback.
    """
    if not staging_id or not re.match(r"^[a-zA-Z0-9_\-]+$", staging_id):
        return None

    if staging_id in STAGING_CACHE:
        info = STAGING_CACHE[staging_id]
        if Path(info["disk_path"]).exists():
            return info

    # Disk fallback: look for {staging_id}_*
    staging_dir = settings.STAGING_PHOTOS_DIR
    if staging_dir.exists():
        for entry in os.scandir(staging_dir):
            if entry.name.startswith(staging_id) and not entry.name.endswith(".meta.json"):
                meta_file = staging_dir / f"{staging_id}.meta.json"
                meta_content = {}
                if meta_file.exists():
                    try:
                        with open(meta_file, "r", encoding="utf-8") as f:
                            meta_content = json.load(f)
                    except Exception:
                        pass
                return {
                    "staging_id": staging_id,
                    "filename": entry.name,
                    "disk_path": entry.path,
                    "url": f"/uploads/staging/{entry.name}",
                    "face_detected": meta_content.get("face_detected", False),
                    "face_encoding": None,
                    "created_at": entry.stat().st_mtime
                }
    return None
