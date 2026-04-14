# File overview: API route handlers and request orchestration for app/routers/dashboard.py.
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from ..database import get_db
from ..auth.dependencies import get_current_factory_id, get_current_user, require_role
from ..models.user import User
from ..models.production import ProductionSchedule
from ..models.mould import Mould
from ..models.element import Element
from ..models.project import Project
from ..models.element_mould import ElementMould
from ..models.hollowcore_cast import HollowcoreCast
from ..models.yard import YardInventory
from ..models.yard_location import YardLocation
from ..models.dispatch import DispatchOrder
from ..models.dispatch_item import DispatchItem
from ..models.quality import QualityTest
from ..services.qc_lab_queue import build_qc_lab_queue

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
ACTIVE_PROJECT_STATUSES = ("planned", "active")


# Handles  normalize planned label flow.
def _normalize_planned_label(label: str) -> str:
    const = (label or "").strip()
    lower = const.lower()
    if lower in ["beam", "beams"]:
        return "Beams"
    if lower in ["column", "columns"]:
        return "Columns"
    return const or "Other"


# -----------------------------
# Production summary dashboard
# -----------------------------
@router.get("/production")
# Handles production dashboard flow.
def production_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    factory_id = get_current_factory_id(current_user)
    results = (
        db.query(
            ProductionSchedule.production_date,
            Mould.name.label("mould"),
            Element.element_type.label("element_type"),
            ProductionSchedule.quantity,
        )
        .join(Mould, ProductionSchedule.mould_id == Mould.id)
        .join(Element, ProductionSchedule.element_id == Element.id)
        .filter(ProductionSchedule.factory_id == factory_id)
        .order_by(ProductionSchedule.production_date)
        .all()
    )

    return [
        {
            "production_date": r.production_date,
            "mould": r.mould,
            "element_type": r.element_type,
            "quantity": r.quantity,
        }
        for r in results
    ]


