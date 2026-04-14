# File overview: ORM models and persistence mapping for app/models/dispatch_id.py.
from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


# Data model for dispatch item.
# Maps object fields to storage columns/constraints.
class DispatchItem(Base):
    __tablename__ = "dispatch_items"

    id = Column(Integer, primary_key=True, index=True)

    dispatch_id = Column(Integer, ForeignKey("dispatch_orders.id"))

    yard_item_id = Column(Integer, ForeignKey("yard_inventory.id"))

    quantity = Column(Integer, nullable=False)

    dispatch = relationship("DispatchOrder", back_populates="items")