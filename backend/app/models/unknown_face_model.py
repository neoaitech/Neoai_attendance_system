from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class UnknownFace(Base):
    __tablename__ = "UnknownFaces"

    unknown_face_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("Sessions.session_id"),
        nullable=False,
        index=True,
    )
    cropped_face_path: Mapped[str | None] = mapped_column(String, nullable=True)
    detected_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default="CURRENT_TIMESTAMP",
    )
    bounding_box: Mapped[str | None] = mapped_column(String, nullable=True)
    resolved: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
    )
    tagged_student_id: Mapped[int | None] = mapped_column(
        ForeignKey("Students.student_id"),
        nullable=True,
        index=True,
    )

    session: Mapped["AttendanceSession"] = relationship(back_populates="unknown_faces")
    tagged_student: Mapped["Student | None"] = relationship(
        back_populates="tagged_unknown_faces",
        foreign_keys=[tagged_student_id],
    )
