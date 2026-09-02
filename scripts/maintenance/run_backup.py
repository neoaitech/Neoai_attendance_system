"""
VisionAttend Database Backup Script
Creates a timestamped snapshot of the SQLite database in database/backups/
"""
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(root))

from backend.app.services.backup_service import backup_service

def run_backup():
    print("[*] Creating database backup snapshot...")
    backup_file = backup_service.create_database_backup()
    print(f"[+] Backup successfully created at: {backup_file}")

if __name__ == "__main__":
    run_backup()
