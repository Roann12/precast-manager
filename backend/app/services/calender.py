from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models.production import ProductionSchedule
from ..models.mould import Mould
from ..models.element import Element


def get_production_calendar(db: Session):

    query = (
        db.query(
            ProductionSchedule.production_date,
            Mould.name.label("mould"),
            Element.element_type,
            Element.element_mark,
            ProductionSchedule.quantity,
            ProductionSchedule.status
        )
        .join(Mould, ProductionSchedule.mould_id == Mould.id)
        .join(Element, ProductionSchedule.element_id == Element.id)
        .order_by(ProductionSchedule.production_date)
    )

    results = query.all()

    calendar = []

    for row in results:
        calendar.append(
            {
                "production_date": row.production_date,
                "mould": row.mould,
                "element_type": row.element_type,
                "element_mark": row.element_mark,
                "quantity": row.quantity,
                "status": row.status
            }
        )

    return calendar