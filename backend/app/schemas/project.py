# File overview: Pydantic schemas for validation/serialization in app/schemas/project.py.
from datetime import date
from typing import Literal
from pydantic import BaseModel

from .common import ORMModel

ProjectStatus = Literal["planned", "active", "suspended", "stopped", "completed", "cancelled"]


# Data model for project base.
# Maps object fields to storage columns/constraints.
class ProjectBase(BaseModel):
    project_name: str
    client: str | None = None
    start_date: date | None = None
    due_date: date | None = None
    status: ProjectStatus = "active"
    status_reason: str | None = None
    closed_at: date | None = None
    work_saturday: bool = False
    work_sunday: bool = False


# Data model for project create.
# Maps object fields to storage columns/constraints.
class ProjectCreate(ProjectBase):
    pass


# Data model for project update.
# Maps object fields to storage columns/constraints.
class ProjectUpdate(BaseModel):
    project_name: str | None = None
    client: str | None = None
    start_date: date | None = None
    due_date: date | None = None
    status: ProjectStatus | None = None
    status_reason: str | None = None
    closed_at: date | None = None
    work_saturday: bool | None = None
    work_sunday: bool | None = None


# Data model for project.
# Maps object fields to storage columns/constraints.
class Project(ORMModel, ProjectBase):
    id: int

