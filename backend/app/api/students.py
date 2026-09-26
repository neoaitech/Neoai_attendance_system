import os
import re
import uuid
import json
import base64
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from backend.app.core.config import settings
from backend.app.api.auth import get_current_user, require_admin
from backend.app.db.session import get_db
from backend.app.db.models import Student, ClassCourse, User, AuditLog, AcademicDepartment, AcademicProgram, StudentFreezeLog, EmailLog, AttendanceRecord
from backend.app.schemas.student import StudentCreate, StudentUpdate, StudentResponse, StudentFreezeRequest, StudentPromotionItem, BatchPromotionPayload
from backend.app.services.face_engine import face_engine
from backend.app.services.storage_service import storage_service
from backend.app.api.staging import get_staged_photo_info

router = APIRouter(prefix="/students", tags=["Students"])

@router.get("", response_model=List[StudentResponse])
def get_students(
    search: Optional[str] = None,
    class_id: Optional[int] = None,
    department: Optional[str] = None,
    program: Optional[str] = None,
    semester: Optional[str] = None,
    section: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Student).filter(Student.is_active == True)

    if search:
        query = query.filter(
            or_(
                Student.full_name.ilike(f"%{search}%"),
                Student.roll_number.ilike(f"%{search}%"),
                Student.email.ilike(f"%{search}%")
            )
        )
    if department:
        query = query.filter(Student.department == department)
    if program:
        query = query.filter((Student.program == program) | (Student.course.ilike(f"%{program}%")))
    if semester:
        query = query.filter(Student.semester == semester)
    if section:
        query = query.filter(Student.section == section)
    if class_id:
        query = query.join(Student.enrolled_classes).filter(ClassCourse.id == class_id)

    students = query.offset(skip).limit(limit).all()
    return [s.to_dict() for s in students]

