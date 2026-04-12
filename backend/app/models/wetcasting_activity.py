from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Index
from sqlalchemy.orm import relationship

from ..database import Base


class WetcastingActivity(Base):
    __tablename__ = "wetcasting_activity"

    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    section = Column(String(50), nullable=False, index=True)  # elements | planner | production
    action = Column(String(80), nullable=False)
    entity_type = Column(String(50), nullable=True)  # element | schedule | delay | planner_run
    entity_id = Column(Integer, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User")


Index("ix_wetcasting_activity_factory_created", WetcastingActivity.factory_id, WetcastingActivity.created_at)
