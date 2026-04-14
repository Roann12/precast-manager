# File overview: ORM models and persistence mapping for app/models/quality.py.
from datetime import date
from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey, Index, Float, Boolean
from sqlalchemy.orm import relationship

from ..database import Base


# Data model for quality test.
# Maps object fields to storage columns/constraints.
class QualityTest(Base):
    __tablename__ = "quality_tests"

    id = Column(Integer, primary_key=True, index=True)
    element_id = Column(
        Integer,
        ForeignKey("elements.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    batch_id = Column(String(50), nullable=True, index=True)
    mix_design_id = Column(Integer, ForeignKey("mix_designs.id", ondelete="SET NULL"), index=True, nullable=True)
    test_type = Column(String(100), nullable=False)
    # Legacy free-text result (kept for backward compatibility with existing rows)
    result = Column(String(50), nullable=False)
    age_days = Column(Integer, nullable=True)
    cube1_weight_kg = Column(Float, nullable=True)
    cube1_strength_mpa = Column(Float, nullable=True)
    cube2_weight_kg = Column(Float, nullable=True)
    cube2_strength_mpa = Column(Float, nullable=True)
    cube3_weight_kg = Column(Float, nullable=True)
    cube3_strength_mpa = Column(Float, nullable=True)
    avg_strength_mpa = Column(Float, nullable=True)
    measured_strength_mpa = Column(Float, nullable=True)
    required_strength_mpa = Column(Integer, nullable=True)
    passed = Column(Boolean, nullable=True)
    test_date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)

    element = relationship("Element", back_populates="quality_tests")
    mix_design = relationship("MixDesign")


Index("ix_quality_element_date", QualityTest.element_id, QualityTest.test_date)
Index("ix_quality_batch", QualityTest.batch_id)

