# NeoAI Attendance System — Backend Run & Testing Guide

## 1. Purpose

This guide explains how to install, run, test, and verify the NeoAI Attendance System backend.

It covers:
- Python/backend setup
- OpenCV, dlib, and face-recognition setup
- Automated pytest verification
- Test-data cleanup
- Real face encoding and enrollment
- Session photo upload
- Face recognition through Swagger
- Common errors and fixes
- Final verification checklist

> Run Python commands from the project's `backend` directory unless stated otherwise.

---

## 2. Project Location

Example project location used during final testing:

```text
C:\Users\Acer\Desktop\test\Neoai_attendance_system-main\Neoai_attendance_system-main
```

Backend:

```text
C:\Users\Acer\Desktop\test\Neoai_attendance_system-main\Neoai_attendance_system-main\backend
```

Go to the backend:

```powershell
cd "C:\Users\Acer\Desktop\test\Neoai_attendance_system-main\Neoai_attendance_system-main\backend"
```

Confirm the current directory:

```powershell
Get-Location
```

---

## 3. Python Verification

```powershell
python --version
python -m pip --version
```

The final test environment used Python 3.10.11.

---

## 4. OpenCV Verification

```powershell
python -c "import cv2; print('OpenCV:', cv2.__version__)"
```

Final test:

```text
OpenCV: 4.13.0
```

---

## 5. Install and Verify dlib

Install:

```powershell
python -m pip install dlib
```

Verify:

```powershell
python -c "import dlib; print('dlib OK:', dlib.__version__)"
```

### Windows installation note

If dlib fails with a message such as:

```text
You must use Visual Studio to build a python extension on windows.
```

install the required Visual Studio C++ build tools, restart if requested, open a new PowerShell, and retry:

```powershell
python -m pip install dlib
```

---

## 6. Install and Verify face-recognition

Install:

```powershell
python -m pip install face-recognition
```

Verify:

```powershell
python -c "import face_recognition; print('face_recognition OK')"
```

Check version:

```powershell
python -c "import face_recognition; print('face_recognition version:', face_recognition.__version__)"
```

The final test environment reported:

```text
face_recognition version: 1.2.3
dlib OK
numpy OK: 1.26.3
```

The exact package version can vary; successful import and functional recognition are what matter.

---

## 7. Verify Recognition Service

```powershell
python -c "from app.services.face_recognition_service import compare_encoding; print('Recognition service import OK')"
```

Then:

```powershell
python -c "from app.services.face_recognition_service import encode_image, compare_encoding, find_best_match; print('All recognition functions OK')"
```

Expected:

```text
All recognition functions OK
```

---

## 8. Verify Student Face-Encoding Field

```powershell
python -c "from app.models.student_model import Student; print('face_encoding column:', Student.face_encoding); print('Student model OK')"
```

Expected:

```text
face_encoding column: Student.face_encoding
Student model OK
```

---

## 9. Basic Face-Encoding Pipeline Test

```powershell
python -c "from app.services.face_recognition_service import encode_image; import numpy as np; img=np.zeros((100,100,3),dtype=np.uint8); result=encode_image(img); print('Encoding test OK:', result)"
```

Expected:

```text
Encoding test OK: []
```

`[]` is normal because the test image is black and contains no face.

---

# 10. Run the Automated Backend Tests

Run:

```powershell
python -m pytest -v --tb=short
```

Final verified result:

```text
15 passed, 4 warnings
```

The 15 tests cover attendance logic, face detection, photo upload, reports, and student registration.

### The four warnings

They are `httpx` deprecation warnings:

```text
DeprecationWarning:
The 'app' shortcut is now deprecated.
Use the explicit style 'transport=WSGITransport(app=...)' instead.
```

They are warnings, not failures.

---

# 11. Test-Data Cleanup

The student-registration tests use predictable test roll numbers.

Before repeating the automated suite against the development database:

