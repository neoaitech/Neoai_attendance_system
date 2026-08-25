from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.class_model import Class
from app.models.student_model import Student
from app.schemas.student import StudentCreate, StudentResponse

router = APIRouter(prefix="/students", tags=["Students"])


def not_implemented(message: str):
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=message)


@router.get("")
def list_students(class_id: int | None = None, is_active: bool | None = None):
    return not_implemented("Student listing is planned but not implemented in Day 5.")


@router.get("/{student_id}")
def get_student(student_id: int):
    return not_implemented("Student retrieval is planned but not implemented in Day 5.")


@router.post(
    "",
    response_model=StudentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_student(payload: StudentCreate, db: Session = Depends(get_db)):
    existing = db.query(Student).filter(Student.roll_no == payload.roll_no).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A student with this roll_no already exists",
        )

    class_exists = db.query(Class).filter(Class.class_id == payload.class_id).first()
    if class_exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )

    student = Student(
        roll_no=payload.roll_no,
        full_name=payload.full_name,
        class_id=payload.class_id,
        face_encoding=payload.face_encoding,
        photo_path=payload.photo_path,
        email=str(payload.email) if payload.email else None,
        enrollment_date=payload.enrollment_date,
        is_active=payload.is_active,
    )

    db.add(student)
    try:
        db.commit()
        db.refresh(student)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Student registration conflicts with an existing record",
        )

    return student


@router.put("/{student_id}")
def update_student(student_id: int):
    return not_implemented("Student update is planned but not implemented in Day 5.")


@router.delete("/{student_id}")
def deactivate_student(student_id: int):
    return not_implemented("Student deactivation is planned but not implemented in Day 5.")
