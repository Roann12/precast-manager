from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

from ..database import Base


class ProductionSchedule(Base):
    __tablename__ = "production_schedule"

    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=True, index=True)
    element_id = Column(Integer, ForeignKey("elements.id", ondelete="CASCADE"), index=True, nullable=False)
    mould_id = Column(Integer, ForeignKey("moulds.id", ondelete="RESTRICT"), index=True, nullable=False)
    production_date = Column(Date, nullable=False)
    quantity = Column(Integer, nullable=False)
    batch_id = Column(String(50), nullable=True, index=True)
    status = Column(String(50), nullable=False, default="planned")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    element = relationship("Element", back_populates="production_schedules")
    mould = relationship("Mould", back_populates="production_schedules")


Index(
    "ix_production_mould_date",
    ProductionSchedule.mould_id,
    ProductionSchedule.production_date,
    unique=False,
)
Index("ix_production_status", ProductionSchedule.status)

