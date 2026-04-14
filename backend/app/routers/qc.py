from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..auth.dependencies import get_current_factory_id, require_role
from ..models.user import User
from ..models.production import ProductionSchedule
from ..models.element import Element
from ..models.project import Project
from ..models.quality import QualityTest
from ..models.mix_design import MixDesign
from ..models.hollowcore_cast import HollowcoreCast
from ..models.hollowcore_settings import HollowcoreSettings
from ..services.qc_lab_queue import build_qc_lab_queue
from ..services.wetcasting_activity import log_wetcasting_activity

router = APIRouter(prefix="/qc", tags=["qc"])


class QualityTestCreate(BaseModel):
    element_id: int
    batch_id: Optional[str] = None
    age_days: int
    cube1_weight_kg: float
    cube1_strength_mpa: float
    cube2_weight_kg: float
    cube2_strength_mpa: float
    cube3_weight_kg: float
    cube3_strength_mpa: float
    test_date: date
    test_type: str = "Cube compressive strength"
    notes: Optional[str] = None


@router.get("/queue")
def qc_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["QC", "admin"])),
):
    """
    Lab worklist: cubes due to be crushed today and tomorrow (7d + 28d).

    Keeps a batch/age in the list until a matching QC record exists.
    """
    factory_id = get_current_factory_id(current_user)
    return build_qc_lab_queue(db, factory_id)


@router.post("/tests", status_code=201)
def create_test(
    body: QualityTestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["QC", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    if body.age_days not in (1, 7, 28):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="age_days must be 1, 7 or 28")

    if not body.batch_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="batch_id is required")

    existing_same_age = (
        db.query(QualityTest)
        .join(Element, QualityTest.element_id == Element.id)
        .filter(Element.factory_id == factory_id)
        .filter(QualityTest.batch_id == body.batch_id)
        .filter(QualityTest.age_days == body.age_days)
        .first()
    )
    if existing_same_age:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cube result already exists for batch {body.batch_id} at {body.age_days} day(s).",
        )

    # Enforce: can only enter results once required age has elapsed since cast date.
    is_hollowcore_batch = False
    sched = (
        db.query(ProductionSchedule)
        .filter(ProductionSchedule.batch_id == body.batch_id, ProductionSchedule.factory_id == factory_id)
        .order_by(ProductionSchedule.id.desc())
        .first()
    )
    cast_date = None
    batch_element_id = None
    if sched:
        cast_date = sched.production_date
        batch_element_id = sched.element_id
    else:
        hollow_sched = (
            db.query(HollowcoreCast)
            .join(Element, HollowcoreCast.element_id == Element.id)
            .filter(HollowcoreCast.batch_id == body.batch_id, Element.factory_id == factory_id)
            .order_by(HollowcoreCast.id.desc())
            .first()
        )
        if hollow_sched:
            cast_date = hollow_sched.cast_date
            batch_element_id = hollow_sched.element_id
            is_hollowcore_batch = True

    if cast_date is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown batch_id")
    if batch_element_id is not None and batch_element_id != body.element_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="element_id does not match the provided batch_id",
        )

    age_elapsed = (body.test_date - cast_date).days
    if not (is_hollowcore_batch and body.age_days == 1):
        if age_elapsed < body.age_days:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Too early for {body.age_days}-day test. Earliest: {(cast_date + timedelta(days=body.age_days)).isoformat()}",
            )

    element_row = (
        db.query(Element.id, Element.concrete_strength_mpa, Element.mix_design_id)
        .filter(Element.id == body.element_id, Element.factory_id == factory_id)
        .first()
    )
    if not element_row:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown element_id")

    required = element_row.concrete_strength_mpa
    if is_hollowcore_batch:
        settings = (
            db.query(HollowcoreSettings)
            .filter(HollowcoreSettings.factory_id == factory_id)
            .order_by(HollowcoreSettings.id.desc())
            .first()
        )
        cut_req = int(settings.cutting_strength_mpa or 15) if settings else 15
        final_req = int(settings.final_strength_mpa or 30) if settings else 30
        required = cut_req if body.age_days == 1 else final_req
    try:
        req_val = int(required) if required is not None else None
    except Exception:
        req_val = None

    passed = None
    if req_val is not None:
        avg = (body.cube1_strength_mpa + body.cube2_strength_mpa + body.cube3_strength_mpa) / 3.0
        passed = bool(avg >= float(req_val))
    else:
        avg = (body.cube1_strength_mpa + body.cube2_strength_mpa + body.cube3_strength_mpa) / 3.0

    test = QualityTest(
        element_id=body.element_id,
        batch_id=body.batch_id,
        mix_design_id=element_row.mix_design_id,
        test_type=body.test_type,
        result=f"{avg:g} MPa avg @ {body.age_days}d",
        age_days=body.age_days,
        cube1_weight_kg=body.cube1_weight_kg,
        cube1_strength_mpa=body.cube1_strength_mpa,
        cube2_weight_kg=body.cube2_weight_kg,
        cube2_strength_mpa=body.cube2_strength_mpa,
        cube3_weight_kg=body.cube3_weight_kg,
        cube3_strength_mpa=body.cube3_strength_mpa,
        avg_strength_mpa=avg,
        measured_strength_mpa=avg,
        required_strength_mpa=req_val,
        passed=passed,
        test_date=body.test_date,
        notes=body.notes,
    )
    db.add(test)
    db.commit()
    db.refresh(test)
    log_wetcasting_activity(
        db,
        factory_id=factory_id,
        user_id=current_user.id,
        section="qc",
        action="create_test",
        entity_type="quality_test",
        entity_id=test.id,
        details={
            "batch_id": test.batch_id,
            "element_id": test.element_id,
            "age_days": test.age_days,
            "passed": test.passed,
            "avg_strength_mpa": test.avg_strength_mpa,
            "required_strength_mpa": test.required_strength_mpa,
            "test_date": test.test_date.isoformat() if test.test_date else None,
        },
    )
    db.commit()
    return test


