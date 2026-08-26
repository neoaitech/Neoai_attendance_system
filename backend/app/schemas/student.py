from datetime import date
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class StudentCreate(BaseModel):
    roll_no: str = Field(min_length=1, max_length=100)
    full_name: str = Field(min_length=1, max_length=200)
    class_id: int = Field(gt=0)
    face_encoding: bytes | None = None
    photo_path: str | None = Field(default=None, max_length=500)
    email: EmailStr | None = None
    enrollment_date: date | None = None
    is_active: bool = True

class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    student_id: int
    roll_no: str
    full_name: str
    class_id: int
    photo_path: str | None
    email: str | None
    enrollment_date: date | None
    is_active: bool
