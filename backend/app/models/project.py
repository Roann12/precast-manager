# File overview: ORM models and persistence mapping for app/models/project.py.
from sqlalchemy import Column, Integer, String, Date, DateTime, Index, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


# Data model for project.
# Maps object fields to storage columns/constraints.
class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=True, index=True)
    project_name = Column(String(255), nullable=False)
    client = Column(String(255), nullable=True)
    start_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    status = Column(String(50), nullable=False, default="active")
    status_reason = Column(String(500), nullable=True)
    status_changed_at = Column(DateTime, nullable=True)
    closed_at = Column(Date, nullable=True)
    work_saturday = Column(Boolean, nullable=False, default=False)
    work_sunday = Column(Boolean, nullable=False, default=False)

    elements = relationship("Element", back_populates="project", cascade="all, delete-orphan")


Index("ix_projects_status", Project.status)

