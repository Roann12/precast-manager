# File overview: ORM models and persistence mapping for app/models/element_mould.py.
from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint, Index
from sqlalchemy.orm import relationship

from ..database import Base


# Data model for element mould.
# Maps object fields to storage columns/constraints.
class ElementMould(Base):
    __tablename__ = "element_moulds"

    id = Column(Integer, primary_key=True, index=True)

    element_id = Column(Integer, ForeignKey("elements.id", ondelete="CASCADE"), nullable=False, index=True)
    mould_id = Column(Integer, ForeignKey("moulds.id", ondelete="RESTRICT"), nullable=False, index=True)

    element = relationship("Element", back_populates="element_moulds")
    mould = relationship("Mould")

    __table_args__ = (
        UniqueConstraint("element_id", "mould_id", name="uq_element_mould"),
        Index("ix_element_mould_element_mould", "element_id", "mould_id"),
    )

