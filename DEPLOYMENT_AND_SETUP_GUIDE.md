# 🚀 VisionAttend Pro: Complete Setup, Architecture & Deployment Guide

> **Production-Ready AI Classroom Attendance & Biometric Analytics Platform**  
> *YOLO Face Detection • MiniFASNetV2 Anti-Spoofing • ArcFace 512-D Recognition • Curricular Compliance Matrix*

---

## 📑 Table of Contents
1. [System Architecture & Overview](#1-system-architecture--overview)
2. [Project File Structure & Directory Anatomy](#2-project-file-structure--directory-anatomy)
3. [Data Storage & Biometrics Persistence](#3-data-storage--biometrics-persistence)
4. [Local Setup & Development Guide (Windows / Linux / macOS)](#4-local-setup--development-guide)
5. [Mobile Testing on Local Wi-Fi](#5-mobile-testing-on-local-wi-fi)
6. [Production Deployment - Method 1: Linux VPS (AWS EC2 / Ubuntu / Nginx / SSL)](#6-production-deployment---method-1-linux-vps-aws-ec2--ubuntu--nginx--ssl)
7. [Production Deployment - Method 2: Docker & Docker Compose](#7-production-deployment---method-2-docker--docker-compose)
8. [Production Deployment - Method 3: Cloud PaaS (Render / Railway with Persistent Storage)](#8-production-deployment---method-3-cloud-paas-render--railway)
9. [Database Scaling: SQLite to PostgreSQL Migration](#9-database-scaling-sqlite-to-postgresql-migration)
10. [Security, Backups & Maintenance Checklist](#10-security-backups--maintenance-checklist)
11. [Troubleshooting & Common Questions (FAQ)](#11-troubleshooting--common-questions-faq)

---

## 1. System Architecture & Overview

VisionAttend Pro utilizes a modern, high-performance, decoupled client-server architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND CLIENT LAYER                           │
│  - Vanilla JavaScript Modular SPA (18 Views)                           │
│  - Responsive Multi-Breakpoint Design System (Mobile -> 4K Monitors)   │
│  - Real-time Camera Feed, Multi-angle Photo Ingestion, Visual Auditing │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST API (JSON / FormData)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND API & AI ENGINE                         │
│  - FastAPI (Python 3.10+) + Uvicorn ASGI Server                        │
│  - Computer Vision Pipeline:                                           │
│      1. YOLOv8 Face Detection (Classroom Multi-Face Bounding Boxes)   │
│      2. MiniFASNetV2 Liveness Verification (2D / Screen Spoof Filter)  │
│      3. ArcFace ResNet50 (512-Dimensional Deep Biometric Embeddings)  │
│  - JWT Bearer Authentication & Role-Based Access Control (RBAC)        │
│  - Multi-Division Curricular Attendance Calculation Engine             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────┐
│         DATABASE STORAGE          │ │         PHYSICAL ASSETS           │
│  - SQLAlchemy ORM                 │ │  data/uploads/                    │
│  - SQLite (attendance.db)         │ │  ├── students/ (Profiles)         │
│    or PostgreSQL (Production)     │ │  ├── sessions/ (Classroom Photos) │
│  - 512-D Vectors in JSON fields   │ │  └── unknown_faces/ (Crops)       │
└───────────────────────────────────┘ └───────────────────────────────────┘
```

---

## 2. Project File Structure & Directory Anatomy

```text
ai-attendance-system/
├── backend/                             # Backend Application Source Code
│   ├── app/
│   │   ├── ai/                          # AI Computer Vision Pipeline
│   │   │   ├── face_engine.py           # YOLO + ArcFace + MiniFASNet inference pipeline
│   │   │   └── models.py                # PyTorch neural network definitions
│   │   ├── api/                         # REST API Route Controllers
│   │   │   ├── academic.py              # Department, Program, Course APIs
│   │   │   ├── admin.py                 # System diagnostics, Database backups
│   │   │   ├── analytics.py             # Dashboard KPIs & Attendance Trends
│   │   │   ├── attendance.py            # Session creation & Scanning endpoints
│   │   │   ├── auth.py                  # JWT Login, Session management, RBAC
│   │   │   ├── classes.py               # Course offerings & Roster endpoints
│   │   │   ├── reports.py               # Excel/PDF Exports, Multi-division matrices
│   │   │   ├── sessions.py              # Historical attendance session audits
│   │   │   ├── students.py              # Student CRUD & Biometric photo uploads
│   │   │   └── unknown_faces.py         # Unidentified face resolution queue
│   │   ├── core/                        # Configuration & Security
│   │   │   ├── config.py                # Environment settings & Path resolvers
│   │   │   └── security.py              # Password hashing & JWT token generators
│   │   ├── db/                          # Database Layer
│   │   │   ├── models.py                # SQLAlchemy Database Models (10 Tables)
│   │   │   ├── seed_data.py             # Institutional seed data (Admin, Faculty, Students)
│   │   │   └── session.py               # Database engine, Session factory, Auto-migrations
│   │   ├── schemas/                     # Pydantic Request/Response validation schemas
│   │   ├── services/                    # Business Logic Layer
│   │   │   ├── attendance_service.py    # Attendance marking, deduplication, auto-tagging
│   │   │   ├── face_engine.py           # Centralized face extraction & comparison service
│   │   │   └── report_service.py        # 3-Tier attendance math, Defaulter formulas, Exports
│   │   └── main.py                      # FastAPI App Initialization, Static Files, Middleware
│   └── tests/                           # Backend Pytest Test Suites (41 Unit & Integration Tests)
│
├── frontend/                            # Single-Page Frontend Application
│   ├── css/                             # Modular Responsive CSS Architecture
│   │   ├── base/                        # Global reset, variables, layout, typography
│   │   │   ├── layout.css               # App shell, Topbar, Sidebar, Mobile drawer
│   │   │   ├── reset.css                # Base browser normalizations
│   │   │   ├── typography.css           # Fonts and headings
│   │   │   └── variables.css            # Enterprise SaaS color palette and tokens
│   │   ├── components/                  # Reusable UI component styles
│   │   │   ├── badges.css               # Status & RBAC badges
│   │   │   ├── buttons.css              # Unified button styles
│   │   │   ├── cards.css                # KPI grids, glass cards, summary panels
│   │   │   ├── forms.css                # Form inputs, labels, responsive grids (1-4 cols)
│   │   │   ├── modals.css               # Responsive modal dialogs
│   │   │   ├── tables.css               # Data tables with overflow containment
│   │   │   └── toast.css                # Animated toast notifications
│   │   ├── pages/                       # View-specific CSS stylesheets
│   │   │   ├── admin_panel.css          # System diagnostics styles
│   │   │   ├── auth.css                 # Responsive login portal
│   │   │   ├── capture.css              # Scanner, Camera viewport, Face crop grid
│   │   │   ├── classes.css              # Course cards and offerings
│   │   │   ├── dashboard.css            # Chart layout & Progress tracks
│   │   │   ├── dedicated_forms.css      # New/Edit student & course forms
│   │   │   ├── model_benchmark.css      # AI metric progress meters
│   │   │   ├── profile.css              # Faculty profile hero & assignments
│   │   │   ├── reports.css              # 3-Tier KPI breakdown cards & export tools
│   │   │   ├── review.css               # History session inspector
│   │   │   ├── students.css             # Student grid & filter toolbar
│   │   │   └── unknown_faces.css        # Unidentified face resolution cards
│   │   └── styles.css                   # Master CSS bundle aggregator
│   ├── js/                              # Vanilla JavaScript MVC Architecture
│   │   ├── api.js                       # Centralized API fetch wrapper with Bearer token
│   │   ├── app.js                       # SPA Router, Global Modals, Toast notifications
│   │   ├── auth.js                      # Authentication manager, Role switcher, Session timeout
│   │   └── views/                       # 18 Modular View Controllers
│   │       ├── admin_panel.js           # Database backups & system telemetry
│   │       ├── capture.js               # Live scanner, Multi-photo ingestion, Face linking
│   │       ├── classes.js               # Course offering catalog & batch management
│   │       ├── course_edit.js           # Edit course metadata
│   │       ├── course_new.js            # Create new academic course master
│   │       ├── dashboard.js             # Analytics charts, KPI counters, Quick actions
│   │       ├── faculty_edit.js          # Edit faculty credentials & assignments
│   │       ├── faculty_new.js           # Register new faculty member
│   │       ├── model_benchmark.js       # Face detection & recognition accuracy benchmarks
│   │       ├── offering_edit.js         # Edit class offering divisions & faculty
│   │       ├── offering_new.js          # Create new multi-division course offering
│   │       ├── profile.js               # Faculty teaching workspace & assigned classes
│   │       ├── reports.js               # Hierarchical batch matrix, 3-tier calculations, PDF/Excel
│   │       ├── review.js                # Attendance audit history & bounding box inspector
│   │       ├── roster_manage.js         # Course roster enrollment & student assignments
│   │       ├── student_edit.js          # Update student details & biometrics
│   │       ├── student_new.js           # Enroll new student with 3-8 face photos
│   │       ├── students.js              # Master student directory & filter tools
│   │       └── unknown_faces.js         # Unknown face tagging queue
│   └── index.html                       # Single HTML Entrypoint
│
├── database/                            # SQLite Database Storage
│   ├── attendance.db                    # Active SQLite Database File
│   └── backups/                         # Automated and manual DB backup dumps
│
├── data/                                # Dynamic User & Operational Uploads
│   ├── uploads/
│   │   ├── students/                    # Enrolled student face photos
│   │   ├── sessions/                    # Classroom multi-angle photos
│   │   └── unknown_faces/               # Unidentified face crops extracted by YOLO
│   └── reports_cache/                   # Generated PDF & Excel attendance dossiers
│
├── models/                              # Pre-Trained Deep Learning Weights
│   ├── yolo/yolov8n-face.pt             # YOLOv8 Face Detection Model
│   ├── minifasnet/minifasnetv2.pth      # MiniFASNetV2 Anti-Spoofing PyTorch Model
│   └── arcface/arcface_w600k_r50.onnx   # ArcFace ResNet50 512-D ONNX Embedder
│
├── requirements.txt                     # Python Dependencies List
├── run.py                               # Application Startup Entrypoint
├── .env.example                         # Example Environment Configuration
└── README.md                            # High-Level Project Overview
```

---

## 3. Data Storage & Biometrics Persistence

| Data Type | Storage Location | Persistence & Backup Mechanism |
|---|---|---|
| **Relational Data** (Users, Courses, Rosters, Sessions, Logs) | `database/attendance.db` | Single file. Copying `attendance.db` preserves the entire institutional database. |
| **512-D AI Face Embeddings** | `students` table (`face_embedding` column) | Serialized JSON array of 512 float numbers inside the database. No re-training required on server migration! |
| **Student Photos** | `data/uploads/students/` | Static image files (`.jpg`, `.png`). Served via `/uploads/students/...` |
| **Classroom Session Photos** | `data/uploads/sessions/` | Multi-angle classroom photos. Served via `/uploads/sessions/...` |
| **Unidentified Face Crops** | `data/uploads/unknown_faces/` | Cropped bounding box images. Served via `/uploads/unknown_faces/...` |
| **Attendance Reports** | `data/reports_cache/` | Auto-generated `.xlsx` and `.pdf` files. |

---

## 4. Local Setup & Development Guide

### Prerequisites
- **Python**: Version `3.10` or higher (`3.10`, `3.11`, `3.12`)
- **Git**: For cloning the repository
- **Operating System**: Windows 10/11, Ubuntu/Debian Linux, or macOS

### Step-by-Step Installation:

```bash
# 1. Clone or navigate to the project directory
cd ai-attendance-system

# 2. Create a Python virtual environment
python -m venv venv

# 3. Activate the virtual environment
# On Windows (PowerShell):
.env\Scripts\Activate.ps1
# On Windows (Command Prompt):
.env\Scriptsctivate.bat
# On Linux / macOS:
source venv/bin/activate

# 4. Upgrade pip and install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# 5. Start the application
python run.py
```

### Accessing the Local Platform:
- **Web Portal**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Default Institutional Credentials**:
  - **Administrator**: Username: `admin` | Password: `admin123`
  - **Course Faculty**: Username: `dr_sharma` | Password: `teacher123`

---

## 5. Mobile Testing on Local Wi-Fi

You can test the entire responsive frontend on any mobile phone (Android / iOS) connected to the **same Wi-Fi network**:

```
 ┌─────────────────┐       Wi-Fi Router       ┌─────────────────┐
 │  Laptop Server  │ ◄──────────────────────► │  Mobile Phone   │
 │ 192.168.0.106   │                          │ (Chrome/Safari) │
 └─────────────────┘                          └─────────────────┘
```

1. **Find your Laptop's Local IP**:
   - On Windows: Run `ipconfig` in CMD -> Look for **IPv4 Address** (e.g., `192.168.0.106`).
   - On Linux/macOS: Run `ifconfig` or `ip a` (e.g., `192.168.1.15`).
2. **Ensure Network is Set to Private** (Windows Only):
   - Open Windows Settings -> **Network & Internet** -> **Wi-Fi** -> Select connected Wi-Fi -> Change from **Public** to **Private Network**.
3. **Start the Server**:
   ```bash
   python run.py
   ```
4. **Open in Mobile Browser**:
   Open Google Chrome or Safari on your phone and navigate to:
   ```text
   http://192.168.0.106:8000
   ```
5. **Taking Classroom Attendance via Mobile**:
   - Tap **"Take Attendance"** -> Select **"Upload Photos"**.
   - Tapping the dropzone opens your phone's **Native Camera** directly to snap classroom photos with zero security hurdles.

---

## 6. Production Deployment - Method 1: Linux VPS (AWS EC2 / Ubuntu / Nginx / SSL)

This is the **recommended production method** for colleges, universities, and enterprise self-hosting.

### Step 1: Provision an Ubuntu 22.04 / 24.04 LTS Server
- Recommended specifications:
  - **CPU**: 2 vCPUs minimum (4 vCPUs recommended for multi-class concurrency)
  - **RAM**: 4 GB minimum (8 GB recommended for simultaneous ArcFace AI batch inference)
  - **Disk**: 40 GB SSD / NVMe Storage

### Step 2: Install System Packages
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv git nginx certbot python3-certbot-nginx libgl1 libglib2.0-0
```

### Step 3: Clone Project & Set Up Virtual Environment
```bash
sudo mkdir -p /var/www/visionattend
sudo chown -R $USER:$USER /var/www/visionattend
cd /var/www/visionattend

# Clone your repository or upload project files
git clone <YOUR_GIT_REPO_URL> .

# Setup Python Environment
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 4: Create a Systemd Daemon Service
Create `/etc/systemd/system/visionattend.service`:
```ini
[Unit]
Description=VisionAttend Pro AI Attendance Service
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/var/www/visionattend
Environment="PATH=/var/www/visionattend/venv/bin"
Environment="PYTHONPATH=/var/www/visionattend"
ExecStart=/var/www/visionattend/venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 4

Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable visionattend
sudo systemctl start visionattend
sudo systemctl status visionattend
```

### Step 5: Configure Nginx Reverse Proxy
Create `/etc/nginx/sites-available/visionattend`:
```nginx
server {
    listen 80;
    server_name attendance.yourcollege.edu;  # Replace with your domain name or Server Public IP

    client_max_body_size 50M;               # Allow high-resolution classroom multi-photo uploads

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable configuration and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/visionattend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: Enable Free SSL/HTTPS Certificate (Certbot)
```bash
sudo certbot --nginx -d attendance.yourcollege.edu
```
*Certbot will automatically configure HTTPS, auto-renewal, and redirect HTTP traffic to secure HTTPS!*

---

## 7. Production Deployment - Method 2: Docker & Docker Compose

For containerized environments, use the included production `Dockerfile` and `docker-compose.yml`:

### 1. Build and Run Container:
```bash
# Build and start in detached background mode
docker compose up -d --build

# Check container logs
docker compose logs -f

# Stop container
docker compose down
```

### 2. Volume Bindings:
The `docker-compose.yml` mounts:
- `./database:/app/database` -> Database persists across container rebuilds.
- `./data:/app/data` -> Uploaded student and classroom images persist safely.
- `./models:/app/models` -> Pre-trained AI weights persist without re-downloading.

---

## 8. Production Deployment - Method 3: Cloud PaaS (Render / Railway)

### Deploying on Render (Web Service):
1. **Repository**: Push code to GitHub/GitLab.
2. **Create New Web Service**:
   - Environment: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
3. **Attach Persistent Disk (Crucial)**:
   - Go to **Disks** tab -> Click **Add Disk**.
   - Name: `visionattend-storage`
   - Mount Path: `/app/data` (and `/app/database`)
   - Size: `5 GB` or higher.
4. **Set Environment Variables**:
   - `SECRET_KEY`: `<Generate a random 32-character string>`
   - `PYTHONPATH`: `/app`

---

## 9. Database Scaling: SQLite to PostgreSQL Migration

When scaling to tens of thousands of students across multiple campus branches:

### Step 1: Install PostgreSQL Client Drivers
```bash
pip install psycopg2-binary
```

### Step 2: Update `.env` File
```ini
DATABASE_URL=postgresql://db_user:db_password@db-host.rds.amazonaws.com:5432/visionattend_db
```

### Step 3: Run Database Initialization
```python
python -c "from backend.app.db.session import engine, Base, run_auto_migrations; Base.metadata.create_all(bind=engine); run_auto_migrations()"
```
*SQLAlchemy ORM will automatically create all 10 relational tables on PostgreSQL with zero code changes!*

---

## 10. Security, Backups & Maintenance Checklist

### 1. Automated Daily Database Backups (Cron Job)
Create a daily backup script `/var/www/visionattend/scripts/maintenance/backup_cron.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/var/www/visionattend/database/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

# Backup SQLite database
cp /var/www/visionattend/database/attendance.db "$BACKUP_DIR/attendance_backup_$TIMESTAMP.db"

# Retain only last 30 days of backups
find "$BACKUP_DIR" -type f -name "*.db" -mtime +30 -delete
```
Make executable and add to crontab:
```bash
chmod +x /var/www/visionattend/scripts/maintenance/backup_cron.sh
crontab -e
# Add line: Run every night at 2:00 AM
0 2 * * * /var/www/visionattend/scripts/maintenance/backup_cron.sh
```

### 2. Change Default Passwords
Upon first production launch, login to Administrator account (`admin`) and immediately change:
1. Admin password from `admin123` to a strong unique passphrase.
2. Update `SECRET_KEY` in `.env` file.

---

## 11. Troubleshooting & Common Questions (FAQ)

#### Q1: Mobile camera shows "Webcam access error. Please use file upload"?
- **Cause**: Modern mobile browsers (Chrome/Safari) block live WebRTC camera streaming over unencrypted `HTTP://<IP>` addresses for security.
- **Solution**: Use the **"Upload Photos (1–4 Angles)"** option. Tapping it opens the phone's native camera directly. Once deployed with an **HTTPS SSL Certificate**, live video streaming works on all mobile devices.

#### Q2: Port 8000 is already in use?
- On Windows: `netstat -ano | findstr :8000` -> `taskkill /F /PID <PID>`
- On Linux: `sudo lsof -i :8000` -> `sudo kill -9 <PID>`

#### Q3: How to restore a database backup?
- Simply copy your backup file over `database/attendance.db` and restart the server.

#### Q4: How to run tests before deploying?
```bash
python -m pytest tests/ -v
```
*All 87 unit and integration tests should pass with 100% success.*

---

## 🌟 Support & Institutional Maintenance
- **System Version**: `v1.0.0 Production`
- **Architecture**: Enterprise Micro-Monolith (FastAPI + Vanilla JS SPA)
- **Compliance**: Curricular 75% Attendance Defaulter Policy & Multi-Division Aggregation
