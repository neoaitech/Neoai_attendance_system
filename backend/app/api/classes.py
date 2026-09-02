from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.db.models import ClassCourse, Student, User
from backend.app.schemas.class_course import ClassCreate, ClassUpdate, ClassResponse, EnrollStudentsRequest
from backend.app.api.auth import get_current_user, get_optional_user
from backend.app.services.notification_service import notification_service

router = APIRouter(prefix="/classes", tags=["Classes"])

@router.get("", response_model=List[ClassResponse])
def get_classes(
    department: Optional[str] = None,
    program: Optional[str] = None,
    semester: Optional[str] = None,
    section: Optional[str] = None,
    academic_year: Optional[str] = None,
    faculty_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ClassCourse)
    if department:
        query = query.filter(ClassCourse.department == department)
    if program:
        query = query.filter(ClassCourse.program == program)
    if semester:
        query = query.filter(ClassCourse.semester == semester)
    if section:
        query = query.filter(ClassCourse.section == section)
    if academic_year:
        query = query.filter(ClassCourse.academic_year == academic_year)
    if faculty_id:
        query = query.filter(
            (ClassCourse.teacher_id == faculty_id) |
            (ClassCourse.teachers.any(User.id == faculty_id))
        )
    classes = query.order_by(ClassCourse.code.asc(), ClassCourse.program.asc(), ClassCourse.section.asc()).all()
    return [c.to_dict() for c in classes]

