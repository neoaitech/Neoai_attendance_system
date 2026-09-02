import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.core.config import settings
from backend.app.db.session import engine, Base, SessionLocal, run_auto_migrations
from backend.app.db.seed_data import seed_database
from backend.app.services.face_engine import face_engine
from backend.app.api.auth import router as auth_router
from backend.app.api.students import router as students_router
from backend.app.api.classes import router as classes_router
from backend.app.api.sessions import router as sessions_router
from backend.app.api.attendance import router as attendance_router
from backend.app.api.unknown_faces import router as unknown_faces_router
from backend.app.api.reports import router as reports_router
from backend.app.api.analytics import router as analytics_router
from backend.app.api.admin import router as admin_router
from backend.app.api.academic import router as academic_router
from backend.app.api.notifications import router as notifications_router
from backend.app.api.authority import router as authority_router
from backend.app.api.email_reports import router as email_reports_router
from backend.app.services.permission_service import permission_service

@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    from datetime import datetime

    # Startup: Ensure tables exist, apply migrations & seed initial data
    Base.metadata.create_all(bind=engine)
    run_auto_migrations()
    try:
        seed_database()
    except Exception as e:
        print(f"Seed info: {e}")

    # Ensure roles & permissions are seeded
    try:
        db = SessionLocal()
        permission_service.seed_default_roles_and_permissions(db)
        db.close()
    except Exception as e:
        print(f"Permission seed info: {e}")

    # Ensure all registered students have 512-D ArcFace embeddings
    try:
        db = SessionLocal()
        face_engine.auto_migrate_legacy_embeddings(db)
        db.close()
    except Exception as e:
        print(f"Auto-migration info: {e}")

    # Auto-unfreeze students whose freeze_until has passed
    def run_auto_unfreeze():
        try:
            from backend.app.db.models import Student, StudentFreezeLog
            db = SessionLocal()
            now = datetime.utcnow()
            expired = db.query(Student).filter(
                Student.is_frozen == True,
                Student.freeze_until != None,
                Student.freeze_until <= now
            ).all()
            count = 0
            for s in expired:
                s.is_frozen = False
                s.attendance_status = "ACTIVE"
                s.unfrozen_at = now
                s.freeze_until = None
                log = StudentFreezeLog(
                    student_id=s.id,
                    action="AUTO_UNFREEZE",
                    reason=f"Auto-unfreeze: scheduled expiry reached on {now.strftime('%Y-%m-%d')}",
                    unfrozen_at=now
                )
                db.add(log)
                count += 1
            if count:
                db.commit()
                print(f"[AutoUnfreeze] {count} student(s) auto-unfrozen on startup.")
            db.close()
        except Exception as e:
            print(f"[AutoUnfreeze] Error: {e}")

    run_auto_unfreeze()

    # Background task: check every midnight for expired freezes
    async def periodic_auto_unfreeze():
        while True:
            try:
                # Wait until next midnight (IST offset handled via UTC check)
                await asyncio.sleep(3600)  # Check every hour
                run_auto_unfreeze()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[AutoUnfreeze periodic] Error: {e}")

    task = asyncio.create_task(periodic_auto_unfreeze())

    yield
    # Shutdown
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Industry-Grade AI Classroom Attendance & Biometric Analytics System",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# No-Cache Header Middleware for Instant Browser Refresh on Mobile
@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path == "/" or path.startswith("/api/") or path.endswith((".html", ".js", ".css")):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"An unexpected server error occurred: {str(exc)}"}
    )

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    fav_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "favicon.ico"
    if fav_path.exists():
        from fastapi.responses import FileResponse
        return FileResponse(fav_path, media_type="image/x-icon")
    return JSONResponse(content={}, status_code=204)

# Include API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(students_router, prefix=settings.API_V1_STR)
app.include_router(classes_router, prefix=settings.API_V1_STR)
app.include_router(sessions_router, prefix=settings.API_V1_STR)
app.include_router(attendance_router, prefix=settings.API_V1_STR)
app.include_router(unknown_faces_router, prefix=settings.API_V1_STR)
app.include_router(reports_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)
app.include_router(academic_router, prefix=settings.API_V1_STR)
app.include_router(notifications_router, prefix=settings.API_V1_STR)
app.include_router(authority_router, prefix=settings.API_V1_STR)
app.include_router(email_reports_router, prefix=settings.API_V1_STR)

# Static File Mounts
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")
app.mount("/reports_cache", StaticFiles(directory=str(settings.REPORTS_DIR)), name="reports_cache")

# Mount Frontend
frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
