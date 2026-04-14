# File overview: API route handlers and request orchestration for app/routers/hollowcore.py.
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..auth.dependencies import get_current_user, require_role
from ..database import get_db
from ..models.element import Element
from ..models.hollowcore_bed import HollowcoreBed
from ..models.hollowcore_cast import HollowcoreCast
from ..models.hollowcore_settings import HollowcoreSettings
from ..models.project import Project
from ..models.user import User
from ..models.yard import YardInventory
from ..models.yard_location import YardLocation
from ..services.hollowcore_planner_v2 import generate_plan_rows
from ..services.public_holidays import is_south_africa_public_holiday
from ..services.wetcasting_activity import log_wetcasting_activity

router = APIRouter(prefix="/hollowcore", tags=["hollowcore"])


# Handles  factory id or none flow.
def _factory_id_or_none(u: User) -> int | None:
    # Super admin: factory_id is None (can read across factories).
    return int(u.factory_id) if u.factory_id is not None else None


# Handles  require factory for write flow.
def _require_factory_for_write(u: User) -> int:
    if u.factory_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not assigned to a factory")
    return int(u.factory_id)


# Handles  max panels per cast flow.
def _max_panels_per_cast(*, bed: HollowcoreBed, default_waste_mm: int, panel_length_mm: int) -> int:
    """Matches hollowcore_planner_v2: usable length = bed - margin at each end, then floor(usable / panel)."""
    if panel_length_mm <= 0:
        return 0
    margin = int(default_waste_mm or 0)
    usable = int(bed.length_mm or 0) - 2 * margin
    if usable <= 0:
        return 0
    return usable // int(panel_length_mm)


# Handles  used and waste mm flow.
def _used_and_waste_mm(*, quantity: int, panel_length_mm: int, bed_length_mm: int) -> tuple[int, int]:
    used = int(quantity) * int(panel_length_mm)
    waste = int(bed_length_mm) - used
    return used, waste


# Handles  project allows cast on date flow.
def _project_allows_cast_on_date(*, cast_date: date, work_saturday: bool, work_sunday: bool) -> bool:
    if is_south_africa_public_holiday(cast_date):
        return False
    wd = cast_date.weekday()  # Monday=0 ... Sunday=6
    if wd <= 4:
        return True
    if wd == 5:
        return bool(work_saturday)
    return bool(work_sunday)


# Handles  find cast at slot flow.
def _find_cast_at_slot(
    db: Session,
    *,
    factory_id: int,
    cast_date: date,
    bed_id: int,
    cast_slot_index: int,
    bed_number: int,
) -> HollowcoreCast | None:
    return (
        db.query(HollowcoreCast)
        .filter(HollowcoreCast.factory_id == factory_id)
        .filter(HollowcoreCast.cast_date == cast_date)
        .filter(HollowcoreCast.cast_slot_index == cast_slot_index)
        .filter((HollowcoreCast.bed_id == bed_id) | (HollowcoreCast.bed_number == bed_number))
        .first()
    )


# -------------------
# Beds
# -------------------
class BedIn(BaseModel):
    name: str
    length_mm: int
    max_casts_per_day: int
    active: bool = True