@router.get("/my-teaching", response_model=List[ClassResponse])
def get_my_teaching_classes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns only the course offerings assigned to the currently logged in faculty member.
    """
    query = db.query(ClassCourse).filter(
        (ClassCourse.teacher_id == current_user.id) |
        (ClassCourse.teachers.any(User.id == current_user.id))
    ).order_by(ClassCourse.code.asc(), ClassCourse.program.asc(), ClassCourse.section.asc())
    classes = query.all()
    return [c.to_dict() for c in classes]

@router.get("/{class_id}")
def get_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.query(ClassCourse).filter(ClassCourse.id == class_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Class not found.")

    data = course.to_dict()
    data["students"] = [s.to_dict() for s in course.students]
    return data

@router.post("", response_model=ClassResponse)
def create_class(
    payload: ClassCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from backend.app.services.permission_service import permission_service
    if not permission_service.has_permission(db, current_user, "course.create"):
        raise HTTPException(status_code=403, detail="Access denied. You lack authority 'course.create' to create course offerings.")

    prog = payload.program or "B.Tech"
    ay = payload.academic_year or "2026-27"
    
    # Determine sections to create (supports multi-division offering)
    raw_sections = payload.sections if (payload.sections and len(payload.sections) > 0) else [payload.section or "A"]
    # Clean and deduplicate section names while preserving order
    sections_list = []
    for s in raw_sections:
        clean_s = str(s).strip()
        if clean_s and clean_s not in sections_list:
            sections_list.append(clean_s)

    if not sections_list:
        sections_list = ["A"]

    # Check for existing duplicate offering
    existing_conflicts = []
    for sec in sections_list:
        existing = db.query(ClassCourse).filter(
            ClassCourse.code == payload.code,
            ClassCourse.program == prog,
            ClassCourse.semester == payload.semester,
            ClassCourse.section == sec,
            ClassCourse.academic_year == ay
        ).first()
        if existing:
            existing_conflicts.append(sec)

    if existing_conflicts:
        raise HTTPException(
            status_code=400,
            detail=f"Course offering '{payload.code}' for {prog} {payload.semester} Section(s) {', '.join(existing_conflicts)} ({ay}) already exists."
        )

    created_courses = []

    for sec in sections_list:
        # Determine faculty for this specific section
        sec_faculty_ids = []
        if payload.faculty_scope_map and isinstance(payload.faculty_scope_map, dict):
            # Combine "All" scope and section-specific scope
            all_scope = payload.faculty_scope_map.get("All", [])
            sec_scope = payload.faculty_scope_map.get(sec, [])
            sec_faculty_ids = list(dict.fromkeys(all_scope + sec_scope))
        elif payload.faculty_ids:
            sec_faculty_ids = payload.faculty_ids

        primary_teacher_id = (
            sec_faculty_ids[0] if sec_faculty_ids 
            else (payload.teacher_id or current_user.id)
        )

        start_d = None
        if payload.start_date:
            try:
                from datetime import date
                start_d = date.fromisoformat(str(payload.start_date).split("T")[0])
            except Exception:
                pass

        course = ClassCourse(
            code=payload.code,
            name=payload.name,
            subject_name=payload.subject_name or payload.name,
            department=payload.department,
            program=prog,
            semester=payload.semester,
            section=sec,
            academic_year=ay,
            term=payload.term or payload.semester,
            credits=payload.credits or 4,
            room=payload.room,
            day=payload.day,
            start_time=payload.start_time,
            end_time=payload.end_time,
            start_date=start_d,
            status=payload.status or "Active",
            teacher_id=primary_teacher_id
        )

        # Assign faculty
        if sec_faculty_ids:
            faculty_users = db.query(User).filter(User.id.in_(sec_faculty_ids)).all()
            course.teachers = list(faculty_users)
        elif primary_teacher_id:
            p_user = db.query(User).filter(User.id == primary_teacher_id).first()
            if p_user:
                course.teachers = [p_user]

        # Determine students for this specific section
        if payload.division_student_map and isinstance(payload.division_student_map, dict) and sec in payload.division_student_map:
            sec_stud_ids = payload.division_student_map[sec]
            if sec_stud_ids:
                explicit_students = db.query(Student).filter(Student.id.in_(sec_stud_ids)).all()
                course.students = list(explicit_students)
        elif payload.student_ids:
            # Filter explicit student IDs that match this section
            explicit_students = db.query(Student).filter(
                Student.id.in_(payload.student_ids),
                Student.section.ilike(sec.strip())
            ).all()
            if explicit_students:
                course.students = list(explicit_students)
            else:
                # If student section was not specified in student object, associate provided IDs directly
                all_expl = db.query(Student).filter(Student.id.in_(payload.student_ids)).all()
                course.students = list(all_expl)
        elif payload.auto_enroll:
            query = db.query(Student).filter(Student.is_active == True)
            if payload.department:
                query = query.filter(Student.department == payload.department)
            if prog:
                query = query.filter((Student.program == prog) | (Student.course.ilike(f"%{prog}%")))
            if sec and sec != "All":
                query = query.filter(Student.section.ilike(sec.strip()))
            if payload.semester and payload.semester != "All":
                sem_clean = payload.semester.strip()
                digits = "".join(filter(str.isdigit, sem_clean))
                if digits:
                    query = query.filter(
                        (Student.semester == sem_clean) |
                        (Student.semester.ilike(f"%{digits}%")) |
                        (Student.semester.ilike(f"%{sem_clean}%"))
                    )
                else:
                    query = query.filter(
                        (Student.semester == sem_clean) |
                        (Student.semester.ilike(f"%{sem_clean}%"))
                    )

            matching_students = query.all()
            if matching_students:
                course.students = list(matching_students)

        db.add(course)
        created_courses.append(course)

    db.commit()
    for c in created_courses:
        db.refresh(c)

    # Trigger recipient-specific faculty notifications for created course offerings
    faculty_divisions_map = {}
    for c in created_courses:
        all_t_ids = [t.id for t in (c.teachers or [])]
        if c.teacher_id and c.teacher_id not in all_t_ids:
            all_t_ids.append(c.teacher_id)
        for fid in all_t_ids:
            if fid not in faculty_divisions_map:
                role = "Primary Faculty" if fid == c.teacher_id else "Co-Faculty"
                faculty_divisions_map[fid] = {"divisions": [], "role": role, "sample_course": c}
            faculty_divisions_map[fid]["divisions"].append(c.section)

    for fid, info in faculty_divisions_map.items():
        notification_service.notify_course_assignment(
            db=db,
            faculty_id=fid,
            course=info["sample_course"],
            divisions=info["divisions"],
            role=info["role"],
            actor=current_user
        )

    res_dict = created_courses[0].to_dict()
    res_dict["sections"] = sections_list
    return res_dict

@router.put("/{class_id}", response_model=ClassResponse)
def update_class(
    class_id: int,
    payload: ClassUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from backend.app.services.permission_service import permission_service
    if not permission_service.has_permission(db, current_user, "course.edit"):
        raise HTTPException(status_code=403, detail="Access denied. You lack authority 'course.edit' to edit course offerings.")

    course = db.query(ClassCourse).filter(ClassCourse.id == class_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Class not found.")

    # Capture previous assignment state for change detection
    prev_teacher_ids = [t.id for t in (course.teachers or [])]
    if course.teacher_id and course.teacher_id not in prev_teacher_ids:
        prev_teacher_ids.append(course.teacher_id)
    prev_section = course.section
    prev_primary_id = course.teacher_id

    if payload.name is not None:
        course.name = payload.name
    if payload.subject_name is not None:
        course.subject_name = payload.subject_name
    if payload.department is not None:
        course.department = payload.department
    if payload.program is not None:
        course.program = payload.program
    if payload.semester is not None:
        course.semester = payload.semester
    if payload.section is not None:
        course.section = payload.section
    if payload.academic_year is not None:
        course.academic_year = payload.academic_year
    if payload.term is not None:
        course.term = payload.term
    if payload.credits is not None:
        course.credits = payload.credits
    if payload.room is not None:
        course.room = payload.room
    if payload.day is not None:
        course.day = payload.day
    if payload.start_time is not None:
        course.start_time = payload.start_time
    if payload.end_time is not None:
        course.end_time = payload.end_time
    if payload.start_date is not None:
        if payload.start_date:
            try:
                from datetime import date
                course.start_date = date.fromisoformat(str(payload.start_date).split("T")[0])
            except Exception:
                pass
        else:
            course.start_date = None
    if payload.status is not None:
        course.status = payload.status
    if payload.teacher_id is not None:
        course.teacher_id = payload.teacher_id

    if payload.faculty_ids is not None:
        faculty_users = db.query(User).filter(User.id.in_(payload.faculty_ids)).all()
        course.teachers = list(faculty_users)

    db.commit()
    db.refresh(course)

    # Perform accurate change detection
    new_teacher_ids = [t.id for t in (course.teachers or [])]
    if course.teacher_id and course.teacher_id not in new_teacher_ids:
        new_teacher_ids.append(course.teacher_id)
    new_section = course.section
    new_primary_id = course.teacher_id

    # 1. Newly assigned faculty
    for fid in new_teacher_ids:
        if fid not in prev_teacher_ids:
            role = "Primary Faculty" if fid == new_primary_id else "Co-Faculty"
            notification_service.notify_course_assignment(
                db=db,
                faculty_id=fid,
                course=course,
                divisions=[new_section],
                role=role,
                actor=current_user
            )

    # 2. Removed faculty
    for fid in prev_teacher_ids:
        if fid not in new_teacher_ids:
            notification_service.notify_course_assignment_removed(
                db=db,
                faculty_id=fid,
                course_code=course.code,
                course_name=course.name,
                program=course.program,
                semester=course.semester,
                division=prev_section,
                actor=current_user
            )

    # 3. Existing faculty with updated section or role
    for fid in new_teacher_ids:
        if fid in prev_teacher_ids:
            old_role = "Primary Faculty" if fid == prev_primary_id else "Co-Faculty"
            new_role = "Primary Faculty" if fid == new_primary_id else "Co-Faculty"
            if old_role != new_role or prev_section != new_section:
                notification_service.notify_course_assignment_updated(
                    db=db,
                    faculty_id=fid,
                    course=course,
                    prev_divisions=[prev_section],
                    updated_divisions=[new_section],
                    prev_role=old_role,
                    updated_role=new_role,
                    actor=current_user
                )

    return course.to_dict()

@router.post("/{class_id}/enroll")
def enroll_students_in_class(
    class_id: int,
    payload: EnrollStudentsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.query(ClassCourse).filter(ClassCourse.id == class_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Class not found.")

    students = db.query(Student).filter(Student.id.in_(payload.student_ids)).all()
    current_ids = {s.id for s in course.students}

    for s in students:
        if s.id not in current_ids:
            course.students.append(s)

    db.commit()
    return {
        "message": f"Successfully enrolled {len(students)} students in '{course.code}'.",
        "total_enrolled": len(course.students)
    }

@router.delete("/{class_id}/students/{student_id}")
def unenroll_student_from_class(
    class_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.query(ClassCourse).filter(ClassCourse.id == class_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Class not found.")

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    if student in course.students:
        course.students.remove(student)
        db.commit()

    return {
        "message": f"Successfully removed student '{student.full_name}' from '{course.code}'.",
        "total_enrolled": len(course.students)
    }

@router.delete("/{class_id}")
def delete_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Only Administrators can delete course offerings.")

    course = db.query(ClassCourse).filter(ClassCourse.id == class_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Class not found.")

    all_assigned_fids = [t.id for t in (course.teachers or [])]
    if course.teacher_id and course.teacher_id not in all_assigned_fids:
        all_assigned_fids.append(course.teacher_id)

    code = course.code
    name = course.name
    section = course.section
    prog = course.program
    sem = course.semester

    db.delete(course)
    db.commit()

    for fid in all_assigned_fids:
        notification_service.notify_course_assignment_removed(
            db=db,
            faculty_id=fid,
            course_code=code,
            course_name=name,
            program=prog,
            semester=sem,
            division=section,
            actor=current_user
        )

    return {"message": f"Course offering '{code} - {name} ({prog} Div {section})' deleted successfully."}