@router.get("/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    return student.to_dict()

@router.post("", response_model=StudentResponse)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    existing = db.query(Student).filter(
        (Student.roll_number == payload.roll_number) | (Student.email == payload.email)
    ).first()
    if existing:
        if existing.is_active:
            raise HTTPException(status_code=400, detail="Student with this Roll Number or Email already exists.")
        else:
            db.query(StudentFreezeLog).filter(StudentFreezeLog.student_id == existing.id).delete()
            db.query(EmailLog).filter(EmailLog.student_id == existing.id).delete()
            db.query(AttendanceRecord).filter(AttendanceRecord.student_id == existing.id).delete()
            existing.enrolled_classes.clear()
            db.delete(existing)
            db.commit()

    prog = payload.program or "B.Tech"
    student = Student(
        roll_number=payload.roll_number,
        full_name=payload.full_name,
        email=payload.email,
        program=prog,
        course=payload.course or f"{prog} {payload.department}",
        semester=payload.semester or "Semester 5",
        specialization=payload.specialization or "General",
        department=payload.department,
        year=payload.year,
        section=payload.section,
        is_active=True
    )

    if payload.class_ids:
        classes = db.query(ClassCourse).filter(ClassCourse.id.in_(payload.class_ids)).all()
        student.enrolled_classes.extend(classes)
    else:
        # Auto-enroll strictly in classes matching department, program, semester, section
        matching_classes = db.query(ClassCourse).filter(
            ClassCourse.department == payload.department,
            ClassCourse.program == prog,
            ClassCourse.semester == payload.semester,
            ClassCourse.section == payload.section
        ).all()
        student.enrolled_classes.extend(matching_classes)

    db.add(student)
    db.commit()
    db.refresh(student)
    return student.to_dict()

@router.post("/register-with-photo", response_model=StudentResponse)
async def register_student_with_photo(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Registers a student with comprehensive profile fields and extracts biometric vectors
    from 1 to 5 multi-angle photos.
    """
    form_data = await request.form()
    
    roll_number = str(form_data.get("roll_number") or "").strip()
    full_name = str(form_data.get("full_name") or "").strip()
    email = str(form_data.get("email") or "").strip()
    mobile_number = str(form_data.get("mobile_number") or "").strip() or None
    dob = str(form_data.get("dob") or "").strip() or None
    gender = str(form_data.get("gender") or "").strip() or None
    address = str(form_data.get("address") or "").strip() or None
    status_val = str(form_data.get("status") or "Active").strip()
    
    department = str(form_data.get("department") or "Computer").strip()
    other_department = str(form_data.get("other_department") or "").strip() or None
    if department == "Other" and other_department:
        department = other_department

    if department and department.lower() != "other":
        try:
            from sqlalchemy import func
            existing_dept = db.query(AcademicDepartment).filter(
                func.lower(AcademicDepartment.name) == department.lower()
            ).first()
            if not existing_dept:
                dept_code = "".join(w[0] for w in department.split()[:4]).upper() or "DEPT"
                new_dept = AcademicDepartment(name=department, code=dept_code, is_active=True)
                db.add(new_dept)
                db.flush()
        except Exception as e:
            print("AcademicDepartment auto-registration note:", e)

    program = str(form_data.get("program") or "B.Tech").strip()
    other_program = str(form_data.get("other_program") or "").strip() or None
    if program == "Other" and other_program:
        program = other_program

    course = str(form_data.get("course") or f"{program} {department}").strip()
    semester = str(form_data.get("semester") or "Semester 5").strip()
    specialization = str(form_data.get("specialization") or "General").strip()
    academic_year = str(form_data.get("academic_year") or "2026-27").strip()
    try:
        admission_year = int(form_data.get("admission_year") or 2023)
    except Exception:
        admission_year = 2023
    batch = str(form_data.get("batch") or f"{admission_year}-{admission_year+4}").strip()

    try:
        year = int(form_data.get("year") or 3)
    except Exception:
        year = 3
    section = str(form_data.get("section") or "A").strip()
    class_ids = form_data.get("class_ids")
    webcam_snapshots_json = form_data.get("webcam_snapshots_json")
    webcam_base64 = form_data.get("webcam_base64")

    if not roll_number or not full_name or not email:
        raise HTTPException(status_code=400, detail="Full Name, Roll Number, and Email are required.")

    from backend.app.services.permission_service import permission_service
    scope_context = {
        "department": department,
        "program": program,
        "semester": semester,
        "division": section
    }
    if not permission_service.has_permission(db, current_user, "student.create", scope=scope_context):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access Denied: You lack authority to add students in scope [{department} • {program} • {semester} • Div {section}]."
        )

    existing = db.query(Student).filter(
        (Student.roll_number == roll_number) | (Student.email == email)
    ).first()
    if existing:
        if existing.is_active:
            raise HTTPException(status_code=400, detail=f"Student with Roll '{roll_number}' or Email '{email}' already exists.")
        else:
            db.query(StudentFreezeLog).filter(StudentFreezeLog.student_id == existing.id).delete()
            db.query(EmailLog).filter(EmailLog.student_id == existing.id).delete()
            db.query(AttendanceRecord).filter(AttendanceRecord.student_id == existing.id).delete()
            existing.enrolled_classes.clear()
            db.delete(existing)
            db.commit()

    saved_photo_paths = []
    saved_file_disk_paths = []
    seen_filenames = set()
    pre_extracted_embeddings = []

    # 0. Support Instagram-style background staged photos
    staged_photo_ids_raw = form_data.get("staged_photo_ids") or form_data.get("staged_photos_json")
    staged_ids = []
    if staged_photo_ids_raw:
        if isinstance(staged_photo_ids_raw, str):
            try:
                parsed = json.loads(staged_photo_ids_raw)
                if isinstance(parsed, list):
                    staged_ids = [str(x).strip() for x in parsed if str(x).strip()]
                else:
                    staged_ids = [s.strip() for s in staged_photo_ids_raw.split(",") if s.strip()]
            except Exception:
                staged_ids = [s.strip() for s in staged_photo_ids_raw.split(",") if s.strip()]
        elif isinstance(staged_photo_ids_raw, list):
            staged_ids = [str(x).strip() for x in staged_photo_ids_raw if str(x).strip()]
    else:
        staged_list = form_data.getlist("staged_photo_ids")
        if staged_list:
            staged_ids = [str(x).strip() for x in staged_list if str(x).strip()]

    # Migrate any valid staged photos directly into permanent student storage
    for idx, sid in enumerate(staged_ids, 1):
        info = get_staged_photo_info(sid)
        if info and os.path.exists(info["disk_path"]):
            try:
                with open(info["disk_path"], "rb") as sf:
                    content = sf.read()
                ext = info["filename"].split(".")[-1] if "." in info["filename"] else "jpg"
                filename = f"portrait_{roll_number}_staged{idx}_{uuid.uuid4().hex[:6]}.{ext}"
                url_path, disk_path = storage_service.save_image(content, filename, folder="students")
                saved_photo_paths.append(url_path)
                saved_file_disk_paths.append(disk_path)

                cached_enc = info.get("face_encoding")
                if cached_enc is not None:
                    pre_extracted_embeddings.append(cached_enc)

                # Clean up staging file immediately
                try:
                    os.remove(info["disk_path"])
                    meta_p = Path(info["disk_path"]).parent / f"{sid}.meta.json"
                    if meta_p.exists():
                        meta_p.unlink(missing_ok=True)
                except Exception:
                    pass
            except Exception as e:
                print(f"[StudentRegister] Warning migrating staged photo {sid}: {e}")

    # 1. Collect all uploaded files under any standard key (fallback/direct)
    upload_list = []
    for key in ["photos", "photo", "files", "file", "image", "images"]:
        items = form_data.getlist(key)
        for item in items:
            if hasattr(item, "filename") and item.filename and item.filename not in seen_filenames:
                seen_filenames.add(item.filename)
                upload_list.append(item)

    # 2. Count total photos (staged + uploads + webcam snaps)
    webcam_count = 0
    parsed_snapshots = []
    if webcam_snapshots_json:
        try:
            parsed_snapshots = json.loads(webcam_snapshots_json)
            webcam_count = len(parsed_snapshots)
        except Exception:
            pass
    elif webcam_base64:
        webcam_count = 1

    total_submitted_photos = len(saved_photo_paths) + len(upload_list) + webcam_count

    # Biometric Requirement: Enforce 3 to 8 photos for enrollment gallery
    if total_submitted_photos < 3:
        raise HTTPException(
            status_code=400,
            detail=f"At least 3 face photos are required for biometric registration. (Received: {total_submitted_photos})"
        )
    if total_submitted_photos > 8:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum 8 face photos allowed for biometric registration. (Received: {total_submitted_photos})"
        )

    for idx, p in enumerate(upload_list, len(saved_photo_paths) + 1):
        extension = p.filename.split(".")[-1] if "." in p.filename else "jpg"
        filename = f"portrait_{roll_number}_angle{idx}_{uuid.uuid4().hex[:6]}.{extension}"
        content = await p.read()
        if content:
            url_path, disk_path = storage_service.save_image(content, filename, folder="students")
            saved_photo_paths.append(url_path)
            saved_file_disk_paths.append(disk_path)

    # 3. Handle Webcam Snapshots (fallback/direct)
    if parsed_snapshots:
        for idx, snap_str in enumerate(parsed_snapshots, len(saved_photo_paths) + 1):
            if "," in snap_str:
                snap_str = snap_str.split(",")[1]
            img_data = base64.b64decode(snap_str)
            filename = f"portrait_{roll_number}_cam{idx}_{uuid.uuid4().hex[:6]}.jpg"
            url_path, disk_path = storage_service.save_image(img_data, filename, folder="students")
            saved_photo_paths.append(url_path)
            saved_file_disk_paths.append(disk_path)
    elif webcam_base64:
        if "," in webcam_base64:
            webcam_base64 = webcam_base64.split(",")[1]
        img_data = base64.b64decode(webcam_base64)
        filename = f"portrait_{roll_number}_{uuid.uuid4().hex[:6]}.jpg"
        url_path, disk_path = storage_service.save_image(img_data, filename, folder="students")
        saved_photo_paths.append(url_path)
        saved_file_disk_paths.append(disk_path)

    # 4. Extract Multi-Angle Biometric Embeddings (512-D ArcFace)
    # If pre-computed embeddings exist from background staging, use them directly!
    multi_embeddings = list(pre_extracted_embeddings)
    unprocessed_disk_paths = saved_file_disk_paths[len(pre_extracted_embeddings):]
    for disk_path in unprocessed_disk_paths:
        enc = face_engine.extract_single_face_encoding(disk_path)
        if enc:
            multi_embeddings.append(enc)

    primary_photo = saved_photo_paths[0] if saved_photo_paths else None
    
    student = Student(
        roll_number=roll_number,
        full_name=full_name,
        email=email,
        mobile_number=mobile_number,
        dob=dob,
        gender=gender,
        address=address,
        status=status_val,
        program=program,
        other_program=other_program,
        course=course,
        semester=semester,
        specialization=specialization,
        department=department,
        other_department=other_department,
        academic_year=academic_year,
        admission_year=admission_year,
        batch=batch,
        year=year,
        section=section,
        photo_url=primary_photo,
        is_active=(status_val == "Active")
    )
    student.photo_urls = saved_photo_paths

    if multi_embeddings:
        student.face_embedding = multi_embeddings if len(multi_embeddings) > 1 else multi_embeddings[0]

    # Enroll in selected courses or matching context
    if class_ids:
        try:
            ids = [int(cid.strip()) for cid in str(class_ids).split(",") if cid.strip()]
            if ids:
                classes = db.query(ClassCourse).filter(ClassCourse.id.in_(ids)).all()
                student.enrolled_classes.extend(classes)
        except Exception:
            pass
    else:
        matching_classes = db.query(ClassCourse).filter(
            ClassCourse.department == department,
            ClassCourse.program == program,
            ClassCourse.semester == semester,
            ClassCourse.section == section
        ).all()
        student.enrolled_classes.extend(matching_classes)

    db.add(student)
    db.commit()
    db.refresh(student)

    # 5. Check if this registration is resolving an unknown face detection
    unknown_face_id = form_data.get("unknown_face_id")
    if unknown_face_id:
        try:
            from backend.app.services.attendance_service import attendance_service
            attendance_service.resolve_unknown_face(
                db=db,
                unknown_face_id=int(unknown_face_id),
                student_id=student.id,
                update_attendance=True,
                user_id=current_user.id
            )
        except Exception as e:
            print("Auto-resolving unknown face error during registration:", e)

    return student.to_dict()

@router.put("/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    from backend.app.services.permission_service import permission_service
    scope_context = {
        "department": student.department,
        "program": student.program,
        "semester": student.semester,
        "division": student.section
    }
    if not permission_service.has_permission(db, current_user, "student.edit", scope=scope_context):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access Denied: You lack authority to edit students in scope [{student.department} • {student.program} • {student.semester} • Div {student.section}]."
        )

    # Validate roll_number uniqueness if changed
    if payload.roll_number and payload.roll_number.strip() and payload.roll_number.strip() != student.roll_number:
        clean_roll = payload.roll_number.strip()
        existing_roll = db.query(Student).filter(
            Student.roll_number == clean_roll,
            Student.id != student_id
        ).first()
        if existing_roll:
            raise HTTPException(
                status_code=400,
                detail=f"Roll number '{clean_roll}' is already assigned to {existing_roll.full_name}."
            )

    # Validate email uniqueness if changed
    if payload.email and str(payload.email).strip().lower() != (student.email or "").lower():
        clean_email = str(payload.email).strip().lower()
        existing_email = db.query(Student).filter(
            func.lower(Student.email) == clean_email,
            Student.id != student_id
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=400,
                detail=f"Email '{clean_email}' is already registered with {existing_email.full_name}."
            )

    # Auto-register custom department if provided
    if payload.department:
        dept_clean = payload.department.strip()
        if dept_clean:
            dept_exists = db.query(AcademicDepartment).filter(
                func.lower(AcademicDepartment.name) == dept_clean.lower()
            ).first()
            if not dept_exists:
                code_clean = re.sub(r'[^A-Za-z0-9]', '', dept_clean)[:6].upper() or "DEPT"
                new_dept_record = AcademicDepartment(
                    code=code_clean,
                    name=dept_clean,
                    is_active=True
                )
                db.add(new_dept_record)

    # Auto-register custom program if provided
    if payload.program:
        prog_clean = payload.program.strip()
        if prog_clean:
            prog_exists = db.query(AcademicProgram).filter(
                func.lower(AcademicProgram.name) == prog_clean.lower()
            ).first()
            if not prog_exists:
                target_dept_name = (payload.department or student.department or "Computer").strip()
                dept_rec = db.query(AcademicDepartment).filter(
                    func.lower(AcademicDepartment.name) == target_dept_name.lower()
                ).first()
                dept_id = dept_rec.id if dept_rec else None

                code_clean = re.sub(r'[^A-Za-z0-9]', '', prog_clean)[:6].upper() or "PROG"
                existing_prog_code = db.query(AcademicProgram).filter(AcademicProgram.code == code_clean).first()
                if existing_prog_code:
                    code_clean = f"{code_clean[:4]}_{uuid.uuid4().hex[:3].upper()}"

                new_prog_record = AcademicProgram(
                    code=code_clean,
                    name=prog_clean,
                    department_id=dept_id,
                    is_active=True
                )
                db.add(new_prog_record)

    update_dict = payload.dict(exclude_unset=True)
    for field, value in update_dict.items():
        if field == "class_ids" and value is not None:
            classes = db.query(ClassCourse).filter(ClassCourse.id.in_(value)).all()
            student.enrolled_classes = classes
        else:
            setattr(student, field, value)

    # Audit Trail
    audit = AuditLog(
        user_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="UPDATE_STUDENT",
        entity="Student",
        entity_id=student_id,
        target_name=student.full_name,
        details=f"Updated details for student {student.full_name} ({student.roll_number})"
    )
    db.add(audit)

    db.commit()
    db.refresh(student)
    return student.to_dict()

@router.post("/{student_id}/update-photos", response_model=StudentResponse)
async def update_student_photos(
    student_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    form_data = await request.form()
    webcam_snapshots_json = form_data.get("webcam_snapshots_json")
    webcam_base64 = form_data.get("webcam_base64")

    saved_photo_paths = []
    saved_file_disk_paths = []
    seen_filenames = set()

    for key in ["photos", "photo", "files", "file", "image", "images"]:
        items = form_data.getlist(key)
        for item in items:
            if hasattr(item, "filename") and item.filename and item.filename not in seen_filenames:
                seen_filenames.add(item.filename)
                extension = item.filename.split(".")[-1] if "." in item.filename else "jpg"
                filename = f"portrait_{student.roll_number}_angle_{uuid.uuid4().hex[:6]}.{extension}"
                filepath = settings.STUDENT_PHOTOS_DIR / filename
                content = await item.read()
                if content:
                    with open(filepath, "wb") as f:
                        f.write(content)
                    saved_photo_paths.append(f"/uploads/students/{filename}")
                    saved_file_disk_paths.append(str(filepath))

    if webcam_snapshots_json:
        try:
            snapshots = json.loads(webcam_snapshots_json)
            for idx, snap_str in enumerate(snapshots, len(saved_photo_paths) + 1):
                if "," in snap_str:
                    snap_str = snap_str.split(",")[1]
                img_data = base64.b64decode(snap_str)
                filename = f"portrait_{student.roll_number}_cam{idx}_{uuid.uuid4().hex[:6]}.jpg"
                filepath = settings.STUDENT_PHOTOS_DIR / filename
                with open(filepath, "wb") as f:
                    f.write(img_data)
                saved_photo_paths.append(f"/uploads/students/{filename}")
                saved_file_disk_paths.append(str(filepath))
        except Exception:
            pass

    if saved_file_disk_paths:
        new_embeddings = []
        for disk_path in saved_file_disk_paths:
            enc = face_engine.extract_single_face_encoding(disk_path)
            if enc:
                new_embeddings.append(enc)

        if new_embeddings:
            # Merge with existing embeddings cumulatively
            existing_embs = student.face_embedding
            all_embs = []
            if existing_embs:
                if isinstance(existing_embs, list) and len(existing_embs) > 0 and isinstance(existing_embs[0], list):
                    all_embs.extend(existing_embs)
                elif isinstance(existing_embs, list):
                    all_embs.append(existing_embs)
            all_embs.extend(new_embeddings)

            student.face_embedding = all_embs if len(all_embs) > 1 else all_embs[0]
            
            # Merge photo URLs
            existing_urls = student.photo_urls or ([student.photo_url] if student.photo_url else [])
            combined_urls = list(dict.fromkeys(existing_urls + saved_photo_paths))
            student.photo_urls = combined_urls
            student.photo_url = combined_urls[0] if combined_urls else student.photo_url

            db.commit()
            db.refresh(student)

    return student.to_dict()

@router.post("/attach-crop")
async def attach_crop_to_student(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Attach an unknown face crop detected during attendance directly to an existing enrolled student.
    """
    body = await request.json()
    student_id = body.get("student_id")
    crop_b64 = body.get("crop_image_base64")

    if not student_id or not crop_b64:
        raise HTTPException(status_code=400, detail="student_id and crop_image_base64 are required.")

    student = db.query(Student).filter(Student.id == int(student_id)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    if "," in crop_b64:
        crop_b64 = crop_b64.split(",")[1]

    img_data = base64.b64decode(crop_b64)
    filename = f"crop_{student.roll_number}_{uuid.uuid4().hex[:6]}.jpg"
    filepath = settings.STUDENT_PHOTOS_DIR / filename
    with open(filepath, "wb") as f:
        f.write(img_data)

    enc = face_engine.extract_single_face_encoding(str(filepath))
    if not enc:
        raise HTTPException(status_code=400, detail="Could not extract 128-D face vector from crop.")

    existing_embs = student.face_embedding
    all_embs = []
    if existing_embs:
        if isinstance(existing_embs, list) and len(existing_embs) > 0 and isinstance(existing_embs[0], list):
            all_embs.extend(existing_embs)
        elif isinstance(existing_embs, list):
            all_embs.append(existing_embs)
    all_embs.append(enc)

    student.face_embedding = all_embs
    existing_urls = student.photo_urls or ([student.photo_url] if student.photo_url else [])
    existing_urls.append(f"/uploads/students/{filename}")
    student.photo_urls = existing_urls

    db.commit()
    db.refresh(student)

    return {
        "message": f"Successfully added reference angle to {student.full_name} ({len(all_embs)} total reference angles stored)!",
        "student": student.to_dict()
    }

@router.post("/enroll-from-crop")
async def enroll_from_crop(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    1-Click Enroll an unknown face detected during attendance as a new student into the class.
    """
    body = await request.json()
    full_name = body.get("full_name", "").strip()
    roll_number = body.get("roll_number", "").strip()
    email = body.get("email", "").strip()
    class_id = body.get("class_id")
    crop_b64 = body.get("crop_image_base64")

    if not full_name or not roll_number or not crop_b64:
        raise HTTPException(status_code=400, detail="full_name, roll_number and crop_image_base64 are required.")

    existing = db.query(Student).filter((Student.roll_number == roll_number) | (Student.email == email)).first()
    if existing:
        if existing.is_active:
            raise HTTPException(status_code=400, detail="Student with this Roll Number or Email already exists.")
        else:
            db.query(StudentFreezeLog).filter(StudentFreezeLog.student_id == existing.id).delete()
            db.query(EmailLog).filter(EmailLog.student_id == existing.id).delete()
            db.query(AttendanceRecord).filter(AttendanceRecord.student_id == existing.id).delete()
            existing.enrolled_classes.clear()
            db.delete(existing)
            db.commit()

    if "," in crop_b64:
        crop_b64 = crop_b64.split(",")[1]

    img_data = base64.b64decode(crop_b64)
    filename = f"crop_{roll_number}_{uuid.uuid4().hex[:6]}.jpg"
    filepath = settings.STUDENT_PHOTOS_DIR / filename
    with open(filepath, "wb") as f:
        f.write(img_data)

    enc = face_engine.extract_single_face_encoding(str(filepath))
    if not enc:
        raise HTTPException(status_code=400, detail="Could not extract 128-D face vector from crop.")

    new_student = Student(
        full_name=full_name,
        roll_number=roll_number,
        email=email or f"{roll_number.lower()}@university.edu",
        photo_url=f"/uploads/students/{filename}",
        photo_urls=[f"/uploads/students/{filename}"],
        face_embedding=[enc],
        is_active=True
    )

    if class_id:
        cls = db.query(ClassCourse).filter(ClassCourse.id == int(class_id)).first()
        if cls:
            new_student.enrolled_classes.append(cls)

    db.add(new_student)
    db.commit()
    db.refresh(new_student)

    return {
        "message": f"Student {new_student.full_name} enrolled and biometric angle registered!",
        "student": new_student.to_dict()
    }

@router.post("/{student_id}/update-profile-photo", response_model=StudentResponse)
async def update_student_profile_photo(
    student_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates a student's primary visual profile photo (via file upload or camera snapshot)
    with strict validation (JPG, JPEG, PNG, WEBP, <= 5MB) and creates an audit log entry.
    Preserves biometric embeddings.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(status_code=403, detail="You do not have permission to update student profile photos.")

    form_data = await request.form()
    photo_file = form_data.get("photo")
    photo_base64 = form_data.get("photo_base64")

    saved_photo_url = None
    saved_disk_path = None

    if photo_file and hasattr(photo_file, "filename") and photo_file.filename:
        filename = photo_file.filename
        ext = filename.split(".")[-1].lower() if "." in filename else ""
        if ext not in ["jpg", "jpeg", "png", "webp"]:
            raise HTTPException(status_code=400, detail="Invalid image format. Please upload a valid JPG, JPEG, PNG, or WEBP image.")

        content = await photo_file.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image file size is too large (maximum allowed is 5MB).")

        new_filename = f"portrait_{student.roll_number}_{uuid.uuid4().hex[:6]}.{ext}"
        saved_disk_path = settings.STUDENT_PHOTOS_DIR / new_filename
        with open(saved_disk_path, "wb") as f:
            f.write(content)
        saved_photo_url = f"/uploads/students/{new_filename}"

    elif photo_base64:
        snap_str = str(photo_base64).strip()
        if "," in snap_str:
            snap_str = snap_str.split(",")[1]
        try:
            img_data = base64.b64decode(snap_str)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 image data.")

        if len(img_data) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Captured image size is too large.")

        new_filename = f"portrait_{student.roll_number}_cam_{uuid.uuid4().hex[:6]}.jpg"
        saved_disk_path = settings.STUDENT_PHOTOS_DIR / new_filename
        with open(saved_disk_path, "wb") as f:
            f.write(img_data)
        saved_photo_url = f"/uploads/students/{new_filename}"

    else:
        raise HTTPException(status_code=400, detail="No photo file or camera snapshot provided.")

    old_photo = student.photo_url
    student.photo_url = saved_photo_url

    existing_urls = list(student.photo_urls or [])
    if saved_photo_url not in existing_urls:
        existing_urls.insert(0, saved_photo_url)
    student.photo_urls = existing_urls

    audit = AuditLog(
        user_id=current_user.id,
        action="UPDATE_STUDENT_PROFILE_PHOTO",
        entity="Student",
        entity_id=student.id,
        details=json.dumps({
            "student_id": student.id,
            "roll_number": student.roll_number,
            "full_name": student.full_name,
            "updated_by": current_user.username,
            "old_photo": old_photo,
            "new_photo": saved_photo_url
        })
    )
    db.add(audit)
    db.commit()
    db.refresh(student)

    return student.to_dict()

@router.delete("/{student_id}")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from backend.app.services.permission_service import permission_service
    if not permission_service.has_permission(db, current_user, "student.delete"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required or missing 'student.delete' authority."
        )

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    scope_context = {
        "department": student.department,
        "program": student.program,
        "semester": student.semester,
        "division": student.section
    }
    if not permission_service.has_permission(db, current_user, "student.delete", scope=scope_context):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access Denied: You lack authority to delete students in scope [{student.department} • {student.program} • {student.semester} • Div {student.section}]."
        )

    student_name = student.full_name
    db.query(StudentFreezeLog).filter(StudentFreezeLog.student_id == student.id).delete()
    db.query(EmailLog).filter(EmailLog.student_id == student.id).delete()
    db.query(AttendanceRecord).filter(AttendanceRecord.student_id == student.id).delete()
    student.enrolled_classes.clear()
    db.delete(student)
    db.commit()
    return {"message": f"Student '{student_name}' deleted successfully."}

@router.post("/{student_id}/freeze")
def freeze_student_attendance(
    student_id: int,
    payload: StudentFreezeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from backend.app.services.permission_service import permission_service
    from datetime import datetime, date
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    scope_context = {
        "department": student.department,
        "program": student.program,
        "semester": student.semester,
        "division": student.section
    }
    if not permission_service.has_permission(db, current_user, "student.edit", scope=scope_context):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You lack authority to freeze student attendance."
        )

    now = datetime.utcnow()
    reason = (payload.reason or "Attendance paused by faculty/admin").strip()

    # Parse optional freeze_until date
    freeze_until_dt = None
    if payload.freeze_until:
        try:
            freeze_until_dt = datetime.strptime(payload.freeze_until, "%Y-%m-%d")
            # freeze_until must be in the future
            if freeze_until_dt.date() < date.today():
                raise HTTPException(status_code=400, detail="freeze_until date must be today or in the future.")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid freeze_until date format. Use YYYY-MM-DD.")

    student.attendance_status = "FROZEN"
    student.is_frozen = True
    student.frozen_at = now
    student.unfrozen_at = None
    student.freeze_reason = reason
    student.freeze_until = freeze_until_dt

    until_str = freeze_until_dt.strftime("%d %b %Y") if freeze_until_dt else "indefinitely"

    # Create freeze audit log
    freeze_log = StudentFreezeLog(
        student_id=student.id,
        action="FREEZE",
        reason=reason,
        action_by_user_id=current_user.id,
        frozen_at=now
    )
    db.add(freeze_log)

    audit = AuditLog(
        user_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="FREEZE_STUDENT_ATTENDANCE",
        entity="Student",
        entity_id=student.id,
        target_name=student.full_name,
        details=f"Froze attendance for {student.full_name} ({student.roll_number}) until {until_str}. Reason: {reason}"
    )
    db.add(audit)

    db.commit()
    db.refresh(student)
    return {
        "message": f"Attendance for {student.full_name} has been FROZEN successfully{' until ' + until_str if freeze_until_dt else ''}.",
        "student": student.to_dict()
    }

@router.post("/{student_id}/unfreeze")
def unfreeze_student_attendance(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from backend.app.services.permission_service import permission_service
    from datetime import datetime
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    scope_context = {
        "department": student.department,
        "program": student.program,
        "semester": student.semester,
        "division": student.section
    }
    if not permission_service.has_permission(db, current_user, "student.edit", scope=scope_context):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You lack authority to unfreeze student attendance."
        )

    now = datetime.utcnow()
    student.attendance_status = "ACTIVE"
    student.is_frozen = False
    student.unfrozen_at = now
    student.freeze_until = None
    student.freeze_reason = None

    # Update latest open freeze log if exists
    open_log = db.query(StudentFreezeLog).filter(
        StudentFreezeLog.student_id == student.id,
        StudentFreezeLog.action == "FREEZE",
        StudentFreezeLog.unfrozen_at == None
    ).order_by(StudentFreezeLog.id.desc()).first()

    if open_log:
        open_log.unfrozen_at = now

    # Add unfreeze record
    unfreeze_log = StudentFreezeLog(
        student_id=student.id,
        action="UNFREEZE",
        reason="Attendance reactivated",
        action_by_user_id=current_user.id,
        frozen_at=student.frozen_at,
        unfrozen_at=now
    )
    db.add(unfreeze_log)

    audit = AuditLog(
        user_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="UNFREEZE_STUDENT_ATTENDANCE",
        entity="Student",
        entity_id=student.id,
        target_name=student.full_name,
        details=f"Unfroze and reactivated attendance for {student.full_name} ({student.roll_number})"
    )
    db.add(audit)

    db.commit()
    db.refresh(student)
    return {
        "message": f"Attendance for {student.full_name} has been ACTIVATED / UNFROZEN.",
        "student": student.to_dict()
    }

@router.get("/{student_id}/freeze-history")
def get_student_freeze_history(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    logs = db.query(StudentFreezeLog).filter(StudentFreezeLog.student_id == student_id).order_by(StudentFreezeLog.id.desc()).all()
    return [l.to_dict() for l in logs]


@router.post("/promote-batch")
def promote_batch(
    payload: BatchPromotionPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Executes batch semester rollover and promotion for students.
    Supports:
    - Advancing semester (e.g. Sem 5 -> Sem 6)
    - Division / section reassignment (e.g. Div A -> Div B)
    - Auto-enrolling students in target semester courses
    - Marking dropouts / left college (is_active=False) without deleting historical records
    - Detaining students in current semester
    """
    if current_user.role not in ["admin", "super_admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Admin authorization required for batch student promotion.")

    if not payload.students:
        raise HTTPException(status_code=400, detail="No students provided for promotion.")

    promoted_count = 0
    detained_count = 0
    left_count = 0
    errors = []

    # Cache courses for target semester if auto-enrolling
    target_courses = []
    if payload.auto_enroll_courses and payload.target_semester:
        cq = db.query(ClassCourse).filter(ClassCourse.semester == payload.target_semester, ClassCourse.status == "Active")
        if payload.department:
            cq = cq.filter(ClassCourse.department == payload.department)
        if payload.program:
            cq = cq.filter(ClassCourse.program == payload.program)
        target_courses = cq.all()

    for item in payload.students:
        student = db.query(Student).filter(Student.id == item.student_id).first()
        if not student:
            errors.append(f"Student ID {item.student_id} not found.")
            continue

        action = (item.action or "PROMOTE").upper()

        if action == "PROMOTE":
            student.semester = payload.target_semester
            if item.target_section:
                student.section = item.target_section.strip().upper()
            if payload.academic_year:
                student.academic_year = payload.academic_year

            # Auto-enroll in target semester courses matching student's section
            if payload.auto_enroll_courses and target_courses:
                for tc in target_courses:
                    s_sec = (student.section or "A").strip().upper()
                    c_sec = (tc.section or "A").strip().upper()
                    if c_sec in [s_sec, "ALL", "BOTH", "*"]:
                        if tc not in student.enrolled_classes:
                            student.enrolled_classes.append(tc)

            promoted_count += 1

        elif action in ["LEFT_COLLEGE", "DROPOUT", "INACTIVE", "TRANSFERRED"]:
            student.is_active = False
            student.status = "Transferred" if action == "TRANSFERRED" else "Inactive"
            student.attendance_status = "INACTIVE"
            left_count += 1

        elif action == "DETAIN":
            if item.target_section:
                student.section = item.target_section.strip().upper()
            detained_count += 1

    # Log to AuditLog
    audit = AuditLog(
        user_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="BATCH_STUDENT_PROMOTION",
        entity="Student",
        entity_id=None,
        target_name=f"{payload.from_semester} -> {payload.target_semester}",
        details=f"Batch promotion from {payload.from_semester} to {payload.target_semester}. Promoted: {promoted_count}, Detained: {detained_count}, Left/Inactive: {left_count}."
    )
    db.add(audit)

    db.commit()

    return {
        "success": True,
        "message": f"Successfully processed batch: {promoted_count} promoted to {payload.target_semester}, {detained_count} detained, {left_count} marked inactive.",
        "promoted_count": promoted_count,
        "detained_count": detained_count,
        "left_count": left_count,
        "errors": errors
    }


@router.delete("/{student_id}/photos/{photo_index}")
def delete_student_photo_angle(
    student_id: int,
    photo_index: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from backend.app.services.permission_service import permission_service
    can_manage = (
        current_user.role in ["super_admin", "admin"] or
        permission_service.has_permission(db, current_user, "student.edit_biometric") or
        permission_service.has_permission(db, current_user, "student.edit")
    )
    if not can_manage:
        raise HTTPException(status_code=403, detail="Access Denied: You lack authority to prune student biometric photos.")

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    photos = list(student.photo_urls) if student.photo_urls else []
    if not photos and student.photo_url:
        photos = [student.photo_url]

    if photo_index < 0 or photo_index >= len(photos):
        raise HTTPException(status_code=400, detail=f"Invalid photo index {photo_index}. Total photos: {len(photos)}.")

    if len(photos) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the only registered biometric photo. Please upload a replacement instead.")

    removed_url = photos.pop(photo_index)

    # Remove corresponding embedding vector if available
    current_embs = student.face_embedding
    if current_embs and isinstance(current_embs, list):
        if len(current_embs) > 0 and isinstance(current_embs[0], list):
            if photo_index < len(current_embs):
                current_embs.pop(photo_index)
        elif photo_index == 0:
            current_embs = None

    student.photo_urls = photos
    student.face_embedding = current_embs
    student.photo_url = photos[0] if photos else None

    # Delete physical disk file if auto-enriched
    try:
        import os
        base_name = os.path.basename(removed_url)
        disk_target = settings.STUDENT_PHOTOS_DIR / base_name
        if disk_target.exists():
            disk_target.unlink(missing_ok=True)
    except Exception:
        pass

    audit = AuditLog(
        user_id=current_user.id,
        actor_name=current_user.full_name,
        actor_role=current_user.role,
        action="BIOMETRIC_PHOTO_PRUNED",
        entity="Student",
        entity_id=student.id,
        target_name=student.full_name,
        details=f"Removed biometric photo angle #{photo_index} ({removed_url}) from student '{student.full_name}' ({student.roll_number}). Remaining photos: {len(photos)}."
    )
    db.add(audit)
    db.commit()
    db.refresh(student)

    return {
        "success": True,
        "message": f"Biometric photo removed successfully. {len(photos)} angles remaining in student gallery.",
        "student": student.to_dict()
    }

