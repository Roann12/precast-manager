# File overview: ORM models and persistence mapping for app/models/mix_design.py.
from sqlalchemy import Column, Integer, String, Boolean, Index, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


# Data model for mix design.
# Maps object fields to storage columns/constraints.
class MixDesign(Base):
    __tablename__ = "mix_designs"

    id = Column(Integer, primary_key=True, index=True)
    # Scoped to factories via factory_id (per-factory confidentiality).
    name = Column(String(120), nullable=False)
    target_strength_mpa = Column(Integer, nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=True, index=True)

    elements = relationship("Element", back_populates="mix_design")


Index("ix_mix_designs_active", MixDesign.active)

