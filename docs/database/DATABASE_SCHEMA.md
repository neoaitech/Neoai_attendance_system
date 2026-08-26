# AI Smart Attendance System — SQLite Database

**Day:** 3  
**Date:** 20-Aug-2026  
**Owner:** Shubhi  
**Task:** Create SQLite DB and initial tables matching the approved ER diagram.

## Database
`attendance.db`

## Tables
- Classes
- Students
- Sessions
- Attendance
- UnknownFaces

## Relationship Summary
- One Class has many Students.
- One Class has many Sessions.
- One Session has many Attendance rows.
- One Student has many Attendance rows.
- Attendance connects Students and Sessions.
- One Session has many UnknownFaces.
- `tagged_student_id` in UnknownFaces is nullable and is used when an unknown face is resolved.

## Validation Notes
- Primary keys are defined for all entities.
- Foreign keys follow the ER diagram.
- `Students.roll_no` is UNIQUE.
- Attendance has a UNIQUE `(session_id, student_id)` constraint.
- Attendance status is constrained to `present`, `absent`, or `late`.
- Indexes are added for common foreign-key lookups.
- `PRAGMA foreign_keys = ON` is required when the schema is executed.

## Data Safety
Do not commit real student photos, face embeddings, biometric data, passwords, or other sensitive data to GitHub. Use synthetic/sample data for development and testing.
