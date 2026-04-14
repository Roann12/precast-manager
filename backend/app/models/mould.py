# File overview: ORM models and persistence mapping for app/models/mould.py.
from sqlalchemy import Column, Integer, String, Boolean, Numeric, ForeignKey
from sqlalchemy.orm import relationship

from ..database import Base


# Data model for mould.
# Maps object fields to storage columns/constraints.
class Mould(Base):
    __tablename__ = "moulds"

    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    mould_type = Column(String(100), nullable=False)
    capacity = Column(Integer, nullable=False)
    cycle_time_hours = Column(Numeric(5, 2), nullable=False)
    active = Column(Boolean, default=True, nullable=False)

    production_schedules = relationship("ProductionSchedule", back_populates="mould")

