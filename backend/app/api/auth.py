from pydantic import BaseModel
from fastapi import APIRouter

from app.api._utils import not_implemented

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(payload: LoginRequest):
    return not_implemented("Authentication login is planned but not implemented in Day 5.")


@router.post("/logout")
def logout():
    return not_implemented("Authentication logout is planned but not implemented in Day 5.")
