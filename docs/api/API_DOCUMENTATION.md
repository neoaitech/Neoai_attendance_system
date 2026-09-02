# REST API Specification & Integration Reference

All endpoints are prefixed with `/api` and secured with JWT Bearer authorization headers (`Authorization: Bearer <token>`).

---

## 1. Authentication Endpoints (`/api/auth`)

### `POST /api/auth/login-json`
- **Request Body**:
  ```json
  { "username": "admin", "password": "admin123" }
  ```
- **Response** (200 OK):
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1Ni...",
    "token_type": "bearer",
    "role": "admin",
    "user_id": 1,
    "full_name": "Administrator (Prathiraj)",
    "username": "admin"
  }
  ```

### `GET /api/auth/me`
- **Response** (200 OK): User details and role.

---

## 2. Students & Biometrics (`/api/students`)

### `GET /api/students`
- **Query Params**: `search`, `department`, `class_id`
- **Response**: List of student objects with enrolled courses and biometric status.

### `POST /api/students/register-with-photo` (Multipart)
- **Form Data**: `roll_number`, `full_name`, `email`, `department`, `year`, `section`, `class_ids`, `photo` (File) or `webcam_base64`.
- **Response**: Registered student object with extracted 128-d embedding confirmation.

---

## 3. Classes & Courses (`/api/classes`)

### `GET /api/classes`
- **Response**: Array of classes with enrolled student counts and teacher info.

### `POST /api/classes`
- **Request Body**: `{ "code": "CS-401", "name": "Deep Learning", "department": "Computer Science" }`

### `POST /api/classes/{id}/enroll`
- **Request Body**: `{ "student_ids": [1, 2, 5, 8] }`

---

## 4. Attendance Sessions & AI Pipeline (`/api/sessions`)

### `POST /api/sessions/create-and-process` (Multipart)
- **Form Data**: `class_id`, `session_name`, `session_date`, `tolerance` (0.55), `photo` (File) or `webcam_base64`.
- **Action**: Triggers CLAHE preprocessing, multi-face detection, 128-d embedding extraction, Euclidean distance matching, auto-marks `PRESENT`, auto-marks missing enrolled students as `ABSENT`, saves unknown face crops, and renders annotated photo.
- **Response**: Full session object, list of attendance records, and unknown faces.

---

## 5. Attendance Management & Overrides (`/api/attendance`)

### `POST /api/attendance/bulk-update`
- **Request Body**:
  ```json
  {
    "session_id": 1,
    "updates": [
      { "record_id": 10, "status": "PRESENT", "notes": "Approved medical certificate" },
      { "record_id": 12, "status": "LATE", "notes": "Arrived 15 mins late" }
    ]
  }
  ```

---

## 6. Unknown Faces Queue (`/api/unknown-faces`)

### `GET /api/unknown-faces?status_filter=PENDING`
- **Response**: List of pending cropped unknown face chips.

### `POST /api/unknown-faces/{id}/tag`
- **Request Body**: `{ "student_id": 4, "update_attendance": true }`

### `POST /api/unknown-faces/{id}/dismiss`
- **Response**: Marks entry as `DISMISSED`.

---

## 7. Reports & Exports (`/api/reports`)

### `GET /api/reports/class/{class_id}`
- **Response**: Course attendance summary, average %, and student compliance roster.

### `GET /api/reports/defaulters`
- **Response**: All students with $< 75\%$ attendance across classes.

### `GET /api/reports/export/excel/{class_id}`
- **Response**: Downloadable `.xlsx` spreadsheet file generated via `openpyxl`.

### `GET /api/reports/export/pdf/{class_id}`
- **Response**: Downloadable `.pdf` dossier file generated via `reportlab`.
