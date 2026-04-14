# File overview: Business logic services for app/services/auto_planner.py.
from datetime import date, timedelta
import uuid
from sqlalchemy.orm import Session

from ..models.element import Element
from ..models.project import Project
from ..models.mould import Mould
from ..models.production import ProductionSchedule
from .public_holidays import is_south_africa_public_holiday
from sqlalchemy import or_
ACTIVE_PROJECT_STATUSES = ("planned", "active")

# Handles  is working day flow.
def _is_working_day(d: date, work_saturday: bool, work_sunday: bool) -> bool:
    # South Africa public holidays are treated as non-working days by default.
    if is_south_africa_public_holiday(d):
        return False
    wd = d.weekday()
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


# Handles auto plan production flow.
def auto_plan_production(db: Session, factory_id: int):
    # First clear all non-completed non-hollowcore schedules in this factory.
    # This removes stale planned rows from suspended/cancelled/completed projects
    # so capacity is actually freed before we rebuild the plan.
    non_hollowcore_element_ids = [
        row[0]
        for row in (
            db.query(Element.id)
            .filter(Element.factory_id == factory_id)
            .filter(or_(Element.panel_length_mm.is_(None), Element.slab_thickness_mm.is_(None)))
            .all()
        )
    ]
    if non_hollowcore_element_ids:
        db.query(ProductionSchedule).filter(
            ProductionSchedule.element_id.in_(non_hollowcore_element_ids),
            ProductionSchedule.factory_id == factory_id,
            ProductionSchedule.status != "completed",
        ).delete(synchronize_session=False)
        db.commit()

    # Allow scheduling for elements that are not completed/cancelled.
    elements = (
        db.query(Element)
        .join(Project, Project.id == Element.project_id)
        .filter(
            or_(
                Element.status.is_(None),
                Element.status.in_(["planned", "scheduled"]),
            )
        )
        .filter(Project.status.in_(ACTIVE_PROJECT_STATUSES))
        .filter(Project.factory_id == factory_id)
        # Hollowcore panel elements are scheduled via the hollowcore planner only.
        .filter(or_(Element.panel_length_mm.is_(None), Element.slab_thickness_mm.is_(None)))
        .filter(Element.factory_id == factory_id)
        .all()
    )

    schedules_created = []
    unscheduled = []
    late = []

    # Handles  daily capacity flow.
    def _daily_capacity(mould: Mould) -> int:
        """
        Capacity per day considering mould cycle time.
        If cycle_time_hours=24 => 1 cycle/day => capacity.
        If cycle_time_hours=12 => 2 cycles/day => 2*capacity.
        """
        try:
            cycle = float(mould.cycle_time_hours)
        except Exception:
            cycle = 24.0

        if cycle <= 0:
            cycles_per_day = 1
        else:
            cycles_per_day = int(24 // cycle)
            if cycles_per_day < 1:
                cycles_per_day = 1

        return mould.capacity * cycles_per_day

    for element in elements:
        project = element.project
        work_saturday = bool(getattr(project, "work_saturday", False))
        work_sunday = bool(getattr(project, "work_sunday", False))
        start_from = getattr(project, "start_date", None) or date.today()
        production_day = _next_working_day(max(date.today(), start_from), work_saturday, work_sunday)
        due = element.due_date or getattr(project, "due_date", None)

        allowed_moulds = [m for m in (element.allowed_moulds or []) if m.active]
        if not allowed_moulds:
            unscheduled.append(
                {
                    "element_id": element.id,
                    "element_mark": element.element_mark,
                    "element_type": element.element_type,
                    "reason": "No compatible moulds selected",
                }
            )
            continue

        remaining_qty = element.quantity
        last_date: date | None = None

        while remaining_qty > 0:

            # Try to fit into any allowed mould with free capacity on this day.
            placed = False

            for mould in allowed_moulds:
                capacity = _daily_capacity(mould)

                scheduled_today = (
                    db.query(ProductionSchedule)
                    .filter(
                        ProductionSchedule.mould_id == mould.id,
                        ProductionSchedule.production_date == production_day,
                        ProductionSchedule.factory_id == factory_id,
                    )
                    .with_entities(ProductionSchedule.quantity)
                    .all()
                )

                used_capacity = sum([x[0] for x in scheduled_today]) if scheduled_today else 0
                free_capacity = capacity - used_capacity

                if free_capacity <= 0:
                    continue

                qty_to_schedule = min(remaining_qty, free_capacity)

                schedule = ProductionSchedule(
                    element_id=element.id,
                    mould_id=mould.id,
                    factory_id=factory_id,
                    production_date=production_day,
                    quantity=qty_to_schedule,
                    status="planned"
                )

                db.add(schedule)
                # Session autoflush is disabled in this project; flush so subsequent
                # capacity checks see rows added in this planning run.
                db.flush()
                if getattr(element, "requires_cubes", False) and not schedule.batch_id:
                    schedule.batch_id = f"CUBE-{production_day.strftime('%Y%m%d')}-{schedule.id}-{uuid.uuid4().hex[:6].upper()}"
                schedules_created.append(schedule)
                remaining_qty -= qty_to_schedule
                last_date = production_day
                placed = True

                if remaining_qty <= 0:
                    break

            if not placed:
                production_day = _next_working_day(production_day + timedelta(days=1), work_saturday, work_sunday)

        if due is not None and last_date is not None and last_date > due:
            late.append(
                {
                    "element_id": element.id,
                    "element_mark": element.element_mark,
                    "element_type": element.element_type,
                    "due_date": due,
                    "last_scheduled_date": last_date,
                }
            )

    db.commit()

    return {
        "scheduled_batches": len(schedules_created),
        "unscheduled": unscheduled,
        "late": late,
    }