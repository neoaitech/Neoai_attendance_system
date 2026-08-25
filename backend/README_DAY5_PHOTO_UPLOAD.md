# Day 5 — Classroom Photo Upload API

Implemented the 25-Aug-2026 backend milestone:

`POST /api/v1/sessions/{session_id}/photo`

## Request

`multipart/form-data` with a `photo` field.

## Validation

- JPEG, PNG, and WEBP only
- Maximum file size: 10 MB
- Image signature is checked before saving
- Empty files are rejected
- Filenames are sanitized and are not used as storage paths

## Storage

For this milestone, uploaded photos are stored under:

`backend/uploads/sessions/<session_id>/`

The upload directory is ignored by Git so classroom photos are not committed.
Database persistence of `Sessions.photo_uploaded_path` remains a later database-integration task.

## Local verification

```powershell
cd backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `/docs` and test the upload endpoint with a sample image.

Run tests from the repository root:

```powershell
pytest backend/tests
```
