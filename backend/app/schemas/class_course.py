from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class ClassBase(BaseModel):
    code: str
    name: str
    subject_name: Optional[str] = None
    department: str
    program: Optional[str] = "B.Tech"
    semester: str = "Semester 5"
    section: str = "A"
    academic_year: Optional[str] = "2026-27"
    term: Optional[str] = "Semester 7"
    credits: Optional[int] = 4
    room: Optional[str] = None
    day: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    start_date: Optional[str] = None
    status: Optional[str] = "Active"
    teacher_id: Optional[int] = None

class ClassCreate(ClassBase):
    section: Optional[str] = "A"
    sections: Optional[List[str]] = None  # e.g., ["A", "B"]
    auto_enroll: Optional[bool] = True
    student_ids: Optional[List[int]] = None
    division_student_map: Optional[dict] = None  # e.g. {"A": [1, 2], "B": [3, 4]}
    faculty_ids: Optional[List[int]] = None
    faculty_scope_map: Optional[dict] = None  # e.g. {"All": [1], "A": [1], "B": [2]}

class ClassUpdate(BaseModel):
    name: Optional[str] = None
    subject_name: Optional[str] = None
    department: Optional[str] = None
    program: Optional[str] = None
    semester: Optional[str] = None
    section: Optional[str] = None
    sections: Optional[List[str]] = None
    academic_year: Optional[str] = None
    term: Optional[str] = None
    credits: Optional[int] = None
    room: Optional[str] = None
    day: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    start_date: Optional[str] = None
    status: Optional[str] = None
    teacher_id: Optional[int] = None
    faculty_ids: Optional[List[int]] = None

class ClassResponse(ClassBase):
    id: int
    teacher_name: Optional[str] = "Unassigned"
    teachers: Optional[List[dict]] = []
    sections: Optional[List[str]] = []
    enrolled_students_count: int = 0
    start_date: Optional[str] = None
    created_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class EnrollStudentsRequest(BaseModel):
    student_ids: List[int]
    status: Optional[str] = "Active"

class FacultyAssignmentRequest(BaseModel):
    faculty_ids: List[int]
    primary_faculty_id: Optional[int] = None

