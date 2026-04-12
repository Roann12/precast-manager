from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date

from ..database import get_db
from ..models.dispatch import DispatchOrder
from ..models.dispatch_item import DispatchItem
from ..models.user import User
from ..auth.dependencies import get_current_factory_id, get_current_user, require_role
from ..services.dispatch import (
    create_dispatch,
    add_item_to_dispatch,
    remove_item_from_dispatch,
    update_dispatch_status,
)
from ..models.project import Project
from ..models.yard import YardInventory
from ..models.yard_location import YardLocation
from ..models.element import Element

router = APIRouter(prefix="/dispatch", tags=["dispatch"])


def _serialize_dispatch_order_with_actor(
    order: DispatchOrder,
    status_changed_by_name: str | None,
):
    return {
        "id": order.id,
        "factory_id": order.factory_id,
        "project_id": order.project_id,
        "dispatch_date": order.dispatch_date,
        "truck_number": order.truck_number,
        "status": order.status,
        "status_changed_at": order.status_changed_at,
        "status_changed_by": order.status_changed_by,
        "status_changed_by_name": status_changed_by_name,
    }


@router.post("/create")
def create_dispatch_order(
    project_id: int,
    dispatch_date: str,
    truck_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["dispatch", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    try:
        parsed_dispatch_date = date.fromisoformat(dispatch_date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid dispatch_date. Use YYYY-MM-DD.",
        )

    result = create_dispatch(
        db,
        project_id,
        parsed_dispatch_date,
        truck_number,
        factory_id=factory_id,
        actor_user_id=current_user.id,
    )
    if isinstance(result, dict) and result.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(result["error"]))
    return result


@router.post("/add-item")
def add_item(
    dispatch_id: int,
    yard_inventory_id: int,
    quantity: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["dispatch", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    result = add_item_to_dispatch(
        db,
        dispatch_id,
        yard_inventory_id,
        quantity,
        factory_id=factory_id,
    )
    if isinstance(result, dict) and result.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(result["error"]))
    return result


@router.post("/remove-item")
def remove_item(
    dispatch_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["dispatch", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    result = remove_item_from_dispatch(
        db=db,
        dispatch_item_id=dispatch_item_id,
        factory_id=factory_id,
    )
    if isinstance(result, dict) and result.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(result["error"]))
    return result


@router.get("")
def list_dispatch_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["dispatch", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    orders = (
        db.query(DispatchOrder)
        .filter(DispatchOrder.factory_id == factory_id)
        .order_by(DispatchOrder.dispatch_date.desc())
        .all()
    )
    actor_ids = {o.status_changed_by for o in orders if o.status_changed_by is not None}
    users_by_id = {}
    if actor_ids:
        users = db.query(User).filter(User.id.in_(actor_ids)).all()
        users_by_id = {u.id: u.name for u in users}

    return [
        _serialize_dispatch_order_with_actor(
            order=o,
            status_changed_by_name=users_by_id.get(o.status_changed_by),
        )
        for o in orders
    ]


@router.get("/{dispatch_id:int}")
def get_dispatch(
    dispatch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["dispatch", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    order = db.get(DispatchOrder, dispatch_id)
    if not order or order.factory_id != factory_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispatch order not found")
    items = (
        db.query(DispatchItem)
        .filter(DispatchItem.dispatch_id == dispatch_id)
        .order_by(DispatchItem.id)
        .all()
    )
    actor_name = None
    if order.status_changed_by is not None:
        actor = db.get(User, order.status_changed_by)
        actor_name = actor.name if actor else None
    return {
        "order": _serialize_dispatch_order_with_actor(
            order=order,
            status_changed_by_name=actor_name,
        ),
        "items": items,
    }


@router.get("/export-note")
def export_dispatch_note(
    start_date: str | None = None,
    end_date: str | None = None,
    dispatch_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["dispatch", "admin"])),
):
    """
    Export-friendly dispatch "note" rows.

    Returns a flat list (one row per dispatch item) with human-friendly fields:
    dispatch info + project + element mark/type + yard location + quantities.
    """
    from datetime import date

    factory_id = get_current_factory_id(current_user)

    def _parse(d: str | None) -> date | None:
        if not d:
            return None
        try:
            return date.fromisoformat(d)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid date: {d}")

    start = _parse(start_date)
    end = _parse(end_date)

    q = (
        db.query(
            DispatchOrder.id.label("dispatch_id"),
            DispatchOrder.dispatch_date.label("dispatch_date"),
            DispatchOrder.truck_number.label("truck_number"),
            DispatchOrder.status.label("dispatch_status"),
            Project.id.label("project_id"),
            Project.project_name.label("project_name"),
            DispatchItem.id.label("dispatch_item_id"),
            DispatchItem.quantity.label("dispatch_quantity"),
            YardInventory.id.label("yard_inventory_id"),
            YardInventory.quantity.label("yard_quantity_after"),
            YardLocation.name.label("yard_location"),
            Element.id.label("element_id"),
            Element.element_mark.label("element_mark"),
            Element.element_type.label("element_type"),
        )
        .join(Project, DispatchOrder.project_id == Project.id)
        .join(DispatchItem, DispatchItem.dispatch_id == DispatchOrder.id)
        .join(YardInventory, DispatchItem.yard_inventory_id == YardInventory.id)
        .join(YardLocation, YardInventory.location_id == YardLocation.id)
        .join(Element, YardInventory.element_id == Element.id)
        .filter(DispatchOrder.factory_id == factory_id)
        .filter(Project.factory_id == factory_id)
        .filter(YardInventory.factory_id == factory_id)
        .filter(Element.factory_id == factory_id)
        .order_by(DispatchOrder.dispatch_date.desc(), DispatchOrder.id.desc(), DispatchItem.id.asc())
    )

    if dispatch_id is not None:
        q = q.filter(DispatchOrder.id == dispatch_id)
    if start is not None:
        q = q.filter(DispatchOrder.dispatch_date >= start)
    if end is not None:
        q = q.filter(DispatchOrder.dispatch_date <= end)

    rows = q.all()
    return [
        {
            "dispatch_id": r.dispatch_id,
            "dispatch_date": r.dispatch_date,
            "truck_number": r.truck_number,
            "dispatch_status": r.dispatch_status,
            "project_id": r.project_id,
            "project_name": r.project_name,
            "dispatch_item_id": r.dispatch_item_id,
            "yard_inventory_id": r.yard_inventory_id,
            "yard_location": r.yard_location,
            "element_id": r.element_id,
            "element_mark": r.element_mark,
            "element_type": r.element_type,
            "dispatch_quantity": r.dispatch_quantity,
            "yard_quantity_after": r.yard_quantity_after,
        }
        for r in rows
    ]


@router.post("/{dispatch_id:int}/complete")
def complete_dispatch_order(
    dispatch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["dispatch", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    result = update_dispatch_status(
        db=db,
        dispatch_id=dispatch_id,
        next_status="completed",
        factory_id=factory_id,
        actor_user_id=current_user.id,
    )
    if isinstance(result, dict) and result.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(result["error"]))
    return result


@router.post("/{dispatch_id:int}/cancel")
def cancel_dispatch_order(
    dispatch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["dispatch", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    result = update_dispatch_status(
        db=db,
        dispatch_id=dispatch_id,
        next_status="cancelled",
        factory_id=factory_id,
        actor_user_id=current_user.id,
    )
    if isinstance(result, dict) and result.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(result["error"]))
    return result


@router.post("/{dispatch_id:int}/reopen")
def reopen_dispatch_order(
    dispatch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["dispatch", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    result = update_dispatch_status(
        db=db,
        dispatch_id=dispatch_id,
        next_status="planned",
        factory_id=factory_id,
        actor_user_id=current_user.id,
    )
    if isinstance(result, dict) and result.get("error"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(result["error"]))
    return result