# -----------------------------
# Production calendar view
# -----------------------------
@router.get("/calendar")
# Handles production calendar flow.
def production_calendar(
    include_inactive_projects: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    factory_id = get_current_factory_id(current_user)
    q = (
        db.query(
            ProductionSchedule.id.label("id"),
            ProductionSchedule.production_date,
            ProductionSchedule.mould_id.label("mould_id"),
            Mould.name.label("mould"),
            Project.id.label("project_id"),
            Project.project_name.label("project_name"),
            Project.due_date.label("project_due_date"),
            Element.element_type,
            Element.element_mark,
            Element.due_date.label("element_due_date"),
            Element.requires_cubes,
            ProductionSchedule.batch_id,
            ProductionSchedule.quantity,
            ProductionSchedule.status,
        )
        .join(Mould, ProductionSchedule.mould_id == Mould.id)
        .join(Element, ProductionSchedule.element_id == Element.id)
        .join(Project, Element.project_id == Project.id)
        .filter(
            ProductionSchedule.factory_id == factory_id,
            Element.factory_id == factory_id,
            Project.factory_id == factory_id,
        )
    )
    if not include_inactive_projects:
        q = q.filter(Project.status.in_(ACTIVE_PROJECT_STATUSES))
    results = q.order_by(ProductionSchedule.production_date).all()

    return [
        {
            "id": r.id,
            "production_date": r.production_date,
            "mould_id": r.mould_id,
            "mould": r.mould,
            "project_id": r.project_id,
            "project_name": r.project_name,
            "project_due_date": r.project_due_date,
            "element_type": r.element_type,
            "element_mark": r.element_mark,
            "element_due_date": r.element_due_date,
            "requires_cubes": r.requires_cubes,
            "batch_id": r.batch_id,
            "quantity": r.quantity,
            "status": r.status,
        }
        for r in results
    ]


# -----------------------------
# Mould Utilization Dashboard
# -----------------------------
@router.get("/mould-utilization")
# Handles mould utilization flow.
def mould_utilization(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    factory_id = get_current_factory_id(current_user)
    results = (
        db.query(
            Mould.id,
            Mould.name,
            Mould.capacity,
            ProductionSchedule.quantity,
        )
        .outerjoin(
            ProductionSchedule,
            (ProductionSchedule.mould_id == Mould.id)
            & (ProductionSchedule.factory_id == factory_id),
        )
        .filter(Mould.factory_id == factory_id)
        .all()
    )

    utilisation = {}

    for r in results:
        if r.id not in utilisation:
            utilisation[r.id] = {
                "mould": r.name,
                "capacity": r.capacity,
                "scheduled": 0,
            }

        if r.quantity:
            utilisation[r.id]["scheduled"] += r.quantity

    output = []

    for m in utilisation.values():

        capacity = m["capacity"]
        scheduled = m["scheduled"]

        utilization_percent = 0
        if capacity > 0:
            utilization_percent = round((scheduled / capacity) * 100, 1)

        output.append(
            {
                "mould": m["mould"],
                "capacity": capacity,
                "scheduled": scheduled,
                "utilization_percent": utilization_percent
            }
        )

    return output


# -----------------------------
# Yard Stock Dashboard
# -----------------------------
@router.get("/yard-stock")
# Handles yard stock flow.
def yard_stock(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    factory_id = get_current_factory_id(current_user)
    results = (
        db.query(
            Element.element_type,
            Element.element_mark,
            YardLocation.name.label("location"),
            YardInventory.quantity
        )
        .join(Element, YardInventory.element_id == Element.id)
        .join(YardLocation, YardInventory.location_id == YardLocation.id)
        .filter(YardInventory.factory_id == factory_id)
        .order_by(Element.element_mark)
        .all()
    )

    return [
        {
            "element_type": r.element_type,
            "element_mark": r.element_mark,
            "location": r.location,
            "quantity": r.quantity,
        }
        for r in results
    ]


@router.get("/overview")
# Handles overview flow.
def overview(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    High-level KPI snapshot for the dashboard.
    """
    today = date.today()
    factory_id = get_current_factory_id(current_user)

    # Non-hollowcore "today"
    todays = (
        db.query(ProductionSchedule)
        .filter(ProductionSchedule.production_date == today)
        .filter(ProductionSchedule.factory_id == factory_id)
        .all()
    )

    production_todays_units = sum(s.quantity for s in todays)
    production_todays_count = len(todays)
    production_todays_completed = sum(1 for s in todays if s.status == "completed")

    # Hollowcore "today"
    hollowcore_todays = (
        db.query(HollowcoreCast)
        .join(Element, HollowcoreCast.element_id == Element.id)
        .filter(HollowcoreCast.cast_date == today)
        .filter(Element.factory_id == factory_id)
        .all()
    )
    hollowcore_todays_units = sum(c.quantity for c in hollowcore_todays)
    hollowcore_todays_count = len(hollowcore_todays)
    hollowcore_todays_completed = sum(1 for c in hollowcore_todays if c.status == "completed")

    # Combined KPI for dashboard cards
    todays_units = production_todays_units + hollowcore_todays_units
    todays_count = production_todays_count + hollowcore_todays_count
    todays_completed = production_todays_completed + hollowcore_todays_completed

    # Late scheduled items: scheduled after element/project due date
    calendar = production_calendar(
        include_inactive_projects=False,
        db=db,
        current_user=current_user,
    )
    late_items = 0
    for row in calendar:
        due = row.get("element_due_date") or row.get("project_due_date")
        if due and row["production_date"] > due:
            late_items += 1

    # Unscheduled elements: planned/scheduled elements with no compatible moulds selected
    active_elements = (
        db.query(Element)
        .filter(Element.status.in_(["planned", "scheduled"]))
        # Exclude Hollowcore panel elements (they are planned via the Hollowcore planner).
        .filter(or_(Element.panel_length_mm.is_(None), Element.slab_thickness_mm.is_(None)))
        .filter(Element.factory_id == factory_id)
        .all()
    )
    element_ids = [e.id for e in active_elements]
    mould_links = set()
    if element_ids:
        mould_links = set(
            db.query(ElementMould.element_id)
            .filter(ElementMould.element_id.in_(element_ids))
            .all()
        )
    unscheduled_elements = sum(1 for e in active_elements if (e.id,) not in mould_links)

    # Projects at risk: any schedule row for that project after project due date
    projects = db.query(Project).filter(Project.factory_id == factory_id).all()
    project_due = {p.id: p.due_date for p in projects}
    latest_by_project = {}
    for row in calendar:
        pid = row["project_id"]
        latest_by_project[pid] = max(latest_by_project.get(pid, row["production_date"]), row["production_date"])

    projects_at_risk = []
    for pid, last_dt in latest_by_project.items():
        due = project_due.get(pid)
        if due and last_dt > due:
            p = next((x for x in projects if x.id == pid), None)
            projects_at_risk.append(
                {
                    "project_id": pid,
                    "project_name": p.project_name if p else f"Project #{pid}",
                    "due_date": due,
                    "last_scheduled_date": last_dt,
                    "days_late": (last_dt - due).days,
                }
            )

    projects_at_risk.sort(key=lambda x: x["days_late"], reverse=True)

    # Hollowcore attention needed (computed from existing hollowcore casts)
    # - "Unscheduled" approximated as: total cast quantity for a hollowcore element < element.quantity.
    # - "Late" computed as: max cast date > element due date (element.due_date or project.due_date).
    # Match hollowcore_planner_v2: only active elements; scope casts via element factory (not stale rows).
    hollowcore_elements = (
        db.query(Element)
        .filter(Element.active == True)  # noqa: E712
        .filter(Element.panel_length_mm.isnot(None))
        .filter(Element.slab_thickness_mm.isnot(None))
        .filter(or_(Element.status.is_(None), Element.status.in_(["planned", "scheduled"])))
        .filter(Element.factory_id == factory_id)
        .all()
    )
    hollowcore_ids = [e.id for e in hollowcore_elements]
    hollowcore_cast_qty: dict[int, int] = {}
    hollowcore_last_cast_date: dict[int, date] = {}
    if hollowcore_ids:
        cast_rows = (
            db.query(
                HollowcoreCast.element_id,
                func.coalesce(func.sum(HollowcoreCast.quantity), 0).label("cast_qty"),
                func.max(HollowcoreCast.cast_date).label("last_cast_date"),
            )
            .join(Element, HollowcoreCast.element_id == Element.id)
            .filter(Element.factory_id == factory_id)
            .filter(HollowcoreCast.element_id.in_(hollowcore_ids))
            .group_by(HollowcoreCast.element_id)
            .all()
        )
        for r in cast_rows:
            hollowcore_cast_qty[r.element_id] = int(r.cast_qty or 0)
            if r.last_cast_date is not None:
                hollowcore_last_cast_date[r.element_id] = r.last_cast_date

    hollowcore_unscheduled_elements = 0
    hollowcore_unscheduled_detail: list[dict] = []
    hollowcore_late_elements = 0
    for e in hollowcore_elements:
        cast_qty = hollowcore_cast_qty.get(e.id, 0)
        order_qty = int(e.quantity or 0)
        if cast_qty < order_qty:
            hollowcore_unscheduled_elements += 1
            hollowcore_unscheduled_detail.append(
                {
                    "element_id": int(e.id),
                    "element_mark": e.element_mark,
                    "order_quantity": order_qty,
                    "scheduled_quantity": cast_qty,
                    "remaining": order_qty - cast_qty,
                }
            )

        due = e.due_date or (e.project.due_date if e.project else None)
        last_dt = hollowcore_last_cast_date.get(e.id)
        if due is not None and last_dt is not None and last_dt > due:
            hollowcore_late_elements += 1

    dispatch_orders_planned = int(
        db.query(func.count(DispatchOrder.id))
        .filter(DispatchOrder.factory_id == factory_id, DispatchOrder.status == "planned")
        .scalar()
        or 0
    )

    dispatch_orders_planned_with_items = (
        db.query(DispatchOrder.id)
        .join(DispatchItem, DispatchItem.dispatch_id == DispatchOrder.id)
        .filter(DispatchOrder.factory_id == factory_id, DispatchOrder.status == "planned")
        .distinct()
        .count()
    )

    yard_inventory_lines = int(
        db.query(func.count(YardInventory.id)).filter(YardInventory.factory_id == factory_id).scalar() or 0
    )

    hollowcore_planned_casts_today = int(
        db.query(func.count(HollowcoreCast.id))
        .join(Element, HollowcoreCast.element_id == Element.id)
        .filter(
            HollowcoreCast.cast_date == today,
            Element.factory_id == factory_id,
            HollowcoreCast.status == "planned",
        )
        .scalar()
        or 0
    )

    _qc_lab = build_qc_lab_queue(db, factory_id)
    qc_lab_overdue = len(_qc_lab["overdue"])
    qc_lab_due_today = len(_qc_lab["today"])
    qc_lab_due_tomorrow = len(_qc_lab["tomorrow"])

    # Recorded tests with no pass/fail yet where test_date is today or in the past (entry overdue).
    qc_manual_results_pending = int(
        db.query(func.count(QualityTest.id))
        .join(Element, QualityTest.element_id == Element.id)
        .filter(
            Element.factory_id == factory_id,
            QualityTest.passed.is_(None),
            QualityTest.test_date <= today,
            QualityTest.test_date >= today - timedelta(days=365),
        )
        .scalar()
        or 0
    )

    return {
        "today": today,
        "todays_units": todays_units,
        "todays_schedules": todays_count,
        "todays_completed": todays_completed,
        # These KPI values are for non-hollowcore schedules only.
        # The dashboard UI can combine them with the hollowcore counts if needed.
        "late_scheduled_items": late_items,
        "unscheduled_elements": unscheduled_elements,
        "hollowcore_late_elements": hollowcore_late_elements,
        "hollowcore_unscheduled_elements": hollowcore_unscheduled_elements,
        "hollowcore_unscheduled_detail": hollowcore_unscheduled_detail,
        "projects_at_risk": projects_at_risk[:10],
        "dispatch_orders_planned": dispatch_orders_planned,
        "dispatch_orders_planned_with_items": dispatch_orders_planned_with_items,
        "yard_inventory_lines": yard_inventory_lines,
        "hollowcore_planned_casts_today": hollowcore_planned_casts_today,
        "qc_lab_overdue": qc_lab_overdue,
        "qc_lab_due_today": qc_lab_due_today,
        "qc_lab_due_tomorrow": qc_lab_due_tomorrow,
        "qc_manual_results_pending": qc_manual_results_pending,
    }


@router.get("/planned-by-type")
# Handles planned by type flow.
def planned_by_type(
    planned_date: Optional[date] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Breakdown of production planned for a given day by element type.

    - Non-hollowcore: grouped by Element.element_type from ProductionSchedule
    - Hollowcore: aggregated into a single "Hollowcore" bucket from HollowcoreCast
    """
    target = planned_date or date.today()
    factory_id = get_current_factory_id(current_user)

    # Hollowcore elements: both panel_length_mm + slab_thickness_mm are set.
    hollowcore_non_null_filter = [
        Element.panel_length_mm.isnot(None),
        Element.slab_thickness_mm.isnot(None),
    ]
    non_hollowcore_null_filter = [
        or_(Element.panel_length_mm.is_(None), Element.slab_thickness_mm.is_(None)),
    ]

    # Non-hollowcore buckets.
    scheduled_rows = (
        db.query(
            Element.element_type.label("element_type"),
            func.coalesce(func.sum(ProductionSchedule.quantity), 0).label("qty"),
        )
        .join(Element, ProductionSchedule.element_id == Element.id)
        .filter(ProductionSchedule.production_date == target)
        .filter(ProductionSchedule.factory_id == factory_id)
        .filter(*non_hollowcore_null_filter)
        .group_by(Element.element_type)
        .all()
    )

    items: list[dict[str, str | int]] = []
    for r in scheduled_rows:
        items.append({"label": _normalize_planned_label(r.element_type), "value": int(r.qty or 0)})

    # Hollowcore bucket.
    hollowcore_qty_row = (
        db.query(func.coalesce(func.sum(HollowcoreCast.quantity), 0).label("qty"))
        .join(Element, HollowcoreCast.element_id == Element.id)
        .filter(HollowcoreCast.cast_date == target)
        .filter(Element.factory_id == factory_id)
        .filter(*hollowcore_non_null_filter)
        .one()
    )

    hollowcore_qty = int(hollowcore_qty_row.qty or 0)
    if hollowcore_qty > 0:
        items.append({"label": "Hollowcore", "value": hollowcore_qty})

    # Remove zeros and sort for stable display.
    items = [i for i in items if int(i["value"]) > 0]
    items.sort(key=lambda x: -int(x["value"]))
    return items


@router.get("/capacity")
# Handles capacity flow.
def capacity(
    days: int = 14,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Capacity view for the next N days.

    Daily capacity respects cycle_time_hours:
      dailyCapacity = capacity * max(1, floor(24 / cycle_time_hours))
    """
    if days < 1:
        days = 1
    if days > 60:
        days = 60

    start = date.today()
    end = start + timedelta(days=days - 1)

    factory_id = get_current_factory_id(current_user)
    moulds = (
        db.query(Mould)
        .filter(Mould.active == True)
        .filter(Mould.factory_id == factory_id)
        .order_by(Mould.name)
        .all()
    )
    mould_by_id = {m.id: m for m in moulds}

    # Precompute capacity per mould
    cap_by_mould = {}
    for m in moulds:
        try:
            cycle = float(m.cycle_time_hours)
        except Exception:
            cycle = 24.0
        if cycle <= 0:
            cycles_per_day = 1
        else:
            cycles_per_day = int(24 // cycle)
            if cycles_per_day < 1:
                cycles_per_day = 1
        cap_by_mould[m.id] = m.capacity * cycles_per_day

    # Used qty per mould per day (planned + completed both count against capacity)
    rows = (
        db.query(
            ProductionSchedule.mould_id,
            ProductionSchedule.production_date,
            func.coalesce(func.sum(ProductionSchedule.quantity), 0).label("used"),
        )
        .filter(ProductionSchedule.factory_id == factory_id)
        .filter(ProductionSchedule.production_date >= start, ProductionSchedule.production_date <= end)
        .group_by(ProductionSchedule.mould_id, ProductionSchedule.production_date)
        .all()
    )

    used_map = {}
    for r in rows:
        used_map[(r.mould_id, r.production_date)] = int(r.used or 0)

    # Build output
    dates = [start + timedelta(days=i) for i in range(days)]
    out = []
    for m in moulds:
        series = []
        for d in dates:
            used = used_map.get((m.id, d), 0)
            cap = cap_by_mould.get(m.id, m.capacity)
            series.append(
                {
                    "date": d,
                    "used": used,
                    "capacity": cap,
                    "free": max(0, cap - used),
                    "utilization_percent": round((used / cap) * 100, 1) if cap else 0,
                }
            )
        out.append(
            {
                "mould_id": m.id,
                "mould": m.name,
                "mould_type": m.mould_type,
                "cycle_time_hours": m.cycle_time_hours,
                "series": series,
            }
        )

    return {"start": start, "days": days, "moulds": out}


@router.get("/production-completion")
# Handles production completion flow.
def production_completion(
    start_date: Optional[date] = Query(None, alias="start_date"),
    end_date: Optional[date] = Query(None, alias="end_date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "production", "admin"])),
):
    """
    Production completion summary per day.

    Includes:
    - Non-hollowcore ProductionSchedule quantities (planned/completed)
    - HollowcoreCast quantities (planned/completed)
    """
    factory_id = get_current_factory_id(current_user)
    start = start_date or (date.today() - timedelta(days=14))
    end = end_date or (date.today() + timedelta(days=14))
    if end < start:
        start, end = end, start

    # Non-hollowcore schedules by day/status
    sched_rows = (
        db.query(
            ProductionSchedule.production_date.label("d"),
            ProductionSchedule.status.label("status"),
            func.coalesce(func.sum(ProductionSchedule.quantity), 0).label("qty"),
        )
        .filter(ProductionSchedule.factory_id == factory_id)
        .filter(ProductionSchedule.production_date >= start, ProductionSchedule.production_date <= end)
        .group_by(ProductionSchedule.production_date, ProductionSchedule.status)
        .all()
    )

    # Hollowcore casts by day/status (factory via Element.factory_id)
    cast_rows = (
        db.query(
            HollowcoreCast.cast_date.label("d"),
            HollowcoreCast.status.label("status"),
            func.coalesce(func.sum(HollowcoreCast.quantity), 0).label("qty"),
        )
        .join(Element, HollowcoreCast.element_id == Element.id)
        .filter(Element.factory_id == factory_id)
        .filter(HollowcoreCast.cast_date >= start, HollowcoreCast.cast_date <= end)
        .group_by(HollowcoreCast.cast_date, HollowcoreCast.status)
        .all()
    )

    # Assemble per-day output
    day_map: dict[date, dict] = {}
    for i in range((end - start).days + 1):
        d = start + timedelta(days=i)
        day_map[d] = {
            "date": d,
            "non_hollowcore_planned_qty": 0,
            "non_hollowcore_completed_qty": 0,
            "hollowcore_planned_qty": 0,
            "hollowcore_completed_qty": 0,
        }

    for r in sched_rows:
        d = r.d
        if d not in day_map:
            continue
        if (r.status or "") == "completed":
            day_map[d]["non_hollowcore_completed_qty"] += int(r.qty or 0)
        else:
            day_map[d]["non_hollowcore_planned_qty"] += int(r.qty or 0)

    for r in cast_rows:
        d = r.d
        if d not in day_map:
            continue
        if (r.status or "") == "completed":
            day_map[d]["hollowcore_completed_qty"] += int(r.qty or 0)
        else:
            day_map[d]["hollowcore_planned_qty"] += int(r.qty or 0)

    out = list(day_map.values())
    out.sort(key=lambda x: x["date"])
    return out


@router.get("/late-items")
# Handles late items flow.
def late_items(
    start_date: Optional[date] = Query(None, alias="start_date"),
    end_date: Optional[date] = Query(None, alias="end_date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    """
    Export-friendly list of items scheduled after their due date.
    """
    factory_id = get_current_factory_id(current_user)
    start = start_date or (date.today() - timedelta(days=30))
    end = end_date or (date.today() + timedelta(days=90))
    if end < start:
        start, end = end, start

    rows = (
        db.query(
            ProductionSchedule.id.label("schedule_id"),
            ProductionSchedule.production_date.label("production_date"),
            ProductionSchedule.status.label("status"),
            ProductionSchedule.quantity.label("quantity"),
            Mould.name.label("mould"),
            Project.id.label("project_id"),
            Project.project_name.label("project_name"),
            Project.due_date.label("project_due_date"),
            Element.id.label("element_id"),
            Element.element_mark.label("element_mark"),
            Element.element_type.label("element_type"),
            Element.due_date.label("element_due_date"),
        )
        .join(Mould, ProductionSchedule.mould_id == Mould.id)
        .join(Element, ProductionSchedule.element_id == Element.id)
        .join(Project, Element.project_id == Project.id)
        .filter(ProductionSchedule.factory_id == factory_id)
        .filter(ProductionSchedule.production_date >= start, ProductionSchedule.production_date <= end)
        .all()
    )

    out = []
    for r in rows:
        due = r.element_due_date or r.project_due_date
        if due is None:
            continue
        if r.production_date and r.production_date > due:
            out.append(
                {
                    "schedule_id": r.schedule_id,
                    "production_date": r.production_date,
                    "status": r.status,
                    "quantity": r.quantity,
                    "mould": r.mould,
                    "project_id": r.project_id,
                    "project_name": r.project_name,
                    "project_due_date": r.project_due_date,
                    "element_id": r.element_id,
                    "element_mark": r.element_mark,
                    "element_type": r.element_type,
                    "element_due_date": r.element_due_date,
                    "effective_due_date": due,
                    "days_late": (r.production_date - due).days,
                }
            )

    out.sort(key=lambda x: (x["days_late"], x["production_date"]), reverse=True)
    return out


@router.get("/project-summaries")
# Handles project summaries flow.
def project_summaries(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    """
    Per-project export summary for the current factory.
    """
    factory_id = get_current_factory_id(current_user)
    today = date.today()

    projects = (
        db.query(Project)
        .filter(Project.factory_id == factory_id)
        .order_by(Project.due_date.is_(None), Project.due_date.asc(), Project.id.asc())
        .all()
    )
    project_ids = [p.id for p in projects]
    if not project_ids:
        return []

    # Element totals per project
    elem_totals: dict[int, dict] = {}
    for pid, cnt, qty_total in (
        db.query(
            Element.project_id,
            func.count(Element.id).label("element_count"),
            func.coalesce(func.sum(Element.quantity), 0).label("element_qty_total"),
        )
        .filter(Element.factory_id == factory_id)
        .filter(Element.project_id.in_(project_ids))
        .group_by(Element.project_id)
        .all()
    ):
        elem_totals[int(pid)] = {
            "element_count": int(cnt or 0),
            "element_qty_total": int(qty_total or 0),
        }

    # Non-hollowcore produced qty per project
    prod_completed: dict[int, int] = {}
    for pid, qty in (
        db.query(
            Element.project_id,
            func.coalesce(func.sum(ProductionSchedule.quantity), 0).label("qty"),
        )
        .join(Element, ProductionSchedule.element_id == Element.id)
        .filter(ProductionSchedule.factory_id == factory_id)
        .filter(Element.factory_id == factory_id)
        .filter(Element.project_id.in_(project_ids))
        .filter(ProductionSchedule.status == "completed")
        .group_by(Element.project_id)
        .all()
    ):
        prod_completed[int(pid)] = int(qty or 0)

    # Hollowcore produced qty per project
    hc_completed: dict[int, int] = {}
    for pid, qty in (
        db.query(
            Element.project_id,
            func.coalesce(func.sum(HollowcoreCast.quantity), 0).label("qty"),
        )
        .join(Element, HollowcoreCast.element_id == Element.id)
        .filter(Element.factory_id == factory_id)
        .filter(Element.project_id.in_(project_ids))
        .filter(HollowcoreCast.status == "completed")
        .group_by(Element.project_id)
        .all()
    ):
        hc_completed[int(pid)] = int(qty or 0)

    # Last scheduled date per project (non-hollowcore)
    last_sched: dict[int, date] = {}
    for pid, last_date in (
        db.query(
            Element.project_id,
            func.max(ProductionSchedule.production_date).label("last_date"),
        )
        .join(Element, ProductionSchedule.element_id == Element.id)
        .filter(ProductionSchedule.factory_id == factory_id)
        .filter(Element.factory_id == factory_id)
        .filter(Element.project_id.in_(project_ids))
        .group_by(Element.project_id)
        .all()
    ):
        if last_date is not None:
            last_sched[int(pid)] = last_date

    # Last cast date per project (hollowcore)
    last_cast: dict[int, date] = {}
    for pid, last_date in (
        db.query(
            Element.project_id,
            func.max(HollowcoreCast.cast_date).label("last_date"),
        )
        .join(Element, HollowcoreCast.element_id == Element.id)
        .filter(Element.factory_id == factory_id)
        .filter(Element.project_id.in_(project_ids))
        .group_by(Element.project_id)
        .all()
    ):
        if last_date is not None:
            last_cast[int(pid)] = last_date

    out = []
    for p in projects:
        totals = elem_totals.get(p.id) or {}
        element_count = int(totals.get("element_count", 0) or 0)
        element_qty_total = int(totals.get("element_qty_total", 0) or 0)

        produced_non_hc = int(prod_completed.get(p.id, 0) or 0)
        produced_hc = int(hc_completed.get(p.id, 0) or 0)
        produced_total = produced_non_hc + produced_hc

        remaining_qty_est = max(0, element_qty_total - produced_total)

        last_date = max(
            [d for d in [last_sched.get(p.id), last_cast.get(p.id)] if d is not None],
            default=None,
        )

        due = p.due_date
        days_to_due = (due - today).days if due is not None else None
        is_late = bool(due is not None and last_date is not None and last_date > due)

        out.append(
            {
                "project_id": p.id,
                "project_name": p.project_name,
                "client": p.client,
                "status": p.status,
                "start_date": p.start_date,
                "due_date": p.due_date,
                "days_to_due": days_to_due,
                "element_count": element_count,
                "element_qty_total": element_qty_total,
                "produced_qty_non_hollowcore": produced_non_hc,
                "produced_qty_hollowcore": produced_hc,
                "produced_qty_total": produced_total,
                "remaining_qty_est": remaining_qty_est,
                "last_scheduled_or_cast_date": last_date,
                "is_late": is_late,
            }
        )

    return out