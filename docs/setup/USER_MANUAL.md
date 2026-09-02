# VisionAttend Pro - User Manual & Operating Guide

---

## 1. Quickstart Guide

### Starting the Server:
```bash
python run.py
```
Open your web browser and navigate to: `http://localhost:8000`

### Preconfigured Logins:
- **System Administrator**: Username: `admin` | Password: `admin123`
- **Course Faculty**: Username: `dr_sharma` | Password: `teacher123`

---

## 2. Step-by-Step Workflow for Teachers

### Step 1: Ingesting Attendance
1. Click **"Take Attendance"** in the sidebar or top bar.
2. Select your course from the dropdown (e.g. `CS-301 - Computer Vision & Deep Learning`).
3. Enter the lecture topic name.
4. Choose either:
   - **File / Demo Photo**: Click **"Load Demo Photo"** to test with the preloaded 10-student sample classroom image, or select any photo from your computer.
   - **Live Webcam Stream**: Click **"Capture Classroom Snapshot"**.
5. Click **"Process Attendance with AI"**.

### Step 2: Reviewing Recognitions & Overriding Status
1. The AI engine automatically detects all faces, matches them against enrolled 128-D student vectors, marks recognized students as `PRESENT`, and marks absent students as `AUTO_ABSENT`.
2. Inspect the annotated classroom photo on the left (Green = Recognized, Red = Unknown).
3. On the right, toggle any student's status (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`) or add notes.
4. Click **"Save Attendance"** to commit the audit trail.

### Step 3: Resolving Unknown Faces
1. If unknown faces are flagged, navigate to **"Unknown Faces"** in the sidebar.
2. View the cropped face card.
3. Click **"Tag Student"**, search the student by name/roll number, and confirm. The system will automatically mark them `PRESENT` in that session.

### Step 4: Generating Institutional Reports & Defaulter Lists
1. Navigate to **"Reports & Defaulters"**.
2. View course summary metrics and the list of students below the 75% attendance threshold.
3. Click **"Export Excel (.xlsx)"** for formatted spreadsheets or **"Export PDF (.pdf)"** for official signed administrative dossiers.
