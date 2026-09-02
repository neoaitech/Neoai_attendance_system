import os
import sys
import uvicorn
from pathlib import Path

# Ensure project root is in sys.path and environment
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))
os.environ["PYTHONPATH"] = str(PROJECT_ROOT) + os.pathsep + os.environ.get("PYTHONPATH", "")

from backend.app.core.config import settings
from backend.app.db.session import engine, Base, run_auto_migrations
from backend.app.db.seed_data import seed_database

def main():
    print("=" * 75)
    print("   VisionAttend Pro - AI Classroom Attendance & Analytics Platform")
    print("=" * 75)
    print(f" [*] Project Root: {PROJECT_ROOT}")
    print(f" [*] Database: {settings.DATABASE_URL}")
    print(" [*] Initializing database tables, running schema migrations and seed dataset...")
    
    Base.metadata.create_all(bind=engine)
    run_auto_migrations()
    seed_database()

    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        local_ip = socket.gethostbyname(socket.gethostname())

    print("\n" + "-" * 75)
    print(" [*] System Credentials:")
    print("     - Administrator: username: 'admin'     | password: 'admin123'")
    print("     - Faculty Member: username: 'dr_sharma' | password: 'teacher123'")
    print(f" [*] Laptop Browser URL:  http://localhost:8000")
    print(f" [*] Mobile Browser URL:  http://{local_ip}:8000  (Same Wi-Fi)")
    print(f" [*] Swagger API Docs:    http://localhost:8000/docs")
    print("-" * 75 + "\n")

    uvicorn.run(
        "backend.app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(PROJECT_ROOT / "backend"), str(PROJECT_ROOT / "frontend")]
    )

if __name__ == "__main__":
    main()
