# File overview: API route handlers and request orchestration for app/routers/mix_designs.py.
from collections import defaultdict
from datetime import timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth.dependencies import get_current_user, require_role
from ..models.mix_design import MixDesign as MixDesignModel
from ..models.quality import QualityTest
from ..models.element import Element
from ..schemas.mix_design import MixDesign, MixDesignCreate, MixDesignUpdate

router = APIRouter(prefix="/mix-designs", tags=["mix-designs"])


@router.get("", response_model=List[MixDesign])
# Handles list mix designs flow.
def list_mix_designs(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = db.query(MixDesignModel).order_by(MixDesignModel.active.desc(), MixDesignModel.name)
    # Factories must not see other factories' confidential mix designs.
    if current_user.factory_id is not None:
        q = q.filter(MixDesignModel.factory_id == current_user.factory_id)
    return q.all()


@router.post("", response_model=MixDesign, status_code=201)
# Handles create mix design flow.
def create_mix_design(
    body: MixDesignCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["planner", "admin"])),
):
    if current_user.factory_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Factory-scoped access required")
    obj = MixDesignModel(**body.dict(), factory_id=current_user.factory_id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{mix_design_id}", response_model=MixDesign)
# Handles get mix design flow.
def get_mix_design(mix_design_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    obj = db.get(MixDesignModel, mix_design_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mix design not found")
    if current_user.factory_id is not None and obj.factory_id != current_user.factory_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mix design not found")
    return obj


@router.get("/analysis/data")
# Handles mix design analysis flow.
def mix_design_analysis(
    weeks: int = 12,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["planner", "QC", "admin"])),
):
    if current_user.factory_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Factory-scoped access required")
    factory_id = int(current_user.factory_id)

    mixes = (
        db.query(MixDesignModel)
        .filter(MixDesignModel.factory_id == factory_id)
        .order_by(MixDesignModel.active.desc(), MixDesignModel.name)
        .all()
    )
    mix_meta = {m.id: m for m in mixes}

    rows = (
        db.query(
            QualityTest.id,
            QualityTest.mix_design_id,
            QualityTest.batch_id,
            QualityTest.age_days,
            QualityTest.avg_strength_mpa,
            QualityTest.measured_strength_mpa,
            QualityTest.passed,
            QualityTest.test_date,
        )
        .join(Element, QualityTest.element_id == Element.id)
        .filter(Element.factory_id == factory_id)
        .filter(QualityTest.mix_design_id.isnot(None))
        .filter(QualityTest.age_days.in_([1, 7, 28]))
        .order_by(QualityTest.test_date.desc(), QualityTest.id.desc())
        .all()
    )

    # Keep a rolling window based on last N calendar weeks.
    latest_date = None
    for row in rows:
        if row.test_date is not None:
            latest_date = row.test_date
            break
    if latest_date is not None and weeks > 0:
        min_date = latest_date - timedelta(days=7 * max(weeks - 1, 0))
    else:
        min_date = None

    def _calc_stats(values: list[float], pass_flags: list[bool]) -> dict:
        n = len(values)
        if n == 0:
            return {"n": 0, "mean": None, "sd": None, "min": None, "max": None, "pass_rate": None}
        mean = sum(values) / n
        if n >= 2:
            var = sum((x - mean) ** 2 for x in values) / (n - 1)
            sd = var ** 0.5
        else:
            sd = None
        pass_rate = (sum(1 for p in pass_flags if p) / len(pass_flags)) if pass_flags else None
        return {
            "n": n,
            "mean": round(mean, 3),
            "sd": round(sd, 3) if sd is not None else None,
            "min": round(min(values), 3),
            "max": round(max(values), 3),
            "pass_rate": round(pass_rate, 3) if pass_rate is not None else None,
        }

    by_mix_age_values: dict[int, dict[int, list[float]]] = defaultdict(lambda: defaultdict(list))
    by_mix_age_passes: dict[int, dict[int, list[bool]]] = defaultdict(lambda: defaultdict(list))
    by_week_mix_age_values: dict[str, dict[int, dict[int, list[float]]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    by_week_mix_age_passes: dict[str, dict[int, dict[int, list[bool]]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    by_mix_batch_age_latest: dict[int, dict[str, dict[int, tuple]]] = defaultdict(lambda: defaultdict(dict))

    for row in rows:
        if row.test_date is None or row.mix_design_id is None or row.age_days not in (1, 7, 28):
            continue
        if min_date is not None and row.test_date < min_date:
            continue
        strength = row.avg_strength_mpa if row.avg_strength_mpa is not None else row.measured_strength_mpa
        if strength is None:
            continue
        mix_id = int(row.mix_design_id)
        age = int(row.age_days)
        iso_year, iso_week, _ = row.test_date.isocalendar()
        week_key = f"{iso_year}-W{iso_week:02d}"
        strength_val = float(strength)

        by_mix_age_values[mix_id][age].append(strength_val)
        if row.passed is not None:
            by_mix_age_passes[mix_id][age].append(bool(row.passed))

        by_week_mix_age_values[week_key][mix_id][age].append(strength_val)
        if row.passed is not None:
            by_week_mix_age_passes[week_key][mix_id][age].append(bool(row.passed))

        if row.batch_id:
            prev = by_mix_batch_age_latest[mix_id][row.batch_id].get(age)
            curr_key = (row.test_date, int(row.id or 0))
            if prev is None or curr_key > prev[0]:
                by_mix_batch_age_latest[mix_id][row.batch_id][age] = (curr_key, strength_val)

    mix_cards = []
    for mix in mixes:
        age1_values = by_mix_age_values[mix.id][1]
        age7_values = by_mix_age_values[mix.id][7]
        age28_values = by_mix_age_values[mix.id][28]
        age1_stats = _calc_stats(age1_values, by_mix_age_passes[mix.id][1])
        age7_stats = _calc_stats(age7_values, by_mix_age_passes[mix.id][7])
        age28_stats = _calc_stats(age28_values, by_mix_age_passes[mix.id][28])
        target = float(mix.target_strength_mpa) if mix.target_strength_mpa is not None else None
        age28_margin = round(age28_stats["mean"] - target, 3) if (age28_stats["mean"] is not None and target is not None) else None
        mix_cards.append(
            {
                "mix_design_id": mix.id,
                "mix_design_name": mix.name,
                "target_strength_mpa": mix.target_strength_mpa,
                "active": bool(mix.active),
                "age_1": age1_stats,
                "age_7": age7_stats,
                "age_28": age28_stats,
                "age_28_margin_mpa": age28_margin,
            }
        )

    trend = []
    for week_key in sorted(by_week_mix_age_values.keys()):
        for mix_id in sorted(by_week_mix_age_values[week_key].keys()):
            mix = mix_meta.get(mix_id)
            if mix is None:
                continue
            vals_7 = by_week_mix_age_values[week_key][mix_id][7]
            vals_28 = by_week_mix_age_values[week_key][mix_id][28]
            vals_1 = by_week_mix_age_values[week_key][mix_id][1]
            pass_28 = by_week_mix_age_passes[week_key][mix_id][28]
            target = float(mix.target_strength_mpa) if mix.target_strength_mpa is not None else None
            avg_28 = (sum(vals_28) / len(vals_28)) if vals_28 else None
            margin_28 = (avg_28 - target) if (avg_28 is not None and target is not None) else None
            trend.append(
                {
                    "week": week_key,
                    "mix_design_id": mix_id,
                    "mix_design_name": mix.name,
                    "avg_strength_1_mpa": round(sum(vals_1) / len(vals_1), 3) if vals_1 else None,
                    "avg_strength_7_mpa": round(sum(vals_7) / len(vals_7), 3) if vals_7 else None,
                    "avg_strength_28_mpa": round(avg_28, 3) if avg_28 is not None else None,
                    "target_strength_mpa": mix.target_strength_mpa,
                    "margin_28_mpa": round(margin_28, 3) if margin_28 is not None else None,
                    "samples_1": len(vals_1),
                    "samples_7": len(vals_7),
                    "samples_28": len(vals_28),
                    "pass_rate_28": round(sum(1 for p in pass_28 if p) / len(pass_28), 3) if pass_28 else None,
                }
            )

    correlation = []
    for mix_id, batch_map in by_mix_batch_age_latest.items():
        mix = mix_meta.get(mix_id)
        if mix is None:
            continue
        for batch_id, ages in batch_map.items():
            row_7 = ages.get(7)
            row_28 = ages.get(28)
            if row_7 is None or row_28 is None:
                continue
            correlation.append(
                {
                    "mix_design_id": mix_id,
                    "mix_design_name": mix.name,
                    "batch_id": batch_id,
                    "strength_7_mpa": round(float(row_7[1]), 3),
                    "strength_28_mpa": round(float(row_28[1]), 3),
                }
            )

    return {
        "weeks": weeks,
        "mixes": mix_cards,
        "trend": trend,
        "correlation_7_to_28": correlation,
    }


@router.put("/{mix_design_id}", response_model=MixDesign)
# Handles update mix design flow.
def update_mix_design(
    mix_design_id: int,
    body: MixDesignUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["planner", "admin"])),
):
    obj = db.get(MixDesignModel, mix_design_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mix design not found")
    if current_user.factory_id is None or obj.factory_id != current_user.factory_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mix design not found")
    for k, v in body.dict(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{mix_design_id}", status_code=204)
# Handles delete mix design flow.
def delete_mix_design(
    mix_design_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["planner", "admin"])),
):
    obj = db.get(MixDesignModel, mix_design_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mix design not found")
    if current_user.factory_id is None or obj.factory_id != current_user.factory_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mix design not found")
    db.delete(obj)
    db.commit()
    return None

