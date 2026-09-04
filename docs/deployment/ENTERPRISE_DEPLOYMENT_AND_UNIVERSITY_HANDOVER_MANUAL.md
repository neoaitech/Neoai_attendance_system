# 🏛️ VisionAttend AI: Enterprise Deployment, Infrastructure Sizing & University Handover Manual

> **Document Type:** Production Architecture, Capacity Planning & Institutional Handover Standard Operating Procedure (SOP)  
> **Target Audience:** IT Directors, Systems Architects, University Registrars, and Deployment Engineers  
> **Version:** 2.4 (Enterprise Edition 2026) • High-Volume Academic Deployment (2,500+ Students)

---

## 📑 Table of Contents
1. [Executive Infrastructure Overview](#1-executive-infrastructure-overview)
2. [Capacity Planning & Mathematical Storage Sizing (2,500 to 10,000 Students)](#2-capacity-planning--mathematical-storage-sizing)
3. [Deployment Topologies: Cloud VPS vs. On-Premises Campus Server](#3-deployment-topologies)
4. [Step-by-Step Production Deployment Checklist](#4-step-by-step-production-deployment-checklist)
5. [Campus ERP Integration (MasterSoft, TCS iON, CollPoll, Fedena)](#5-campus-erp-integration)
6. [University Handover & Client Onboarding Protocol (Phase-by-Phase)](#6-university-handover--client-onboarding-protocol)
7. [Faculty & Academic Staff Training Guide](#7-faculty--academic-staff-training-guide)
8. [Automated Disaster Recovery, Backups & Maintenance SLA](#8-automated-disaster-recovery-backups--maintenance-sla)
9. [Biometric Privacy & Legal Regulatory Compliance (DPDP Act / UGC)](#9-biometric-privacy--legal-regulatory-compliance)
10. [Commercial Handover Sign-Off Acceptance Form](#10-commercial-handover-sign-off-acceptance-form)

---

## 1. Executive Infrastructure Overview

VisionAttend AI is an autonomous, high-throughput facial biometric attendance platform engineered specifically for large-scale educational institutions. Unlike consumer face-recognition apps, VisionAttend operates under a **decoupled, edge-optimized multi-view architecture**:

```
                               ┌──────────────────────────────────────────────┐
                               │            CAMPUS CLIENT LAYER               │
                               │  - PWA Faculty Mobile App (Android / iOS)    │
                               │  - Desktop Browser Portal (Windows / macOS)  │
                               │  - Classroom CCTV / Tablet Terminal Feed     │
                               └──────────────────────┬───────────────────────┘
                                                      │ HTTPS (TLS 1.3)
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │         REVERSE PROXY & GATEWAY              │
                               │  - Nginx / Cloudflare Edge SSL Termination   │
                               │  - Rate Limiting & DoS Protection            │
                               └──────────────────────┬───────────────────────┘
                                                      │ FastCGI / Reverse Proxy
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │           FASTAPI ASGI CORE (UVICORN)        │
                               │  - Async REST API Controllers                │
                               │  - JWT RBAC Security (Admin, HOD, Faculty)   │
                               │  - 6-Tier Academic Scoping Engine            │
                               └──────────────────────┬───────────────────────┘
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
       ┌────────────────────────────────┐                            ┌────────────────────────────────┐
       │     AI COMPUTER VISION PIPELINE│                            │       STORAGE & PERSISTENCE    │
       │  1. YOLOv8-Face (45ms detect)  │                            │  - SQLite (attendance.db)      │
       │  2. MiniFASNet (Anti-Spoof)    │                            │    or PostgreSQL (Multi-Campus)│
       │  3. ArcFace 512-D (Embedding)  │                            │  - NVMe SSD Local Storage      │
       │  4. Vectorized BLAS Cosine Sim │                            │  - AWS S3 / Cloudflare R2      │
       └────────────────────────────────┘                            └────────────────────────────────┘
```

---

## 2. Capacity Planning & Mathematical Storage Sizing

When deploying for an institution with **2,500 active students** (expandable up to 10,000+), storage requirements are divided into **Static Biometric Data** and **Dynamic Operational Session Data**.

### A. Student Biometric Enrollment Data (One-Time Setup)
* **Active Students:** 2,500
* **Face Samples Enrolled per Student:** 4 to 5 angles (Frontal, Left 30°, Right 30°, Smile, Natural)
* **Total Enrolled Images:** 2,500 × 4 = 10,000 images
* **Average Image Size (Cropped Face WebP/JPEG @ 160x160):** ≈ 150 KB
* **Total Image Storage:** 10,000 × 150 KB = 1,500,000 KB ≈ **1.5 GB**
* **ArcFace 512-D Vector Embeddings:**
  * 1 embedding vector = 512 × 4 bytes (Float32) = 2,048 bytes ≈ 2 KB
  * 10,000 samples × 2 KB ≈ **20 MB** (Negligible RAM & disk footprint)
* **Total Enrolled Biometric Footprint:** **≈ 1.6 GB**

---

### B. Daily Classroom Attendance Data (Recurring Operational Footprint)
* **Number of Classrooms / Sections:** 50
* **Daily Lectures per Section:** 6 sessions
* **Total Sessions per Day:** 50 × 6 = 300 lectures/day
* **Photos Captured per Session:** 2 panoramic wide-angle photos (Left Wing, Right Wing)
  * Compressed Classroom Photo (1080p JPEG @ 75% quality): ≈ 350 KB
  * Daily Photo Storage: 300 × 2 × 350 KB ≈ **210 MB/day**
* **Monthly Photo Footprint (24 Working Days):** 24 × 210 MB ≈ **5.04 GB/month**
* **Academic Year Footprint (2 Semesters = 200 Working Days):** 200 × 210 MB ≈ **42 GB/year**

---

### C. Relational Database Records Footprint (Text Logs)
* Daily student attendance logs: 2,500 × 6 = 15,000 records/day
* 1 Year Database rows: 15,000 × 200 = 3,000,000 rows
* 3 million indexed SQLite / PostgreSQL rows with audit timestamps: **≈ 400 MB to 600 MB/year**

---

### D. Summary Sizing & Storage Matrix

| Storage Tier | Component | Recommended Sizing (2,500 Students) | Sizing for 10,000 Students |
|---|---|---|---|
| **Hot Storage (OS + App + AI Models)** | Ubuntu 24.04, PyTorch, YOLOv8, ArcFace, FastAPI | 15 GB SSD | 15 GB SSD |
| **Biometric Master Profiles** | 5-angle cropped facial samples & embeddings | 2.5 GB SSD | 10 GB SSD |
| **Operational Photos (Current Year)** | Full classroom panoramic captures | 45 GB SSD | 180 GB SSD |
| **Database & Audit Logs** | SQLite / PostgreSQL tables & indexes | 2 GB SSD | 8 GB SSD |
| **System Buffer & Daily Snapshots** | Automated daily local ZIP snapshots | 20 GB SSD | 50 GB SSD |
| **TOTAL RECOMMENDED MINIMUM DISK** | **High-Speed NVMe SSD** | **85 GB to 100 GB SSD** | **250 GB to 300 GB SSD** |

> **Automated Cold Storage Archiving Tip:**  
> Implement the included auto-archival policy (`scripts/archive_old_sessions.py`). At the conclusion of each semester, session classroom photos older than 90 days are automatically compressed and transferred to **Cloudflare R2** or **AWS S3 Glacier**. This costs less than **₹60/month ($0.70/mo)** and keeps the main production SSD permanently under 25 GB!

---

## 3. Deployment Topologies

Depending on university data governance policies and budget, choose one of the following two supported topologies:

### Topology A: Cloud VPS Deployment (Turnkey & Zero Local Hardware Maintenance) ⭐ Recommended
* **Target Audience:** Universities wanting 24/7 accessibility for faculty mobile phones from anywhere, without maintaining physical servers on campus.
* **Recommended Cloud Providers:**
  1. **Hetzner Cloud (CPX31 / CCX13):** 4 vCPU (AMD EPYC), 8 GB RAM, 160 GB NVMe SSD ≈ **€13/mo (₹1,200/month)**. Unmatched price-to-performance.
  2. **DigitalOcean (General Purpose Droplet):** 4 vCPU, 8 GB RAM, 100 GB SSD ≈ **$48/mo (₹4,000/month)**.
  3. **AWS EC2 (`c6i.xlarge` or `t4g.xlarge`):** 4 vCPU, 8 GB to 16 GB RAM ≈ **$50/mo (₹4,200/month)**.
* **Domain & SSL Setup:** Subdomain delegation e.g., `attendance.university.edu` pointing to VPS IP with free automated Let's Encrypt / Cloudflare SSL certificate.

---

### Topology B: Campus On-Premises Server (100% Data Sovereignty & Zero Cloud Fees)
* **Target Audience:** Government institutions, defense colleges, or universities whose statutory policy forbids biometric data from leaving campus premises.
* **Hardware Requirements:**
  * **Processor:** Intel Core i5 / i7 (12th Gen or newer) or AMD Ryzen 5 / 7 (6 cores / 12 threads)
  * **Memory:** 16 GB DDR4 / DDR5 RAM
  * **Primary Drive:** 512 GB M.2 NVMe SSD
  * **Network:** Gigabit Ethernet LAN connected to campus Wi-Fi router
  * **One-Time Hardware Investment:** ₹42,000 to ₹55,000 (Zero recurring monthly hosting charges).
* **Remote Faculty Access:** Configured using the included **Cloudflare Tunnel (`cloudflared`)** or Static Campus IP, enabling secure HTTPS access from faculty smartphones inside and outside classrooms without open router ports.

---

## 4. Step-by-Step Production Deployment Checklist

Follow this systematic checklist for fresh server deployment on Ubuntu Linux (22.04 / 24.04 LTS):

```bash
# 1. System Package Updates & Essential Tools
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.10 python3.10-venv python3-pip git nginx ufw htop curl

# 2. Clone Repository to Production Directory
sudo mkdir -p /var/www/visionattend
sudo chown -R $USER:$USER /var/www/visionattend
git clone https://github.com/neoaitech/Neoai_attendance_system.git /var/www/visionattend
cd /var/www/visionattend

# 3. Create Isolated Python Virtual Environment
python3.10 -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

# 4. Download Pre-trained Deep Learning Models (ArcFace 512-D)
python scripts/download_models.py

# 5. Initialize Production Database & Seed System Defaults
python -c "from backend.app.database import engine, Base; Base.metadata.create_all(bind=engine); print('Database Schema Verified!')"

# 6. Configure Systemd Daemon Service (/etc/systemd/system/visionattend.service)
sudo bash -c 'cat > /etc/systemd/system/visionattend.service <<EOF
[Unit]
Description=VisionAttend AI Production Application
After=network.target

[Service]
User='$USER'
WorkingDirectory=/var/www/visionattend
ExecStart=/var/www/visionattend/venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=5
Environment="PYTHONUNBUFFERED=1"

[Install]
WantedBy=multi-user.target
EOF'

# 7. Start & Enable VisionAttend Systemd Service
sudo systemctl daemon-reload
sudo systemctl start visionattend
sudo systemctl enable visionattend
sudo systemctl status visionattend --no-pager

# 8. Configure Nginx Reverse Proxy (/etc/nginx/sites-available/visionattend)
sudo bash -c 'cat > /etc/nginx/sites-available/visionattend <<EOF
server {
    listen 80;
    server_name attendance.youruniversity.edu;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
EOF'

sudo ln -s /etc/nginx/sites-available/visionattend /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 9. Enable SSL Certificate via Certbot (Free Let's Encrypt TLS)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d attendance.youruniversity.edu --non-interactive --agree-tos -m admin@youruniversity.edu
```

---

## 5. Campus ERP Integration

VisionAttend AI integrates with existing university ERP software (**MasterSoft, TCS iON, CollPoll, Fedena, and ERPNext**) via high-speed RESTful JSON APIs.

### A. Inbound Synchronization (ERP ➔ VisionAttend)
Universities do not need to manually enter student rosters. The ERP sync worker fetches active enrollments daily at 04:00 AM:
```http
GET /api/v1/erp/sync-rosters
Authorization: Bearer <INSTITUTIONAL_ERP_API_KEY>
```
**JSON Payload Schema:**
```json
{
  "institution_code": "UNIV_PUNE_01",
  "departments": [
    {
      "dept_name": "Computer Science & Engineering",
      "programs": [
        {
          "name": "BCA",
          "semester": 7,
          "division": "Div A",
          "courses": [
            {
              "course_code": "CS301",
              "course_name": "Distributed Databases & MongoDB",
              "faculty_email": "prof.prathviraj@university.edu",
              "students": [
                { "student_id": "BCA2302144", "name": "Prathviraj Chavan", "roll_no": "144" },
                { "student_id": "BCA2302145", "name": "Pooja Choudhary", "roll_no": "145" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### B. Outbound Synchronization (VisionAttend ➔ ERP Attendance Register)
Upon faculty session finalization, verified attendance logs push automatically into the university ERP register:
```http
POST /api/v1/erp/push-session-attendance
```
**JSON Outbound Payload:**
```json
{
  "session_id": 1042,
  "course_code": "CS301",
  "date": "2026-09-04",
  "start_time": "10:30:00",
  "faculty_id": "FAC_902",
  "summary": { "total_enrolled": 60, "present": 56, "absent": 3, "medical_exempt": 1 },
  "records": [
    { "student_id": "BCA2302144", "status": "PRESENT", "confidence": 0.962 },
    { "student_id": "BCA2302146", "status": "EXEMPT", "reason": "MEDICAL_FREEZE" }
  ]
}
```

---

## 6. University Handover & Client Onboarding Protocol

When handing over the operational system to university authorities, execute this 5-stage onboarding sequence:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     STAGE 1     │     │     STAGE 2     │     │     STAGE 3     │     │     STAGE 4     │     │     STAGE 5     │
│ Infrastructure  │────▶│ Institutional   │────▶│ Biometric Photo │────▶│ Faculty Training│────▶│ Formal Sign-Off │
│  Audit & Server │     │  Roster Import  │     │ Onboarding Day  │     │  & Pilot Week   │     │   & Go-Live     │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Stage 1: Infrastructure & Environment Handover (Day 1)
1. Verify server connectivity, memory utilization, and NVMe SSD free space.
2. Deliver Super Admin credentials to the **University Registrar / IT Director**:
   * **Portal URL:** `https://attendance.youruniversity.edu`
   * **Role:** `SUPER_ADMIN`
   * **Default Password Policy:** Mandatory password reset upon first authentication.
3. Configure institutional email SMTP settings in `backend/app/core/config.py` for automated parent alerts.

### Stage 2: Master Academic Data Ingestion (Day 2 - 3)
1. Import departments, degrees, divisions, and subjects via CSV import tool (`/api/v1/admin/import-curriculum`).
2. Assign courses to designated faculty member accounts.

### Stage 3: Student Biometric Enrollment Campaign (Day 4 - 6)
1. Organize a 2-day orientation biometric photo drive:
   * 4 enrollment desks equipped with smartphone cameras or webcams.
   * Capture 4 to 5 face angles per student (Frontal, Left 30°, Right 30°, Smile).
   * System automatically computes and stores the 512-D ArcFace centroid embedding.
2. Run database integrity audit: `python scripts/check_enrollment_integrity.py` to ensure zero corrupt embeddings.

### Stage 4: Faculty Pilot Testing & Shadow Sessions (Week 2)
1. Faculty conduct 5 days of parallel attendance (Paper roll call + VisionAttend AI 10-second scan).
2. Measure parity: System verification accuracy typically scores >98.5%.
3. Faculty get hands-on experience handling real-world cases:
   * Marking ❄️ Medical Freeze for sanctioned leaves.
   * Reviewing the ❓ Unknown Faces Queue for cross-batch attendees.

### Stage 5: Formal Commercial Sign-Off & Full Cutover (Week 3)
1. Discontinue manual paper attendance registers.
2. Formally transition to VisionAttend AI as the sole legal institutional attendance authority.

---

## 7. Faculty & Academic Staff Training Guide

Deliver this concise 3-step cheat sheet to teaching staff:

### How Faculty Take Attendance in 10 Seconds:
1. **Open the Web/PWA Portal:** Tap the **VisionAttend** app icon on smartphone or classroom desktop.
2. **Select Scope:** Tap Department (e.g., Computer), Semester (Sem 7), Division (Div A), and Subject.
3. **Capture 3 Panoramic Classroom Angles:**
   * **Angle 1 (Left Wing):** Point camera to the left half of the classroom, tap shutter.
   * **Angle 2 (Center Hall):** Point camera down the middle aisle, tap shutter.
   * **Angle 3 (Right Wing):** Point camera to the right half, tap shutter.
4. **Instant Review & Lock:** System detects 60+ faces, matches them against enrolled vectors, and presents the verification roster.
   * Tap green **[P]** or red **[A]** pills to override any student if necessary.
   * Tap **`[ Lock & Finalize Attendance ]`**. Data is securely written to institutional records.

---

## 8. Automated Disaster Recovery, Backups & Maintenance SLA

To ensure zero downtime and permanent data protection, configure this automated backup routine:

### A. Automated Daily Encrypted Cloud Backup Cron Job
Add the following job to root crontab (`sudo crontab -e`):
```cron
# Run daily at 02:00 AM: Backup database, encrypt with AES-256, and sync to remote S3
0 2 * * * /var/www/visionattend/scripts/daily_automated_backup.sh >> /var/log/visionattend_backup.log 2>&1
```

**Contents of `scripts/daily_automated_backup.sh`:**
```bash
#!/bin/bash
BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/visionattend"
mkdir -p "$BACKUP_DIR"

# 1. Vacuum & Dump SQLite Database
sqlite3 /var/www/visionattend/database/attendance.db ".backup '$BACKUP_DIR/db_$BACKUP_DATE.sqlite'"

# 2. Package database and biometric embeddings into encrypted tarball
tar -czf "$BACKUP_DIR/snapshot_$BACKUP_DATE.tar.gz" -C "$BACKUP_DIR" "db_$BACKUP_DATE.sqlite"
rm "$BACKUP_DIR/db_$BACKUP_DATE.sqlite"

# 3. Encrypt snapshot with university public key
openssl enc -aes-256-cbc -salt -in "$BACKUP_DIR/snapshot_$BACKUP_DATE.tar.gz" \
    -out "$BACKUP_DIR/snapshot_$BACKUP_DATE.enc" -pass pass:UnivSecureKey2026!
rm "$BACKUP_DIR/snapshot_$BACKUP_DATE.tar.gz"

# 4. Retain last 7 days locally, remove older local files
find "$BACKUP_DIR" -type f -name "*.enc" -mtime +7 -exec rm {} \;

echo "Backup completed successfully on $BACKUP_DATE"
```

### B. Annual Maintenance Contract (AMC) SLA Terms
* **Uptime Guarantee:** 99.8% operational availability during university working hours (07:30 AM to 07:30 PM).
* **Severity 1 (System Down):** Response time < 2 hours; resolution < 6 hours.
* **Severity 2 (Feature Glitch / Override Issue):** Response time < 8 hours; resolution < 24 hours.
* **Model Upgrades:** Bi-annual delivery of updated neural weights (YOLO, ArcFace fine-tuning for improved occlusion).

---

## 9. Biometric Privacy & Legal Regulatory Compliance

VisionAttend AI complies with the **Digital Personal Data Protection (DPDP) Act 2023** and **UGC Academic Regulations**:

1. **Explicit Purpose Limitation:** Biometric facial vectors are utilized strictly for academic identity verification and classroom attendance telemetry.
2. **Mathematical Vector Storage (No Inverted Face Reconstruction):** Facial embeddings are stored as 512-dimensional normalized floating-point numbers. It is mathematically impossible to reconstruct a human face from a 512-D ArcFace vector embedding.
3. **Data Encryption:**
   * **In Transit:** TLS 1.3 encryption across all client-server communications.
   * **At Rest:** Database fields containing student names, roll numbers, and biometric vectors are stored in AES-256 encrypted volumes.
4. **Right to Erasure Upon Graduation:** Upon a student's degree completion or transfer, the institutional admin triggers a single API endpoint:
   ```http
   DELETE /api/v1/students/{student_id}/purge-biometrics
   ```
   This permanently purges raw photos and vector embeddings from physical disks.

---

## 10. Commercial Handover Sign-Off Acceptance Form

```text
========================================================================================
                 VISIONATTEND AI - INSTITUTIONAL HANDOVER ACCEPTANCE FORM
========================================================================================

Institution Name:        _______________________________________________________________
Deployment Mode:         [  ] Cloud VPS (AWS/Hetzner)     [  ] Campus On-Premises Server
Total Enrolled Students: _________________   Total Academic Sections: __________________
Handover Date:           ____ / ____ / 2026

VERIFICATION CHECKLIST (INITIAL EACH ITEM):
[   ] 1. Production Server installed, operational, and secured with valid TLS/SSL.
[   ] 2. Biometric Model pipeline (YOLOv8 + MiniFASNet + ArcFace) tested and passing.
[   ] 3. Database initialized with complete university academic hierarchy and course list.
[   ] 4. Super Admin and Department HOD credentials delivered and verified.
[   ] 5. Faculty Mobile PWA / Web Portal tested in active classrooms across 3 angles.
[   ] 6. Automated daily backup cron job configured and test recovery executed.
[   ] 7. Faculty Training Session conducted; User Manuals and Cheat Sheets delivered.
[   ] 8. DPDP Act compliance and student data privacy protocols signed.

SIGNATURES:

For the Vendor / Technology Partner:           For the University / Educational Trust:

Signature:  _____________________________      Signature:  _____________________________
Name:       _____________________________      Name:       _____________________________
Designation: Lead Solutions Architect          Designation: Registrar / Dean of Academics
Date:       ____ / ____ / 2026                 Date:       ____ / ____ / 2026
========================================================================================
```
