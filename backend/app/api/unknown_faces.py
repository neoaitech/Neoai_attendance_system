from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.db.models import UnknownFace, User
from backend.app.schemas.unknown_face import UnknownFaceResponse, TagUnknownFaceRequest
from backend.app.services.attendance_service import attendance_service
from backend.app.api.auth import get_current_user

router = APIRouter(prefix="/unknown-faces", tags=["Unknown Faces Queue"])

@router.get("", response_model=List[UnknownFaceResponse])
def get_unknown_faces(
    status_filter: Optional[str] = "PENDING",
    session_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(UnknownFace)
    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(UnknownFace.status == status_filter.upper())
    if session_id:
        query = query.filter(UnknownFace.session_id == session_id)

    unknown_faces = query.order_by(UnknownFace.created_at.desc()).all()
    return [u.to_dict() for u in unknown_faces]

@router.post("/resolve")
def resolve_unknown_face_unified(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Unified endpoint to resolve an unknown face crop:
    - ATTACH_EXISTING: tags crop to an existing registered student.
    - ENROLL_NEW: creates a new student from the crop data and assigns biometric vector.
    """
    unknown_face_id = payload.get("unknown_face_id")
    action = payload.get("action", "ATTACH_EXISTING")

    if not unknown_face_id:
        raise HTTPException(status_code=400, detail="unknown_face_id is required.")

    from backend.app.db.models import Student, ClassCourse
    import os

    unknown_face = db.query(UnknownFace).filter(UnknownFace.id == unknown_face_id).first()
    if not unknown_face:
        raise HTTPException(status_code=404, detail=f"Unknown face entry #{unknown_face_id} not found.")

    from backend.app.services.permission_service import permission_service

    if action == "ATTACH_EXISTING":
        if not permission_service.has_permission(db, current_user, "unknown_face.link_existing_student"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied: You lack authority 'unknown_face.link_existing_student' to tag unknown faces."
            )
        student_id = payload.get("student_id")
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id is required for ATTACH_EXISTING.")

        resolved = attendance_service.resolve_unknown_face(
            db=db,
            unknown_face_id=unknown_face_id,
            student_id=int(student_id),
            update_attendance=True,
            user_id=current_user.id
        )
        return resolved.to_dict()

    elif action == "ENROLL_NEW":
        if not permission_service.has_permission(db, current_user, "unknown_face.enroll_new_student"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied: You lack authority 'unknown_face.enroll_new_student' to enroll new students from unknown faces."
            )
        student_data = payload.get("student_data", {})
        full_name = student_data.get("full_name")
        roll_number = student_data.get("roll_number")
        email = student_data.get("email")

        if not full_name or not roll_number:
            raise HTTPException(status_code=400, detail="Full name and Roll number are required.")

        existing = db.query(Student).filter(
            (Student.roll_number == roll_number) | (Student.email == email)
        ).first()

        if existing:
            student = existing
        else:
            student = Student(
                roll_number=roll_number,
                full_name=full_name,
                email=email or f"{roll_number.lower()}@university.edu",
                department=student_data.get("department", "Computer Science"),
                course=student_data.get("course", "B.Tech Computer Science"),
                is_active=True
            )

            class_ids = student_data.get("class_ids", [])
            if class_ids:
                classes = db.query(ClassCourse).filter(ClassCourse.id.in_(class_ids)).all()
                student.enrolled_classes.extend(classes)
            else:
                all_classes = db.query(ClassCourse).all()
                student.enrolled_classes.extend(all_classes)

            if unknown_face.cropped_image_path and os.path.exists(unknown_face.cropped_image_path):
                student.photo_url = f"/uploads/unknown_faces/{os.path.basename(unknown_face.cropped_image_path)}"
                try:
                    from backend.app.ai.face_engine import face_engine
                    enc = face_engine.extract_single_face_encoding(unknown_face.cropped_image_path)
                    if enc is not None:
                        student.face_embedding = [enc]
                except Exception:
                    pass

            db.add(student)
            db.flush()

        resolved = attendance_service.resolve_unknown_face(
            db=db,
            unknown_face_id=unknown_face_id,
            student_id=student.id,
            update_attendance=True,
            user_id=current_user.id
        )
        return resolved.to_dict()

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported resolution action: {action}")

@router.post("/{unknown_face_id}/tag", response_model=UnknownFaceResponse)
def tag_unknown_face(
    unknown_face_id: int,
    payload: TagUnknownFaceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from backend.app.services.permission_service import permission_service
    if not permission_service.has_permission(db, current_user, "unknown_face.link_existing_student"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You lack authority 'unknown_face.link_existing_student' to tag unknown faces."
        )
    resolved = attendance_service.resolve_unknown_face(
        db=db,
        unknown_face_id=unknown_face_id,
        student_id=payload.student_id,
        update_attendance=payload.update_attendance,
        user_id=current_user.id
    )
    return resolved.to_dict()

@router.post("/{unknown_face_id}/resolve")
def resolve_unknown_face_by_id(
    unknown_face_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from backend.app.services.permission_service import permission_service
    if not permission_service.has_permission(db, current_user, "unknown_face.link_existing_student"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You lack authority 'unknown_face.link_existing_student' to link unknown faces."
        )
    student_id = payload.get("student_id")
    if not student_id:
        raise HTTPException(status_code=400, detail="student_id is required.")
    update_attendance = payload.get("update_attendance", True)
    resolved = attendance_service.resolve_unknown_face(
        db=db,
        unknown_face_id=unknown_face_id,
        student_id=int(student_id),
        update_attendance=bool(update_attendance),
        user_id=current_user.id
    )
    return resolved.to_dict()

@router.post("/{unknown_face_id}/dismiss", response_model=UnknownFaceResponse)
def dismiss_unknown_face(
    unknown_face_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from backend.app.services.permission_service import permission_service
    if not permission_service.has_permission(db, current_user, "unknown_face.dismiss"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You lack authority 'unknown_face.dismiss' to dismiss unknown faces."
        )
    dismissed = attendance_service.dismiss_unknown_face(
        db=db,
        unknown_face_id=unknown_face_id,
        user_id=current_user.id
    )
    return dismissed.to_dict()
