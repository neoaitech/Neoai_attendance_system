"""
VisionAttend Database Seeding Script
Populates initial demo faculty, courses, and student records if empty.
"""
import sys
from pathlib import Path

# Add project root to sys.path
root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(root))

from backend.app.db.session import engine, Base, SessionLocal, run_auto_migrations
from backend.app.db.seed_data import seed_database
from backend.app.ai.face_engine import face_engine

def run_seed():
    print("[*] Initializing database schema...")
    Base.metadata.create_all(bind=engine)
    run_auto_migrations()
    print("[*] Seeding default records...")
    seed_database()
    print("[*] Performing ArcFace embedding validation...")
    db = SessionLocal()
    face_engine.auto_migrate_legacy_embeddings(db)
    db.close()
    print("[+] Database initialized successfully.")

if __name__ == "__main__":
    run_seed()
