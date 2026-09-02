# Project Charter: VisionAttend Pro
**AI-Powered Automated Classroom Attendance & Biometric Analytics System**

---

## 1. Executive Summary
VisionAttend Pro is an enterprise-grade automated classroom attendance and biometric analytics platform. It leverages Computer Vision and 128-dimensional Deep Metric Face Recognition to identify enrolled students from group classroom photos or real-time webcam streams, auto-mark attendance records, flag unknown faces, and generate institutional compliance reports (Excel and PDF) with $<75\%$ defaulter tracking.

---

## 2. Team Roles & Responsibility Assignment Matrix (RACI)

| Milestone & Domain | Prathiraj (Backend & Arch Lead) | Prachi (UI/UX & Frontend Lead) | Priti (AI/Computer Vision Lead) | Shubhi (DB & Analytics Lead) |
| :--- | :--- | :--- | :--- | :--- |
| **Milestone 1: Inception & Specs** | Architecture, API specs, Repo setup (A/R) | Wireframes, Mockups, UI design system (A/R) | CV library comparison & model selection (A/R) | ER Diagram, DB schema & entities (A/R) |
| **Milestone 2: Prototype Core** | FastAPI routing & upload endpoints (A/R) | Single-page UI, Capture & Review (A/R) | Face detection, 128-d embeddings (A/R) | SQLAlchemy ORM, Student insert logic (A/R) |
| **Milestone 3: Full Integration** | Attendance API, JWT auth, Error handling (A/R) | Review UI, Unknown queue, Dashboards (A/R) | Threshold tuning, CLAHE preprocessing (A/R) | Auto-absent logic, Excel/PDF exports (A/R) |
| **Milestone 4: Release & Polish** | RBAC, performance optimization, v1.0 (A/R) | UX polish, responsive layouts, QA (A/R) | Benchmark metrics, edge-case testing (A/R) | DB backups, integrity scripts, docs (A/R) |

*Key: **A** = Accountable, **R** = Responsible, **C** = Consulted, **I** = Informed.*

---

## 3. Scope & Objectives

### In-Scope:
- Biometric 128-D face embedding extraction using ResNet deep metric networks.
- Multi-face detection and CLAHE contrast enhancement for varied classroom lighting.
- Automatic attendance marking (`PRESENT`) for recognized students and auto-marking `ABSENT` for missing students.
- Unknown / low-confidence face extraction, isolation, and manual tagging resolution queue.
- Interactive attendance review workspace with manual status override and audit logging.
- Official institutional Excel (`.xlsx`) and publication-grade PDF dossier exports.
- RBAC authentication for administrators and faculty members with JWT tokens.
- Complete automated test suite covering API, AI engine, business logic, and database integrity.

---

## 4. Technology Stack

- **Backend API**: FastAPI 0.109+ (Python 3.10+) with Uvicorn ASGI server
- **Computer Vision / AI**: `face_recognition` (dlib 20.x ResNet-34), OpenCV 4.13, NumPy
- **Database & ORM**: SQLite 3 with SQLAlchemy 2.0 ORM
- **Security & Auth**: PyJWT, Passlib (Bcrypt hashing, 12 rounds)
- **Document Generators**: `openpyxl` & `pandas` (Excel), `reportlab 5.x` (PDF)
- **Frontend SPA**: Vanilla Modern JavaScript (ES6+), Glassmorphism CSS design system, Lucide Icons, Chart.js
- **Testing & QA**: `pytest`, `pytest-timeout`, `httpx` TestClient
