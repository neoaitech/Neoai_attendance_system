# AI Smart Attendance System — API Specification

**Date:** 20-Aug-2026  
**Owner:** Prathviraj  
**Role:** Backend / Integration  
**Status:** Initial API Contract

## 1. Purpose
This document defines the initial REST API contract for the AI Smart Attendance System. The API connects the frontend, backend services, AI/ML processing, database, attendance workflow, and reporting modules.

## 2. Base API
```text
/api/v1
```

## 3. Authentication
### POST /auth/login
Authenticate an authorized user.

Request:
```json
{"username":"string","password":"string"}
```

### POST /auth/logout
Logout the authenticated user.

## 4. Classes
### GET /classes
Return available classes.

### GET /classes/{class_id}
Return one class.

### POST /classes
Create a class.

## 5. Students
### GET /students
Return registered students. Optional filters: `class_id`, `is_active`.

### GET /students/{student_id}
Return one student.

### POST /students
Register a student.

### PUT /students/{student_id}
Update student information.

### DELETE /students/{student_id}
Deactivate a student using the `is_active` flag.

## 6. Attendance Sessions
### POST /sessions
Create an attendance session.

### GET /sessions
Return sessions. Optional filters: `class_id`, `session_date`.

### GET /sessions/{session_id}
Return one session.

## 7. Classroom / Group Photo
### POST /sessions/{session_id}/photo
Upload the classroom/group photo for an attendance session.

Request content type:
```text
multipart/form-data
photo=<uploaded image>
```

The current project scope uses an uploaded classroom/group photo; this API does not define live-video attendance.

## 8. Face Processing
### POST /sessions/{session_id}/recognize
Start face detection, alignment, and recognition processing for the uploaded photo.

Processing:
```text
Uploaded Group Photo
        ↓
Face Detection & Alignment
        ↓
Face Recognition / Verification
        ↓
Confidence Score
        ↓
Attendance Candidate Results
```

Recognition results should not automatically finalize uncertain attendance.

## 9. Attendance Review
### GET /sessions/{session_id}/attendance
Return attendance results.

### PUT /attendance/{attendance_id}
Review or correct an attendance record.

### POST /attendance/{attendance_id}/verify
Verify an uncertain attendance result manually.

## 10. Unknown Faces
### GET /sessions/{session_id}/unknown-faces
Return unknown faces detected during a session.

### PUT /unknown-faces/{unknown_face_id}
Resolve/tag an unknown face.

## 11. Reports
### GET /reports/daily
Daily session attendance report.

### GET /reports/summary
Weekly/monthly attendance summary.

### GET /reports/low-attendance
Students below the configured attendance threshold.

### GET /reports/unknown-faces
Unknown-face review log.

### GET /reports/roster
Registered class roster.

### GET /reports/recognition-accuracy
Measured recognition evaluation information. This endpoint must not invent accuracy values.

## 12. HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | Successful request |
| 201 | Resource created |
| 400 | Bad request |
| 401 | Authentication required |
| 403 | Permission denied |
| 404 | Resource not found |
| 409 | Resource conflict |
| 422 | Validation error |
| 500 | Internal server error |
| 501 | Not implemented — development scaffold endpoint |

## 13. Standard Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {}
  }
}
```

## 14. Security Requirements
- Never store passwords in plain text.
- Never commit API keys, secrets, or `.env` files.
- Validate uploaded files before processing.
- Do not commit real student photos, face embeddings, or biometric data.
- Restrict attendance corrections to authorized users.

## 15. Integration Flow
```text
React Frontend
      |
      v
Backend REST API
      |
      +------------------+
      |                  |
      v                  v
SQLite Database       AI/ML Pipeline
                           |
                           v
                  Face Detection
                           |
                           v
                  Face Recognition
                           |
                           v
                    Confidence
                           |
                           v
                  Attendance Results
                           |
                           v
                  Review / Verification
                           |
                           v
                    Final Attendance
                           |
                           v
                       Reports
```

## 16. Core Data Entities
- Students
- Classes
- Sessions
- Attendance
- UnknownFaces

The API contract should remain consistent with the approved ER diagram and database schema.

## 17. Implementation Status
- API structure: Defined
- Endpoint specification: Defined
- Authentication design: Initial
- Backend implementation: Pending
- Database integration: Pending
- AI/ML integration: Pending
- API testing: Pending
