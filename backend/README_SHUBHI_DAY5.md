# Shubhi — 24 Aug 2026 ORM Model Deliverable

## Official Task

Implement SQLAlchemy ORM models matching the approved database schema.

## Source schema

The models are based directly on the existing:
- `database/schema.sql`
- `docs/database/DATABASE_SCHEMA.md`
- `docs/database/DATABASE_FINAL_VERIFICATION.md`

## Models included

- `Classes` → `Class`
- `Students` → `Student`
- `Sessions` → `AttendanceSession`
- `Attendance` → `Attendance`
- `UnknownFaces` → `UnknownFace`

## Preserved database rules

- Primary keys and auto-increment IDs
- `Students.roll_no` UNIQUE
- Required foreign keys
- Attendance UNIQUE `(session_id, student_id)`
- Attendance status CHECK: `present`, `absent`, `late`
- Nullable `UnknownFaces.tagged_student_id`
- Foreign-key lookup indexes
- SQLite-compatible timestamp defaults

## Scope

This deliverable implements the ORM model layer only. It does not add attendance business logic, student registration APIs, report generation, or AI/face-recognition processing. Those belong to later milestones.

## Integration location

Copy the contents of:

`backend/app/models/`

into the project's:

`backend/app/models/`

The existing database schema and API files should not be replaced by this deliverable.
