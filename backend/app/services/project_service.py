# File overview: Business logic services for app/services/project_service.py.
from typing import List
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from ..models.project import Project
from ..models.dispatch import DispatchOrder
from ..models.dispatch_item import DispatchItem
from ..models.element import Element
from ..models.production import ProductionSchedule
from ..models.yard import YardInventory
from ..schemas.project import ProjectCreate, ProjectUpdate

ACTIVE_PROJECT_STATUSES = ("planned", "active")


# Handles list projects flow.
def list_projects(
    db: Session,
    factory_id: int,
    search: str | None = None,
    status_filter: str | None = None,
    include_inactive: bool = False,
) -> List[Project]:
    stmt = select(Project).where(Project.factory_id == factory_id)
    if status_filter:
        stmt = stmt.where(Project.status == status_filter)
    elif not include_inactive:
        stmt = stmt.where(Project.status.in_(ACTIVE_PROJECT_STATUSES))

    if search:
        q = f"%{search.strip()}%"
        stmt = stmt.where(or_(Project.project_name.ilike(q), Project.client.ilike(q)))

    stmt = stmt.order_by(Project.due_date)
    return list(db.scalars(stmt))


# Handles create project flow.
def create_project(db: Session, project_in: ProjectCreate, factory_id: int) -> Project:
    project = Project(**project_in.dict(), factory_id=factory_id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


# Handles get project flow.
def get_project(db: Session, project_id: int, factory_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id, Project.factory_id == factory_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


# Handles update project flow.
def update_project(db: Session, project_id: int, project_in: ProjectUpdate, factory_id: int) -> Project:
    project = get_project(db, project_id, factory_id)
    updates = project_in.dict(exclude_unset=True)
    previous_status = project.status

    for field, value in updates.items():
        setattr(project, field, value)

    new_status = updates.get("status")
    if new_status and new_status != previous_status:
        project.status_changed_at = datetime.utcnow()
        if new_status in {"completed", "stopped", "cancelled"} and not updates.get("closed_at"):
            project.closed_at = datetime.utcnow().date()
        if new_status in {"active", "planned"}:
            project.closed_at = None
            if "status_reason" not in updates:
                project.status_reason = None

    db.commit()
    db.refresh(project)
    return project


# Handles delete project flow.
def delete_project(db: Session, project_id: int, factory_id: int) -> None:
    _ = get_project(db, project_id, factory_id)

    # Collect element ids up front (needed to delete yard inventory references).
    element_ids = [
        row[0]
        for row in db.query(Element.id)
        .filter(Element.project_id == project_id, Element.factory_id == factory_id)
        .all()
    ]

    # Ensure dependent rows that reference projects are removed first.
    # Elements are already ON DELETE CASCADE via Element.project_id, but DispatchOrder.project_id
    # has no ON DELETE behavior defined, so it can block deletes at the DB level.
    dispatch_order_ids = [
        row[0]
        for row in db.query(DispatchOrder.id)
        .filter(DispatchOrder.project_id == project_id, DispatchOrder.factory_id == factory_id)
        .all()
    ]
    if dispatch_order_ids:
        db.query(DispatchItem).filter(DispatchItem.dispatch_id.in_(dispatch_order_ids)).delete(
            synchronize_session=False
        )
        db.query(DispatchOrder).filter(DispatchOrder.id.in_(dispatch_order_ids)).delete(
            synchronize_session=False
        )

    # Yard inventory FK does not specify ON DELETE CASCADE, so it can block deleting elements.
    if element_ids:
        db.query(YardInventory).filter(
            YardInventory.element_id.in_(element_ids),
            YardInventory.factory_id == factory_id,
        ).delete(synchronize_session=False)
        # Defensive: schedules should be removable via ORM cascade, but remove explicitly too.
        db.query(ProductionSchedule).filter(
            ProductionSchedule.element_id.in_(element_ids),
            ProductionSchedule.factory_id == factory_id,
        ).delete(synchronize_session=False)

    db.delete(project)
    db.commit()

