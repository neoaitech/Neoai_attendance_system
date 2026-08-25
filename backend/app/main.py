from fastapi import FastAPI

from app.api import (
    attendance,
    auth,
    classes,
    recognition,
    reports,
    sessions,
    students,
    unknown_faces,
)

app = FastAPI(
    title="AI Smart Attendance System API",
    version="1.0.0",
    description="Phase-2 Day-5 backend skeleton aligned with the approved API contract.",
)


@app.get("/api/v1/health", tags=["Health"])
def health_check():
    return {"status": "ok"}


app.include_router(auth.router, prefix="/api/v1")
app.include_router(classes.router, prefix="/api/v1")
app.include_router(students.router, prefix="/api/v1")
app.include_router(sessions.router, prefix="/api/v1")
app.include_router(attendance.router, prefix="/api/v1")
app.include_router(unknown_faces.router, prefix="/api/v1")
app.include_router(recognition.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
