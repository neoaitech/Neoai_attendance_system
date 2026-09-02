from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class DashboardStats(BaseModel):
    total_students: int
    total_classes: int
    total_sessions: int
    today_sessions_count: int
    overall_attendance_rate: float
    pending_unknown_faces_count: int
    total_defaulters_count: int
    recent_sessions: List[Dict[str, Any]]
    weekly_attendance_trend: List[Dict[str, Any]]
    class_wise_distribution: List[Dict[str, Any]]

class ModelBenchmarkMetrics(BaseModel):
    library_comparison: List[Dict[str, Any]]
    current_model_metrics: Dict[str, Any]
    threshold_analysis: List[Dict[str, Any]]
