# File overview: API route handlers and request orchestration for app/routers/production.py.
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.mould import Mould
from ..models.element import Element
from ..models.project import Project
from ..models.production import ProductionSchedule
from ..models.user import User
from ..auth.dependencies import get_current_factory_id, get_current_user, require_role
from ..services.production_completion import complete_production
from ..services.capacity import check_mould_capacity
from ..services.wetcasting_activity import log_wetcasting_activity

router = APIRouter(prefix="/production", tags=["production"])
ACTIVE_PROJECT_STATUSES = ("planned", "active")


# Data model for production update.
# Maps object fields to storage columns/constraints.
class ProductionUpdate(BaseModel):
    mould_id: Optional[int] = None
    production_date: Optional[date] = None
    quantity: Optional[int] = None
    status: Optional[str] = None


@router.post("/complete")
# Handles complete flow.
def complete(
    schedule_id: int,
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["production", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    """
    Mark a production schedule as completed and move the produced
    elements into a yard location.
    """
    result = complete_production(
        db=db,
        schedule_id=schedule_id,
        location_id=location_id,
        factory_id=factory_id,
    )

    if isinstance(result, dict) and result.get("error"):
        code = result.get("code")
        if code == "not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result["error"])
        if code == "already_completed":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=result["error"])
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])

    schedule = db.get(ProductionSchedule, schedule_id)
    element_mark = None
    if schedule and schedule.element_id is not None:
        el = db.get(Element, schedule.element_id)
        element_mark = el.element_mark if el else None

    log_wetcasting_activity(
        db,
        factory_id=factory_id,
        user_id=current_user.id,
        section="production",
        action="complete_schedule",
        entity_type="schedule",
        entity_id=schedule_id,
        details={
            "location_id": location_id,
            "element_mark": element_mark,
        },
    )
    db.commit()
    return result


@router.get("/schedule")
# Handles list schedule flow.
def list_schedule(
    include_inactive_projects: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["production", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    q = (
        db.query(ProductionSchedule)
        .join(Element, Element.id == ProductionSchedule.element_id)
        .join(Project, Project.id == Element.project_id)
        .filter(
            ProductionSchedule.factory_id == factory_id,
            Element.factory_id == factory_id,
            Project.factory_id == factory_id,
        )
    )
    if not include_inactive_projects:
        q = q.filter(Project.status.in_(ACTIVE_PROJECT_STATUSES))
    return q.order_by(ProductionSchedule.production_date).all()


@router.patch("/{schedule_id}")
# Handles update production flow.
def update_production(
    schedule_id: int,
    body: ProductionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["production", "admin"])),
):
    """
    Update a production schedule entry.

    When mould_id or production_date are changed, enforce mould capacity
    so that the total quantity on that mould and date does not exceed capacity.
    """

    factory_id = get_current_factory_id(current_user)

    schedule = db.get(ProductionSchedule, schedule_id)
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found"
        )
    if schedule.factory_id != factory_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    # Determine target mould/date and quantity (fall back to existing values)
    target_mould_id = body.mould_id if body.mould_id is not None else schedule.mould_id
    target_date = (
        body.production_date if body.production_date is not None else schedule.production_date
    )
    target_quantity = body.quantity if body.quantity is not None else schedule.quantity

    # Capacity check when mould or date or quantity may change
    mould = db.get(Mould, target_mould_id)
    if not mould:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Mould not found"
        )

    # Compatibility guard: prevent moving a schedule to an incompatible mould.
    # The auto-planner schedules only to Element.allowed_moulds; manual moves must respect the same rule.
    if schedule.element_id is not None and target_mould_id is not None:
        el = db.get(Element, schedule.element_id)
        if not el:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Element not found")

        allowed_ids = {m.id for m in (el.allowed_moulds or []) if getattr(m, "active", True)}
        if allowed_ids and int(target_mould_id) not in allowed_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mould not compatible with element",
            )

    ok, _ = check_mould_capacity(
        db=db,
        mould_id=target_mould_id,
        factory_id=factory_id,
        production_date=target_date,
        quantity=target_quantity,
    )
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mould capacity exceeded")

    # Apply updates
    for field, value in body.dict(exclude_unset=True).items():
        setattr(schedule, field, value)

    db.commit()
    db.refresh(schedule)
    element_mark = None
    if schedule.element_id is not None:
        el = db.get(Element, schedule.element_id)
        element_mark = el.element_mark if el else None

    log_wetcasting_activity(
        db,
        factory_id=factory_id,
        user_id=current_user.id,
        section="production",
        action="update_schedule",
        entity_type="schedule",
        entity_id=schedule.id,
        details={
            "element_mark": element_mark,
            "updated_fields": sorted(body.dict(exclude_unset=True).keys()),
        },
    )
    db.commit()
    return schedule