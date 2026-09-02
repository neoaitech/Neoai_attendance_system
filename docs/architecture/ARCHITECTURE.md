# System Architecture & Technical Specification

---

## 1. High-Level System Architecture

```mermaid
graph TD
    Client["Frontend Client (SPA - HTML5/CSS3/ES6/Chart.js)"]
    
    subgraph "FastAPI Backend API Layer"
        Router["FastAPI Central Router (/api)"]
        AuthMiddleware["JWT Authentication & RBAC Guard"]
        StaticServer["Static Files Mount (/uploads, /reports_cache)"]
    end

    subgraph "Core Domain & Service Layer"
        CVEngine["FaceEngine (OpenCV CLAHE + dlib ResNet-34)"]
        AttendanceSvc["AttendanceService (Auto-Present & Auto-Absent Logic)"]
        ReportSvc["ReportService (OpenPyXL Excel & ReportLab PDF)"]
        BackupSvc["BackupService (DB Integrity & SQLite Snapshots)"]
    end

    subgraph "Data Storage & File System"
        DB[("SQLite Database (attendance.db)")]
        Uploads[("Disk Storage: uploads/")]
        ReportsCache[("Disk Storage: reports_cache/")]
    end

    Client <-->|"REST API (JSON / Multipart)"| Router
    Router --> AuthMiddleware
    AuthMiddleware --> AttendanceSvc
    AuthMiddleware --> CVEngine
    AuthMiddleware --> ReportSvc
    AuthMiddleware --> BackupSvc
    
    CVEngine <--> Uploads
    AttendanceSvc <--> DB
    ReportSvc <--> DB
    ReportSvc --> ReportsCache
    BackupSvc <--> DB
```

---

## 2. Computer Vision Recognition Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Teacher
    participant Frontend as Frontend SPA
    participant API as FastAPI Backend
    participant CV as FaceEngine (CV)
    participant DB as SQLite Database

    Teacher->>Frontend: Upload Classroom Photo & Select Course
    Frontend->>API: POST /api/sessions/create-and-process (Multipart)
    API->>DB: Fetch Enrolled Students & Stored 128-D Embeddings
    API->>CV: process_classroom_session_photo(image, enrolled_embeddings)
    
    Note over CV: 1. CLAHE Lighting Normalization<br/>2. Multi-Face HOG/CNN Detection<br/>3. 128-D Biometric Vector Extraction<br/>4. Vectorized Euclidean Distance Matching
    
    CV-->>API: {recognized: [...], unknown: [...], annotated_image}
    API->>DB: 1. Insert AttendanceSession<br/>2. Insert PRESENT records for recognized<br/>3. Insert AUTO_ABSENT records for missing<br/>4. Insert UnknownFace records
    DB-->>API: Transaction Committed
    API-->>Frontend: 200 OK (Session data, detections, annotated photo URL)
    Frontend->>Teacher: Display Annotated Photo & Review Roster
```

---

## 3. Data Flow & Security Model

- **Authentication**: JWT tokens signed with HS256 algorithm and 24-hour expiration. Passwords hashed using bcrypt with salt rounds.
- **Role-Based Access Control (RBAC)**:
  - `admin`: Complete administrative privileges, system diagnostics, full DB backup, student/course master edits.
  - `teacher`: Course-level attendance capture, review, overrides, unknown face resolution, and report export.
- **Biometric Privacy**: Raw biometric facial embeddings are stored as 128-dimensional mathematical floating-point vectors, ensuring irreversible one-way template storage compliant with biometric privacy standards.