@router.get("/beds")
# Handles list beds flow.
def list_beds(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    fid = _factory_id_or_none(current_user)
    q = db.query(HollowcoreBed).order_by(HollowcoreBed.active.desc(), HollowcoreBed.name.asc())
    if fid is not None:
        q = q.filter(HollowcoreBed.factory_id == fid)
    return q.all()


@router.post("/beds", status_code=201)
# Handles create bed flow.
def create_bed(
    body: BedIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    fid = _require_factory_for_write(current_user)
    if body.length_mm <= 0 or body.max_casts_per_day <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="length_mm and max_casts_per_day must be positive")
    bed = HollowcoreBed(factory_id=fid, **body.dict())
    db.add(bed)
    db.commit()
    db.refresh(bed)
    return bed


@router.put("/beds/{bed_id:int}")
# Handles update bed flow.
def update_bed(
    bed_id: int,
    body: BedIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    fid = _require_factory_for_write(current_user)
    bed = db.get(HollowcoreBed, bed_id)
    if not bed or bed.factory_id != fid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bed not found")
    if body.length_mm <= 0 or body.max_casts_per_day <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="length_mm and max_casts_per_day must be positive")
    for k, v in body.dict().items():
        setattr(bed, k, v)
    db.commit()
    db.refresh(bed)
    return bed


@router.delete("/beds/{bed_id:int}", status_code=204)
# Handles delete bed flow.
def delete_bed(
    bed_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    fid = _require_factory_for_write(current_user)
    bed = db.get(HollowcoreBed, bed_id)
    if not bed or bed.factory_id != fid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bed not found")
    db.delete(bed)
    db.commit()
    return None


# -------------------
# Settings
# -------------------
class SettingsIn(BaseModel):
    default_waste_mm: int = 2000
    default_casts_per_day: int = 1
    cutting_strength_mpa: int = 15
    final_strength_mpa: int = 30


@router.get("/settings")
# Handles get settings flow.
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    fid = _require_factory_for_write(current_user)
    s = (
        db.query(HollowcoreSettings)
        .filter(HollowcoreSettings.factory_id == fid)
        .order_by(HollowcoreSettings.id.desc())
        .first()
    )
    if not s:
        # Return defaults without writing.
        return {
            "default_waste_mm": 2000,
            "default_casts_per_day": 1,
            "cutting_strength_mpa": 15,
            "final_strength_mpa": 30,
        }
    return {
        "default_waste_mm": int(s.default_waste_mm or s.waste_margin_mm or 2000),
        "default_casts_per_day": int(s.default_casts_per_day or s.casts_per_bed_per_day or 1),
        "cutting_strength_mpa": int(s.cutting_strength_mpa or 15),
        "final_strength_mpa": int(s.final_strength_mpa or 30),
    }


@router.put("/settings")
# Handles put settings flow.
def put_settings(
    body: SettingsIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    fid = _require_factory_for_write(current_user)
    if (
        body.default_waste_mm < 0
        or body.default_casts_per_day <= 0
        or body.cutting_strength_mpa <= 0
        or body.final_strength_mpa <= 0
        or body.final_strength_mpa < body.cutting_strength_mpa
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid settings values")

    s = (
        db.query(HollowcoreSettings)
        .filter(HollowcoreSettings.factory_id == fid)
        .order_by(HollowcoreSettings.id.desc())
        .first()
    )
    if not s:
        s = HollowcoreSettings(
            factory_id=fid,
            default_waste_mm=body.default_waste_mm,
            default_casts_per_day=body.default_casts_per_day,
            cutting_strength_mpa=body.cutting_strength_mpa,
            final_strength_mpa=body.final_strength_mpa,
        )
        db.add(s)
    else:
        s.default_waste_mm = body.default_waste_mm
        s.default_casts_per_day = body.default_casts_per_day
        s.cutting_strength_mpa = body.cutting_strength_mpa
        s.final_strength_mpa = body.final_strength_mpa
        s.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "ok"}


# -------------------
# Planner
# -------------------
class PlannerGenerateIn(BaseModel):
    start_date: date
    end_date: date
    apply_to_db: bool = True


# Data model for planned cast in.
# Maps object fields to storage columns/constraints.
class PlannedCastIn(BaseModel):
    cast_date: date
    bed_id: int
    cast_slot_index: int
    element_id: int
    panel_length_mm: int
    slab_thickness_mm: int
    quantity: int
    used_length_mm: int
    waste_mm: int


@router.post("/planner/generate")
# Handles planner generate flow.
def planner_generate(
    body: PlannerGenerateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    fid = _require_factory_for_write(current_user)
    beds = (
        db.query(HollowcoreBed)
        .filter(HollowcoreBed.factory_id == fid)
        .filter(HollowcoreBed.active == True)  # noqa: E712
        .order_by(HollowcoreBed.name.asc())
        .all()
    )

    settings = get_settings(db=db, current_user=current_user)
    default_waste_mm = int(settings["default_waste_mm"])

    casts, unplaced_remaining = generate_plan_rows(
        db=db,
        factory_id=fid,
        beds=beds,
        start_date=body.start_date,
        end_date=body.end_date,
        default_waste_mm=default_waste_mm,
    )
    if body.apply_to_db:
        bed_ids = [int(b.id) for b in beds if b and b.id is not None]
        replaced = 0
        if bed_ids:
            # Regeneration is authoritative for this window: replace prior planned rows
            # so new/edited beds can rebalance existing draft casts.
            existing_rows = (
                db.query(HollowcoreCast)
                .filter(HollowcoreCast.factory_id == fid)
                .filter(HollowcoreCast.status == "planned")
                .filter(HollowcoreCast.cast_date >= body.start_date)
                .filter(HollowcoreCast.cast_date <= body.end_date)
                .filter((HollowcoreCast.bed_id.in_(bed_ids)) | (HollowcoreCast.bed_number.in_(bed_ids)))
                .all()
            )
            for ex in existing_rows:
                db.delete(ex)
                replaced += 1
            if replaced > 0:
                # Ensure unique slot keys are released before we insert regenerated rows.
                db.flush()

        inserted = 0
        for c in casts:
            if str(c.get("status") or "planned") != "planned":
                # Locked non-planned rows are returned for UI context only; they already exist in DB.
                continue
            bid = int(c["bed_id"])
            bed = next((b for b in beds if int(b.id) == bid), None)
            bed_number = int(bed.id) if bed else bid
            row = HollowcoreCast(
                factory_id=fid,
                element_id=int(c["element_id"]),
                cast_date=c["cast_date"],
                bed_number=bed_number,
                bed_id=bid,
                cast_slot_index=int(c["cast_slot_index"]),
                panel_length_mm=int(c["panel_length_mm"]),
                slab_thickness_mm=int(c["slab_thickness_mm"]),
                quantity=int(c["quantity"]),
                used_length_mm=int(c["used_length_mm"]),
                waste_mm=int(c["waste_mm"]),
                status="planned",
                created_by=current_user.id,
            )
            db.add(row)
            db.flush()
            c["id"] = row.id
            inserted += 1

        if inserted > 0 or replaced > 0:
            db.commit()

    return {"beds": beds, "casts": casts, "unplaced_remaining": unplaced_remaining}


# Data model for planner commit in.
# Maps object fields to storage columns/constraints.
class PlannerCommitIn(BaseModel):
    casts: list[PlannedCastIn]


@router.post("/planner/commit", status_code=201)
# Handles planner commit flow.
def planner_commit(
    body: PlannerCommitIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    fid = _require_factory_for_write(current_user)
    if not body.casts:
        return {"inserted": 0}

    settings = get_settings(db=db, current_user=current_user)
    default_waste_mm = int(settings["default_waste_mm"])

    # Validate referenced beds first and prepare efficient lookups.
    bed_ids = sorted({int(c.bed_id) for c in body.casts})
    bed_map: dict[int, HollowcoreBed] = {}
    for bid in bed_ids:
      bed = db.query(HollowcoreBed).filter(HollowcoreBed.id == bid, HollowcoreBed.factory_id == fid).first()
      if not bed:
          raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown bed_id {bid}")
      bed_map[bid] = bed

    # Build submitted slot keys for "replace window" behavior.
    # When planner moves casts to different dates/slots, we must delete stale planned rows
    # from the same visible window, otherwise totals are double-counted.
    min_date = min(c.cast_date for c in body.casts)
    max_date = max(c.cast_date for c in body.casts)
    submitted_keys: set[tuple[date, int, int]] = {
        (c.cast_date, int(c.bed_id), int(c.cast_slot_index)) for c in body.casts
    }

    existing_planned_rows = (
        db.query(HollowcoreCast)
        .filter(HollowcoreCast.factory_id == fid)
        .filter(HollowcoreCast.status == "planned")
        .filter(HollowcoreCast.cast_date >= min_date)
        .filter(HollowcoreCast.cast_date <= max_date)
        .filter((HollowcoreCast.bed_id.in_(bed_ids)) | (HollowcoreCast.bed_number.in_(bed_ids)))
        .all()
    )
    existing_by_key: dict[tuple[date, int, int], HollowcoreCast] = {}
    stale_existing_rows: list[HollowcoreCast] = []
    for ex in existing_planned_rows:
        ex_bed = int(ex.bed_id if ex.bed_id is not None else ex.bed_number)
        ex_slot = int(ex.cast_slot_index or 0)
        key = (ex.cast_date, ex_bed, ex_slot)
        existing_by_key[key] = ex
        if key not in submitted_keys:
            stale_existing_rows.append(ex)

    cast_totals: dict[int, int] = defaultdict(int)
    for row in (
        db.query(HollowcoreCast.element_id, func.coalesce(func.sum(HollowcoreCast.quantity), 0))
        .filter(HollowcoreCast.factory_id == fid)
        .group_by(HollowcoreCast.element_id)
        .all()
    ):
        cast_totals[int(row[0])] = int(row[1] or 0)

    # Subtract quantities for stale planned rows that will be removed.
    for ex in stale_existing_rows:
        cast_totals[int(ex.element_id)] -= int(ex.quantity or 0)

    # Subtract old quantities for rows that will be updated in place.
    for c in body.casts:
        key = (c.cast_date, int(c.bed_id), int(c.cast_slot_index))
        existing = existing_by_key.get(key)
        if existing:
            cast_totals[int(existing.element_id)] -= int(existing.quantity or 0)

    for c in body.casts:
        cast_totals[int(c.element_id)] += int(c.quantity)

    # Snapshot current totals before this commit, so we can allow corrective commits that
    # reduce existing over-allocation instead of blocking all edits.
    current_totals = dict(cast_totals)

    for eid, total in cast_totals.items():
        if total < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid quantity adjustments (totals went negative).",
            )
        el = db.query(Element).filter(Element.id == eid, Element.factory_id == fid).first()
        if not el:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown element_id {eid}")
        order_qty = int(el.quantity or 0)
        if total > order_qty:
            old_total = int(current_totals.get(eid, 0) or 0)
            # If this element was already over-allocated before this commit,
            # allow save only when the new total does not make it worse.
            if old_total > order_qty and total <= old_total:
                continue
            mark = (
                el.element_mark.strip()
                if isinstance(el.element_mark, str) and el.element_mark.strip()
                else f"#{el.id}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Total planned hollowcore quantity for element {mark} ({total}) "
                    f"exceeds the order quantity ({order_qty})."
                ),
            )

    inserted = 0
    updated = 0
    deleted = 0

    # Remove stale planned rows in the same planner window.
    for ex in stale_existing_rows:
        db.delete(ex)
        deleted += 1

    project_cache: dict[int, Project] = {}
    for c in body.casts:
        el = db.query(Element).filter(Element.id == c.element_id, Element.factory_id == fid).first()
        if not el:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown element_id {c.element_id}")
        pid = int(el.project_id)
        project = project_cache.get(pid)
        if project is None:
            project = db.query(Project).filter(Project.id == pid, Project.factory_id == fid).first()
            if not project:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown project_id {pid} for element {el.id}")
            project_cache[pid] = project
        if not _project_allows_cast_on_date(
            cast_date=c.cast_date,
            work_saturday=bool(getattr(project, "work_saturday", False)),
            work_sunday=bool(getattr(project, "work_sunday", False)),
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Project '{project.project_name}' does not allow weekend work; "
                    f"element {el.element_mark or el.id} cannot be planned on {c.cast_date}."
                ),
            )

        bed = bed_map[int(c.bed_id)]

        bed_number = int(bed.id)
        max_fit = _max_panels_per_cast(bed=bed, default_waste_mm=default_waste_mm, panel_length_mm=c.panel_length_mm)
        qty = int(c.quantity)
        if qty < 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity must be at least 1.")
        if qty > max_fit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Quantity {qty} exceeds bed capacity for this panel length "
                    f"(maximum {max_fit} units; usable bed length minus margin / panel length)."
                ),
            )

        used_length_mm, waste_mm = _used_and_waste_mm(
            quantity=qty,
            panel_length_mm=c.panel_length_mm,
            bed_length_mm=int(bed.length_mm or 0),
        )

        existing = existing_by_key.get((c.cast_date, int(c.bed_id), int(c.cast_slot_index)))

        if existing:
            if existing.status != "planned":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Slot already committed and not planned (cast_id {existing.id}, status {existing.status}).",
                )
            existing.element_id = c.element_id
            existing.bed_id = c.bed_id
            existing.bed_number = bed_number
            existing.panel_length_mm = c.panel_length_mm
            existing.slab_thickness_mm = c.slab_thickness_mm
            existing.quantity = qty
            existing.used_length_mm = used_length_mm
            existing.waste_mm = waste_mm
            existing.status = "planned"
            existing.created_by = current_user.id
            updated += 1
        else:
            cast = HollowcoreCast(
                factory_id=fid,
                element_id=c.element_id,
                cast_date=c.cast_date,
                bed_number=bed_number,
                bed_id=c.bed_id,
                cast_slot_index=c.cast_slot_index,
                panel_length_mm=c.panel_length_mm,
                slab_thickness_mm=c.slab_thickness_mm,
                quantity=qty,
                used_length_mm=used_length_mm,
                waste_mm=waste_mm,
                status="planned",
                created_by=current_user.id,
            )
            db.add(cast)
            inserted += 1

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Plan commit failed (slot already taken or invalid data). Try generating again or clearing planned casts for that day.",
        ) from e
    log_wetcasting_activity(
        db,
        factory_id=fid,
        user_id=current_user.id,
        section="hollowcore",
        action="planner_commit",
        details={
            "inserted": inserted,
            "updated": updated,
            "deleted": deleted,
            "cast_count": len(body.casts),
        },
    )
    db.commit()
    return {"inserted": inserted, "updated": updated, "deleted": deleted}


