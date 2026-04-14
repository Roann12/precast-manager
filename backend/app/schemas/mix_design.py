# File overview: Pydantic schemas for validation/serialization in app/schemas/mix_design.py.
from typing import Optional
from pydantic import BaseModel

from .common import ORMModel


# Data model for mix design base.
# Maps object fields to storage columns/constraints.
class MixDesignBase(BaseModel):
    name: str
    target_strength_mpa: Optional[int] = None
    active: bool = True


# Data model for mix design create.
# Maps object fields to storage columns/constraints.
class MixDesignCreate(MixDesignBase):
    pass


# Data model for mix design update.
# Maps object fields to storage columns/constraints.
class MixDesignUpdate(BaseModel):
    name: Optional[str] = None
    target_strength_mpa: Optional[int] = None
    active: Optional[bool] = None


# Data model for mix design.
# Maps object fields to storage columns/constraints.
class MixDesign(ORMModel, MixDesignBase):
    id: int

