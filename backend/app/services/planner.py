from sqlalchemy.orm import Session
from datetime import date, timedelta
import uuid

from ..models.element import Element
from ..models.project import Project
from ..models.production import ProductionSchedule
from .public_holidays import is_south_africa_public_holiday

from .capacity import check_mould_capacity
from sqlalchemy import or_
ACTIVE_PROJECT_STATUSES = ("planned", "active")

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


def _next_working_day(d: date, work_saturday: bool, work_sunday: bool) -> date:
    cur = d
    while not _is_working_day(cur, work_saturday, work_sunday):
        cur = cur + timedelta(days=1)
    return cur


def generate_production_plan(db: Session, factory_id: int):
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
    # The UI may set status to "scheduled" immediately, so include that too.
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
        .filter(Element.factory_id == factory_id)
        # Hollowcore panel elements are scheduled via the hollowcore planner only.
        # Treat an element as hollowcore when both panel_length_mm and slab_thickness_mm are set.
        .filter(or_(Element.panel_length_mm.is_(None), Element.slab_thickness_mm.is_(None)))
        .all()
    )

    today_global = date.today()
    scheduled_batches = 0
    unscheduled = []
    late = []

    for element in elements:
        project = element.project
        work_saturday = bool(getattr(project, "work_saturday", False))
        work_sunday = bool(getattr(project, "work_sunday", False))
        start_from = getattr(project, "start_date", None) or today_global
        current_day = _next_working_day(max(today_global, start_from), work_saturday, work_sunday)
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

        remaining = element.quantity
        last_date: date | None = None

        while remaining > 0:

            for mould in allowed_moulds:

                production_date = current_day

                quantity = min(mould.capacity, remaining)

                # 🔹 CAPACITY CHECK
                ok, msg = check_mould_capacity(
                    db,
                    mould.id,
                    factory_id,
                    production_date,
                    quantity
                )

                if not ok:
                    continue

                schedule = ProductionSchedule(
                    element_id=element.id,
                    mould_id=mould.id,
                    factory_id=factory_id,
                    production_date=production_date,
                    quantity=quantity,
                    status="planned"
                )

                db.add(schedule)
                # Session autoflush is disabled; flush to make capacity checks consistent
                # within the same planning run.
                db.flush()
                if getattr(element, "requires_cubes", False) and not schedule.batch_id:
                    schedule.batch_id = f"CUBE-{production_date.strftime('%Y%m%d')}-{schedule.id}-{uuid.uuid4().hex[:6].upper()}"
                scheduled_batches += 1
                last_date = production_date

                remaining -= quantity

                if remaining <= 0:
                    break

            current_day = _next_working_day(current_day + timedelta(days=1), work_saturday, work_sunday)

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
        "message": "Production plan generated",
        "scheduled_batches": scheduled_batches,
        "unscheduled": unscheduled,
        "late": late,
    }