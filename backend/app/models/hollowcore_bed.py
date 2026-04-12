from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Index

from ..database import Base


class HollowcoreBed(Base):
    __tablename__ = "hollowcore_beds"

    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=True, index=True)

    name = Column(String(120), nullable=False)
    length_mm = Column(Integer, nullable=False)
    max_casts_per_day = Column(Integer, nullable=False)

    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


Index("ix_hollowcore_beds_factory_active", HollowcoreBed.factory_id, HollowcoreBed.active)

