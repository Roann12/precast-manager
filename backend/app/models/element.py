# File overview: ORM models and persistence mapping for app/models/element.py.
from datetime import date
from sqlalchemy import Column, Integer, String, Date, ForeignKey, Numeric, Index, Boolean
from sqlalchemy.orm import relationship

from ..database import Base


# Data model for element.
# Maps object fields to storage columns/constraints.
class Element(Base):
    __tablename__ = "elements"

    id = Column(Integer, primary_key=True, index=True)

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    mix_design_id = Column(Integer, ForeignKey("mix_designs.id", ondelete="SET NULL"), index=True, nullable=True)

    element_type = Column(String(50), nullable=False)
    element_mark = Column(String(50), nullable=False)

    quantity = Column(Integer, nullable=False)
    volume = Column(Numeric(10, 2), nullable=True)
    due_date = Column(Date, nullable=True)
    concrete_strength_mpa = Column(Integer, nullable=True)
    requires_cubes = Column(Boolean, nullable=False, default=False)

    # Hollowcore-specific panel data.
    # When both are set, the element is treated as a hollowcore panel job.
    panel_length_mm = Column(Integer, nullable=True)
    slab_thickness_mm = Column(Integer, nullable=True)

    # Archive flag (keep history + yard/QC integrity)
    active = Column(Boolean, nullable=False, default=True)

    status = Column(String(50), nullable=False, default="planned")

    project = relationship("Project", back_populates="elements")
    mix_design = relationship("MixDesign", back_populates="elements")

    production_schedules = relationship(
        "ProductionSchedule", back_populates="element", cascade="all, delete-orphan"
    )

    quality_tests = relationship(
        "QualityTest", back_populates="element", cascade="all, delete-orphan"
    )

    hollowcore_casts = relationship(
        "HollowcoreCast", back_populates="element", cascade="all, delete-orphan"
    )

    element_moulds = relationship(
        "ElementMould", back_populates="element", cascade="all, delete-orphan"
    )

    allowed_moulds = relationship(
        "Mould",
        secondary="element_moulds",
        viewonly=True,
    )

    @property
    # Handles allowed mould ids flow.
    def allowed_mould_ids(self):
        # Used by Pydantic response models to expose compatibility mapping.
        return [em.mould_id for em in (self.element_moulds or [])]


Index("ix_elements_status", Element.status)
Index("ix_elements_project_due", Element.project_id, Element.due_date)
Index("ix_elements_active", Element.active)

