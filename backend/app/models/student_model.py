from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Student(Base):
    __tablename__ = "Students"

    student_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    roll_no: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    class_id: Mapped[int] = mapped_column(
        ForeignKey("Classes.class_id"),
        nullable=False,
        index=True,
    )
    face_encoding: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    photo_path: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    enrollment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
    )

    class_: Mapped["Class"] = relationship(back_populates="students")
    attendance_records: Mapped[list["Attendance"]] = relationship(
        back_populates="student",
        cascade="save-update, merge",
    )
    tagged_unknown_faces: Mapped[list["UnknownFace"]] = relationship(
        back_populates="tagged_student",
        foreign_keys="UnknownFace.tagged_student_id",
        cascade="save-update, merge",
    )
