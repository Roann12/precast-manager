# File overview: API route handlers and request orchestration for app/routers/planner.py.
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth.dependencies import get_current_factory_id, get_current_user, require_role
from ..models.user import User
from ..models.planner_delay import PlannerDelay
from ..services.planner import generate_production_plan
from ..services.auto_planner import auto_plan_production
from ..services.wetcasting_activity import log_wetcasting_activity

router = APIRouter(prefix="/planner", tags=["planner"])


# --------------------------------
# Existing planner
# --------------------------------
@router.post("/generate")
# Handles generate plan flow.
def generate_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    # Return the full planner result so the UI can display unscheduled/late details.
    result = generate_production_plan(db, factory_id=factory_id)
    log_wetcasting_activity(
        db,
        factory_id=factory_id,
        user_id=current_user.id,
        section="planner",
        action="generate_plan",
        entity_type="planner_run",
        details={"scheduled_batches": result.get("scheduled_batches"), "unscheduled_count": len(result.get("unscheduled") or [])},
    )
    db.commit()
    return result


# --------------------------------
# Smart auto planner
# --------------------------------
@router.post("/auto-plan")
# Handles auto plan flow.
def auto_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    result = auto_plan_production(db, factory_id=factory_id)
    log_wetcasting_activity(
        db,
        factory_id=factory_id,
        user_id=current_user.id,
        section="planner",
        action="auto_plan",
        entity_type="planner_run",
        details={"scheduled_batches": result.get("scheduled_batches"), "unscheduled_count": len(result.get("unscheduled") or [])},
    )
    db.commit()
    return result


# --------------------------------
# Delay events (persistent)
# --------------------------------
class PlannerDelayIn(BaseModel):
    planner_type: str  # "production" | "hollowcore"
    delay_date: date
    mould_id: Optional[int] = None
    bed_id: Optional[int] = None
    lost_capacity: int = 1
    reason: Optional[str] = None


@router.get("/delays")
# Handles list delays flow.
def list_delays(
    planner_type: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    pt = (planner_type or "").strip().lower()
    if pt not in ("production", "hollowcore"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="planner_type must be 'production' or 'hollowcore'")

    q = (
        db.query(PlannerDelay)
        .filter(PlannerDelay.factory_id == factory_id)
        .filter(PlannerDelay.planner_type == pt)
        .order_by(PlannerDelay.delay_date.asc(), PlannerDelay.id.asc())
    )
    if from_date is not None:
        q = q.filter(PlannerDelay.delay_date >= from_date)
    if to_date is not None:
        q = q.filter(PlannerDelay.delay_date <= to_date)
    return q.all()


@router.post("/delays", status_code=201)
# Handles create delay flow.
def create_delay(
    body: PlannerDelayIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    pt = (body.planner_type or "").strip().lower()
    if pt not in ("production", "hollowcore"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="planner_type must be 'production' or 'hollowcore'")
    if body.lost_capacity < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="lost_capacity must be >= 1")
    if pt == "production" and body.bed_id is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="bed_id is not allowed for production delays")
    if pt == "hollowcore" and body.mould_id is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="mould_id is not allowed for hollowcore delays")

    d = PlannerDelay(
        factory_id=factory_id,
        planner_type=pt,
        delay_date=body.delay_date,
        mould_id=body.mould_id,
        bed_id=body.bed_id,
        lost_capacity=int(body.lost_capacity),
        reason=(body.reason.strip() if isinstance(body.reason, str) and body.reason.strip() else None),
        created_by=current_user.id,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    log_wetcasting_activity(
        db,
        factory_id=factory_id,
        user_id=current_user.id,
        section="planner",
        action="create_delay",
        entity_type="delay",
        entity_id=d.id,
        details={"planner_type": d.planner_type, "delay_date": str(d.delay_date), "lost_capacity": d.lost_capacity},
    )
    db.commit()
    return d


@router.delete("/delays/{delay_id:int}", status_code=204)
# Handles delete delay flow.
def delete_delay(
    delay_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    d = db.get(PlannerDelay, delay_id)
    if not d or d.factory_id != factory_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delay not found")
    deleted_id = d.id
    db.delete(d)
    db.commit()
    log_wetcasting_activity(
        db,
        factory_id=factory_id,
        user_id=current_user.id,
        section="planner",
        action="delete_delay",
        entity_type="delay",
        entity_id=deleted_id,
    )
    db.commit()
    return None