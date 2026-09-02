from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.security import verify_password, create_access_token, decode_access_token, oauth2_scheme
from backend.app.db.session import get_db
from backend.app.db.models import User
from backend.app.schemas.auth import Token, LoginRequest, UserResponse, UserCreate

router = APIRouter(prefix="/auth", tags=["Authentication"])

def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(token)
    username: str = payload.get("sub")
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def get_optional_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Optional[User]:
    if token:
        try:
            payload = decode_access_token(token)
            username: str = payload.get("sub")
            if username:
                user = db.query(User).filter(User.username == username).first()
                if user and user.is_active:
                    return user
        except Exception:
            pass
    return db.query(User).filter(User.role == "faculty").first() or db.query(User).first()

def require_admin(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    from backend.app.services.permission_service import permission_service
    if not (permission_service.is_super_admin(current_user) or current_user.role == "admin" or permission_service.has_permission(db, current_user, "permissions.manage")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required for this operation."
        )
    return current_user

def require_permission(permission_key: str):
    def permission_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> User:
        from backend.app.services.permission_service import permission_service
        if not permission_service.has_permission(db, current_user, permission_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: You lack required authority '{permission_key}' to perform this operation."
            )
        return current_user
    return permission_checker

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active or user.status in ("Suspended", "Deactivated"):
        raise HTTPException(status_code=400, detail="Inactive or suspended user account.")

    user.last_login_at = datetime.utcnow()
    db.commit()

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.username, role=user.role, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.id,
        "full_name": user.full_name,
        "username": user.username
    }

@router.post("/login-json", response_model=Token)
def login_json(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active or user.status in ("Suspended", "Deactivated"):
        raise HTTPException(status_code=400, detail="Inactive or suspended user account.")

    user.last_login_at = datetime.utcnow()
    db.commit()

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.username, role=user.role, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.id,
        "full_name": user.full_name,
        "username": user.username
    }

@router.get("/me")
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from backend.app.services.permission_service import permission_service
    user_dict = current_user.to_dict()
    eff = permission_service.get_user_effective_permissions(db, current_user)
    user_dict["permissions"] = eff["effective_permissions"]
    user_dict["granted_keys"] = eff["granted_keys"]
    user_dict["scopes"] = eff["academic_scopes"]
    user_dict["is_super_admin"] = eff["is_super_admin"]
    return user_dict

@router.get("/users", response_model=list[UserResponse])
def list_system_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    users = db.query(User).all()
    return [u.to_dict() for u in users]

@router.post("/users", response_model=UserResponse)
def create_faculty_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from backend.app.core.security import get_password_hash
    existing = db.query(User).filter((User.username == payload.username) | (User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this username or email already exists.")
    
    new_user = User(
        username=payload.username.strip(),
        email=payload.email.strip(),
        full_name=payload.full_name.strip(),
        hashed_password=get_password_hash(payload.password),
        role=payload.role or "teacher",
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user.to_dict()

@router.patch("/users/{user_id}")
def update_user_status(
    user_id: int,
    request_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    
    if "is_active" in request_data:
        target.is_active = bool(request_data["is_active"])
    if "role" in request_data:
        target.role = str(request_data["role"])
    
    db.commit()
    db.refresh(target)
    return target.to_dict()
