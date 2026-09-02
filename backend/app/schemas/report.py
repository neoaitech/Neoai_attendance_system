from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class StudentAttendanceSummary(BaseModel):
    student_id: int
    roll_number: str
    full_name: str
    department: str
    total_sessions: int
    present_count: int
    absent_count: int
    late_count: int
    attendance_percentage: float
    is_defaulter: bool

class ClassAttendanceReport(BaseModel):
    class_id: int
    class_code: str
    class_name: str
    total_enrolled: int
    total_sessions_conducted: int
    average_attendance_percentage: float
    defaulters_count: int
    students_summary: List[StudentAttendanceSummary]

class SessionSummaryReport(BaseModel):
    session_id: int
    session_name: str
    session_date: str
    class_name: str
    total_enrolled: int
    total_present: int
    total_absent: int
    total_late: int
    attendance_percentage: float
    total_unknown_faces: int
