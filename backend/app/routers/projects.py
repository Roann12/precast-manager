from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth.dependencies import get_current_factory_id, get_current_user, require_role
from ..models.user import User
from ..schemas.project import Project, ProjectCreate, ProjectUpdate
from ..services import project_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=List[Project])
def list_projects(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    factory_id = get_current_factory_id(current_user)
    return project_service.list_projects(
        db,
        factory_id,
        search=search,
        status_filter=status,
        include_inactive=include_inactive,
    )


@router.post("", response_model=Project, status_code=201)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    return project_service.create_project(db, project_in, factory_id)


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    factory_id = get_current_factory_id(current_user)
    return project_service.get_project(db, project_id, factory_id)


@router.put("/{project_id}", response_model=Project)
def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    return project_service.update_project(db, project_id, project_in, factory_id)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    project_service.delete_project(db, project_id, factory_id)