@router.get("/tests")
def list_tests(
    batch_id: Optional[str] = None,
    element_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["QC", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    q = (
        db.query(QualityTest)
        .join(Element, QualityTest.element_id == Element.id)
        .filter(Element.factory_id == factory_id)
        .order_by(QualityTest.test_date.desc(), QualityTest.id.desc())
    )
    if batch_id:
        q = q.filter(QualityTest.batch_id == batch_id)
    if element_id:
        q = q.filter(QualityTest.element_id == element_id)
    return q.all()


@router.get("/results")
def list_results(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["QC", "admin"])),
):
    """
    QC results for export/display.

    If project_id is provided, returns only QC tests whose element belongs to that project.
    Includes cast_date derived from either ProductionSchedule or HollowcoreCast via batch_id.
    """
    factory_id = get_current_factory_id(current_user)
    q = (
        db.query(
            QualityTest.id.label("id"),
            QualityTest.element_id.label("element_id"),
            QualityTest.batch_id.label("batch_id"),
            QualityTest.test_type.label("test_type"),
            QualityTest.result.label("result"),
            QualityTest.age_days.label("age_days"),
            QualityTest.cube1_weight_kg.label("cube1_weight_kg"),
            QualityTest.cube1_strength_mpa.label("cube1_strength_mpa"),
            QualityTest.cube2_weight_kg.label("cube2_weight_kg"),
            QualityTest.cube2_strength_mpa.label("cube2_strength_mpa"),
            QualityTest.cube3_weight_kg.label("cube3_weight_kg"),
            QualityTest.cube3_strength_mpa.label("cube3_strength_mpa"),
            QualityTest.avg_strength_mpa.label("avg_strength_mpa"),
            QualityTest.measured_strength_mpa.label("measured_strength_mpa"),
            QualityTest.required_strength_mpa.label("required_strength_mpa"),
            QualityTest.passed.label("passed"),
            QualityTest.test_date.label("test_date"),
            QualityTest.notes.label("notes"),
            Element.element_mark.label("element_mark"),
            Element.element_type.label("element_type"),
            Element.project_id.label("project_id"),
            Project.project_name.label("project_name"),
            func.coalesce(
                ProductionSchedule.production_date, HollowcoreCast.cast_date
            ).label("cast_date"),
        )
        .join(Element, QualityTest.element_id == Element.id)
        .join(Project, Element.project_id == Project.id)
        .outerjoin(
            ProductionSchedule,
            (ProductionSchedule.batch_id == QualityTest.batch_id)
            & (ProductionSchedule.factory_id == factory_id),
        )
        .outerjoin(
            HollowcoreCast,
            (HollowcoreCast.batch_id == QualityTest.batch_id)
            & (HollowcoreCast.factory_id == factory_id),
        )
        .filter(QualityTest.batch_id.isnot(None))
        .filter(Element.factory_id == factory_id)
    )

    if project_id is not None:
        q = q.filter(Element.project_id == project_id)

    rows = q.order_by(QualityTest.test_date.desc(), QualityTest.id.desc()).all()

    out = []
    for r in rows:
        cast_date = r.cast_date
        due_date = None
        if cast_date is not None and r.age_days is not None:
            due_date = cast_date + timedelta(days=int(r.age_days))

        out.append(
            {
                "id": r.id,
                "element_id": r.element_id,
                "batch_id": r.batch_id,
                "test_type": r.test_type,
                "result": r.result,
                "age_days": r.age_days,
                "cube1_weight_kg": r.cube1_weight_kg,
                "cube1_strength_mpa": r.cube1_strength_mpa,
                "cube2_weight_kg": r.cube2_weight_kg,
                "cube2_strength_mpa": r.cube2_strength_mpa,
                "cube3_weight_kg": r.cube3_weight_kg,
                "cube3_strength_mpa": r.cube3_strength_mpa,
                "avg_strength_mpa": r.avg_strength_mpa,
                "measured_strength_mpa": r.measured_strength_mpa,
                "required_strength_mpa": r.required_strength_mpa,
                "passed": r.passed,
                "test_date": r.test_date,
                "notes": r.notes,
                "element_mark": r.element_mark,
                "element_type": r.element_type,
                "project_id": r.project_id,
                "project_name": r.project_name,
                "cast_date": cast_date,
                "due_date": due_date,
            }
        )

    return out


