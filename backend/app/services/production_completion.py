from sqlalchemy.orm import Session

from ..models.production import ProductionSchedule
from ..models.yard import YardInventory
from ..models.yard_location import YardLocation


def complete_production(db: Session, schedule_id: int, location_id: int, factory_id: int):

    # Find production schedule
    schedule = db.query(ProductionSchedule).filter(
        ProductionSchedule.id == schedule_id,
        ProductionSchedule.factory_id == factory_id,
    ).first()

    if not schedule:
        return {"error": "Schedule not found", "code": "not_found"}

    # Prevent duplicate inventory movements for already-completed schedules.
    if schedule.status == "completed":
        return {"error": "Schedule already completed", "code": "already_completed"}

    location = db.query(YardLocation).filter(
        YardLocation.id == location_id,
        YardLocation.factory_id == factory_id,
    ).first()
    if not location:
        return {"error": "Invalid yard location for this factory", "code": "invalid_location"}

    # Mark production as completed
    schedule.status = "completed"

    # Check if yard inventory already exists for this element + location
    yard_item = (
        db.query(YardInventory)
        .filter(
            YardInventory.element_id == schedule.element_id,
            YardInventory.location_id == location_id,
            YardInventory.factory_id == factory_id,
        )
        .first()
    )

    # Update existing yard stock
    if yard_item:
        yard_item.quantity += schedule.quantity

    # Create new yard inventory record
    else:
        yard_item = YardInventory(
            element_id=schedule.element_id,
            location_id=location_id,
            quantity=schedule.quantity,
            factory_id=factory_id,
        )

        db.add(yard_item)

    db.commit()

    return {"message": "Production completed and moved to yard"}