```powershell
python -c "from app.db import SessionLocal; from app.models.student_model import Student; db=SessionLocal(); db.query(Student).filter(Student.roll_no.in_(['TEST-STUDENT-001','TEST-STUDENT-002','TEST-STUDENT-003'])).delete(synchronize_session=False); db.commit(); db.close(); print('Test student data cleaned')"
```

Then:

```powershell
python -m pytest -v --tb=short
```

Expected:

```text
15 passed, 4 warnings
```

> **Important:** This cleanup deletes those test students from the development database. If you need to perform real face-recognition testing afterward, enroll the test student's face again.

---

# 12. Prepare a Real Test Face

Use a clear image containing one face, for example:

```text
test_face.jpg
```

Place it in:

```text
backend\test_face.jpg
```

Verify:

```powershell
Test-Path .\test_face.jpg
```

Expected:

```text
True
```

If it is `False`, OpenCV cannot read the image.

---

# 13. Test Real Face Encoding

```powershell
python -c "from app.services.face_recognition_service import encode_image; import cv2; img=cv2.cvtColor(cv2.imread('test_face.jpg'), cv2.COLOR_BGR2RGB); enc=encode_image(img); print('Faces detected:', len(enc)); print('Encoding shape:', enc[0].shape if enc else None)"
```

Successful final test:

```text
Faces detected: 1
Encoding shape: (128,)
```

This confirms:

```text
Real image
    ↓
Face detection
    ↓
128-dimensional face encoding
```

---

# 14. Check Students and Face-Encoding Status

```powershell
python -c "from app.db import SessionLocal; from app.models.student_model import Student; db=SessionLocal(); print([(s.student_id, s.roll_no, s.full_name, bool(s.face_encoding)) for s in db.query(Student).order_by(Student.student_id).all()]); db.close()"
```

The final value means:

- `False` = no face encoding saved
- `True` = face encoding saved

---

# 15. Enroll a Test Student's Face

For the controlled recognition test, use:

```text
TEST-STUDENT-001
```

Make sure `test_face.jpg` exists.

Run:

```powershell
python -c "import cv2; from app.db import SessionLocal; from app.models.student_model import Student; from app.services.face_recognition_service import encode_image, encoding_to_bytes; db=SessionLocal(); s=db.query(Student).filter(Student.roll_no=='TEST-STUDENT-001').first(); print('Student exists:', bool(s)); img=cv2.imread('test_face.jpg'); assert img is not None, 'test_face.jpg not found'; rgb=cv2.cvtColor(img, cv2.COLOR_BGR2RGB); enc=encode_image(rgb); assert len(enc)==1, f'Expected 1 face, found {len(enc)}'; s.face_encoding=encoding_to_bytes(enc[0]); db.commit(); print('Face enrollment: PASS'); db.close()"
```

Expected:

```text
Student exists: True
Face enrollment: PASS
```

---

# 16. Verify Saved Encoding

```powershell
python -c "from app.db import SessionLocal; from app.models.student_model import Student; from app.services.face_recognition_service import bytes_to_encoding; db=SessionLocal(); s=db.query(Student).filter(Student.roll_no=='TEST-STUDENT-001').first(); e=bytes_to_encoding(s.face_encoding); print('Student:', s.roll_no); print('Encoding saved:', bool(s.face_encoding)); print('Encoding length:', len(e) if e is not None else None); print('First 5:', e[:5] if e is not None else None); db.close()"
```

Expected:

```text
Encoding saved: True
Encoding length: 128
```

---

# 17. Verify Direct Face Comparison

```powershell
python -c "import cv2; from app.db import SessionLocal; from app.models.student_model import Student; from app.services.face_recognition_service import encode_image, bytes_to_encoding, compare_encoding; db=SessionLocal(); s=db.query(Student).filter(Student.roll_no=='TEST-STUDENT-001').first(); img=cv2.imread('test_face.jpg'); rgb=cv2.cvtColor(img, cv2.COLOR_BGR2RGB); current=encode_image(rgb)[0]; saved=bytes_to_encoding(s.face_encoding); print('Current encoding:', len(current)); print('Saved encoding:', len(saved)); print('Compare result:', compare_encoding(current, saved)); db.close()"
```

