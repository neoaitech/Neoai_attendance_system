---
title: VisionAttend AI Attendance Platform
emoji: 📸
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 8000
pinned: false
---

# VisionAttend Pro - AI Classroom Attendance & Analytics Platform

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![YOLOv8](https://img.shields.io/badge/Detector-YOLOv8--Face-purple.svg)](https://ultralytics.com/)
[![ArcFace](https://img.shields.io/badge/Recognition-ArcFace--512D-green.svg)](https://github.com/deepinsight/insightface)
[![Status](https://img.shields.io/badge/Release-v1.0.0--Production--Ready-success.svg)](#)

VisionAttend Pro is an enterprise-grade automated classroom attendance and biometric analytics platform. Powered by **YOLOv8-Face Detection** and **ArcFace ResNet-50 512-Dimensional Deep Metric Recognition**, it enables faculty to record attendance in seconds via group photos (1–4 panoramic angles) or live webcam streams.

---

## 🚀 Key Architectural Capabilities

- **Multi-Face Detection**: High-density YOLOv8-Face detector optimized for crowded classroom rows, side angles, and low-light environments.
- **512-D ArcFace Recognition**: Angular hypersphere embeddings with Normalized Cosine Similarity and Ambiguity Margin protection.
- **Multi-Angle Aggregation**: Seamless ingestion of 1 to 4 classroom perspectives with deduplication across views.
- **Anti-Spoofing & Liveness Guard**: 2D FFT spectral lattice texture verification and specular glare reflection filtering.
- **Automated Roster Synchronization**: Marks recognized students as `PRESENT` and absent enrolled students as `ABSENT`.
- **Unknown Faces Resolution Queue**: Isolates unrecognized facial crops for one-click faculty tagging and verification.
- **Interactive Visual Audit**: Bounding box overlay (Green = Enrolled Student, Red = Unknown Face) with manual override and audit trail.
- **Multi-Division Reporting**: Styled multi-sheet `.xlsx` workbooks by division and signed `.pdf` compliance dossiers with $<75\%$ defaulter tracking.
- **Role-Based Security**: Secure JWT HS256 authentication and RBAC for Administrators and Faculty.

---

## 📁 Industry-Standard Directory Structure

```
VisionAttend/
├── .env.example                     # Sample environment configuration
├── .gitignore                        # Git exclusion rules
├── LICENSE                           # MIT License
├── README.md                         # Project documentation
├── requirements.txt                  # Python dependencies
├── run.py                            # Application entry point & server launcher
│
├── backend/                          # Backend application package
│   └── app/
│       ├── main.py                   # FastAPI app, static mounts, and startup lifecycle
│       ├── api/                      # REST API route controllers
│       │   ├── admin.py              # System diagnostics, user management & database health
│       │   ├── analytics.py          # Dashboard KPIs, trend charts & AI benchmarks
│       │   ├── attendance.py         # Record management and individual status overrides
│       │   ├── auth.py               # Authentication, JWT login & current user profile
│       │   ├── classes.py            # Course catalog, batch roster & student enrollment
│       │   ├── reports.py            # Multi-division Excel & PDF report generators
│       │   ├── sessions.py           # Multi-photo classroom ingestion & attendance processing
│       │   ├── students.py           # Student registry, 512-D embeddings & batch transfers
│       │   └── unknown_faces.py      # Unidentified face resolution queue
│       ├── ai/                       # Computer Vision & Deep Learning Engine
│       │   └── face_engine.py        # YOLOv8-Face detector + ArcFace ResNet-50 embedder
│       ├── core/                     # Application configuration, JWT security & password hashing
│       │   ├── config.py             # Centralized settings, model & storage paths
│       │   └── security.py           # Bcrypt hashing & JWT token generation
│       ├── db/                       # Database layer & ORM models
│       │   ├── models.py             # SQLAlchemy entities (User, Student, ClassCourse, etc.)
│       │   ├── seed_data.py          # Demo institutional dataset
│       │   └── session.py            # SQLAlchemy engine, session maker & auto-migrations
│       ├── schemas/                  # Pydantic request/response validation schemas
│       │   ├── analytics.py
│       │   ├── attendance.py
│       │   ├── auth.py
│       │   ├── class_course.py
│       │   ├── report.py
│       │   ├── student.py
│       │   └── unknown_face.py
│       └── services/                 # Business logic & service facades
│           ├── attendance_service.py # Attendance matching & aggregation pipeline
│           ├── backup_service.py     # SQLite database backup & JSON export
│           ├── face_engine.py        # Backward-compatible AI facade
│           └── report_service.py     # OpenPyXL & ReportLab generators
│
├── frontend/                         # Modern Single Page Application (SPA)
│   ├── index.html                    # Single page application entry HTML
│   ├── css/                          # Modular styling architecture
│   │   ├── styles.css                # Master CSS bundle
│   │   ├── base/                     # Reset, variables & global grid layout
│   │   ├── components/               # Badges, buttons, cards, forms, modals, tables, toasts
│   │   └── pages/                    # View-specific CSS stylesheets
│   └── js/                           # Frontend JavaScript architecture
│       ├── api.js                    # Fetch client with automatic JWT bearer handling
│       ├── app.js                    # SPA Router, navigation controller & UI helpers
│       ├── auth.js                   # Authentication & session manager
│       └── views/                    # View controllers
│           ├── admin_panel.js        # System diagnostics & faculty directory
│           ├── capture.js            # Take Attendance & multi-angle scanner
│           ├── classes.js            # Course directory & roster workspace
│           ├── dashboard.js          # Executive dashboard, KPIs & trend chart
│           ├── model_benchmark.js    # AI model performance telemetry
│           ├── profile.js            # Faculty teaching workspace
│           ├── reports.js            # Attendance reports & multi-division export
│           ├── review.js             # Attendance history & biometric inspector
│           ├── students.js           # Student directory & multi-angle registration
│           └── unknown_faces.js      # Unidentified face queue
│
├── database/                         # Database storage & backup archives
│   ├── attendance.db                 # Primary production SQLite database
│   ├── backups/                      # Timestamped SQLite database backup archives
│   └── README.md
│
├── models/                           # Neural network model weights
│   ├── yolo/                         # YOLOv8-Face detection model (yolov8n-face.pt)
│   ├── arcface/                      # ArcFace ResNet-50 512-D ONNX model (arcface_w600k_r50.onnx)
│   └── README.md
│
├── data/                             # Application runtime data & storage
│   ├── uploads/
│   │   ├── students/                 # Student multi-angle biometric reference photos
│   │   ├── sessions/                 # Annotated panoramic classroom attendance photos
│   │   └── unknown_faces/            # Unidentified face crops
│   ├── reports_cache/                # Cached generated Excel (.xlsx) and PDF (.pdf) reports
│   └── README.md
│
├── docs/                             # Technical & architectural documentation
│   ├── architecture/                 # System architecture diagrams & data flows
│   ├── api/                          # REST API endpoint specifications
│   ├── database/                     # ERD & relational database documentation
│   ├── ai/                           # Face recognition benchmark & accuracy telemetry
│   ├── setup/                        # Installation & operations manual
│   ├── reports/                      # Project charter & executive presentation deck
│   └── README.md
│
├── scripts/                          # Automation & administrative utilities
│   ├── database/seed_db.py           # Database initialization & seeding
│   ├── maintenance/run_backup.py     # Automated SQLite backup snapshot
│   └── README.md
│
└── tests/                            # Automated test suite
    ├── conftest.py                   # Pytest fixtures, test database & authentication clients
    ├── run_all_tests.py              # Test suite runner
    ├── test_api_auth.py              # Authentication, JWT & RBAC tests
    ├── test_attendance_service.py    # Attendance matching & aggregation tests
    ├── test_db_integrity.py          # Database foreign keys & integrity tests
    ├── test_face_engine.py           # YOLO & ArcFace pipeline tests
    └── test_reports_and_export.py     # Excel & PDF generation tests
```

---

## ⚡ Quickstart Guide

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Launch the Application
```bash
python run.py
```

### 3. Open in Browser
- **Web Application**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger API Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 4. Default Credentials
| Role | Username | Password |
|---|---|---|
| **System Administrator** | `admin` | `admin123` |
| **Faculty Member** | `dr_sharma` | `teacher123` |

---

## 🧪 Running Automated Tests

Run the complete 24-point test suite with:
```bash
python -m pytest tests/ -v
```
or
```bash
python tests/run_all_tests.py
```

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
