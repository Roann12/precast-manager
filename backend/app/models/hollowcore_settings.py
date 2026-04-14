# File overview: ORM models and persistence mapping for app/models/hollowcore_settings.py.
from datetime import datetime

from sqlalchemy import Boolean, Column, Integer, DateTime, ForeignKey

from ..database import Base


# Data model for hollowcore settings.
# Maps object fields to storage columns/constraints.
class HollowcoreSettings(Base):
    __tablename__ = "hollowcore_settings"

    id = Column(Integer, primary_key=True, index=True)

    # Per-factory configuration; if NULL it acts as a global default.
    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=True, index=True)

    # Physical bed configuration (used by the planner to determine how many panels fit per cast).
    bed_count = Column(Integer, nullable=False, default=1)
    bed_length_mm = Column(Integer, nullable=False, default=6000)
    waste_margin_mm = Column(Integer, nullable=False, default=2000)

    # Cast frequency per bed per production day.
    casts_per_bed_per_day = Column(Integer, nullable=False, default=1)

    # New defaults (v2 planner). If NULL, fall back to legacy values above.
    default_waste_mm = Column(Integer, nullable=True)
    default_casts_per_day = Column(Integer, nullable=True)
    cutting_strength_mpa = Column(Integer, nullable=True)
    final_strength_mpa = Column(Integer, nullable=True)

    active = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