For the same test image, the verified result was:

```text
Current encoding: 128
Saved encoding: 128
Compare result: (True, 0.0)
```

This independently proves the saved and current face encodings match.

---

# 18. Check Attendance Sessions

```powershell
python -c "from app.db import SessionLocal; from app.models.session_model import AttendanceSession; db=SessionLocal(); print([(s.session_id, s.class_id, s.photo_uploaded_path) for s in db.query(AttendanceSession).order_by(AttendanceSession.session_id).all()]); db.close()"
```

The final recognition test used:

```text
Session ID: 1
Class ID: 1
```

---

# 19. Verify Session Photo Path

Example:

```powershell
python -c "from app.db import SessionLocal; from app.models.session_model import AttendanceSession; from pathlib import Path; db=SessionLocal(); s=db.query(AttendanceSession).filter(AttendanceSession.session_id==1).first(); print('DB path:', s.photo_uploaded_path); p=Path(s.photo_uploaded_path); print('Relative exists:', p.exists()); print('Resolved:', p.resolve()); db.close()"
```

The physical session photo must exist.

---

# 20. Session Photo Path Resolution

The backend uses `_resolve_stored_path()` to convert a database-relative path such as:

```text
uploads/sessions/1/photo.jpg
```

to an actual backend file path.

Verify:

```powershell
python -c "from app.api.sessions import _resolve_stored_path; p=_resolve_stored_path('uploads/sessions/1/f162ae7c510c467c811fa595acf0f36b.jpg'); print('Resolved:', p); print('Exists:', p.exists())"
```

Expected:

```text
Exists: True
```

The resolved path should point under:

```text
backend\uploads\sessions\
```

---

# 21. Start the Backend

From the `backend` directory:

```powershell
python -m uvicorn app.main:app --reload
```

Expected:

```text
Uvicorn running on http://127.0.0.1:8000
```

Keep this terminal running.

---

# 22. Open Swagger

Open:

```text
http://127.0.0.1:8000/docs
```

Swagger UI provides the API endpoints.

---

# 23. Upload a Real Session Photo

Use:

```text
POST /api/v1/sessions/{session_id}/photo
```

In Swagger:

1. Click **Try it out**
2. Set:
   ```text
   session_id = 1
   ```
3. Select a real image, such as:
   ```text
   test_face.jpg
   ```
4. Click **Execute**

Expected:

```text
201 Created
```

For the verified real test:

```text
face_count = 1
```

---

# 24. Run Real Face Recognition

Use:

```text
POST /api/v1/sessions/{session_id}/recognize
```

In Swagger:

1. Click **Try it out**
2. Set:
   ```text
   session_id = 1
   ```
3. Click **Execute**

For a successful test, the student's class must match the session's class.

Expected structure:

```json
{
  "session_id": 1,
  "face_count": 1,
  "recognized_count": 1,
  "unknown_count": 0,
  "recognized_faces": [
    {
      "student_id": 2,
      "roll_no": "TEST-STUDENT-001",
      "full_name": "Test Student",
      "distance": 0,
      "confidence": 1,
      "status": "recognized"
    }
  ],
  "unknown_faces": []
}
```

The exact `student_id` can differ between databases.

---

# 25. Class Matching Is Required

Recognition is class-aware.

The student's:

```text
class_id
```

must match the session's:

```text
class_id
```

Example:

```text
Student class_id = 1
Session class_id = 1
```

If:

```text
Student class_id = 2
Session class_id = 1
```

the student is not considered a candidate for that session, even if the face encoding itself matches.

This behavior was verified during testing.

---

# 26. If Recognition Returns `unknown`

A response such as:

```json
{
  "face_count": 1,
  "recognized_count": 0,
  "unknown_count": 1
}
```

