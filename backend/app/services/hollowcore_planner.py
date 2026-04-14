# File overview: Business logic services for app/services/hollowcore_planner.py.
from __future__ import annotations

from datetime import date, timedelta
import math
import uuid

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ..models.element import Element
from ..models.hollowcore_settings import HollowcoreSettings
from ..models.hollowcore_cast import HollowcoreCast
from .public_holidays import is_south_africa_public_holiday


# Handles  is working day flow.
def _is_working_day(d: date, work_saturday: bool, work_sunday: bool) -> bool:
    # South Africa public holidays are treated as non-working days by default.
    if is_south_africa_public_holiday(d):
        return False
    wd = d.weekday()  # 0=Mon ... 5=Sat 6=Sun
    if wd == 5:
        return work_saturday
    if wd == 6:
        return work_sunday
    return True


# Handles  next working day flow.
def _next_working_day(d: date, work_saturday: bool, work_sunday: bool) -> date:
    cur = d
    while not _is_working_day(cur, work_saturday, work_sunday):
        cur = cur + timedelta(days=1)
    return cur


# Handles  get casts per panel cast flow.
def _get_casts_per_panel_cast(bed_length_mm: int, waste_margin_mm: int, panel_length_mm: int) -> int:
    # How many panels fit onto a bed cast, accounting for trim/waste.
    # The planner assumes the cast is entirely dedicated to one panel length per slot.
    usable = bed_length_mm - waste_margin_mm
    if panel_length_mm <= 0 or usable <= 0:
        return 0
    return usable // panel_length_mm


