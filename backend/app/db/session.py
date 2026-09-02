from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.core.config import settings

# SQLite connection with thread checking disabled for FastAPI async handlers
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 30} if "sqlite" in settings.DATABASE_URL else {},
    echo=False
)

# High-Concurrency WAL Mode & Busy Timeout for simultaneous multi-user attendance & reports
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if "sqlite" in settings.DATABASE_URL:
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA busy_timeout = 30000;")
            cursor.execute("PRAGMA synchronous = NORMAL;")
            cursor.execute("PRAGMA foreign_keys = ON;")
        finally:
            cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def run_auto_migrations():
    """
    Ensures new schema columns and association tables are added to SQLite database without losing data.
    """
    try:
        with engine.connect() as conn:
            # 1. student_class_association table migration
            res_sca = conn.execute(text("PRAGMA table_info(student_class_association)"))
            cols_sca = [row[1] for row in res_sca.fetchall()]
            if cols_sca:
                if "status" not in cols_sca:
                    conn.execute(text("ALTER TABLE student_class_association ADD COLUMN status VARCHAR(20) DEFAULT 'Active'"))
                if "enrolled_at" not in cols_sca:
                    conn.execute(text("ALTER TABLE student_class_association ADD COLUMN enrolled_at DATETIME"))

            # 2. Classes table migration
            res_c = conn.execute(text("PRAGMA table_info(classes)"))
            cols_c = [row[1] for row in res_c.fetchall()]
            if cols_c:
                if "subject_name" not in cols_c:
                    conn.execute(text("ALTER TABLE classes ADD COLUMN subject_name VARCHAR(150)"))
                if "program" not in cols_c:
                    conn.execute(text("ALTER TABLE classes ADD COLUMN program VARCHAR(50) DEFAULT 'B.Tech'"))
                if "academic_year" not in cols_c:
                    conn.execute(text("ALTER TABLE classes ADD COLUMN academic_year VARCHAR(20) DEFAULT '2026-27'"))
                if "term" not in cols_c:
                    conn.execute(text("ALTER TABLE classes ADD COLUMN term VARCHAR(20)"))
                if "credits" not in cols_c:
                    conn.execute(text("ALTER TABLE classes ADD COLUMN credits INTEGER DEFAULT 4"))
                if "room" not in cols_c:
                    conn.execute(text("ALTER TABLE classes ADD COLUMN room VARCHAR(50)"))
                if "day" not in cols_c:
                    conn.execute(text("ALTER TABLE classes ADD COLUMN day VARCHAR(20)"))
                if "start_time" not in cols_c:
                    conn.execute(text("ALTER TABLE classes ADD COLUMN start_time VARCHAR(20)"))
                if "end_time" not in cols_c:
                    conn.execute(text("ALTER TABLE classes ADD COLUMN end_time VARCHAR(20)"))
                if "status" not in cols_c:
                    conn.execute(text("ALTER TABLE classes ADD COLUMN status VARCHAR(20) DEFAULT 'Active'"))

            # 3. Students table migration
            res = conn.execute(text("PRAGMA table_info(students)"))
            cols = [row[1] for row in res.fetchall()]
            if cols:
                if "course" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN course VARCHAR(100) DEFAULT 'B.Tech Computer Science'"))
                if "semester" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN semester VARCHAR(20) DEFAULT 'Semester 5'"))
                if "specialization" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN specialization VARCHAR(100) DEFAULT 'Artificial Intelligence & Data Science'"))
                if "photo_urls" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN photo_urls TEXT"))
                if "mobile_number" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN mobile_number VARCHAR(20)"))
                if "dob" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN dob VARCHAR(20)"))
                if "gender" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN gender VARCHAR(20) DEFAULT 'Male'"))
                if "address" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN address TEXT"))
                if "status" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN status VARCHAR(20) DEFAULT 'Active'"))
                if "program" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN program VARCHAR(50) DEFAULT 'B.Tech'"))
                if "other_program" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN other_program VARCHAR(100)"))
                if "other_department" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN other_department VARCHAR(100)"))
                if "academic_year" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN academic_year VARCHAR(20) DEFAULT '2026-27'"))
                if "admission_year" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN admission_year INTEGER DEFAULT 2023"))
                if "batch" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN batch VARCHAR(20) DEFAULT '2023-2027'"))
                # Freeze lifecycle columns (v8.1)
                if "attendance_status" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN attendance_status VARCHAR(20) DEFAULT 'ACTIVE'"))
                if "is_frozen" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN is_frozen BOOLEAN DEFAULT 0"))
                if "frozen_at" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN frozen_at DATETIME"))
                if "unfrozen_at" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN unfrozen_at DATETIME"))
                if "freeze_reason" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN freeze_reason TEXT"))
                if "freeze_until" not in cols:
                    conn.execute(text("ALTER TABLE students ADD COLUMN freeze_until DATETIME"))

            # 4. Users table migration
            res_u = conn.execute(text("PRAGMA table_info(users)"))
            cols_u = [row[1] for row in res_u.fetchall()]
            if cols_u:
                if "photo_url" not in cols_u:
                    conn.execute(text("ALTER TABLE users ADD COLUMN photo_url TEXT"))
                if "face_embedding" not in cols_u:
                    conn.execute(text("ALTER TABLE users ADD COLUMN face_embedding TEXT"))

            # 5. Attendance sessions table migration
            res_s = conn.execute(text("PRAGMA table_info(attendance_sessions)"))
            cols_s = [row[1] for row in res_s.fetchall()]
            if cols_s:
                if "photo_paths" not in cols_s:
                    conn.execute(text("ALTER TABLE attendance_sessions ADD COLUMN photo_paths TEXT"))
                if "processed_photo_paths" not in cols_s:
                    conn.execute(text("ALTER TABLE attendance_sessions ADD COLUMN processed_photo_paths TEXT"))
                if "extra_candidates" not in cols_s:
                    conn.execute(text("ALTER TABLE attendance_sessions ADD COLUMN extra_candidates TEXT"))
                if "finalized_at" not in cols_s:
                    conn.execute(text("ALTER TABLE attendance_sessions ADD COLUMN finalized_at DATETIME"))

            # 6. Attendance records table migration
            res_r = conn.execute(text("PRAGMA table_info(attendance_records)"))
            cols_r = [row[1] for row in res_r.fetchall()]
            if cols_r:
                if "attendance_type" not in cols_r:
                    conn.execute(text("ALTER TABLE attendance_records ADD COLUMN attendance_type VARCHAR(30) DEFAULT 'REGULAR'"))
                if "is_extra_lecture" not in cols_r:
                    conn.execute(text("ALTER TABLE attendance_records ADD COLUMN is_extra_lecture BOOLEAN DEFAULT 0"))
                if "verification_type" not in cols_r:
                    conn.execute(text("ALTER TABLE attendance_records ADD COLUMN verification_type VARCHAR(30) DEFAULT 'AUTO_AI'"))
                if "notes" not in cols_r:
                    conn.execute(text("ALTER TABLE attendance_records ADD COLUMN notes TEXT"))

            # 7. Classes table — start_date column (v8.1)
            res_c2 = conn.execute(text("PRAGMA table_info(classes)"))
            cols_c2 = [row[1] for row in res_c2.fetchall()]
            if cols_c2:
                if "start_date" not in cols_c2:
                    conn.execute(text("ALTER TABLE classes ADD COLUMN start_date DATE"))

            # 8. Ensure association and master tables exist
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS course_faculty_association (
                    class_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    role VARCHAR(50) DEFAULT 'Primary Faculty',
                    status VARCHAR(20) DEFAULT 'Active',
                    assigned_at DATETIME,
                    PRIMARY KEY (class_id, user_id),
                    FOREIGN KEY(class_id) REFERENCES classes (id),
                    FOREIGN KEY(user_id) REFERENCES users (id)
                )
            """))

            # 9. Student freeze audit log table (v8.1)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS student_freeze_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_id INTEGER NOT NULL,
                    action VARCHAR(20) NOT NULL,
                    reason TEXT,
                    action_by_user_id INTEGER,
                    frozen_at DATETIME,
                    unfrozen_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(student_id) REFERENCES students (id),
                    FOREIGN KEY(action_by_user_id) REFERENCES users (id)
                )
            """))

            conn.commit()
    except Exception as e:
        print(f"Auto-migration notice: {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