@router.get("/status")
def qc_status(
    batch_ids: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["QC", "admin"])),
):
    """
    Return QC status per batch_id.
    Chooses the "best" test per batch: highest age_days, then latest date.
    """
    ids = [x.strip() for x in (batch_ids or "").split(",") if x.strip()]
    if not ids:
        return {}

    factory_id = get_current_factory_id(current_user)
    tests = (
        db.query(QualityTest)
        .join(Element, QualityTest.element_id == Element.id)
        .filter(Element.factory_id == factory_id)
        .filter(QualityTest.batch_id.in_(ids))
        .all()
    )

    best_by_batch = {}
    for t in tests:
        if not t.batch_id:
            continue
        prev = best_by_batch.get(t.batch_id)
        key = (
            int(t.age_days or 0),
            t.test_date,
            int(t.id or 0),
        )
        if not prev:
            best_by_batch[t.batch_id] = (key, t)
            continue
        if key > prev[0]:
            best_by_batch[t.batch_id] = (key, t)

    out = {}
    for bid, (_, t) in best_by_batch.items():
        out[bid] = {
            "passed": t.passed,
            "age_days": t.age_days,
            "measured_strength_mpa": t.avg_strength_mpa if t.avg_strength_mpa is not None else t.measured_strength_mpa,
            "required_strength_mpa": t.required_strength_mpa,
            "test_date": t.test_date,
        }

    # Add age completeness for lane/batch workflow (1d, 7d, 28d)
    by_batch_age: dict[str, dict[int, QualityTest]] = {}
    for t in tests:
        if not t.batch_id or t.age_days not in (1, 7, 28):
            continue
        bm = by_batch_age.get(t.batch_id) or {}
        prev = bm.get(int(t.age_days))
        key = (t.test_date, int(t.id or 0))
        if prev is None or key > (prev.test_date, int(prev.id or 0)):
            bm[int(t.age_days)] = t
        by_batch_age[t.batch_id] = bm

    for bid in ids:
        bm = by_batch_age.get(bid, {})
        age_status = {
            "1": None if 1 not in bm else bm[1].passed,
            "7": None if 7 not in bm else bm[7].passed,
            "28": None if 28 not in bm else bm[28].passed,
        }
        exists = {
            "1": 1 in bm,
            "7": 7 in bm,
            "28": 28 in bm,
        }
        if bid not in out:
            out[bid] = {"passed": None, "age_days": None}
        out[bid]["ages"] = age_status
        out[bid]["exists"] = exists
        out[bid]["cut_allowed"] = age_status["1"] is True

    return out


@router.get("/mix-stats/{mix_design_id}")
def mix_stats(
    mix_design_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["QC", "admin"])),
):
    """
    Summary stats per mix design for 7d and 28d results.
    Uses avg_strength_mpa when available.
    """
    factory_id = get_current_factory_id(current_user)
    tests = (
        db.query(QualityTest)
        .join(Element, QualityTest.element_id == Element.id)
        .filter(Element.factory_id == factory_id)
        .filter(QualityTest.mix_design_id == mix_design_id)
        .filter(QualityTest.age_days.in_([7, 28]))
        .all()
    )

    def _stats(age: int):
        vals = [
            float(t.avg_strength_mpa if t.avg_strength_mpa is not None else t.measured_strength_mpa)
            for t in tests
            if int(t.age_days or 0) == age and (t.avg_strength_mpa is not None or t.measured_strength_mpa is not None)
        ]
        n = len(vals)
        if n == 0:
            return {"n": 0, "mean": None, "sd": None, "min": None, "max": None, "pass_rate": None}
        mean = sum(vals) / n
        if n >= 2:
            var = sum((x - mean) ** 2 for x in vals) / (n - 1)  # sample SD
            sd = var ** 0.5
        else:
            sd = None

        passed_flags = [t.passed for t in tests if int(t.age_days or 0) == age and t.passed is not None]
        pass_rate = (sum(1 for p in passed_flags if p) / len(passed_flags)) if passed_flags else None

        return {
            "n": n,
            "mean": round(mean, 3),
            "sd": round(sd, 3) if sd is not None else None,
            "min": round(min(vals), 3),
            "max": round(max(vals), 3),
            "pass_rate": round(pass_rate, 3) if pass_rate is not None else None,
        }

    mix = db.get(MixDesign, mix_design_id)
    # Enforce factory isolation for mix design metadata.
    if mix and mix.factory_id != factory_id:
        mix = None
    return {
        "mix_design_id": mix_design_id,
        "mix_design_name": mix.name if mix else None,
        "target_strength_mpa": mix.target_strength_mpa if mix else None,
        "age_7": _stats(7),
        "age_28": _stats(28),
    }

