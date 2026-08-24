from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Attendance(Base):
    __tablename__ = "Attendance"

    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "student_id",
            name="uq_attendance_session_student",
        ),
        CheckConstraint(
            "status IN ('present', 'absent', 'late')",
            name="ck_attendance_status",
        ),
    )

    attendance_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("Sessions.session_id"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("Students.student_id"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String, nullable=False)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    marked_by: Mapped[str | None] = mapped_column(String, nullable=True)
    marked_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default="CURRENT_TIMESTAMP",
    )

    session: Mapped["AttendanceSession"] = relationship(back_populates="attendance_records")
    student: Mapped["Student"] = relationship(back_populates="attendance_records")
