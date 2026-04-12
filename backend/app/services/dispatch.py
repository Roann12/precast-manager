from sqlalchemy.orm import Session
from datetime import date
from datetime import datetime

from ..models.dispatch import DispatchOrder
from ..models.dispatch_item import DispatchItem
from ..models.yard import YardInventory
from ..models.element import Element
from ..models.quality import QualityTest
from ..models.project import Project
from .wetcasting_activity import log_wetcasting_activity


ALLOWED_DISPATCH_STATUSES = {"planned", "completed", "cancelled"}


def create_dispatch(
    db: Session,
    project_id: int,
    dispatch_date: date,
    truck_number: str,
    factory_id: int,
    actor_user_id: int | None = None,
):

    project = db.query(Project).filter(Project.id == project_id, Project.factory_id == factory_id).first()
    if not project:
        return {"error": "Project not found in your factory"}

    dispatch = DispatchOrder(
        factory_id=factory_id,
        project_id=project_id,
        dispatch_date=dispatch_date,
        truck_number=truck_number,
        status="planned",
        status_changed_at=datetime.utcnow(),
        status_changed_by=actor_user_id,
    )

    db.add(dispatch)
    db.commit()
    db.refresh(dispatch)

    return dispatch


def add_item_to_dispatch(
    db: Session,
    dispatch_id: int,
    yard_inventory_id: int,
    quantity: int,
    factory_id: int,
):
    if quantity <= 0:
        return {"error": "Quantity must be greater than 0"}

    yard_item = (
        db.query(YardInventory)
        .filter(YardInventory.id == yard_inventory_id, YardInventory.factory_id == factory_id)
        .with_for_update()
        .first()
    )

    if not yard_item:
        return {"error": "Inventory item not found"}

    dispatch = db.query(DispatchOrder).filter(DispatchOrder.id == dispatch_id, DispatchOrder.factory_id == factory_id).first()
    if not dispatch:
        return {"error": "Dispatch order not found"}
    if dispatch.status != "planned":
        return {"error": "Only planned dispatch orders can be edited"}

    # QC eligibility gate for dispatching from yard.
    # Hollowcore policy (always cube-controlled):
    # - Any final-age (7d/28d) fail blocks dispatch.
    # - At least one final-age (7d/28d) pass is required before dispatch.
    # Other elements keep legacy rules:
    # - 28-day fail blocks dispatch.
    # - 7-day pass is required.
    element = db.get(Element, yard_item.element_id)
    if element and dispatch.project_id and element.project_id != dispatch.project_id:
        return {"error": "Selected yard item belongs to a different project"}
    is_hollowcore = bool(element and (element.element_type or "").strip().lower() == "hollowcore")
    if element and is_hollowcore:
        has_final_fail = (
            db.query(QualityTest)
            .filter(QualityTest.element_id == element.id)
            .filter(QualityTest.age_days.in_([7, 28]))
            .filter(QualityTest.passed == False)  # noqa: E712
            .first()
            is not None
        )
        if has_final_fail:
            return {"error": "QC failed final-strength test (7d/28d) for this hollowcore element; cannot dispatch."}

        has_final_pass = (
            db.query(QualityTest)
            .filter(QualityTest.element_id == element.id)
            .filter(QualityTest.age_days.in_([7, 28]))
            .filter(QualityTest.passed == True)  # noqa: E712
            .first()
            is not None
        )
        if not has_final_pass:
            return {
                "error": "QC pending: final-strength result (7d/28d) has not passed for this hollowcore element; cannot dispatch yet."
            }
    elif element and getattr(element, "requires_cubes", False):
        has_28d_fail = (
            db.query(QualityTest)
            .filter(QualityTest.element_id == element.id)
            .filter(QualityTest.age_days == 28)
            .filter(QualityTest.passed == False)  # noqa: E712
            .first()
            is not None
        )
        if has_28d_fail:
            return {"error": "QC failed at 28 days for this element; cannot dispatch."}

        has_7d_pass = (
            db.query(QualityTest)
            .filter(QualityTest.element_id == element.id)
            .filter(QualityTest.age_days == 7)
            .filter(QualityTest.passed == True)  # noqa: E712
            .first()
            is not None
        )
        if not has_7d_pass:
            return {
                "error": "QC pending: 7-day results have not passed for this element; cannot dispatch yet."
            }

    if yard_item.quantity < quantity:
        return {"error": "Not enough stock in this location"}

    item = DispatchItem(
        dispatch_id=dispatch_id,
        yard_inventory_id=yard_inventory_id,
        quantity=quantity
    )

    yard_item.quantity -= quantity

    db.add(item)
    db.commit()

    return item


def remove_item_from_dispatch(
    db: Session,
    dispatch_item_id: int,
    factory_id: int,
):
    item = db.query(DispatchItem).filter(DispatchItem.id == dispatch_item_id).first()
    if not item:
        return {"error": "Dispatch item not found"}

    dispatch = (
        db.query(DispatchOrder)
        .filter(DispatchOrder.id == item.dispatch_id, DispatchOrder.factory_id == factory_id)
        .first()
    )
    if not dispatch:
        return {"error": "Dispatch order not found"}
    if dispatch.status != "planned":
        return {"error": "Only planned dispatch orders can be edited"}

    yard_item = (
        db.query(YardInventory)
        .filter(YardInventory.id == item.yard_inventory_id, YardInventory.factory_id == factory_id)
        .with_for_update()
        .first()
    )
    if not yard_item:
        return {"error": "Inventory item not found"}

    yard_item.quantity += item.quantity
    db.delete(item)
    db.commit()

    return {"ok": True}


def update_dispatch_status(
    db: Session,
    dispatch_id: int,
    next_status: str,
    factory_id: int,
    actor_user_id: int | None = None,
):
    dispatch = (
        db.query(DispatchOrder)
        .filter(DispatchOrder.id == dispatch_id, DispatchOrder.factory_id == factory_id)
        .first()
    )
    if not dispatch:
        return {"error": "Dispatch order not found"}

    next_status_normalized = (next_status or "").strip().lower()
    if next_status_normalized not in ALLOWED_DISPATCH_STATUSES:
        return {"error": "Invalid dispatch status"}

    if next_status_normalized == "completed":
        has_items = (
            db.query(DispatchItem.id)
            .filter(DispatchItem.dispatch_id == dispatch.id)
            .first()
            is not None
        )
        if not has_items:
            return {"error": "Cannot complete a dispatch order with no items"}

    if dispatch.status == next_status_normalized:
        return dispatch

    dispatch.status = next_status_normalized
    dispatch.status_changed_at = datetime.utcnow()
    dispatch.status_changed_by = actor_user_id
    db.add(dispatch)
    db.commit()
    db.refresh(dispatch)
    if actor_user_id is not None:
        log_wetcasting_activity(
            db,
            factory_id=factory_id,
            user_id=actor_user_id,
            section="dispatch",
            action="dispatch_status",
            entity_type="dispatch_order",
            entity_id=dispatch.id,
            details={"to_status": next_status_normalized},
        )
        db.commit()
    return dispatch