# VisionAttend Pro - Final Project Presentation Deck
**Slide-by-Slide Team Breakdown for Academic & Industry Review**

---

### Slide 1: Title Slide & Team Introduction
- **Project Title**: VisionAttend Pro: Industry-Grade Automated Classroom Biometric Attendance & Analytics
- **Team**:
  - **Prathiraj**: Architecture, Backend Core, Security & Integration Lead
  - **Prachi**: UI/UX Design, Frontend Architecture & User Flows Lead
  - **Priti**: Computer Vision, Deep Metric Embeddings & Model Benchmarks Lead
  - **Shubhi**: Database Schema, Business Logic, Compliance Reporting & Exports Lead

---

### Slide 2: Problem Statement & Motivation
- Manual roll-call consumes 10-15% of instructional lecture time.
- Proxy attendance and human error compromise compliance and accreditation records.
- Existing biometric fingerprint scanners create bottlenecks at lecture hall entrances and present hygiene concerns.
- **Solution**: Contactless group photo face recognition that processes an entire classroom of 20-50+ students in under 1 second.

---

### Slide 3: Prathiraj's Domain - System Architecture & Backend Infrastructure
- **FastAPI Asynchronous Backend**: Modular routers (`auth`, `students`, `classes`, `sessions`, `reports`, `admin`).
- **Security & Authorization**: JWT token auth, bcrypt salt hashing, RBAC (`admin`, `teacher`).
- **Performance**: Asynchronous non-blocking file ingestion, static mounts for media serving.

---

### Slide 4: Prachi's Domain - UI/UX & Responsive Frontend
- **Design System**: Dark glassmorphic modern SPA with high-contrast typography, glowing KPI cards, and custom badges.
- **Interactive Workspaces**: Dual-mode camera capture, split-screen review canvas with bounding box overlays, and unknown faces resolution queue.
- **Visual Analytics**: Interactive Chart.js telemetry charts, responsive tables with live filters.

---

### Slide 5: Priti's Domain - Computer Vision & Face Recognition Pipeline
- **Contrast Enhancement**: CLAHE (Contrast Limited Adaptive Histogram Equalization) preprocessing for variable lighting.
- **128-D Deep Metric Embeddings**: ResNet-34 deep metric network achieving 99.38% LFW accuracy.
- **Vectorized Matching & Confidence Scaling**: Euclidean distance calculation with calibrated threshold tolerance (0.55).
- **Comprehensive Benchmark**: Quantitative evaluation comparing OpenCV, MediaPipe, MTCNN, dlib, and DeepFace.

---

### Slide 6: Shubhi's Domain - Database Architecture & Enterprise Reporting
- **SQLAlchemy ORM Data Model**: Normalized SQLite schema with foreign key enforcement and cascade rules.
- **Automated Business Logic**: Auto-absent logic for enrolled non-detected students and manual override audit trails.
- **Export Engines**:
  - `openpyxl`: Styled color-coded multi-column spreadsheets with formula headers.
  - `reportlab`: Formal publication-grade PDF dossiers with institution banners, attendance percentages, and instructor signature lines.
- **Data Governance**: One-click SQLite snapshots, JSON exports, and PRAGMA integrity verification.

---

### Slide 7: Live Demonstration & Results Walkthrough
- Real-time demo: Ingest classroom group photo -> AI detection -> review table -> save attendance -> unknown face tagging -> download Excel/PDF reports.

---

### Slide 8: Conclusion & Future Roadmap
- Ready for cloud multi-tenant deployment (PostgreSQL / Docker / Kubernetes).
- Optional edge-camera RTSP streaming for continuous automated lecture hall attendance.
