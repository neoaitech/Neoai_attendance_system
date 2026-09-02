from typing import Optional, List
from pydantic import BaseModel

class UnknownFaceResponse(BaseModel):
    id: int
    session_id: int
    session_name: str
    cropped_image_path: str
    bbox: Optional[List[int]] = None
    confidence_score: float
    status: str  # "PENDING", "RESOLVED", "DISMISSED"
    assigned_student_id: Optional[int] = None
    assigned_student_name: Optional[str] = None
    created_at: Optional[str] = None

class TagUnknownFaceRequest(BaseModel):
    student_id: int
    update_attendance: bool = True