does not automatically mean the face-recognition library is broken.

Check these in order.

### Student exists

```powershell
python -c "from app.db import SessionLocal; from app.models.student_model import Student; db=SessionLocal(); s=db.query(Student).filter(Student.roll_no=='TEST-STUDENT-001').first(); print('Student exists:', bool(s)); db.close()"
```

### Encoding exists

```powershell
python -c "from app.db import SessionLocal; from app.models.student_model import Student; db=SessionLocal(); s=db.query(Student).filter(Student.roll_no=='TEST-STUDENT-001').first(); print('Encoding saved:', bool(s.face_encoding) if s else None); db.close()"
```

### Encoding length

Expected:

```text
128
```

### Student and session classes

```powershell
python -c "from app.db import SessionLocal; from app.models.student_model import Student; from app.models.session_model import AttendanceSession; db=SessionLocal(); s=db.query(Student).filter(Student.roll_no=='TEST-STUDENT-001').first(); a=db.query(AttendanceSession).filter(AttendanceSession.session_id==1).first(); print('Student class:', s.class_id); print('Session class:', a.class_id); db.close()"
```

### Direct comparison

For the same image:

```text
Compare result: (True, 0.0)
```

should be possible.

---

# 27. Common Error: `No module named 'app'`

If you see:

```text
ModuleNotFoundError: No module named 'app'
```

you are probably in the project root instead of `backend`.

Fix:

```powershell
cd backend
```

Then rerun the command.

---

# 28. Common Error: `test_face.jpg` Cannot Be Read

If OpenCV reports:

```text
imread_('test_face.jpg'): can't open/read file
```

run:

```powershell
Test-Path .\test_face.jpg
```

If it returns:

```text
False
```

place the image at:

```text
backend\test_face.jpg
```

Then retry.

---

# 29. Common Error: Session Photo File Not Found

First inspect the stored database path:

```powershell
python -c "from app.db import SessionLocal; from app.models.session_model import AttendanceSession; db=SessionLocal(); s=db.query(AttendanceSession).filter(AttendanceSession.session_id==1).first(); print(s.photo_uploaded_path); db.close()"
```

Then verify the physical file.

If the file exists but the API reports it is missing, test `_resolve_stored_path()` as described in Section 20.

The resolved path must point to the actual file under:

```text
backend\uploads\sessions\
```

---

# 30. Common Error: `Unable to decode session photo`

A file can pass simple upload/header validation but still not be a valid image that OpenCV can decode.

For example, a minimal fake JPEG header can pass header validation but fail OpenCV decoding.

Solution:

Use a real JPEG/PNG image and upload it through:

```text
POST /api/v1/sessions/{session_id}/photo
```

Then run recognition again.

---

# 31. Common Error: dlib Installation Failure

If:

```powershell
python -m pip install face-recognition
```

fails while building dlib with Visual C++/Visual Studio errors:

1. Install the required Visual Studio C++ build tools.
2. Restart if requested.
3. Open a new PowerShell.
4. Run:

```powershell
python -m pip install dlib
```

5. Verify:

```powershell
python -c "import dlib; print('dlib OK:', dlib.__version__)"
```

6. Install/verify face-recognition:

```powershell
python -m pip install face-recognition
python -c "import face_recognition; print('face_recognition OK')"
```

---

# 32. Recommended Clean Final Verification Sequence

## Step 1 — Go to backend

```powershell
cd "C:\Users\Acer\Desktop\test\Neoai_attendance_system-main\Neoai_attendance_system-main\backend"
```

## Step 2 — Verify environment

```powershell
python -c "import cv2; print('OpenCV:', cv2.__version__)"
python -c "import dlib; print('dlib OK:', dlib.__version__)"
python -c "import face_recognition; print('face_recognition OK')"
```

## Step 3 — Verify recognition service

```powershell
python -c "from app.services.face_recognition_service import encode_image, compare_encoding, find_best_match; print('All recognition functions OK')"
```

