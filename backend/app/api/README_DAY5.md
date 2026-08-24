# Prathviraj Day 5 — Backend Skeleton

## Scope

This independent test project implements the Phase-2 Day-5 backend skeleton:
- FastAPI application
- `/api/v1` versioning
- health endpoint
- routes matching the approved API specification
- request/query/path validation where defined by the contract
- standard `501 NOT_IMPLEMENTED` placeholders for business logic

It intentionally does **not** implement database, authentication, photo processing,
face detection/recognition, attendance logic, or reporting logic.

## Run

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open:
- http://127.0.0.1:8000/api/v1/health
- http://127.0.0.1:8000/docs

## Expected behavior

`GET /api/v1/health` returns `200` with:

```json
{"status": "ok"}
```

Contract routes that are not implemented yet return `501` with the documented
standard error shape rather than a misleading successful business response.

## Contract note

The route paths and methods are aligned to the 20-Aug-2026 API specification.
No unsupported API endpoints are added.
