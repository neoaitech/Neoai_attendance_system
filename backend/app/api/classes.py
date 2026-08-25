from fastapi import APIRouter

from app.api._utils import not_implemented

router = APIRouter(prefix="/classes", tags=["Classes"])


@router.get("")
def list_classes():
    return not_implemented("Class listing is planned but not implemented in Day 5.")


@router.get("/{class_id}")
def get_class(class_id: int):
    return not_implemented("Class retrieval is planned but not implemented in Day 5.")


@router.post("")
def create_class():
    return not_implemented("Class creation is planned but not implemented in Day 5.")
