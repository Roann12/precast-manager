from sqlalchemy.orm import Session

from ..models.production import ProductionSchedule
from ..models.yard import YardInventory


def move_to_yard(db: Session, schedule_id: int, location: str):

    schedule = db.query(ProductionSchedule).filter(
        ProductionSchedule.id == schedule_id
    ).first()

    if not schedule:
        return None

    yard_item = YardInventory(
        element_id=schedule.element_id,
        schedule_id=schedule.id,
        quantity=schedule.quantity,
        location=location,
        status="available"
    )

    db.add(yard_item)

    schedule.status = "demoulded"

    db.commit()

    return yard_item