from datetime import date
from pydantic import BaseModel
from typing import Optional, List


class ElementBase(BaseModel):
    project_id: int
    mix_design_id: Optional[int] = None
    element_type: str
    element_mark: str
    quantity: int
    volume: Optional[float] = None
    due_date: Optional[date] = None
    concrete_strength_mpa: Optional[int] = None
    requires_cubes: bool = False
    # Hollowcore-specific panel fields (optional unless the element represents a hollowcore panel job).
    panel_length_mm: Optional[int] = None
    slab_thickness_mm: Optional[int] = None
    active: bool = True
    status: Optional[str] = "planned"


class ElementCreate(ElementBase):
    allowed_mould_ids: List[int] = []


class ElementUpdate(BaseModel):
    mix_design_id: Optional[int] = None
    element_type: Optional[str] = None
    element_mark: Optional[str] = None
    quantity: Optional[int] = None
    volume: Optional[float] = None
    due_date: Optional[date] = None
    concrete_strength_mpa: Optional[int] = None
    panel_length_mm: Optional[int] = None
    slab_thickness_mm: Optional[int] = None
    active: Optional[bool] = None
    requires_cubes: Optional[bool] = None
    status: Optional[str] = None
    allowed_mould_ids: Optional[List[int]] = None


class Element(ElementBase):
    id: int
    allowed_mould_ids: List[int] = []

    class Config:
        from_attributes = True