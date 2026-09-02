# Database Architecture & Entity Relationship Diagram (ERD)

---

## 1. Entity Relationship (ER) Diagram

```mermaid
erDiagram
    User ||--o{ ClassCourse : "teaches"
    User ||--o{ AttendanceSession : "conducts"
    ClassCourse ||--o{ AttendanceSession : "has"
    ClassCourse }o--o{ Student : "enrolls (student_class_association)"
    AttendanceSession ||--o{ AttendanceRecord : "contains"
    AttendanceSession ||--o{ UnknownFace : "detects"
    Student ||--o{ AttendanceRecord : "records"
    Student ||--o{ UnknownFace : "resolved_as"
    User ||--o{ AuditLog : "triggers"

    User {
        int id PK
        string username UK
        string email UK
        string hashed_password
        string full_name
        string role
        boolean is_active
        datetime created_at
    }

    ClassCourse {
        int id PK
        string code UK
        string name
        string department
        string semester
        string section
        int teacher_id FK
        datetime created_at
    }

    Student {
        int id PK
        string roll_number UK
        string full_name
        string email UK
        string department
        int year
        string section
        string photo_url
        text face_embedding
        boolean is_active
        datetime created_at
    }

    AttendanceSession {
        int id PK
        int class_id FK
        int teacher_id FK
        string session_name
        date session_date
        string start_time
        string end_time
        string raw_photo_path
        string processed_photo_path
        int total_detected
        int total_recognized
        int total_unknown
        string status
        text notes
        datetime created_at
    }

    AttendanceRecord {
        int id PK
        int session_id FK
        int student_id FK
        string status
        float confidence_score
        text detection_bbox
        string verification_type
        text notes
        datetime marked_at
    }

    UnknownFace {
        int id PK
        int session_id FK
        string cropped_image_path
        text bbox
        float confidence_score
        string status
        int assigned_student_id FK
        datetime created_at
    }

    AuditLog {
        int id PK
        int user_id FK
        string action
        string entity
        int entity_id
        text details
        datetime timestamp
    }
```

---

## 2. Table Specifications & Indexes

| Table Name | Primary Key | Foreign Keys | Unique Constraints | Indexed Columns |
| :--- | :--- | :--- | :--- | :--- |
| `users` | `id` | None | `username`, `email` | `username`, `email` |
| `classes` | `id` | `teacher_id -> users.id` | `code` | `code`, `teacher_id` |
| `students` | `id` | None | `roll_number`, `email` | `roll_number`, `email` |
| `student_class_association`| `(student_id, class_id)`| `students.id`, `classes.id`| None | Composite PK |
| `attendance_sessions` | `id` | `class_id -> classes.id` | None | `class_id`, `session_date`|
| `attendance_records` | `id` | `session_id`, `student_id` | None | `session_id`, `student_id`|
| `unknown_faces` | `id` | `session_id`, `assigned_student_id`| None | `session_id`, `status` |
| `audit_logs` | `id` | `user_id` | None | `timestamp`, `action` |
