from typing import Optional
from pydantic import BaseModel, EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    full_name: str
    username: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str
    role: str = "teacher"

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: Optional[str] = None
