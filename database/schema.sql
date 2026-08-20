-- AI Smart Attendance System
-- Day 3 SQLite Initial Schema
-- Date: 20-Aug-2026
-- Based on the approved Day-2 ER diagram

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Classes (
    class_id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_name TEXT NOT NULL,
    subject TEXT,
    teacher_name TEXT,
    academic_year TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Students (
    student_id INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_no TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    class_id INTEGER NOT NULL,
    face_encoding BLOB,
    photo_path TEXT,
    email TEXT,
    enrollment_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    FOREIGN KEY (class_id) REFERENCES Classes(class_id)
);

CREATE TABLE IF NOT EXISTS Sessions (
    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL,
    session_date DATE NOT NULL,
    start_time TIME,
    photo_uploaded_path TEXT,
    total_students_expected INTEGER,
    created_by TEXT,
    FOREIGN KEY (class_id) REFERENCES Classes(class_id)
);

CREATE TABLE IF NOT EXISTS Attendance (
    attendance_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
    confidence_score REAL,
    marked_by TEXT,
    marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (session_id, student_id),
    FOREIGN KEY (session_id) REFERENCES Sessions(session_id),
    FOREIGN KEY (student_id) REFERENCES Students(student_id)
);

CREATE TABLE IF NOT EXISTS UnknownFaces (
    unknown_face_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    cropped_face_path TEXT,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    bounding_box TEXT,
    resolved BOOLEAN NOT NULL DEFAULT 0,
    tagged_student_id INTEGER,
    FOREIGN KEY (session_id) REFERENCES Sessions(session_id),
    FOREIGN KEY (tagged_student_id) REFERENCES Students(student_id)
);

CREATE INDEX IF NOT EXISTS idx_students_class_id ON Students(class_id);
CREATE INDEX IF NOT EXISTS idx_sessions_class_id ON Sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON Attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON Attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_unknown_faces_session_id ON UnknownFaces(session_id);
