# File overview: API route handlers and request orchestration for app/routers/elements.py.
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from ..database import get_db
from ..auth.dependencies import get_current_factory_id, get_current_user, require_role
from ..models.user import User
from ..models.mould import Mould as MouldModel
from ..models.element import Element as ElementModel
from ..models.project import Project as ProjectModel
from ..models.element_mould import ElementMould
from ..models.yard import YardInventory as YardInventoryModel
from ..models.production import ProductionSchedule
from ..schemas.element import Element, ElementCreate, ElementUpdate
from ..services.wetcasting_activity import log_wetcasting_activity

router = APIRouter(prefix="/elements", tags=["elements"])
ACTIVE_PROJECT_STATUSES = ("planned", "active")


@router.post("/", response_model=Element)
# Handles create element flow.
def create_element(
    element: ElementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    data = element.dict()
    allowed_mould_ids = data.pop("allowed_mould_ids", []) or []

    # Ensure mould links cannot cross factories.
    allowed_mould_ids = [
        row[0]
        for row in db.query(MouldModel.id)
        .filter(MouldModel.id.in_(allowed_mould_ids), MouldModel.factory_id == factory_id)
        .all()
    ]

    db_element = ElementModel(**data, factory_id=factory_id)
    db.add(db_element)
    db.commit()
    db.refresh(db_element)

    for mould_id in allowed_mould_ids:
        db.add(ElementMould(element_id=db_element.id, mould_id=mould_id))
    db.commit()
    db.refresh(db_element)
    log_wetcasting_activity(
        db,
        factory_id=factory_id,
        user_id=current_user.id,
        section="elements",
        action="create_element",
        entity_type="element",
        entity_id=db_element.id,
        details={"element_mark": db_element.element_mark, "quantity": db_element.quantity},
    )
    if db_element.panel_length_mm is not None and db_element.slab_thickness_mm is not None:
        log_wetcasting_activity(
            db,
            factory_id=factory_id,
            user_id=current_user.id,
            section="hollowcore",
            action="create_element",
            entity_type="element",
            entity_id=db_element.id,
            details={
                "element_mark": db_element.element_mark,
                "quantity": db_element.quantity,
                "panel_length_mm": db_element.panel_length_mm,
                "slab_thickness_mm": db_element.slab_thickness_mm,
            },
        )
    db.commit()
    return db_element


@router.get("/", response_model=List[Element])
# Handles list elements flow.
def list_elements(
    hollowcore_only: Optional[bool] = None,
    include_inactive: Optional[bool] = False,
    include_inactive_projects: Optional[bool] = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    factory_id = get_current_factory_id(current_user)
    q = (
        db.query(ElementModel)
        .join(ProjectModel, ProjectModel.id == ElementModel.project_id)
        .filter(ElementModel.factory_id == factory_id, ProjectModel.factory_id == factory_id)
    )
    if not include_inactive:
        q = q.filter(ElementModel.active == True)  # noqa: E712
    if not include_inactive_projects:
        q = q.filter(ProjectModel.status.in_(ACTIVE_PROJECT_STATUSES))
    if hollowcore_only is True:
        q = q.filter(ElementModel.panel_length_mm.isnot(None)).filter(ElementModel.slab_thickness_mm.isnot(None))
    if hollowcore_only is False:
        q = q.filter(
            ~(
                (ElementModel.panel_length_mm.isnot(None))
                & (ElementModel.slab_thickness_mm.isnot(None))
            )
        )
    return q.all()


@router.get("/progress")
# Handles list element progress flow.
def list_element_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    factory_id = get_current_factory_id(current_user)
    elements = (
        db.query(
            ElementModel.id,
            ElementModel.element_mark,
            ElementModel.quantity.label("planned_total"),
        )
        .filter(ElementModel.factory_id == factory_id)
        .all()
    )
    completed_rows = (
        db.query(
            ProductionSchedule.element_id,
            func.coalesce(func.sum(ProductionSchedule.quantity), 0).label("completed_qty"),
        )
        .filter(ProductionSchedule.factory_id == factory_id)
        .filter(ProductionSchedule.status == "completed")
        .group_by(ProductionSchedule.element_id)
        .all()
    )
    completed_by_element = {int(r.element_id): int(r.completed_qty or 0) for r in completed_rows}
    out = []
    for e in elements:
        completed_qty = int(completed_by_element.get(int(e.id), 0))
        planned_total = int(e.planned_total or 0)
        remaining_qty = max(0, planned_total - completed_qty)
        out.append(
            {
                "element_id": int(e.id),
                "element_mark": e.element_mark,
                "planned_total": planned_total,
                "completed_qty": completed_qty,
                "remaining_qty": remaining_qty,
                "derived_status": (
                    "planned"
                    if completed_qty <= 0
                    else ("completed" if remaining_qty <= 0 else "in_progress")
                ),
            }
        )
    return out


@router.get("/{element_id}", response_model=Element)
# Handles get element flow.
def get_element(
    element_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    factory_id = get_current_factory_id(current_user)
    element = db.query(ElementModel).filter(ElementModel.id == element_id, ElementModel.factory_id == factory_id).first()
    if not element:
        raise HTTPException(status_code=404, detail="Element not found")
    return element


@router.put("/{element_id}", response_model=Element)
# Handles update element flow.
def update_element(
    element_id: int,
    update: ElementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    element = db.query(ElementModel).filter(ElementModel.id == element_id, ElementModel.factory_id == factory_id).first()
    if not element:
        raise HTTPException(status_code=404, detail="Element not found")

    payload = update.dict(exclude_unset=True)
    allowed_mould_ids = payload.pop("allowed_mould_ids", None)

    for field, value in payload.items():
        setattr(element, field, value)

    if allowed_mould_ids is not None:
        allowed_mould_ids = [
            row[0]
            for row in db.query(MouldModel.id)
            .filter(MouldModel.id.in_(allowed_mould_ids or []), MouldModel.factory_id == factory_id)
            .all()
        ]
        db.query(ElementMould).filter(ElementMould.element_id == element_id).delete(
            synchronize_session=False
        )
        for mould_id in allowed_mould_ids:
            db.add(ElementMould(element_id=element_id, mould_id=mould_id))

    db.commit()
    db.refresh(element)
    log_wetcasting_activity(
        db,
        factory_id=factory_id,
        user_id=current_user.id,
        section="elements",
        action="update_element",
        entity_type="element",
        entity_id=element.id,
        details={"element_mark": element.element_mark, "updated_fields": sorted(payload.keys())},
    )
    db.commit()
    return element


@router.post("/{element_id}/archive", response_model=Element)
# Handles archive element flow.
def archive_element(
    element_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    element = db.query(ElementModel).filter(ElementModel.id == element_id, ElementModel.factory_id == factory_id).first()
    if not element:
        raise HTTPException(status_code=404, detail="Element not found")
    element.active = False
    db.commit()
    db.refresh(element)
    log_wetcasting_activity(
        db,
        factory_id=factory_id,
        user_id=current_user.id,
        section="elements",
        action="archive_element",
        entity_type="element",
        entity_id=element.id,
        details={"element_mark": element.element_mark},
    )
    db.commit()
    return element


@router.post("/{element_id}/unarchive", response_model=Element)
# Handles unarchive element flow.
def unarchive_element(
    element_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    element = db.query(ElementModel).filter(ElementModel.id == element_id, ElementModel.factory_id == factory_id).first()
    if not element:
        raise HTTPException(status_code=404, detail="Element not found")
    element.active = True
    db.commit()
    db.refresh(element)
    log_wetcasting_activity(
        db,
        factory_id=factory_id,
        user_id=current_user.id,
        section="elements",
        action="unarchive_element",
        entity_type="element",
        entity_id=element.id,
        details={"element_mark": element.element_mark},
    )
    db.commit()
    return element


@router.delete("/{element_id}")
# Handles delete element flow.
def delete_element(
    element_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    element = db.query(ElementModel).filter(ElementModel.id == element_id, ElementModel.factory_id == factory_id).first()
    if not element:
        raise HTTPException(status_code=404, detail="Element not found")

    # Prevent deleting an element that is already in yard stock.
    yard_rows = (
        db.query(YardInventoryModel)
        .filter(YardInventoryModel.factory_id == factory_id)
        .filter(YardInventoryModel.element_id == element_id)
        .all()
    )
    if yard_rows:
        total = sum(int(r.quantity or 0) for r in yard_rows)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete element: it exists in yard inventory (total qty {total}). Move/dispatch stock first.",
        )

    # Clean up join table links first (defensive for FK constraints)
    db.query(ElementMould).filter(ElementMould.element_id == element_id).delete(synchronize_session=False)

    try:
        deleted_mark = element.element_mark
        db.delete(element)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete element because it is referenced by other records (production/QC/dispatch/yard).",
        )
    log_wetcasting_activity(
        db,
        factory_id=factory_id,
        user_id=current_user.id,
        section="elements",
        action="delete_element",
        entity_type="element",
        entity_id=element_id,
        details={"element_mark": deleted_mark},
    )
    db.commit()
    return {"message": "Element deleted"}