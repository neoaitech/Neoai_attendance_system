# Neoai_attendance_system
AI Smart Attendance System — One Month Project Plan

Team: Prathiraj, Prachi, Priti, Shubhi Duration: Tuesday, 18 August 2026 → Friday, 18 September 2026 (24 working days, Sat–Sun off) Goal: Build a working prototype that lets a teacher upload a classroom photo, detects & recognizes registered students, auto-marks attendance, flags unknown faces, and generates an attendance report.

1. Team Roles & Responsibilities
Member	Primary Role	Core Ownership
Prathiraj	Team Lead / Backend Developer	System architecture, backend APIs, integration, deployment, GitHub repo management
Prachi	Frontend / UI-UX Developer	Wireframes, mockups, teacher-facing web app, dashboard, presentation visuals
Priti	AI/ML Engineer (Computer Vision)	Face detection, face recognition, model tuning, accuracy testing
Shubhi	Database & Reporting / QA-Docs	DB design, attendance logic, report generation (PDF/Excel), testing, documentation

Everyone reviews everyone else's module during integration weeks — this isn't siloed work, it's ownership with shared accountability.

2. Suggested Tech Stack
Layer	Tool/Library
Language	Python 3.x
Face Detection	OpenCV + MediaPipe / MTCNN
Face Recognition	face_recognition (dlib-based) or DeepFace
Backend	Flask or FastAPI (REST APIs)
Frontend	React.js (or HTML/CSS/JS if time-constrained)
Database	SQLite (prototype) → MySQL (if scaling)
Reports	Pandas + openpyxl (Excel) / ReportLab (PDF)
Version Control	GitHub (with Issues for bug tracking)
Design	Figma (wireframes/mockups)
3. Phase Overview
Phase	Dates	Focus
Phase 1	Aug 18 – Aug 21 (4 days)	Planning, research, architecture, DB schema, wireframes
Phase 2	Aug 24 – Aug 28 (5 days)	Core dev part 1: detection module, registration, DB setup
Phase 3	Aug 31 – Sep 4 (5 days)	Core dev part 2: recognition, attendance marking, unknown-face handling, reports
Phase 4	Sep 7 – Sep 11 (5 days)	Integration, security, admin panel, bug bash
Phase 5	Sep 14 – Sep 18 (5 days)	Polish, documentation, demo rehearsal, final submission
4. Day-Wise Task Plan
PHASE 1 — Planning & Research

Day 1 — Tue, 18 Aug

All: Kickoff meeting — align on scope, finalize roles, set up GitHub repo + shared Drive/Notion for docs.
Prathiraj: Create repo, define folder structure, write project charter.
Prachi: Research UI patterns from existing attendance apps; list required screens.
Priti: Compare face detection/recognition libraries (OpenCV Haar, MediaPipe, MTCNN, face_recognition, DeepFace).
Shubhi: List all data entities needed (students, classes, sessions, attendance, unknown faces) and reports required.

Day 2 — Wed, 19 Aug

Prathiraj: Draft high-level system architecture diagram (draw.io).
Prachi: Sketch low-fidelity wireframes — login, photo capture, attendance review, report screen.
Priti: Run OpenCV face detection on sample images; shortlist detection approach.
Shubhi: Draft ER diagram — Students, Classes, Sessions, Attendance, UnknownFaces tables.

Day 3 — Thu, 20 Aug

Prathiraj: Finalize tech stack; document required API endpoints.
Prachi: Convert wireframes into high-fidelity Figma mockups.
Priti: Test a face recognition library on a small sample dataset; note accuracy.
Shubhi: Set up local SQLite DB; create initial tables per ER diagram.

Day 4 — Fri, 21 Aug

All: Team review — present architecture, mockups, DB schema, and detection/recognition approach. Consolidate into one "Project Understanding Document."
✅ Milestone: Finalized requirements doc + architecture + wireframes + DB schema.
PHASE 2 — Core Development Part 1

Day 5 — Mon, 24 Aug

Prathiraj: Set up Flask/FastAPI backend skeleton with basic routing.
Prachi: Set up frontend project skeleton; build login/dashboard layout.
Priti: Collect/organize sample face dataset (folder per student).
Shubhi: Implement DB models (SQLAlchemy or equivalent ORM) matching schema.

Day 6 — Tue, 25 Aug

Prathiraj: Build "upload classroom photo" API endpoint.
Prachi: Build photo upload UI (camera capture / file upload component).
Priti: Implement face detection module (detect all faces, draw bounding boxes).
Shubhi: Build Student Registration API + DB insert logic.

Day 7 — Wed, 26 Aug

Prathiraj: Integrate detection module with the upload endpoint.
Prachi: Build "Register Student" form (name, roll no, face photo upload).
Priti: Build face-encoding generator (create & store embeddings for registered students).
Shubhi: Design attendance logic — session-wise, date-wise record structure.

Day 8 — Thu, 27 Aug

