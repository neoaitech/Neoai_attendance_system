from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class DepartmentBase(BaseModel):
    name: str
    code: str
    is_active: Optional[bool] = True

class DepartmentResponse(DepartmentBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class ProgramBase(BaseModel):
    name: str
    code: str
    department_id: Optional[int] = None
    duration_years: Optional[int] = 4
    total_semesters: Optional[int] = 8
    is_active: Optional[bool] = True

class ProgramResponse(ProgramBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class AcademicYearResponse(BaseModel):
    id: int
    year_code: str
    is_current: bool
    model_config = ConfigDict(from_attributes=True)

class CourseMasterBase(BaseModel):
    code: str
    title: str
    subject_name: Optional[str] = None
    credits: Optional[int] = 4
    description: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = "Active"

class CourseMasterResponse(CourseMasterBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class AcademicMetadataResponse(BaseModel):
    departments: List[str]
    programs: List[str]
    semesters: List[str]
    divisions: List[str]
    academic_years: List[str]
    batches: List[str]
    enrollment_statuses: List[str]
    student_statuses: List[str]
