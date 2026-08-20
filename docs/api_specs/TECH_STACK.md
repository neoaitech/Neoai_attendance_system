# AI Smart Attendance System — Technology Stack Decision

**Date:** 20-Aug-2026  
**Owner:** Prathviraj  
**Role:** Backend / Integration  
**Status:** Development Planning

## 1. Purpose
This document records the proposed development technology stack and separates confirmed project choices from components requiring implementation/testing validation.

## 2. Application Stack

| Layer | Technology / Choice | Purpose |
|---|---|---|
| Frontend | React | User interface |
| Backend API | FastAPI | REST API and integration layer |
| Database | SQLite | Initial local/development database |
| Face Detection | MediaPipe / evaluated detector | Detection and landmark-based alignment |
| Face Recognition | DeepFace with suitable backend | Feature extraction and verification |
| Documentation | Markdown + Draw.io | Technical documentation |
| Version Control | Git + GitHub | Collaboration and review |

## 3. Backend
FastAPI is proposed for the backend REST API connecting the React frontend, database, and AI/ML pipeline.

API contract:
```text
docs/api_specs/API_SPECIFICATION.md
```

## 4. Database
SQLite is the initial database choice for local development.

Core entities:
- Students
- Classes
- Sessions
- Attendance
- UnknownFaces

The database schema must remain consistent with the approved ER diagram.

## 5. AI / ML Processing

### Stage 1 — Face Detection & Alignment
Process an uploaded classroom/group photo. MediaPipe is the recommended detection/alignment candidate from the framework research, subject to project-specific testing.

### Stage 2 — Face Recognition / Verification
DeepFace is the recognition framework candidate, with an appropriate backend such as ArcFace or FaceNet selected after implementation/testing.

Detection and recognition are separate stages.

## 6. Frontend
React will support:
- Login
- Dashboard
- Student registration
- Classroom/group photo upload
- Recognition results
- Attendance review
- Attendance reports

## 7. API Versioning
```text
/api/v1
```

## 8. Testing and Validation
Technology choices are not claims of measured project performance. Project-specific accuracy, processing time, and resource usage must be measured on the project dataset during implementation/testing before final production configuration.

## 9. Security / Repository Rules
Do not commit:
- Real student/classroom photos
- Real biometric data or face embeddings
- Passwords
- API keys or secrets
- `.env` files
- Production databases
- Unapproved model weights

## 10. Current Status
| Component | Status |
|---|---|
| Frontend | Defined |
| Backend | Proposed |
| Development database | Defined |
| Detection approach | Candidate selected for testing |
| Recognition framework | Candidate selected for testing |
| API structure | Defined |
| Production performance configuration | Pending empirical testing |

## 11. Next Integration Steps
1. Implement the SQLite schema.
2. Implement the backend API contract.
3. Connect React screens to the API.
4. Integrate face detection/alignment.
5. Integrate face recognition/verification.
6. Connect recognition results to attendance review.
7. Test the end-to-end workflow.
8. Measure performance and finalize production configuration.
