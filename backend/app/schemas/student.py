from typing import Optional, List
from pydantic import BaseModel, EmailStr, ConfigDict

class StudentBase(BaseModel):
    roll_number: str
    full_name: str
    email: EmailStr
    mobile_number: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = "Active"
    program: Optional[str] = "B.Tech"
    other_program: Optional[str] = None
    course: Optional[str] = "B.Tech Computer Science"
    semester: Optional[str] = "Semester 5"
    specialization: Optional[str] = "Artificial Intelligence & Data Science"
    department: str
    other_department: Optional[str] = None
    academic_year: Optional[str] = "2026-27"
    admission_year: Optional[int] = 2023
    batch: Optional[str] = "2023-2027"
    year: int = 3
    section: str = "A"

class StudentCreate(StudentBase):
    class_ids: Optional[List[int]] = []

class StudentUpdate(BaseModel):
    roll_number: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    mobile_number: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None
    program: Optional[str] = None
    other_program: Optional[str] = None
    course: Optional[str] = None
    semester: Optional[str] = None
    specialization: Optional[str] = None
    department: Optional[str] = None
    other_department: Optional[str] = None
    academic_year: Optional[str] = None
    admission_year: Optional[int] = None
    batch: Optional[str] = None
    year: Optional[int] = None
    section: Optional[str] = None
    is_active: Optional[bool] = None
    attendance_status: Optional[str] = None
    is_frozen: Optional[bool] = None
    freeze_reason: Optional[str] = None
    class_ids: Optional[List[int]] = None

class StudentFreezeRequest(BaseModel):
    reason: Optional[str] = "Temporary administrative / academic freeze"
    freeze_until: Optional[str] = None  # ISO date string e.g. "2026-09-15"

class StudentResponse(StudentBase):
    id: int
    photo_url: Optional[str] = None
    photo_urls: Optional[List[str]] = []
    photos_count: int = 0
    has_face_embedding: bool
    is_active: bool
    attendance_status: Optional[str] = "ACTIVE"
    is_frozen: Optional[bool] = False
    frozen_at: Optional[str] = None
    unfrozen_at: Optional[str] = None
    freeze_reason: Optional[str] = None
    freeze_until: Optional[str] = None  # Auto-unfreeze date
    created_at: Optional[str] = None
    enrolled_classes: Optional[List[dict]] = []
    classes: Optional[List[dict]] = []

    model_config = ConfigDict(from_attributes=True)
