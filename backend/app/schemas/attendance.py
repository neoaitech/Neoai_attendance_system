from typing import Optional, List
from datetime import date
from pydantic import BaseModel

class SessionCreate(BaseModel):
    class_id: int
    session_name: str
    session_date: Optional[date] = None
    start_time: Optional[str] = "09:00 AM"
    end_time: Optional[str] = "10:30 AM"
    notes: Optional[str] = None
    tolerance: Optional[float] = 0.55

class AttendanceRecordUpdate(BaseModel):
    record_id: Optional[int] = None
    status: str  # "PRESENT", "ABSENT", "LATE", "EXCUSED"
    notes: Optional[str] = None

class LiveStudentVerifyRequest(BaseModel):
    student_id: int
    record_id: Optional[int] = None
    image_base64: str
    tolerance: Optional[float] = 0.54

class BulkAttendanceUpdateRequest(BaseModel):
    session_id: int
    updates: List[AttendanceRecordUpdate]

class AttendanceRecordResponse(BaseModel):
    id: int
    session_id: int
    student_id: int
    student_name: str
    roll_number: str
    status: str
    confidence_score: float
    detection_bbox: Optional[List[int]] = None
    verification_type: str
    notes: Optional[str] = None
    marked_at: Optional[str] = None

class AttendanceSessionResponse(BaseModel):
    id: int
    class_id: int
    class_code: Optional[str] = None
    class_name: Optional[str] = None
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = None
    session_name: str
    session_date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    scheduled_start_time: Optional[str] = None
    scheduled_end_time: Optional[str] = None
    actual_time: Optional[str] = None
    actual_datetime: Optional[str] = None
    raw_photo_path: Optional[str] = None
    photo_paths: Optional[List[str]] = []
    processed_photo_path: Optional[str] = None
    processed_photo_paths: Optional[List[str]] = []
    total_detected: int
    total_recognized: int
    total_unknown: int
    status: str
    notes: Optional[str] = None
    created_at: Optional[str] = None
    finalized_at: Optional[str] = None
    records: Optional[List[AttendanceRecordResponse]] = []