# -------------------
# Casts
# -------------------
@router.get("/casts")
# Handles list casts flow.
def list_casts(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    fid = _factory_id_or_none(current_user)
    q = db.query(HollowcoreCast).order_by(HollowcoreCast.cast_date.asc(), HollowcoreCast.bed_id.asc(), HollowcoreCast.cast_slot_index.asc())
    if fid is not None:
        q = q.filter(HollowcoreCast.factory_id == fid)
    if from_date:
        q = q.filter(HollowcoreCast.cast_date >= from_date)
    if to_date:
        q = q.filter(HollowcoreCast.cast_date <= to_date)
    if status_filter:
        q = q.filter(HollowcoreCast.status == status_filter)
    return q.all()


# Data model for cast update in.
# Maps object fields to storage columns/constraints.
class CastUpdateIn(BaseModel):
    cast_date: Optional[date] = None
    bed_id: Optional[int] = None
    cast_slot_index: Optional[int] = None
    quantity: Optional[int] = None


@router.put("/casts/{cast_id:int}")
# Handles update cast flow.
def update_cast(
    cast_id: int,
    body: CastUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    fid = _require_factory_for_write(current_user)
    cast = db.get(HollowcoreCast, cast_id)
    if not cast or cast.factory_id != fid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cast not found")
    for k, v in body.dict(exclude_unset=True).items():
        setattr(cast, k, v)
    db.commit()
    db.refresh(cast)
    return cast


@router.post("/casts/{cast_id:int}/mark-cast")
# Handles mark cast flow.
def mark_cast(
    cast_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    fid = _require_factory_for_write(current_user)
    cast = db.get(HollowcoreCast, cast_id)
    if not cast or cast.factory_id != fid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cast not found")
    cast.status = "cast"
    if not cast.batch_id:
        # One cube set identity per lane/cast.
        cast.batch_id = f"HC-{fid}-{cast.id}-{uuid4().hex[:6].upper()}"
    db.commit()
    db.refresh(cast)
    log_wetcasting_activity(
        db,
        factory_id=fid,
        user_id=current_user.id,
        section="hollowcore",
        action="mark_cast",
        entity_type="hollowcore_cast",
        entity_id=cast.id,
        details={
            "element_id": cast.element_id,
            "batch_id": cast.batch_id,
            "cast_date": cast.cast_date.isoformat() if cast.cast_date else None,
            "bed_id": cast.bed_id,
            "cast_slot_index": cast.cast_slot_index,
            "quantity": cast.quantity,
        },
    )
    db.commit()
    return cast


@router.post("/casts/{cast_id:int}/mark-cut")
# Handles mark cut flow.
def mark_cut(
    cast_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    from ..models.quality import QualityTest

    fid = _require_factory_for_write(current_user)
    cast = db.get(HollowcoreCast, cast_id)
    if not cast or cast.factory_id != fid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cast not found")
    if not cast.batch_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cast has no cube set (batch). Mark cast first.")

    latest_1d = (
        db.query(QualityTest)
        .join(Element, QualityTest.element_id == Element.id)
        .filter(Element.factory_id == fid)
        .filter(QualityTest.batch_id == cast.batch_id)
        .filter(QualityTest.age_days == 1)
        .order_by(QualityTest.test_date.desc(), QualityTest.id.desc())
        .first()
    )
    if not latest_1d:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing 1-day cube result for this lane.")
    if latest_1d.passed is not True:
        cast.status = "hold_qc_1d_fail"
        db.commit()
        db.refresh(cast)
        log_wetcasting_activity(
            db,
            factory_id=fid,
            user_id=current_user.id,
            section="hollowcore",
            action="auto_hold_qc_1d_fail",
            entity_type="hollowcore_cast",
            entity_id=cast.id,
            details={
                "element_id": cast.element_id,
                "batch_id": cast.batch_id,
                "cast_date": cast.cast_date.isoformat() if cast.cast_date else None,
                "bed_id": cast.bed_id,
                "cast_slot_index": cast.cast_slot_index,
                "quantity": cast.quantity,
                "latest_1d_passed": latest_1d.passed,
                "latest_1d_test_date": latest_1d.test_date.isoformat() if latest_1d.test_date else None,
                "latest_1d_avg_strength_mpa": latest_1d.avg_strength_mpa,
                "latest_1d_required_strength_mpa": latest_1d.required_strength_mpa,
            },
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="1-day cube result failed. Cast moved to HOLD. Request retest or admin override.",
        )

    cast.status = "cut"
    db.commit()
    db.refresh(cast)
    log_wetcasting_activity(
        db,
        factory_id=fid,
        user_id=current_user.id,
        section="hollowcore",
        action="mark_cut",
        entity_type="hollowcore_cast",
        entity_id=cast.id,
        details={
            "element_id": cast.element_id,
            "batch_id": cast.batch_id,
            "cast_date": cast.cast_date.isoformat() if cast.cast_date else None,
            "bed_id": cast.bed_id,
            "cast_slot_index": cast.cast_slot_index,
            "quantity": cast.quantity,
        },
    )
    db.commit()
    return cast


# Data model for complete in.
# Maps object fields to storage columns/constraints.
class CompleteIn(BaseModel):
    location_id: int


# Data model for retest request in.
# Maps object fields to storage columns/constraints.
class RetestRequestIn(BaseModel):
    reason: str


# Data model for override cut in.
# Maps object fields to storage columns/constraints.
class OverrideCutIn(BaseModel):
    reason: str


@router.post("/casts/{cast_id:int}/complete")
# Handles complete cast flow.
def complete_cast(
    cast_id: int,
    body: CompleteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    fid = _require_factory_for_write(current_user)
    cast = db.get(HollowcoreCast, cast_id)
    if not cast or cast.factory_id != fid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cast not found")
    if cast.status not in ("cut", "completed"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cast must be marked cut before completion.")

    location = db.get(YardLocation, body.location_id)
    if not location or location.factory_id != fid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid yard location for this factory")

    # Move to yard inventory (element_id + location_id)
    yard_row = (
        db.query(YardInventory)
        .filter(YardInventory.factory_id == fid)
        .filter(YardInventory.element_id == cast.element_id)
        .filter(YardInventory.location_id == body.location_id)
        .first()
    )
    if yard_row:
        yard_row.quantity += int(cast.quantity or 0)
    else:
        yard_row = YardInventory(
            factory_id=fid,
            element_id=cast.element_id,
            location_id=body.location_id,
            quantity=int(cast.quantity or 0),
        )
        db.add(yard_row)

    cast.status = "completed"
    db.commit()
    db.refresh(cast)
    log_wetcasting_activity(
        db,
        factory_id=fid,
        user_id=current_user.id,
        section="hollowcore",
        action="complete_cast",
        entity_type="hollowcore_cast",
        entity_id=cast.id,
        details={
            "element_id": cast.element_id,
            "batch_id": cast.batch_id,
            "cast_date": cast.cast_date.isoformat() if cast.cast_date else None,
            "bed_id": cast.bed_id,
            "cast_slot_index": cast.cast_slot_index,
            "quantity": cast.quantity,
            "location_id": body.location_id,
        },
    )
    db.commit()
    return {"message": "ok", "cast": cast}


@router.post("/casts/{cast_id:int}/request-retest")
# Handles request retest flow.
def request_retest(
    cast_id: int,
    body: RetestRequestIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    fid = _require_factory_for_write(current_user)
    cast = db.get(HollowcoreCast, cast_id)
    if not cast or cast.factory_id != fid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cast not found")
    if not cast.batch_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cast has no cube set (batch). Mark cast first.")
    reason = (body.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Retest reason is required.")

    cast.status = "hold_qc_1d_fail"
    db.commit()
    db.refresh(cast)
    log_wetcasting_activity(
        db,
        factory_id=fid,
        user_id=current_user.id,
        section="hollowcore",
        action="request_retest",
        entity_type="hollowcore_cast",
        entity_id=cast.id,
        details={
            "element_id": cast.element_id,
            "batch_id": cast.batch_id,
            "cast_date": cast.cast_date.isoformat() if cast.cast_date else None,
            "bed_id": cast.bed_id,
            "cast_slot_index": cast.cast_slot_index,
            "quantity": cast.quantity,
            "reason": reason,
        },
    )
    db.commit()
    return {"message": "Retest requested", "cast": cast}


@router.post("/casts/{cast_id:int}/mark-cut-override")
# Handles mark cut override flow.
def mark_cut_override(
    cast_id: int,
    body: OverrideCutIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"])),
):
    from ..models.quality import QualityTest

    fid = _require_factory_for_write(current_user)
    cast = db.get(HollowcoreCast, cast_id)
    if not cast or cast.factory_id != fid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cast not found")
    if cast.status not in ("cast", "hold_qc_1d_fail"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cast must be in cast/hold status to override cut.")
    if not cast.batch_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cast has no cube set (batch). Mark cast first.")
    reason = (body.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Override reason is required.")

    latest_1d = (
        db.query(QualityTest)
        .join(Element, QualityTest.element_id == Element.id)
        .filter(Element.factory_id == fid)
        .filter(QualityTest.batch_id == cast.batch_id)
        .filter(QualityTest.age_days == 1)
        .order_by(QualityTest.test_date.desc(), QualityTest.id.desc())
        .first()
    )
    if not latest_1d:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing 1-day cube result for this lane.")

    cast.status = "cut"
    db.commit()
    db.refresh(cast)
    log_wetcasting_activity(
        db,
        factory_id=fid,
        user_id=current_user.id,
        section="hollowcore",
        action="mark_cut_override",
        entity_type="hollowcore_cast",
        entity_id=cast.id,
        details={
            "element_id": cast.element_id,
            "batch_id": cast.batch_id,
            "cast_date": cast.cast_date.isoformat() if cast.cast_date else None,
            "bed_id": cast.bed_id,
            "cast_slot_index": cast.cast_slot_index,
            "quantity": cast.quantity,
            "override_reason": reason,
            "latest_1d_passed": latest_1d.passed,
            "latest_1d_test_date": latest_1d.test_date.isoformat() if latest_1d.test_date else None,
            "latest_1d_avg_strength_mpa": latest_1d.avg_strength_mpa,
            "latest_1d_required_strength_mpa": latest_1d.required_strength_mpa,
        },
    )
    db.commit()
    return cast

