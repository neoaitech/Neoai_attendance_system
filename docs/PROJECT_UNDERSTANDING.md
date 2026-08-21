<div align="center">

# AI Smart Attendance System
## Project Understanding Document — Phase 1 Milestone Baseline

![Status](https://img.shields.io/badge/Phase_1-Ready_for_Sign--off-yellow)
![Milestone](https://img.shields.io/badge/Milestone-21_Aug_2026-blue)
![Team](https://img.shields.io/badge/Team-4_members-orange)
![Next](https://img.shields.io/badge/Phase_2_starts-24_Aug_2026-lightgrey)

**Prepared by:** Prathviraj — Backend / Integration / Team Lead
**Document status:** Phase-1 baseline — ready for team review & sign-off

</div>

---

> **At a glance:** During Phase 1 (18–21 Aug), the team defined requirements, designed the system architecture, finalized the wireframes and database baseline, evaluated 5 AI/ML frameworks, ran 2 early experiments, documented the technology stack, and defined the full API contract. This document consolidates the Phase-1 baseline for Phase 2.

---

## Table of Contents

1. [Document Purpose](#1-document-purpose)
2. [Project Definition](#2-project-definition)
3. [Scope Baseline](#3-scope-baseline)
4. [Requirements → Design Traceability](#4-requirements--design-traceability)
5. [System Architecture Baseline](#5-system-architecture-baseline)
6. [Technology Baseline](#6-technology-baseline)
7. [AI/ML Evidence and Decision Status](#7-aiml-evidence-and-decision-status)
8. [Database Baseline](#8-database-baseline)
9. [API Baseline](#9-api-baseline)
10. [UI Baseline](#10-ui-baseline)
11. [Team Ownership](#11-team-ownership)
12. [Phase-1 Consistency Review](#12-phase-1-consistency-review)
13. [Phase-1 Milestone Status — 21 August 2026](#13-phase-1-milestone-status--21-august-2026)
14. [Phase-2 Development Handoff](#14-phase-2-development-handoff)
15. [Security and Data Handling Baseline](#15-security-and-data-handling-baseline)
16. [Phase-1 Exit Criteria](#16-phase-1-exit-criteria)
17. [Repository Reference](#17-repository-reference)
18. [Sign-off / Approval](#18-sign-off--approval)

---

## 1. Document Purpose

This document consolidates the Phase-1 work completed across requirements, architecture, UI/wireframes, database design, API design, technology selection, and AI/ML framework evaluation.

It is intended to be the shared baseline for Phase 2 implementation. It does **not** replace the detailed source artifacts; those remain the authoritative technical references for their respective areas.

### Source artifacts

| Area | File |
|---|---|
| Charter | `docs/PROJECT_CHARTER.md` |
| Architecture | `docs/architecture/AI_Smart_Attendance_System_Day2_Architecture.drawio` + matching PDF |
| ER Diagram | `docs/database/AI_Smart_Attendance_System_ER_Diagram_Day2.drawio` |
| Database docs | `docs/database/DATABASE_SCHEMA.md`, `database/schema.sql`, `database/attendance.db` |
| Tech stack | `docs/api_specs/TECH_STACK.md` |
| API contract | `docs/api_specs/API_SPECIFICATION.md` |
| AI/ML evidence | `ai_models/detection/` (framework PDF, Day-2 OpenCV report, Day-3 recognition report) |
| UI research | `prachi-ui-research-screens.docx`, `docs/ui/ui-screen.docx` |

---

## 2. Project Definition

### 2.1 Purpose
The system is designed to take a classroom/group photo, detect and recognize registered students, mark attendance for the relevant session, flag unknown or low-confidence faces for human review, and provide attendance reporting.

### 2.2 Current Input Model
The Phase-1 architecture is based on an **uploaded classroom/group photo**.
**Live video-stream attendance is outside the current cycle.**

### 2.3 Core Objectives
- Detect faces in classroom/group photos
- Recognize registered students against stored face representations
- Mark attendance per session
- Flag unknown or low-confidence faces for manual review
- Generate daily/weekly attendance reports with Excel/PDF export
- Validate accuracy and performance using the project dataset during implementation

---

## 3. Scope Baseline

### ✅ In Scope
Photo upload · Face detection · Face recognition/matching · Session-wise attendance · Unknown-face/manual review · Teacher login/authentication · Student and class administration · Attendance reporting/export · Basic project-dataset performance and accuracy validation

### ❌ Out of Scope (Current Cycle)
Live video-stream attendance · Native mobile application · Multi-campus production deployment · Fingerprint/RFID fallback · Production-grade horizontal scaling

*These scope boundaries are taken from the Phase-1 project plan, not assumptions added by this document.*

---

## 4. Requirements → Design Traceability

| Requirement / capability | Architecture | API | Database | UI | AI/ML |
|---|:---:|:---:|:---:|:---:|:---:|
| Teacher authentication | ✓ | ✓ | — | ✓ | — |
| Student/class management | ✓ | ✓ | ✓ | ✓ | — |
| Classroom photo upload | ✓ | ✓ | Session/photo fields | ✓ | ✓ |
| Face detection/alignment | ✓ | ✓ | — | Recognition result | ✓ |
| Face recognition/verification | ✓ | ✓ | Student face representation | Recognition result | ✓ |
| Attendance marking | ✓ | ✓ | ✓ | ✓ | ✓ |
| Unknown/low-confidence review | ✓ | ✓ | ✓ | ✓ | ✓ |
| Attendance reports/export | ✓ | ✓ | ✓ | ✓ | — |

**Interpretation:** This is a Phase-1 consistency view of existing artifacts — not a claim that every integration is already implemented.

---

## 5. System Architecture Baseline

1. **Actor / Entry** — teacher login, session start, photo upload, review, confirmation/correction, reports
2. **Presentation** — web UI for login, dashboard, registration, upload, recognition results, review and reports
3. **Application / Backend API** — auth, validation, session ops, student/class ops, AI orchestration, attendance confirmation, reporting APIs
4. **AI Processing** — Stage 1 detection/alignment → Stage 2 recognition/verification
5. **Data & Reporting** — application database + attendance reporting
6. **Cross-cutting Security** — authentication, file/field validation, protection of sensitive data

```text
Teacher → React Web UI → FastAPI REST API → Class/Session Selection
    → Classroom Photo Upload → Face Detection & Alignment
    → Face Recognition/Verification → Recognized / Unknown / Low-confidence Decision
    → Attendance Result → Manual Teacher Review → Persist Attendance → Reports/Export
```

---

## 6. Technology Baseline

| Layer | Phase-1 choice / candidate | Status |
|---|---|---|
| Frontend | React | Selected |
| Backend API | FastAPI | Selected |
| Database | SQLite (dev) | Selected for development |
| Face Detection | MediaPipe | Recommended candidate — validation pending |
| Face Recognition | DeepFace | Recommended candidate — backend selection pending |
| Recognition backend | ArcFace / FaceNet | Pending implementation/testing |
| Reporting | Pandas, openpyxl, ReportLab | Documented |
| Version Control | Git + GitHub | In use |

> **Important:** A technology listed here does not mean production performance has already been proven.

---

## 7. AI/ML Evidence and Decision Status

### 7.1 Framework evaluation (Day 1)

| Framework | Type | Suitability |
|---|---|:---:|
| OpenCV Haar Cascades | Detection | Low |
| **MediaPipe** | Detection & Alignment | **High** |
| MTCNN | Detection & Alignment | Medium |
| face_recognition (dlib) | Detection & Recognition | Medium |
| **DeepFace** | Recognition wrapper | **High** |

### 7.2 OpenCV detection experiment (Day 2) — real test results

| Test image | Expected faces | Detected | Missed | Quality |
|---|:---:|:---:|:---:|---|
| Single person | 1 | 1 | 0 | High (100%) |
| Side face | 1 | 1 | 0 | Medium |
| **Group of 4 people** | 4 | **1** | **3** | **Low — failed 3 faces** |

**Conclusion:** OpenCV Haar Cascade detected only 1 of 4 faces in a classroom-style group photo and is **ruled out** for multi-face attendance use. This directly confirmed the Day-1 framework recommendation to use MediaPipe instead.

### 7.3 Recognition experiment (Day 3)
`face_recognition` tested on an LFW sample: two photos of the same person matched with a distance of **0.4765** (below the 0.6 match threshold). Reported as a **single-sample qualitative result**, not project-wide accuracy.

### 7.4 Recommended pipeline
```text
MediaPipe → Detection/Alignment → DeepFace → Recognition/Verification
    → Confidence/Decision → Attendance or Manual Review
```

### 7.5 Not Yet Proven (requires real dataset)
Project-level recognition accuracy · Project-level detection recall · Processing time · Resource usage · Production model/backend configuration

---

## 8. Database Baseline

**5 core entities:** `Classes` → `Students` → `Sessions` → `Attendance` ← `UnknownFaces`

| Entity | Key Fields & Rules |
|---|---|
| Classes | `class_id` (PK), class_name, subject, teacher_name |
| Students | `student_id` (PK), `roll_no` (UNIQUE), class_id (FK), face_encoding |
| Sessions | `session_id` (PK), class_id (FK), session_date, photo_uploaded_path |
| Attendance | `attendance_id` (PK), session_id + student_id (FK, **UNIQUE pair**), status ∈ {present, absent, late} |
| UnknownFaces | `unknown_face_id` (PK), session_id (FK), tagged_student_id (FK, nullable) |

Foreign keys, unique constraints, and indexes on all FK columns are implemented **and verified directly against the `.db` file** — not just documented on paper.

---

## 9. API Baseline

**Version:** `/api/v1`

Authentication · Classes · Students · Sessions · Photo Upload · Face Processing/Recognition · Attendance Review · Unknown Faces · Reports · Standard error handling

---

## 10. UI Baseline

**7 required screens:** Login → Dashboard → Student Registration → Upload Group Photo → Recognition Result → Attendance Review → Attendance Report

**Design principles:** clear Present/Absent/Unknown indicators · visual separation of recognized vs unknown faces · simple manual-review path · 3–4 step teacher workflow · explicit confirmation before finalizing · date/student filtering with export

---

## 11. Team Ownership

| Member | Role | Ownership |
|---|---|---|
| **Prathviraj** | Backend / Integration / Team Lead | APIs, Git workflow, integration, deployment/demo coordination |
| **Prachi** | Frontend / UI Lead | UI/UX research, wireframes, mockups, screens, styling |
| **Priti** | AI/ML Lead | Detection/recognition framework evaluation, model testing, accuracy validation |
| **Shubhi** | Database & Reporting Lead | Data model, database implementation, attendance logic, reporting |

---

## 12. Phase-1 Consistency Review

**Verified:**
- Database entities match the architecture and API model
- The two-stage Detection → Recognition pipeline matches the AI/ML recommendation
- UI screens map to the presentation workflow and corresponding API actions
- React, FastAPI, SQLite, MediaPipe, DeepFace are consistent across all technical docs
- No real student photos, biometric data, passwords, API keys or `.env` files in the repository
- AI results are labeled qualitative/single-sample, not project-wide accuracy

**Open validation items:** full project-dataset accuracy testing · end-to-end integration testing · production performance benchmarking · final DB/model configuration

---

## 13. Phase-1 Milestone Status — 21 August 2026

| Deliverable | Owner | Status |
|---|---|---|
| Requirements & Project Charter | Prathviraj | ✅ Finalized |
| System Architecture | Prathviraj | ✅ Finalized |
| Wireframes / Mockups | Prachi | ✅ Finalized |
| Database Schema (ER + SQLite) | Shubhi | ✅ Finalized |
| AI/ML Framework Selection | Priti | ✅ Finalized as candidate (empirical testing pending) |
| Technology Stack | Prathviraj | ✅ Finalized for planning |
| API Contract | Prathviraj | ✅ Finalized for planning |
| Project Understanding Document | Prathviraj | ✅ This document |

> **"Finalized" = finalized as the Phase-1 planning/design baseline** — not a claim that the full production system is already implemented.

---

## 14. Phase-2 Development Handoff

Phase 2 begins **24 August 2026**.

| Date | Planned outcome |
|---|---|
| 24 Aug | Backend skeleton with basic routing |
| 25 Aug | Classroom photo upload API |
| 26 Aug | Detection module integration |
| 27 Aug | API returning detected faces |
| 28 Aug | Working backend prototype / milestone demo |

---

## 15. Security and Data Handling Baseline

**The repository must never contain:** real student/classroom photos · real biometric data or face embeddings · passwords · API keys/secrets · `.env` files · production databases · unapproved model weights

Development/testing data must be synthetic or explicitly approved. Sensitive student information must not appear in repository docs, issues, screenshots, or logs.

---

## 16. Phase-1 Exit Criteria

- [x] Requirements and scope
- [x] Architecture
- [x] API contract
- [x] Technology stack
- [x] Database model/schema
- [x] UI/wireframe direction
- [x] AI/ML framework evaluation
- [x] Security/repository rules
- [x] Cross-team consistency review
- [x] Project Understanding Document

**Phase-2 activities (not Phase-1 criteria):**
- [ ] Full backend implementation
- [ ] End-to-end integration
- [ ] Project-dataset accuracy testing
- [ ] Production performance benchmarking
- [ ] Final production configuration

---

## 17. Repository Reference

`github.com/neoaitech/Neoai_attendance_system`

```text
docs/PROJECT_CHARTER.md
docs/architecture/
docs/database/
docs/api_specs/
docs/ui/
database/
ai_models/detection/
```

---

## 18. Sign-off / Approval

*To be completed during the 21 August milestone sync call.*

- [ ] Prathviraj — Team Lead
- [ ] Prachi — Frontend / UI Lead
- [ ] Priti — AI/ML Lead
- [ ] Shubhi — Database & Reporting Lead
---

<div align="center">

**Document owner:** Prathviraj · **Phase:** 1 — Planning & Research · **Status:** Ready for team review

</div>
