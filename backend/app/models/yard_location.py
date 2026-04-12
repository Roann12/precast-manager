from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


class YardLocation(Base):
    __tablename__ = "yard_locations"

    id = Column(Integer, primary_key=True, index=True)

    # Scoped to factories via factory_id (per-factory confidentiality).
    name = Column(String(50), nullable=False)
    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=True, index=True)

    description = Column(String(255), nullable=True)

    inventory = relationship("YardInventory", back_populates="location")