from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.db.models import (
    AcademicDepartment, AcademicProgram, AcademicYear, CourseMaster, ClassCourse, Student, User
)
from backend.app.schemas.academic import (
    DepartmentResponse, ProgramResponse, AcademicYearResponse,
    CourseMasterResponse, CourseMasterBase, AcademicMetadataResponse
)
from backend.app.api.auth import get_current_user, require_admin

router = APIRouter(prefix="/academic", tags=["Academic Master & Structure"])

DEFAULT_DEPARTMENTS = [
    ("Computer", "COMP"),
    ("Law", "LAW"),
    ("Management", "MGMT"),
    ("Sport", "SPORT")
]

DEFAULT_PROGRAMS = [
    ("BCA", "BCA", 3, 6),
    ("MCA", "MCA", 2, 4),
    ("MBA", "MBA", 2, 4),
    ("BBA", "BBA", 3, 6),
    ("BA", "BA", 3, 6),
    ("MA", "MA", 2, 4),
    ("B.Tech", "BTECH", 4, 8),
    ("M.Tech", "MTECH", 2, 4)
]

DEFAULT_YEARS = ["2026-27", "2025-26", "2024-25"]

@router.get("/metadata", response_model=AcademicMetadataResponse)
def get_academic_metadata(db: Session = Depends(get_db)):
    # 1. Fetch departments from DB + default list + distinct from Student and ClassCourse
    dept_objs = db.query(AcademicDepartment).filter(AcademicDepartment.is_active == True).all()
    db_dept_names = [d.name for d in dept_objs] if dept_objs else []

    # Dynamic custom departments from students and course offerings
    from sqlalchemy import distinct
    student_depts = [d[0] for d in db.query(distinct(Student.department)).filter(Student.department.isnot(None)).all() if d[0] and d[0].strip()]
    class_depts = [d[0] for d in db.query(distinct(ClassCourse.department)).filter(ClassCourse.department.isnot(None)).all() if d[0] and d[0].strip()]

    # Ordered list with primary standard departments first
    seen_lower = set()
    departments = []
    primary_defaults = [d[0] for d in DEFAULT_DEPARTMENTS]
    for d in primary_defaults + db_dept_names + student_depts + class_depts:
        d_clean = str(d).strip()
        if d_clean and d_clean.lower() not in seen_lower and d_clean.lower() != "other":
            seen_lower.add(d_clean.lower())
            departments.append(d_clean)
    
    # 2. Fetch programs: Primary standard programs + DB programs + student/class distinct programs
    prog_objs = db.query(AcademicProgram).filter(AcademicProgram.is_active == True).all()
    db_prog_names = [p.name for p in prog_objs] if prog_objs else []
    student_progs = [p[0] for p in db.query(distinct(Student.program)).filter(Student.program.isnot(None)).all() if p[0] and p[0].strip()]
    class_progs = [p[0] for p in db.query(distinct(ClassCourse.program)).filter(ClassCourse.program.isnot(None)).all() if p[0] and p[0].strip()]

    seen_prog_lower = set()
    programs = []
    primary_prog_defaults = [p[0] for p in DEFAULT_PROGRAMS]
    for p in primary_prog_defaults + db_prog_names + student_progs + class_progs:
        p_clean = str(p).strip()
        if p_clean and p_clean.lower() not in seen_prog_lower and p_clean.lower() not in ["other", "all", "all programs"]:
            seen_prog_lower.add(p_clean.lower())
            programs.append(p_clean)

    # 3. Fetch academic years
    year_objs = db.query(AcademicYear).all()
    academic_years = [y.year_code for y in year_objs] if year_objs else DEFAULT_YEARS

    semesters = [f"Semester {i}" for i in range(1, 9)]
    divisions = ["A", "B", "C", "D"]
    batches = ["2023-2027", "2024-2028", "2025-2029", "2026-2030"]
    enrollment_statuses = ["Active", "Dropped", "Completed", "Withdrawn"]
    student_statuses = ["Active", "Inactive", "Graduated", "Transferred", "Suspended"]

    return {
        "departments": departments,
        "programs": programs,
        "semesters": semesters,
        "divisions": divisions,
        "academic_years": academic_years,
        "batches": batches,
        "enrollment_statuses": enrollment_statuses,
        "student_statuses": student_statuses
    }

@router.get("/courses", response_model=List[CourseMasterResponse])
def get_course_masters(
    department: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(CourseMaster).filter(CourseMaster.status == "Active")
    if department:
        query = query.filter(CourseMaster.department == department)
    courses = query.all()
    
    if not courses:
        # Fallback to distinct codes from ClassCourse offerings
        classes = db.query(ClassCourse).all()
        seen = set()
        result = []
        for c in classes:
            if c.code not in seen:
                seen.add(c.code)
                result.append({
                    "id": c.id,
                    "code": c.code,
                    "title": c.name,
                    "subject_name": getattr(c, "subject_name", c.name),
                    "credits": getattr(c, "credits", 4),
                    "description": "",
                    "department": c.department,
                    "status": "Active"
                })
        return result
    return [c.to_dict() for c in courses]

@router.post("/courses", response_model=CourseMasterResponse)
def create_course_master(
    payload: CourseMasterBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    existing = db.query(CourseMaster).filter(CourseMaster.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Course Master with code '{payload.code}' already exists.")
    
    course = CourseMaster(
        code=payload.code,
        title=payload.title,
        subject_name=payload.subject_name or payload.title,
        credits=payload.credits or 4,
        description=payload.description,
        department=payload.department,
        status=payload.status or "Active"
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course.to_dict()

@router.put("/courses/{course_id}", response_model=CourseMasterResponse)
def update_course_master(
    course_id: int,
    payload: CourseMasterBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    course = db.query(CourseMaster).filter(CourseMaster.id == course_id).first()
    if not course:
        # Fallback search by code
        course = db.query(CourseMaster).filter(CourseMaster.code == payload.code).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course Master not found.")

    course.code = payload.code
    course.title = payload.title
    course.subject_name = payload.subject_name or payload.title
    course.credits = payload.credits or 4
    course.description = payload.description or ""
    course.department = payload.department
    course.status = payload.status or "Active"

    db.commit()
    db.refresh(course)
    return course.to_dict()

@router.delete("/courses/{course_id}")
def delete_course_master(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    course = db.query(CourseMaster).filter(CourseMaster.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course Master not found.")

    db.delete(course)
    db.commit()
    return {"message": f"Course Master '{course.code} - {course.title}' deleted successfully."}

