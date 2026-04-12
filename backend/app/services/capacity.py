from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models.production import ProductionSchedule
from ..models.mould import Mould
from ..models.planner_delay import PlannerDelay


def check_mould_capacity(db: Session, mould_id: int, factory_id: int, production_date, quantity: int):

    mould = db.query(Mould).filter(Mould.id == mould_id, Mould.factory_id == factory_id).first()

    if not mould:
        return False, "Mould not found"

    scheduled = (
        db.query(func.sum(ProductionSchedule.quantity))
        .filter(
            ProductionSchedule.mould_id == mould_id,
            ProductionSchedule.factory_id == factory_id,
            ProductionSchedule.production_date == production_date
        )
        .scalar()
    )

    scheduled = scheduled or 0

    lost = (
        db.query(func.coalesce(func.sum(PlannerDelay.lost_capacity), 0))
        .filter(PlannerDelay.factory_id == factory_id)
        .filter(PlannerDelay.planner_type == "production")
        .filter(PlannerDelay.delay_date == production_date)
        .filter((PlannerDelay.mould_id.is_(None)) | (PlannerDelay.mould_id == mould_id))
        .scalar()
    )
    lost = int(lost or 0)
    eff_cap = max(0, int(mould.capacity or 0) - lost)

    if scheduled + quantity > eff_cap:
        return False, f"Mould capacity exceeded (capacity {eff_cap})"

    return True, "OK"