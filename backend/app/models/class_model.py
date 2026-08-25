from datetime import datetime

from sqlalchemy import DateTime, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Class(Base):
    __tablename__ = "Classes"

    class_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    class_name: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    subject: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    teacher_name: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    academic_year: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    students: Mapped[list["Student"]] = relationship(
        back_populates="class_",
        cascade="save-update, merge",
    )

    sessions: Mapped[list["AttendanceSession"]] = relationship(
        back_populates="class_",
        cascade="save-update, merge",
    )
