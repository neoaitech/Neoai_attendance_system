# AI Smart Attendance System

An AI-powered classroom attendance system that detects and recognizes student faces from a classroom photo, auto-marks attendance, flags unknown faces for manual review, and generates attendance reports.

**Organization:** Neo AI Tech  
**Team:** Prathiraj (Backend and API), Prachi (Frontend and UI), Priti (AI/ML Detection and Recognition), Shubhi (Database and Reporting)  
**Timeline:** 18 Aug 2026 to 18 Sep 2026

---

## Project Structure

```text
Neoai_attendance_system/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/             # API route handlers
│   │   ├── models/          # ORM models and database schema
│   │   ├── services/        # Business logic and integrations
│   │   └── utils/           # Shared backend utilities
│   ├── tests/               # Backend tests
│   ├── README_DAY5.md       # Day-5 backend skeleton notes
│   └── requirements.txt     # Backend dependencies
│
├── frontend/                # Web frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Login, capture, review, and reports
│   │   └── services/        # API clients
│   └── public/
│
├── ai_models/               # Face detection and recognition modules
│   ├── detection/
│   ├── recognition/
│   ├── notebooks/
│   └── sample_data/
│
├── database/
│   ├── schema/
│   └── migrations/
│
├── docs/
│   ├── architecture/
│   ├── meeting_notes/
│   ├── api_specs/
│   └── PROJECT_CHARTER.md
│
├── scripts/
└── .github/
    └── workflows/
```

---

## Tech Stack

- **Backend:** FastAPI
- **Frontend:** React
- **AI/ML:** OpenCV, MediaPipe, MTCNN, face_recognition, DeepFace
- **Database:** SQLite for development, with PostgreSQL as the production candidate
- **Reporting:** Pandas, openpyxl, ReportLab

---

## Backend API

The backend API follows the approved versioned API contract:

```text
/api/v1
```

### Current Backend Skeleton

The Phase-2 Day-5 backend provides the basic API routing structure for:

- Health check
- Authentication
- Classes
- Students
- Sessions
- Classroom photo upload
- Face recognition workflow
- Attendance
- Unknown faces
- Reports

The Day-5 implementation is a **backend skeleton with basic routing**. AI processing, database integration, and complete business logic are implemented progressively in subsequent Phase-2 milestones.

---

## API Modules

```text
backend/app/api/
├── __init__.py
├── _utils.py
├── auth.py
├── classes.py
├── students.py
├── sessions.py
├── attendance.py
├── recognition.py
├── unknown_faces.py
└── reports.py
```

---

## Attendance Workflow

The planned system workflow is:

```text
Class / Session
      ↓
Classroom Group Photo
      ↓
Face Detection
      ↓
Face Recognition
      ↓
Confidence / Decision
      ↓
Attendance Generation
      ↓
Unknown Face Review
      ↓
Teacher Verification
      ↓
Attendance Reports
```

The system is designed around classroom/group-photo based attendance rather than continuous live-video attendance.

---

## Phase-2 Development

The backend implementation is being developed incrementally:

```text
24 Aug  → Backend skeleton + basic routing
25 Aug  → Classroom photo upload API
26 Aug  → Face detection integration
27 Aug  → Detected faces API
28 Aug  → Working backend prototype
```

Each milestone adds functionality on top of the approved API and architecture baseline.

---

## Branching Convention

- Branch naming: `feature/<name>-<short-description>`
- Commit messages should be short and specific
- Daily feature branch pushes are expected
- No direct pushes to `main` without team alignment
- Changes should be tested locally before pushing
- Feature work should remain isolated in the developer's feature branch until reviewed

---

## Development Setup

### Backend

Open a terminal in the `backend` directory:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Start the development server:

```powershell
uvicorn app.main:app --reload
```

The API is available at:

```text
http://127.0.0.1:8000
```

Interactive API documentation:

```text
http://127.0.0.1:8000/docs
```

Health check:

```text
http://127.0.0.1:8000/api/v1/health
```

Expected response:

```json
{
  "status": "ok"
}
```

---

## Current Development Status

### Phase-1

- Requirements and project scope defined
- System architecture established
- API contract defined
- Database baseline established
- Technology stack selected

### Phase-2

- Backend API skeleton: **Completed**
- Basic API routing: **Completed**
- Independent local API testing: **Completed**
- Classroom photo upload implementation: **Completed**
- Face detection integration: **Planned**
- Face recognition integration: **Planned**
- Database integration: **Planned**
- Attendance processing: **Planned**
- Reporting implementation: **Planned**

---

## Documentation

Project documentation is maintained under:

```text
docs/
├── architecture/
├── meeting_notes/
├── api_specs/
└── PROJECT_CHARTER.md
```

Refer to `docs/PROJECT_CHARTER.md` for the overall project scope, goals, milestones, and execution plan.

---

## Team

| Member | Responsibility |
|---|---|
| Prathiraj | Backend and API |
| Prachi | Frontend and UI |
| Priti | AI/ML Detection and Recognition |
| Shubhi | Database and Reporting |

---

## Development Principles

- Follow the approved API contract
- Keep frontend, backend, AI/ML, and database responsibilities separated
- Do not commit secrets, credentials, biometric data, or generated sensitive files
- Validate uploaded files before processing
- Test changes locally before pushing
- Keep feature branches focused on their assigned milestone
- Do not claim unimplemented functionality as completed
- Keep API versioning consistent with `/api/v1`
- Maintain clear separation between API routes, business logic, AI models, and database components

---

## Project Status

The project is currently progressing through Phase-2 implementation.

The Day-5 backend skeleton establishes the FastAPI application structure and approved API routes. Further milestones will progressively implement photo upload, face detection, recognition, attendance processing, database integration, and reporting functionality.
