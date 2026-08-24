from datetime import date, time

from sqlalchemy import Date, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class AttendanceSession(Base):
    __tablename__ = "Sessions"

    session_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    class_id: Mapped[int] = mapped_column(
        ForeignKey("Classes.class_id"),
        nullable=False,
        index=True,
    )
    session_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    photo_uploaded_path: Mapped[str | None] = mapped_column(String, nullable=True)
    total_students_expected: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)

    class_: Mapped["Class"] = relationship(back_populates="sessions")
    attendance_records: Mapped[list["Attendance"]] = relationship(
        back_populates="session",
        cascade="save-update, merge",
    )
    unknown_faces: Mapped[list["UnknownFace"]] = relationship(
        back_populates="session",
        cascade="save-update, merge",
    )
