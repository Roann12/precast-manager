from datetime import datetime, date

from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Index

from ..database import Base


class PlannerDelay(Base):
    __tablename__ = "planner_delays"

    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=True, index=True)

    # "production" or "hollowcore"
    planner_type = Column(String(32), nullable=False, index=True)

    delay_date = Column(Date, nullable=False, index=True)

    # Scope: for production planner, use mould_id; for hollowcore planner, use bed_id.
    # If both are NULL, the delay applies to all moulds/beds for that day within planner_type.
    mould_id = Column(Integer, ForeignKey("moulds.id", ondelete="CASCADE"), nullable=True, index=True)
    bed_id = Column(Integer, ForeignKey("hollowcore_beds.id", ondelete="CASCADE"), nullable=True, index=True)

    # Reduces daily capacity (mould capacity units or hollowcore cast slots).
    lost_capacity = Column(Integer, nullable=False, default=1)
    reason = Column(String(255), nullable=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


Index("ix_planner_delays_factory_type_date", PlannerDelay.factory_id, PlannerDelay.planner_type, PlannerDelay.delay_date)

