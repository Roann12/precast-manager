from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.element import Element
from ..models.hollowcore_bed import HollowcoreBed
from ..models.hollowcore_cast import HollowcoreCast
from ..models.planner_delay import PlannerDelay
from ..models.project import Project
from .public_holidays import is_south_africa_public_holiday


def _daterange(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def _is_working_day_for_project(d: date, work_saturday: bool, work_sunday: bool) -> bool:
    # South Africa public holidays are treated as non-working days by default.
    if is_south_africa_public_holiday(d):
        return False
    wd = d.weekday()  # Monday=0 ... Sunday=6
    if wd <= 4:
        return True
    if wd == 5:
        return bool(work_saturday)
    return bool(work_sunday)


def generate_plan_rows(
    *,
    db: Session,
    factory_id: int,
    beds: list[HollowcoreBed],
    start_date: date,
    end_date: date,
    default_waste_mm: int,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Generate a list of planned cast rows without writing to DB.

    Planning rules:
    - only elements with panel_length_mm + slab_thickness_mm set (hollowcore)
    - remaining_qty = element.quantity - sum(existing_casts.quantity for that element in this factory)
    - fill beds day-by-day, due-date first

    Returns (draft_casts, unplaced_remaining). The second list is elements that still have
    quantity left after the simulation — typically because the date range ran out or daily
    bed capacity (length / max casts per day) could not absorb more in this window.
    """

    def _unplaced_snapshot(remaining_list: list[dict]) -> list[dict[str, Any]]:
        return [
            {
                "element_id": int(cur["element_id"]),
                "element_mark": cur.get("element_mark"),
                "remaining_qty": int(cur["remaining_qty"]),
                "panel_length_mm": int(cur["panel_length_mm"] or 0),
            }
            for cur in remaining_list
            if int(cur["remaining_qty"]) > 0
        ]

    # Remaining qty per element
    bed_ids = [int(b.id) for b in beds if b is not None and b.id is not None]
    # Slots that are already occupied are considered locked.
    # - non-planned rows are immutable in planner
    # - planned rows should be preserved on generate (additive behavior)
    locked_slots: set[tuple[date, int, int]] = set()
    existing_planned_casts: list[dict[str, Any]] = []
    if bed_ids:
        planned_rows = (
            db.query(HollowcoreCast)
            .filter(HollowcoreCast.factory_id == factory_id)
            .filter(HollowcoreCast.cast_date >= start_date)
            .filter(HollowcoreCast.cast_date <= end_date)
            .filter(HollowcoreCast.status == "planned")
            .filter(
                (HollowcoreCast.bed_id.in_(bed_ids))
                | (HollowcoreCast.bed_number.in_(bed_ids))
            )
            .all()
        )
        planned_element_ids = {int(c.element_id) for c in planned_rows if c.element_id is not None}
        planned_element_workdays: dict[int, tuple[bool, bool]] = {}
        if planned_element_ids:
            element_project_rows = (
                db.query(Element.id, Project.work_saturday, Project.work_sunday)
                .join(Project, Project.id == Element.project_id)
                .filter(Element.factory_id == factory_id)
                .filter(Element.id.in_(planned_element_ids))
                .all()
            )
            for eid, work_sat, work_sun in element_project_rows:
                planned_element_workdays[int(eid)] = (bool(work_sat), bool(work_sun))
        for c in planned_rows:
            cast_bed = c.bed_id if c.bed_id is not None else c.bed_number
            if cast_bed is None or c.cast_slot_index is None or c.cast_date is None:
                continue
            work_sat, work_sun = planned_element_workdays.get(int(c.element_id), (False, False))
            if not _is_working_day_for_project(c.cast_date, work_sat, work_sun):
                # Do not preserve old invalid planned rows (weekend/holiday rule changes).
                # They are intentionally omitted from generated draft and will be removed on commit.
                continue
            slot_key = (c.cast_date, int(cast_bed), int(c.cast_slot_index))
            locked_slots.add(slot_key)
            existing_planned_casts.append(
                {
                    "id": c.id,
                    "cast_date": c.cast_date,
                    "bed_id": int(cast_bed),
                    "cast_slot_index": int(c.cast_slot_index),
                    "element_id": int(c.element_id),
                    "panel_length_mm": int(c.panel_length_mm or 0),
                    "slab_thickness_mm": int(c.slab_thickness_mm or 0),
                    "quantity": int(c.quantity or 0),
                    "used_length_mm": int(c.used_length_mm or (int(c.quantity or 0) * int(c.panel_length_mm or 0))),
                    "waste_mm": int(c.waste_mm or 0),
                    "status": "planned",
                    "batch_id": c.batch_id,
                }
            )

        locked_rows = (
            db.query(
                HollowcoreCast.cast_date,
                HollowcoreCast.bed_id,
                HollowcoreCast.bed_number,
                HollowcoreCast.cast_slot_index,
                HollowcoreCast.status,
            )
            .filter(HollowcoreCast.factory_id == factory_id)
            .filter(HollowcoreCast.cast_date >= start_date)
            .filter(HollowcoreCast.cast_date <= end_date)
            .filter(HollowcoreCast.status != "planned")
            .filter(
                (HollowcoreCast.bed_id.in_(bed_ids))
                | (HollowcoreCast.bed_number.in_(bed_ids))
            )
            .all()
        )
        for r in locked_rows:
            # Prefer bed_id (v2), but fall back to bed_number for older rows.
            cast_bed = r.bed_id if r.bed_id is not None else r.bed_number
            if cast_bed is None or r.cast_slot_index is None or r.cast_date is None:
                continue
            locked_slots.add((r.cast_date, int(cast_bed), int(r.cast_slot_index)))

    casted: dict[int, int] = dict(
        db.query(
            HollowcoreCast.element_id,
            func.coalesce(func.sum(HollowcoreCast.quantity), 0),
        )
        .filter(HollowcoreCast.factory_id == factory_id)
        .group_by(HollowcoreCast.element_id)
        .all()
    )

    elements = (
        db.query(Element)
        .filter(Element.factory_id == factory_id)
        .filter(Element.active == True)  # noqa: E712
        .filter(Element.panel_length_mm.isnot(None))
        .filter(Element.slab_thickness_mm.isnot(None))
        .order_by(Element.due_date.is_(None), Element.due_date.asc(), Element.id.asc())
        .all()
    )

    remaining: list[dict] = []
    project_ids = {
        int(e.project_id)
        for e in elements
        if getattr(e, "project_id", None) is not None
    }
    project_workdays: dict[int, tuple[bool, bool]] = {}
    if project_ids:
        for p in (
            db.query(Project)
            .filter(Project.factory_id == factory_id)
            .filter(Project.id.in_(project_ids))
            .all()
        ):
            project_workdays[int(p.id)] = (bool(getattr(p, "work_saturday", False)), bool(getattr(p, "work_sunday", False)))

    for e in elements:
        done_qty = int(casted.get(int(e.id), 0) or 0)
        rem = max(0, int(e.quantity or 0) - done_qty)
        if rem <= 0:
            continue
        work_sat, work_sun = project_workdays.get(int(e.project_id), (False, False))
        remaining.append(
            {
                "element_id": e.id,
                "element_mark": e.element_mark,
                "due_date": e.due_date,
                "project_id": int(e.project_id),
                "work_saturday": bool(work_sat),
                "work_sunday": bool(work_sun),
                "panel_length_mm": int(e.panel_length_mm or 0),
                "slab_thickness_mm": int(e.slab_thickness_mm or 0),
                "remaining_qty": rem,
            }
        )

    casts: list[dict[str, Any]] = list(existing_planned_casts)
    # When every element is already fully cast in the DB, there is nothing new to place —
    # but we must still return existing planned rows in range (otherwise draft/auto UI is empty).
    if not remaining:
        return casts, []
    if not beds:
        return casts, _unplaced_snapshot(remaining)

    bed_ids = [int(b.id) for b in beds if b is not None and b.id is not None]
    lost_by_date_bed: dict[tuple[date, int], int] = {}
    lost_by_date_all: dict[date, int] = {}
    if bed_ids:
        rows = (
            db.query(PlannerDelay.delay_date, PlannerDelay.bed_id, func.coalesce(func.sum(PlannerDelay.lost_capacity), 0))
            .filter(PlannerDelay.factory_id == factory_id)
            .filter(PlannerDelay.planner_type == "hollowcore")
            .filter(PlannerDelay.delay_date >= start_date)
            .filter(PlannerDelay.delay_date <= end_date)
            .group_by(PlannerDelay.delay_date, PlannerDelay.bed_id)
            .all()
        )
        for dd, bid, lost in rows:
            if dd is None:
                continue
            if bid is None:
                lost_by_date_all[dd] = int(lost or 0)
            else:
                lost_by_date_bed[(dd, int(bid))] = int(lost or 0)

    idx = 0
    # Keep each bed "sticky" to one slab thickness while that thickness still has work.
    # This reduces extruder moves between beds for same-thickness products.
    bed_thickness_anchor: dict[int, int] = {}
    for d in _daterange(start_date, end_date):
        for bed in beds:
            if not bed.active:
                continue

            margin = int(default_waste_mm or 0)
            available_length = int(bed.length_mm or 0) - 2 * margin
            if available_length <= 0:
                continue

            max_casts = int(bed.max_casts_per_day or 0)
            if max_casts <= 0:
                continue
            lost_slots = int(lost_by_date_all.get(d, 0) or 0) + int(lost_by_date_bed.get((d, int(bed.id)), 0) or 0)
            max_casts = max(0, max_casts - lost_slots)
            if max_casts <= 0:
                continue
            # Fill bed/day capacity before moving to next bed:
            # same thickness first, then switch thickness only if needed.
            slot_index = 0
            for _pour in range(0, max_casts):
                slot_remaining = int(available_length)
                while slot_remaining > 0:
                    # Skip locked slots (already cast/completed in DB).
                    if (d, int(bed.id), int(slot_index)) in locked_slots:
                        slot_index += 1
                        break

                    while idx < len(remaining) and int(remaining[idx]["remaining_qty"] or 0) <= 0:
                        idx += 1
                    if idx >= len(remaining):
                        break

                    bed_id_int = int(bed.id)
                    anchored_thickness = bed_thickness_anchor.get(bed_id_int)
                    candidate_idx = -1
                    candidate_panel_len = 0
                    # First pass: prefer rows with the same slab thickness on this bed.
                    # Second pass: if no match fits, allow switching thickness.
                    for pass_idx in range(2):
                        require_anchor = anchored_thickness is not None and pass_idx == 0
                        for i in range(idx, len(remaining)):
                            cur = remaining[i]
                            if int(cur["remaining_qty"] or 0) <= 0:
                                continue
                            if require_anchor and int(cur.get("slab_thickness_mm") or 0) != int(anchored_thickness):
                                continue
                            if not _is_working_day_for_project(d, bool(cur.get("work_saturday")), bool(cur.get("work_sunday"))):
                                continue
                            panel_len = int(cur["panel_length_mm"] or 0)
                            if panel_len <= 0:
                                continue
                            if int(slot_remaining // panel_len) <= 0:
                                continue
                            candidate_idx = i
                            candidate_panel_len = panel_len
                            break
                        if candidate_idx >= 0:
                            break

                    if candidate_idx < 0:
                        # Nothing else fits in this pour on this bed/day.
                        break

                    cur = remaining[candidate_idx]
                    bed_thickness_anchor[bed_id_int] = int(cur.get("slab_thickness_mm") or 0)
                    panel_len = candidate_panel_len
                    panels_fit = int(slot_remaining // panel_len)
                    qty = min(panels_fit, int(cur["remaining_qty"]))
                    if qty <= 0:
                        break

                    used_length = qty * panel_len
                    slot_remaining -= used_length
                    waste = int(slot_remaining)

                    casts.append(
                        {
                            "cast_date": d,
                            "bed_id": bed.id,
                            "cast_slot_index": int(slot_index),
                            "element_id": cur["element_id"],
                            "panel_length_mm": panel_len,
                            "slab_thickness_mm": int(cur["slab_thickness_mm"] or 0),
                            "quantity": qty,
                            "used_length_mm": used_length,
                            "waste_mm": waste,
                            "effective_available_length_mm": available_length,
                        }
                    )
                    slot_index += 1

                    cur["remaining_qty"] = int(cur["remaining_qty"]) - qty
                    if candidate_idx == idx and cur["remaining_qty"] <= 0:
                        idx += 1

                if idx >= len(remaining):
                    break

    return casts, _unplaced_snapshot(remaining)

