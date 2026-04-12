from datetime import datetime, date

from sqlalchemy import Column, Integer, String, Date, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship

from ..database import Base


class HollowcoreCast(Base):
    __tablename__ = "hollowcore_casts"

    id = Column(Integer, primary_key=True, index=True)

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=True, index=True)
    element_id = Column(Integer, ForeignKey("elements.id", ondelete="CASCADE"), index=True, nullable=False)

    # The date this bed cast happens.
    cast_date = Column(Date, nullable=False, index=True)

    # Bed coordinates for visual planning.
    # v1: bed_number (kept for legacy rows)
    bed_number = Column(Integer, nullable=True)
    # v2: bed_id reference (preferred)
    bed_id = Column(Integer, ForeignKey("hollowcore_beds.id"), nullable=True, index=True)
    cast_slot_index = Column(Integer, nullable=False, default=0)

    # Thickness and panel length are fixed for the cast slot (one cast per slot).
    slab_thickness_mm = Column(Integer, nullable=False)
    panel_length_mm = Column(Integer, nullable=False)

    # Quantity represents number of panels cast for this element size.
    quantity = Column(Integer, nullable=False)

    used_length_mm = Column(Integer, nullable=True)
    waste_mm = Column(Integer, nullable=True)

    # QC cube reference for this cast (only for elements that require cubes).
    batch_id = Column(String(50), nullable=True, index=True)

    # planned -> cast -> completed
    status = Column(String(50), nullable=False, default="planned")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    element = relationship("Element", back_populates="hollowcore_casts")
    bed = relationship("HollowcoreBed")

    # A cast slot should be unique per date/bed/slot. (The planner creates a full grid of slots.)
    __table_args__ = (
        Index("ix_hollowcore_cast_unique_slot", "cast_date", "bed_number", "cast_slot_index", unique=True),
        Index("ix_hollowcore_cast_unique_slot_v2", "cast_date", "bed_id", "cast_slot_index", unique=False),
    )

