from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


class DispatchItem(Base):
    __tablename__ = "dispatch_items"

    id = Column(Integer, primary_key=True, index=True)

    dispatch_id = Column(Integer, ForeignKey("dispatch_orders.id"))

    yard_item_id = Column(Integer, ForeignKey("yard_inventory.id"))

    quantity = Column(Integer, nullable=False)

    dispatch = relationship("DispatchOrder", back_populates="items")