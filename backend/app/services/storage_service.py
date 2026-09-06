import os
import io
import logging
from pathlib import Path
from typing import Optional, Tuple
import requests
from backend.app.core.config import settings

logger = logging.getLogger("StorageService")

class StorageService:
    """
    Unified Storage Service:
    - Supports Supabase Object Storage (Cloud Bucket) for permanent 24/7 images.
    - Gracefully falls back to Local Disk Storage (/data/uploads) when Supabase is not configured.
    """

    def __init__(self):
        self.supabase_url = (getattr(settings, "SUPABASE_URL", "") or "").rstrip("/")
        self.supabase_key = getattr(settings, "SUPABASE_KEY", "") or ""
        self.supabase_bucket = getattr(settings, "SUPABASE_BUCKET", "attendance-media") or "attendance-media"
        self.is_supabase_enabled = bool(self.supabase_url and self.supabase_key)

        if self.is_supabase_enabled:
            logger.info(f"[StorageService] Supabase Cloud Storage enabled: bucket='{self.supabase_bucket}'")
            self._ensure_bucket_exists()
        else:
            logger.info("[StorageService] Using Local Disk Storage for media files.")

    def _ensure_bucket_exists(self):
        """Checks or attempts to create the public bucket in Supabase if permissions allow."""
        if not self.is_supabase_enabled:
            return
        headers = {
            "Authorization": f"Bearer {self.supabase_key}",
            "apikey": self.supabase_key,
            "Content-Type": "application/json"
        }
        try:
            url = f"{self.supabase_url}/storage/v1/bucket/{self.supabase_bucket}"
            res = requests.get(url, headers=headers, timeout=5)
            if res.status_code == 404:
                # Try to create public bucket
                create_url = f"{self.supabase_url}/storage/v1/bucket"
                payload = {"id": self.supabase_bucket, "name": self.supabase_bucket, "public": True}
                requests.post(create_url, headers=headers, json=payload, timeout=5)
        except Exception as e:
            logger.warning(f"[StorageService] Bucket check note: {e}")

    def save_image(
        self,
        image_bytes: bytes,
        filename: str,
        folder: str = "students",
        content_type: str = "image/jpeg"
    ) -> Tuple[str, str]:
        """
        Saves image to Supabase Cloud Storage (if configured) AND local disk cache.
        Returns:
            (url_path, local_disk_path)
            url_path: e.g. 'https://...supabase.co/storage/v1/object/public/...' or '/uploads/students/...'
            local_disk_path: absolute local path for OpenCV / FaceEngine processing
        """
        # Always save local copy for OpenCV / ArcFace engine processing
        target_dir = settings.UPLOAD_DIR / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        local_disk_path = str(target_dir / filename)
        
        try:
            with open(local_disk_path, "wb") as f:
                f.write(image_bytes)
        except Exception as e:
            logger.error(f"[StorageService] Failed to write local cache: {e}")

        # Cloud upload to Supabase if credentials are provided
        if self.is_supabase_enabled:
            try:
                object_path = f"{folder}/{filename}"
                upload_url = f"{self.supabase_url}/storage/v1/object/{self.supabase_bucket}/{object_path}"
                headers = {
                    "Authorization": f"Bearer {self.supabase_key}",
                    "apikey": self.supabase_key,
                    "Content-Type": content_type,
                    "x-upsert": "true"
                }
                resp = requests.post(upload_url, headers=headers, data=image_bytes, timeout=10)
                if resp.status_code in (200, 201):
                    public_url = f"{self.supabase_url}/storage/v1/object/public/{self.supabase_bucket}/{object_path}"
                    logger.info(f"[StorageService] Uploaded to Supabase Cloud: {public_url}")
                    return public_url, local_disk_path
                else:
                    logger.warning(f"[StorageService] Supabase upload returned {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.error(f"[StorageService] Supabase upload failed, falling back to local: {e}")

        # Fallback / Database-level Cloud Persistence:
        # If no dedicated S3/Supabase storage token is provided, store as optimized Base64 data URL
        # so images display permanently on any device directly from Supabase PostgreSQL!
        try:
            import base64
            b64_str = base64.b64encode(image_bytes).decode("utf-8")
            data_url = f"data:{content_type};base64,{b64_str}"
            return data_url, local_disk_path
        except Exception:
            return f"/uploads/{folder}/{filename}", local_disk_path

storage_service = StorageService()
