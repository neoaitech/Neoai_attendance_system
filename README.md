# AI Smart Attendance System

An AI-powered classroom attendance system that detects and recognizes student faces from a classroom photo, auto-marks attendance, flags unknown faces for manual review, and generates attendance reports.

Organization: Neo AI Tech  
Team: Prathiraj (Backend and DevOps Lead), Prachi (Frontend and UI), Priti (AI/ML Detection and Recognition), Shubhi (Database and Reporting)  
Timeline: 18 Aug 2026 to 18 Sep 2026

## Project Structure

```text
Neoai_attendance_system/
|- backend/                 # Flask/FastAPI backend
|  |- app/
|  |  |- api/               # API route handlers
|  |  |- models/            # ORM models and DB schema
|  |  |- services/          # Detection, recognition, reporting logic
|  |  `- utils/             # Shared helpers
|  |- tests/                # Backend tests
|  `- requirements.txt
|- frontend/                # Web frontend
|  |- src/
|  |  |- components/        # Reusable UI components
|  |  |- pages/             # Login, capture, review, reports
|  |  `- services/          # API clients
|  `- public/
|- ai_models/               # Face detection and recognition modules
|  |- detection/
|  |- recognition/
|  |- notebooks/
|  `- sample_data/
|- database/
|  |- schema/
|  `- migrations/
|- docs/
|  |- architecture/
|  |- meeting_notes/
|  |- api_specs/
|  `- PROJECT_CHARTER.md
|- scripts/
`- .github/workflows/
```

## Tech Stack

- Backend: Python, Flask or FastAPI
- Frontend: React
- AI/ML: OpenCV, MediaPipe, MTCNN, face_recognition, DeepFace
- Database: SQLite (dev) with PostgreSQL as production candidate
- Reporting: Pandas, openpyxl, ReportLab

## Branching Convention

- Branch naming: feature/<name>-<short-description>
- Commit messages should be short and specific
- Daily feature branch pushes are expected
- No direct pushes to main without team alignment

## Getting Started

See docs/PROJECT_CHARTER.md for scope, goals, and the project execution plan.
