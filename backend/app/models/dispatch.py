# File overview: ORM models and persistence mapping for app/models/dispatch.py.
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


# Data model for dispatch order.
# Maps object fields to storage columns/constraints.
class DispatchOrder(Base):
    __tablename__ = "dispatch_orders"

    id = Column(Integer, primary_key=True, index=True)

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))

    dispatch_date = Column(Date, nullable=False)

    truck_number = Column(String(50), nullable=True)

    status = Column(String(50), default="planned")
    status_changed_at = Column(DateTime, nullable=True)
    status_changed_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    items = relationship(
        "DispatchItem",
        back_populates="dispatch",
        cascade="all, delete-orphan"
    )