Prathiraj: Build API to return list of detected faces from an uploaded photo.
Prachi: Build UI grid to display detected faces from a photo.
Priti: Implement face matching logic (compare detected faces vs stored encodings).
Shubhi: Write DB queries to persist attendance records.

Day 9 — Fri, 28 Aug

All: Mid-sprint demo — test detection + basic recognition end-to-end on a sample photo.
✅ Milestone: Working backend prototype (detect + recognize on a single photo).
PHASE 3 — Core Development Part 2

Day 10 — Mon, 31 Aug

Prathiraj: Build "mark attendance" API (auto-mark recognized students present).
Prachi: Build Attendance Review UI (recognized names + confirm/edit checkboxes).
Priti: Tune recognition threshold; handle lighting/angle variation.
Shubhi: Implement auto-absent logic for registered students not detected.

Day 11 — Tue, 1 Sep

Prathiraj: Build "unknown face" flagging API.
Prachi: Build UI to highlight unknown faces with a manual-tag option.
Priti: Implement confidence-threshold-based unknown-face rejection.
Shubhi: Create UnknownFaces table (logs cropped face, timestamp, session).

Day 12 — Wed, 2 Sep

Prathiraj: Build report generation API (daily/weekly summary).
Prachi: Build Report Dashboard UI (attendance %, present/absent list, date filter).
Priti: Optimize recognition for batch processing of group photos.
Shubhi: Implement Excel/PDF export (Pandas + openpyxl/ReportLab).

Day 13 — Thu, 3 Sep

Prathiraj: Full frontend–backend API integration across all screens.
Prachi: Polish styling, responsiveness, loading states.
Priti: Test recognition on multiple classroom photos of varying class sizes.
Shubhi: Validate report accuracy against sample data.

Day 14 — Fri, 4 Sep

All: Full integration test — walk through capture → detect → recognize → mark → report; log and fix bugs.
✅ Milestone: Fully integrated end-to-end working prototype.
PHASE 4 — Integration, Security & Testing

Day 15 — Mon, 7 Sep

Prathiraj: Code review + refactor backend, add error handling.
Prachi: UI/UX review — fix usability gaps, add confirmation dialogs.
Priti: Test edge cases — masks, glasses, poor lighting, overlapping faces.
Shubhi: Validate DB integrity; add backup/export scripts.

Day 16 — Tue, 8 Sep

Prathiraj: Implement teacher login/authentication.
Prachi: Build login page + session handling on frontend.
Priti: Build manual-review queue for low-confidence/unknown faces.
Shubhi: Build admin APIs to add/edit/remove students & classes.

Day 17 — Wed, 9 Sep

Prathiraj: Performance testing (photo processing response time).
Prachi: Build admin panel UI (manage students/classes).
Priti: Re-tune model if needed; document accuracy metrics.
Shubhi: Generate sample reports across multiple sessions; check formatting.

Day 18 — Thu, 10 Sep

All: Bug-bash day — each member tests a module they didn't build; log bugs (GitHub Issues/Trello).
✅ Milestone: Triaged bug list.

Day 19 — Fri, 11 Sep

All: Fix critical/high-priority bugs; sync on remaining work.
✅ Milestone: Stable feature-complete build (v1.0).
PHASE 5 — Finalization & Submission

Day 20 — Mon, 14 Sep

Prathiraj: Prepare demo environment (local server or hosted demo link).
Prachi: Final UI polish; capture screenshots/screen recordings.
Priti: Prepare model performance report (accuracy/precision/recall).
Shubhi: Compile documentation — setup guide + user manual.

Day 21 — Tue, 15 Sep

All: Build presentation deck.
Prathiraj → architecture & backend section
Prachi → UI/UX & live demo section
Priti → AI/ML approach & results section
Shubhi → database/reporting & documentation section

Day 22 — Wed, 16 Sep

All: Full dry-run demo rehearsal (simulate live: capture → attendance → report). Fix any issues found.

Day 23 — Thu, 17 Sep

All: Final polish — README, repo cleanup, code comments, last round of testing.
Prathiraj: Merge all branches, tag final release (v1.0).

Day 24 — Fri, 18 Sep

All: Final submission — project report, source code, presentation deck, demo video.
Team retrospective — capture lessons learned and future improvement ideas.
5. Improvement Ideas to Pitch (as the email encourages)
Liveness detection — prevent spoofing via a photo held up to the camera.
Parent notifications — auto SMS/email alert for absentees.
Analytics dashboard — attendance trends, low-attendance alerts per student.
Mobile app — native teacher app instead of web-only.
Multi-camera/CCTV integration — continuous passive attendance capture.
Cloud storage & scaling — move from SQLite to a cloud DB for multi-classroom deployment.
6. Milestone Summary
Date	Milestone
Aug 21	Requirements, architecture, wireframes, DB schema finalized
Aug 28	Detection + recognition prototype working (backend only)
Sep 4	Full end-to-end integrated prototype
Sep 11	Stable, feature-complete build (v1.0)
Sep 18	Final submission — code, docs, deck, demo video
