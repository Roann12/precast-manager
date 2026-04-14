# File overview: Business logic services for app/services/hollowcore_completion.py.
from sqlalchemy.orm import Session

from ..models.hollowcore_cast import HollowcoreCast
from ..models.yard import YardInventory
from ..models.element import Element


# Handles complete hollowcore cast flow.
def complete_hollowcore_cast(db: Session, cast_id: int, location_id: int, factory_id: int):
    cast = (
        db.query(HollowcoreCast)
        .join(Element, HollowcoreCast.element_id == Element.id)
        .filter(HollowcoreCast.id == cast_id)
        .filter(Element.factory_id == factory_id)
        .first()
    )
    if not cast:
        return {"error": "Cast not found"}

    cast.status = "completed"

    yard_item = (
        db.query(YardInventory)
        .filter(YardInventory.element_id == cast.element_id, YardInventory.location_id == location_id)
        .filter(YardInventory.factory_id == factory_id)
        .first()
    )

    if yard_item:
        yard_item.quantity += cast.quantity
    else:
        yard_item = YardInventory(
            element_id=cast.element_id,
            location_id=location_id,
            quantity=cast.quantity,
            factory_id=factory_id,
        )
        db.add(yard_item)

    db.commit()
    return {"message": "Hollowcore cast completed and moved to yard"}