# Handles generate hollowcore plan flow.
def generate_hollowcore_plan(db: Session, factory_id: int):
    # Use per-factory settings; if not found, fall back to global defaults (factory_id IS NULL).
    settings = (
        db.query(HollowcoreSettings)
        .filter(HollowcoreSettings.active == True)  # noqa: E712
        .filter(HollowcoreSettings.factory_id == factory_id)
        .order_by(HollowcoreSettings.id.desc())
        .first()
    )
    if not settings:
        settings = (
            db.query(HollowcoreSettings)
            .filter(HollowcoreSettings.active == True)  # noqa: E712
            .filter(HollowcoreSettings.factory_id.is_(None))
            .order_by(HollowcoreSettings.id.desc())
            .first()
        )
    if not settings:
        settings = HollowcoreSettings(
            factory_id=factory_id,
            bed_count=1,
            bed_length_mm=6000,
            waste_margin_mm=2000,
            casts_per_bed_per_day=1,
            active=True,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)

    bed_count = int(settings.bed_count)
    bed_length_mm = int(settings.bed_length_mm)
    waste_margin_mm = int(settings.waste_margin_mm)
    casts_per_bed_per_day = max(1, int(settings.casts_per_bed_per_day))

    # Only schedule elements that have hollowcore panel data.
    elements = (
        db.query(Element)
        .filter(
            and_(
                Element.panel_length_mm.isnot(None),
                Element.slab_thickness_mm.isnot(None),
            )
        )
        .filter(
            or_(
                Element.status.is_(None),
                Element.status.in_(["planned", "scheduled"]),
            )
        )
        .filter(Element.factory_id == factory_id)
        .all()
    )

    element_ids = [e.id for e in elements]
    if not element_ids:
        return {"message": "No hollowcore panel elements to schedule", "scheduled_casts": 0, "unscheduled": [], "late": []}

    # Clear existing (non-completed) hollowcore casts so quantity reductions don't add more work.
    db.query(HollowcoreCast).filter(
        HollowcoreCast.element_id.in_(element_ids),
        HollowcoreCast.status != "completed",
    ).delete(synchronize_session=False)
    db.commit()

    today_global = date.today()

    # Occupancy state (include completed casts so we never double-book).
    thickness_by_date_bed: dict[tuple[date, int], int] = {}
    used_slots: set[tuple[date, int, int]] = set()

    completed_rows = (
        db.query(HollowcoreCast)
        .filter(
            HollowcoreCast.element_id.in_(element_ids),
            HollowcoreCast.status == "completed",
        )
        .all()
    )
    for c in completed_rows:
        thickness_by_date_bed[(c.cast_date, c.bed_number)] = c.slab_thickness_mm
        used_slots.add((c.cast_date, c.bed_number, c.cast_slot_index))

    # Sort elements by due date to reduce lateness.
    def _element_due(e: Element) -> date:
        return e.due_date or e.project.due_date or (today_global + timedelta(days=365))

    elements_sorted = sorted(elements, key=_element_due)

    cast_count = 0
    unscheduled = []
    late = []

    # Schedule each cast job earliest-possible subject to:
    # - per-bed thickness lock on a given day
    # - per-bed-slot availability per day
    # - project working days (Saturdays/Sundays)
    for element in elements_sorted:
        project = element.project
        work_saturday = bool(getattr(project, "work_saturday", False))
        work_sunday = bool(getattr(project, "work_sunday", False))
        start_from = getattr(project, "start_date", None) or today_global

        due = element.due_date or getattr(project, "due_date", None)

        panels_per_cast = _get_casts_per_panel_cast(
            bed_length_mm=bed_length_mm,
            waste_margin_mm=waste_margin_mm,
            panel_length_mm=int(element.panel_length_mm or 0),
        )
        if panels_per_cast <= 0:
            unscheduled.append(
                {
                    "element_id": element.id,
                    "element_mark": element.element_mark,
                    "element_type": element.element_type,
                    "reason": "Panel length too large for bed/waste settings",
                }
            )
            continue

        remaining = int(element.quantity)
        if remaining <= 0:
            continue

        last_cast_date: date | None = None

        slab_thickness_mm = int(element.slab_thickness_mm or 0)
        panel_length_mm = int(element.panel_length_mm or 0)

        current_day_anchor = _next_working_day(max(today_global, start_from), work_saturday, work_sunday)

        while remaining > 0:
            cast_qty = min(panels_per_cast, remaining)

            cast_placed = False
            search_day = current_day_anchor

            # Hard limit to avoid infinite loops if constraints are impossible.
            # 2 years window should be plenty for this factory use-case.
            for _ in range(0, 730):
                placed_this_day = False

                for bed_number in range(1, bed_count + 1):
                    existing_thickness = thickness_by_date_bed.get((search_day, bed_number))
                    if existing_thickness is not None and existing_thickness != slab_thickness_mm:
                        continue  # thickness lock for this bed/day

                    for slot_index in range(0, casts_per_bed_per_day):
                        if (search_day, bed_number, slot_index) in used_slots:
                            continue

                        # Slot found.
                        cast = HollowcoreCast(
                            element_id=element.id,
                            cast_date=search_day,
                            bed_number=bed_number,
                            cast_slot_index=slot_index,
                            slab_thickness_mm=slab_thickness_mm,
                            panel_length_mm=panel_length_mm,
                            quantity=cast_qty,
                            status="planned",
                        )
                        db.add(cast)
                        db.flush()  # populate cast.id for batch_id

                        if getattr(element, "requires_cubes", False) and not cast.batch_id:
                            cast.batch_id = (
                                f"CUBE-{cast.cast_date.strftime('%Y%m%d')}-"
                                f"{cast.id}-{uuid.uuid4().hex[:6].upper()}"
                            )

                        # Update occupancy in-memory immediately.
                        thickness_by_date_bed[(search_day, bed_number)] = slab_thickness_mm
                        used_slots.add((search_day, bed_number, slot_index))

                        placed_this_day = True
                        cast_placed = True
                        cast_count += 1
                        last_cast_date = search_day
                        break

                    if placed_this_day:
                        break

                if cast_placed:
                    break

                # No slot found this day; try next working day for this project.
                search_day = _next_working_day(search_day + timedelta(days=1), work_saturday, work_sunday)

            if not cast_placed:
                unscheduled.append(
                    {
                        "element_id": element.id,
                        "element_mark": element.element_mark,
                        "element_type": element.element_type,
                        "reason": "No free hollowcore cast slots found within scheduling horizon",
                    }
                )
                break

            remaining -= cast_qty

            # Continue searching from the last placement day (earliest possible for next cast).
            current_day_anchor = last_cast_date or current_day_anchor
            current_day_anchor = _next_working_day(current_day_anchor, work_saturday, work_sunday)

        if due is not None and last_cast_date is not None and last_cast_date > due:
            late.append(
                {
                    "element_id": element.id,
                    "element_mark": element.element_mark,
                    "element_type": element.element_type,
                    "due_date": due,
                    "last_cast_date": last_cast_date,
                }
            )

    db.commit()

    return {
        "message": "Hollowcore plan generated",
        "scheduled_casts": cast_count,
        "unscheduled": unscheduled,
        "late": late,
    }

