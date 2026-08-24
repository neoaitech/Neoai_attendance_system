from fastapi import APIRouter

from app.api._utils import not_implemented

router = APIRouter(prefix="/students", tags=["Students"])


@router.get("")
def list_students(class_id: int | None = None, is_active: bool | None = None):
    return not_implemented("Student listing is planned but not implemented in Day 5.")


@router.get("/{student_id}")
def get_student(student_id: int):
    return not_implemented("Student retrieval is planned but not implemented in Day 5.")


@router.post("")
def create_student():
    return not_implemented("Student registration is planned but not implemented in Day 5.")


@router.put("/{student_id}")
def update_student(student_id: int):
    return not_implemented("Student update is planned but not implemented in Day 5.")


@router.delete("/{student_id}")
def deactivate_student(student_id: int):
    return not_implemented("Student deactivation is planned but not implemented in Day 5.")
