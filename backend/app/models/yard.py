from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


class YardInventory(Base):
    __tablename__ = "yard_inventory"

    id = Column(Integer, primary_key=True, index=True)

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=True, index=True)
    element_id = Column(Integer, ForeignKey("elements.id"))

    location_id = Column(Integer, ForeignKey("yard_locations.id"))

    quantity = Column(Integer, nullable=False)

    element = relationship("Element")

    location = relationship("YardLocation", back_populates="inventory")