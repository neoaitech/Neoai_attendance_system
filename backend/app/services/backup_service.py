import os
import shutil
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.core.config import settings
from backend.app.db.models import User, Student, ClassCourse, AttendanceSession, AttendanceRecord, UnknownFace

class BackupService:
    @staticmethod
    def create_database_backup() -> str:
        """
        Copies the active SQLite database file to a timestamped backup archive.
        """
        db_path = settings.DATABASE_DIR / "attendance.db"
        if not db_path.exists():
            db_path = settings.BACKEND_DIR / "attendance.db"
        if not db_path.exists():
            raise FileNotFoundError("Active database file not found.")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"attendance_db_backup_{timestamp}.sqlite3"
        backup_path = settings.BACKUPS_DIR / backup_filename

        shutil.copy2(str(db_path), str(backup_path))
        return str(backup_path)

    @staticmethod
    def export_full_database_json(db: Session) -> Dict[str, Any]:
        """
        Exports all records across tables to a structured JSON object for portability.
        """
        users = [u.to_dict() for u in db.query(User).all()]
        classes = [c.to_dict() for c in db.query(ClassCourse).all()]
        students = [s.to_dict(include_embedding=False) for s in db.query(Student).all()]
        sessions = [sess.to_dict() for sess in db.query(AttendanceSession).all()]
        records = [r.to_dict() for r in db.query(AttendanceRecord).all()]
        unknown_faces = [u.to_dict() for u in db.query(UnknownFace).all()]

        return {
            "exported_at": datetime.utcnow().isoformat(),
            "counts": {
                "users": len(users),
                "classes": len(classes),
                "students": len(students),
                "sessions": len(sessions),
                "attendance_records": len(records),
                "unknown_faces": len(unknown_faces)
            },
            "data": {
                "users": users,
                "classes": classes,
                "students": students,
                "sessions": sessions,
                "attendance_records": records,
                "unknown_faces": unknown_faces
            }
        }

    @staticmethod
    def verify_database_integrity(db: Session) -> Dict[str, Any]:
        """
        Runs SQLite integrity checks and relationship validation.
        """
        integrity_result = db.execute(text("PRAGMA integrity_check;")).fetchall()
        foreign_key_check = db.execute(text("PRAGMA foreign_key_check;")).fetchall()

        is_healthy = True
        status_msg = "Database integrity is 100% OK."

        if integrity_result and integrity_result[0][0] != "ok":
            is_healthy = False
            status_msg = f"Integrity error: {integrity_result[0][0]}"

        if foreign_key_check:
            is_healthy = False
            status_msg = f"Foreign key violation detected in {len(foreign_key_check)} rows."

        # Collect table stats
        table_counts = {
            "users": db.query(User).count(),
            "classes": db.query(ClassCourse).count(),
            "students": db.query(Student).count(),
            "sessions": db.query(AttendanceSession).count(),
            "attendance_records": db.query(AttendanceRecord).count(),
            "unknown_faces": db.query(UnknownFace).count()
        }

        return {
            "is_healthy": is_healthy,
            "status": status_msg,
            "table_statistics": table_counts,
            "checked_at": datetime.utcnow().isoformat()
        }

backup_service = BackupService()
