from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint, Index
from sqlalchemy.orm import relationship

from ..database import Base


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

