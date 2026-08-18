# Project Charter — AI Smart Attendance System

**Organization:** Neo AI Tech
**Prepared by:** Prathiraj (Project/Backend)
**Date:** 18 August 2026
**Status:** Draft — Phase 1 (Planning & Research)

## 1. Project Purpose

Build an AI-powered classroom attendance system that takes a single classroom photo, detects and
recognizes student faces, auto-marks attendance, flags unrecognized faces for manual review, and
produces attendance reports — replacing manual roll-call with a faster, auditable process.

## 2. Objectives

1. Detect all faces in a classroom group photo with high recall.
2. Recognize registered students against a stored face-encoding database.
3. Auto-mark present/absent status per session and persist it reliably.
4. Flag unknown or low-confidence faces for a human to review and tag.
5. Generate daily/weekly attendance reports (Excel/PDF export).
6. Ship a stable, demo-ready build by 18 September 2026.

## 3. Scope

**In scope:** Photo upload, face detection, face recognition/matching, attendance marking,
unknown-face review queue, teacher login, admin panel (students/classes), reporting/export,
basic performance and accuracy validation.

**Out of scope (this cycle):** Live video-stream attendance, mobile native app, multi-campus
deployment, biometric fallback (fingerprint/RFID), production-grade horizontal scaling.

## 4. Team & Roles

| Name | Role | Primary Responsibility |
|---|---|---|
| Prathiraj | Backend / DevOps | Backend APIs, repo & Git workflow, integration, deployment demo |
| Prachi | Frontend / UI Lead | UI/UX, wireframes → mockups, all screens, styling |
| Priti | AI/ML Lead | Face detection & recognition, model tuning, accuracy validation |
| Shubhi | Database & Reporting Lead | Data model, DB implementation, attendance logic, reports/export, documentation |

## 5. Timeline & Phases

| Phase | Dates | Goal |
|---|---|---|
| 1. Planning & Research | 18–21 Aug | Requirements, architecture, wireframes, DB schema finalized |
| 2. Core Dev Part 1 | 24–28 Aug | Working backend prototype (detect + recognize on a single photo) |
| 3. Core Dev Part 2 | 31 Aug–4 Sep | Fully integrated end-to-end working prototype |
| 4. Integration, Security & Testing | 7–11 Sep | Stable, feature-complete build (v1.0) |
| 5. Finalization & Submission | 14–18 Sep | Final submission: code, docs, deck, demo video |

Milestone sync calls: 21 Aug, 28 Aug, 4 Sep, 11 Sep, 18 Sep.

## 6. Proposed Tech Stack (final choice by 20 Aug)

- **Backend:** Python — Flask or FastAPI
- **Frontend:** React (SPA)
- **AI/ML:** OpenCV, MediaPipe, MTCNN, face_recognition, DeepFace — shortlisted by Priti in Phase 1
- **Database:** SQLite (development) → PostgreSQL (production candidate)
- **Version Control:** Git / GitHub — `neoaitech/Neoai_attendance_system`
- **Reporting:** Pandas, openpyxl, ReportLab

## 7. Working Agreement

- Working days: Monday–Friday, 18 Aug – 18 Sep 2026.
- Each member commits and pushes to their own `feature/<name>-<description>` branch daily.
- Prathiraj performs an end-of-day merge check and pushes the consolidated build to `main`.
- No direct pushes to `main` without a heads-up in the group.
- Daily evening update in the group: 2–3 lines on what was completed, any blocker, plus a
  screenshot of that day's actual work.

## 8. Success Criteria

- v1.0 stable build by 11 September 2026.
- End-to-end flow works: upload photo → detect → recognize → mark attendance → export report.
- Final submission package (code, documentation, presentation deck, demo video) delivered by
  18 September 2026.

## 9. Risks (initial)

| Risk | Mitigation |
|---|---|
| Face recognition accuracy in poor lighting / occlusion | Priti to test edge cases early (Phase 4), maintain a manual-review fallback |
| Team members blocked on dependencies (e.g. frontend needs API contracts) | Finalize API endpoint list by 20 Aug; use mock data until backend is ready |
| Branch conflicts at daily merge | Small, frequent commits; clear branch naming; daily merge discipline |

## 10. Approval

This charter reflects the team's shared understanding as of 18 Aug 2026 and will be reviewed and
finalized during the 21 Aug milestone sync alongside architecture, wireframes, and DB schema.