## Step 4 — Run automated tests

```powershell
python -m pytest -v --tb=short
```

Expected:

```text
15 passed, 4 warnings
```

## Step 5 — Ensure the real test image exists

```powershell
Test-Path .\test_face.jpg
```

Expected:

```text
True
```

## Step 6 — Test real face encoding

```powershell
python -c "from app.services.face_recognition_service import encode_image; import cv2; img=cv2.cvtColor(cv2.imread('test_face.jpg'), cv2.COLOR_BGR2RGB); enc=encode_image(img); print('Faces detected:', len(enc)); print('Encoding shape:', enc[0].shape if enc else None)"
```

Expected:

```text
Faces detected: 1
Encoding shape: (128,)
```

## Step 7 — Enroll the test student

Use the enrollment command in Section 15.

Expected:

```text
Face enrollment: PASS
```

## Step 8 — Start backend

```powershell
python -m uvicorn app.main:app --reload
```

## Step 9 — Open Swagger

```text
http://127.0.0.1:8000/docs
```

## Step 10 — Upload session photo

```text
POST /api/v1/sessions/{session_id}/photo
```

Expected:

```text
201 Created
face_count = 1
```

## Step 11 — Recognize

```text
POST /api/v1/sessions/{session_id}/recognize
```

Expected:

```text
200 OK
face_count = 1
recognized_count = 1
unknown_count = 0
```

---

# 33. Final Verified Status

The final backend verification achieved:

| Component | Result |
|---|---|
| Python | PASS |
| OpenCV | PASS |
| dlib | PASS |
| face-recognition | PASS |
| Recognition service imports | PASS |
| Student `face_encoding` field | PASS |
| Automated backend tests | **15/15 PASS** |
| Real face detection | **1 face** |
| Real face encoding | **128 dimensions** |
| Face enrollment | PASS |
| Session photo upload | PASS |
| Session photo decoding | PASS |
| Class-based candidate filtering | PASS |
| Direct face comparison | PASS |
| Real face recognition | PASS |
| Recognition confidence in controlled same-image test | **1.0** |
| Unknown faces in controlled same-image test | **0** |

Final successful controlled recognition:

```text
face_count       = 1
recognized_count = 1
unknown_count    = 0
distance         = 0
confidence       = 1
status           = recognized
```

---

# 34. Test-Data Warning

`TEST-STUDENT-001`, `TEST-STUDENT-002`, and `TEST-STUDENT-003` are test records.

The cleanup command removes them from the development database.

After cleanup:
- Automated tests can be run cleanly.
- `TEST-STUDENT-001` must be enrolled again for real recognition testing.
- `test_face.jpg` must be available for enrollment.
- Test student class must match the recognition session class.

Do not treat these test records as final production/student data.

---

# 35. Quick Start — Normal Backend Run

Once dependencies are installed:

```powershell
cd "C:\Users\Acer\Desktop\test\Neoai_attendance_system-main\Neoai_attendance_system-main\backend"
python -m uvicorn app.main:app --reload
```

Open:

```text
http://127.0.0.1:8000/docs
```

For automated verification:

```powershell
python -m pytest -v --tb=short
```

Expected:

```text
15 passed
```

---

# 36. Final Architecture Flow

```text
Student Face Photo
        ↓
Face Detection
        ↓
128-D Face Encoding
        ↓
Student Database Enrollment
        ↓
Session/Classroom Photo Upload
        ↓
Face Detection
        ↓
Face Encoding
        ↓
Class-Based Candidate Filtering
        ↓
Face Comparison
        ↓
Student Recognized
```

## Final conclusion

The backend was successfully verified during final testing.

The verified checkpoint was:

```text
15/15 automated tests passed
+
real face detection passed
+
128-D face encoding passed
+
face enrollment passed
+
session photo upload passed
+
class filtering passed
+
real face recognition passed
```

This document should be used as the step-by-step reference for running and verifying the backend.
