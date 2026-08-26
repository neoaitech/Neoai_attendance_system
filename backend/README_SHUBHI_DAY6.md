# Shubhi — 25 Aug 2026 Student Registration API

## Official task
Build the Student Registration API + DB insert logic.

## Implemented
- `POST /api/v1/students`
- JSON request validation using Pydantic
- Required fields: `roll_no`, `full_name`, `class_id`
- Optional student fields aligned with the approved Students schema
- Verifies that the referenced class exists
- Rejects duplicate `roll_no` with HTTP 409
- Inserts the student into the `Students` table using SQLAlchemy ORM
- Returns HTTP 201 with the created student record
- Enables SQLite foreign-key enforcement

## Files added/updated for Day 6
- `backend/app/db.py`
- `backend/app/api/__init__.py`
- `backend/app/api/students.py`
- `backend/app/schemas/__init__.py`
- `backend/app/schemas/student.py`
- `backend/app/main.py`
- `backend/tests/test_student_registration.py`
- `backend/requirements.txt`
- `backend/README_SHUBHI_DAY6.md`

## Scope
This milestone covers student registration and database insertion only.
Face encoding generation, attendance logic, reports, and admin management remain later milestones.

## Local test
From the repository root:
`python -m pytest backend/tests/test_student_registration.py -q`

Start API from the repository root:
`python -m uvicorn app.main:app --reload --app-dir backend`

Open:
`http://127.0.0.1:8000/docs`
