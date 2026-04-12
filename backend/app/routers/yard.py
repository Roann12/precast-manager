from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth.dependencies import get_current_factory_id, get_current_user, require_role
from ..models.user import User
from ..models.yard_location import YardLocation
from ..models.yard import YardInventory
from ..models.element import Element
from ..models.project import Project
from ..services.wetcasting_activity import log_wetcasting_activity

router = APIRouter(prefix="/yard", tags=["yard"])


# CREATE YARD LOCATION
@router.post("/locations")
def create_location(
    name: str,
    description: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["yard", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    location = YardLocation(
        name=name,
        description=description,
        factory_id=factory_id,
    )

    db.add(location)
    db.commit()
    db.refresh(location)

    return location


# LIST YARD LOCATIONS
@router.get("/locations")
def list_locations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    factory_id = get_current_factory_id(current_user)
    return db.query(YardLocation).filter(YardLocation.factory_id == factory_id).all()


@router.put("/locations/{location_id}")
def update_location(
    location_id: int,
    name: str | None = None,
    description: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["yard", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    loc = db.get(YardLocation, location_id)
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    if loc.factory_id != factory_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    if name is not None:
        loc.name = name
    if description is not None:
        loc.description = description
    db.commit()
    db.refresh(loc)
    return loc


@router.delete("/locations/{location_id}", status_code=204)
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["yard", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    loc = db.get(YardLocation, location_id)
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    if loc.factory_id != factory_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    # Prevent deleting locations that still have inventory
    has_inventory = (
        db.query(YardInventory)
        .filter(YardInventory.location_id == location_id)
        .filter(YardInventory.factory_id == factory_id)
        .first()
        is not None
    )
    if has_inventory:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete location with inventory. Move items out first.",
        )

    db.delete(loc)
    db.commit()
    return None


# VIEW YARD INVENTORY
@router.get("/inventory")
def yard_inventory(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["yard", "dispatch", "admin"])),
):
    factory_id = get_current_factory_id(current_user)

    inventory = (
        db.query(
            YardInventory.id.label("yard_inventory_id"),
            YardInventory.location_id.label("location_id"),
            YardInventory.element_id.label("element_id"),
            Project.id.label("project_id"),
            Project.project_name.label("project_name"),
            YardLocation.name.label("location"),
            Element.element_mark,
            Element.element_type,
            YardInventory.quantity
        )
        .join(YardInventory, YardInventory.location_id == YardLocation.id)
        .join(Element, Element.id == YardInventory.element_id)
        .join(Project, Project.id == Element.project_id)
        .filter(YardInventory.factory_id == factory_id)
        .filter(Project.factory_id == factory_id)
        .all()
    )

    return [
        {
            "yard_inventory_id": row.yard_inventory_id,
            "location_id": row.location_id,
            "element_id": row.element_id,
            "project_id": row.project_id,
            "project_name": row.project_name,
            "location": row.location,
            "element_mark": row.element_mark,
            "element_type": row.element_type,
            "quantity": row.quantity
        }
        for row in inventory
    ]


@router.post("/move")
def move_inventory(
    yard_inventory_id: int,
    to_location_id: int,
    quantity: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["yard", "admin"])),
):
    """
    Move stock between yard locations.

    If quantity is omitted, move the full available quantity.
    """
    src = db.get(YardInventory, yard_inventory_id)
    if not src:
        return {"error": "Inventory item not found"}

    factory_id = get_current_factory_id(current_user)
    if src.factory_id != factory_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if not src.element_id:
        return {"error": "Inventory item missing element_id"}

    dest_location = db.get(YardLocation, to_location_id)
    if not dest_location:
        return {"error": "Destination location not found"}
    if dest_location.factory_id != factory_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    move_qty = src.quantity if quantity is None else quantity
    if move_qty <= 0:
        return {"error": "Quantity must be greater than 0"}
    if src.quantity < move_qty:
        return {"error": "Not enough stock in this location"}

    element_id_for_log = int(src.element_id or 0)

    # Find or create destination inventory row for same element
    dest = (
        db.query(YardInventory)
        .filter(
            YardInventory.element_id == src.element_id,
            YardInventory.location_id == to_location_id,
            YardInventory.factory_id == factory_id,
        )
        .first()
    )

    if dest:
        dest.quantity += move_qty
    else:
        dest = YardInventory(
            element_id=src.element_id,
            location_id=to_location_id,
            quantity=move_qty,
            factory_id=factory_id,
        )
        db.add(dest)

    src.quantity -= move_qty
    if src.quantity == 0:
        db.delete(src)

    db.commit()
    log_wetcasting_activity(
        db,
        factory_id=factory_id,
        user_id=current_user.id,
        section="yard",
        action="move_inventory",
        entity_type="yard_inventory",
        entity_id=yard_inventory_id,
        details={
            "to_location_id": to_location_id,
            "moved_quantity": move_qty,
            "element_id": element_id_for_log,
        },
    )
    db.commit()
    return {"message": "Moved", "moved_quantity": move_qty}