"""Shared QC lab worklist logic (cube crush schedule) for /qc/queue and dashboard metrics."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from ..models.element import Element
from ..models.hollowcore_cast import HollowcoreCast
from ..models.hollowcore_settings import HollowcoreSettings
from ..models.mix_design import MixDesign
from ..models.production import ProductionSchedule
from ..models.project import Project
from ..models.quality import QualityTest


def build_qc_lab_queue(db: Session, factory_id: int) -> Dict[str, Any]:
    """
    Same rules as GET /qc/queue: batches needing 7d/28d (and hollowcore 1d) tests,
    split into overdue / due today / due tomorrow.
    """
    today = date.today()
    tomorrow = today + timedelta(days=1)
    earliest = today - timedelta(days=90)

    production_rows = (
        db.query(
            ProductionSchedule.id.label("schedule_id"),
            ProductionSchedule.production_date.label("production_date"),
            ProductionSchedule.quantity.label("quantity"),
            ProductionSchedule.batch_id.label("batch_id"),
            Element.id.label("element_id"),
            Element.element_mark,
            Element.element_type,
            Element.concrete_strength_mpa,
            Element.mix_design_id,
            MixDesign.name.label("mix_design_name"),
            Project.id.label("project_id"),
            Project.project_name,
        )
        .join(Element, ProductionSchedule.element_id == Element.id)
        .outerjoin(MixDesign, Element.mix_design_id == MixDesign.id)
        .join(Project, Element.project_id == Project.id)
        .filter(ProductionSchedule.status == "completed")
        .filter(ProductionSchedule.factory_id == factory_id)
        .filter(Element.requires_cubes == True)  # noqa: E712
        .filter(Element.factory_id == factory_id)
        .filter(ProductionSchedule.batch_id.isnot(None))
        .filter(ProductionSchedule.production_date >= earliest)
        .all()
    )

    hollowcore_rows = (
        db.query(
            HollowcoreCast.id.label("schedule_id"),
            HollowcoreCast.cast_date.label("production_date"),
            HollowcoreCast.quantity.label("quantity"),
            HollowcoreCast.batch_id.label("batch_id"),
            Element.id.label("element_id"),
            Element.element_mark,
            Element.element_type,
            Element.concrete_strength_mpa,
            Element.mix_design_id,
            MixDesign.name.label("mix_design_name"),
            Project.id.label("project_id"),
            Project.project_name,
        )
        .join(Element, HollowcoreCast.element_id == Element.id)
        .outerjoin(MixDesign, Element.mix_design_id == MixDesign.id)
        .join(Project, Element.project_id == Project.id)
        .filter(HollowcoreCast.status.in_(["cast", "cut", "completed"]))
        .filter(HollowcoreCast.factory_id == factory_id)
        .filter(Element.factory_id == factory_id)
        .filter(HollowcoreCast.batch_id.isnot(None))
        .filter(HollowcoreCast.cast_date >= earliest)
        .all()
    )

    rows = sorted([*production_rows, *hollowcore_rows], key=lambda r: r.production_date, reverse=True)

    existing = set(
        (r[0], int(r[1] or 0))
        for r in (
            db.query(QualityTest.batch_id, QualityTest.age_days)
            .join(Element, QualityTest.element_id == Element.id)
            .filter(Element.factory_id == factory_id)
            .filter(QualityTest.batch_id.isnot(None))
        )
        .all()
    )

    settings = (
        db.query(HollowcoreSettings)
        .filter(HollowcoreSettings.factory_id == factory_id)
        .order_by(HollowcoreSettings.id.desc())
        .first()
    )
    cut_req = int(settings.cutting_strength_mpa or 15) if settings else 15
    final_req = int(settings.final_strength_mpa or 30) if settings else 30

    hollowcore_batch_ids = {str(r.batch_id) for r in hollowcore_rows if r.batch_id}

    def _item(r, age: int, due: date) -> Dict[str, Any]:
        is_hollowcore = str(r.batch_id) in hollowcore_batch_ids
        required_strength_mpa = r.concrete_strength_mpa
        if is_hollowcore:
            required_strength_mpa = cut_req if age == 1 else final_req
        return {
            "schedule_id": r.schedule_id,
            "production_date": r.production_date,
            "due_date": due,
            "age_days": age,
            "quantity": r.quantity,
            "batch_id": r.batch_id,
            "element_id": r.element_id,
            "element_mark": r.element_mark,
            "element_type": r.element_type,
            "concrete_strength_mpa": r.concrete_strength_mpa,
            "required_strength_mpa": required_strength_mpa,
            "mix_design_id": r.mix_design_id,
            "mix_design_name": r.mix_design_name,
            "project_id": r.project_id,
            "project_name": r.project_name,
        }

    today_items: List[Dict[str, Any]] = []
    tomorrow_items: List[Dict[str, Any]] = []
    overdue_items: List[Dict[str, Any]] = []

    for r in rows:
        if not r.batch_id:
            continue

        ages = (1, 7, 28) if str(r.batch_id) in hollowcore_batch_ids else (7, 28)
        for age in ages:
            if (r.batch_id, age) in existing:
                continue
            if age == 1 and str(r.batch_id) in hollowcore_batch_ids:
                due = r.production_date
            else:
                due = r.production_date + timedelta(days=age)
            if due == today:
                today_items.append(_item(r, age, due))
            elif due == tomorrow:
                tomorrow_items.append(_item(r, age, due))
            elif due < today:
                overdue_items.append(_item(r, age, due))

    today_items.sort(key=lambda x: (x["age_days"], x["production_date"], x["batch_id"]))
    tomorrow_items.sort(key=lambda x: (x["age_days"], x["production_date"], x["batch_id"]))
    overdue_items.sort(key=lambda x: (x["due_date"], x["age_days"], x["production_date"], x["batch_id"]))

    return {
        "overdue": overdue_items,
        "today": today_items,
        "tomorrow": tomorrow_items,
        "today_date": today,
        "tomorrow_date": tomorrow,
    }
