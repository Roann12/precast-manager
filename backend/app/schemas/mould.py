# File overview: Pydantic schemas for validation/serialization in app/schemas/mould.py.
from pydantic import BaseModel
from typing import Optional

from .common import ORMModel


# Data model for mould base.
# Maps object fields to storage columns/constraints.
class MouldBase(BaseModel):
    name: str
    mould_type: str
    capacity: int
    cycle_time_hours: float
    active: bool = True


# Data model for mould create.
# Maps object fields to storage columns/constraints.
class MouldCreate(MouldBase):
    pass


# Data model for mould update.
# Maps object fields to storage columns/constraints.
class MouldUpdate(BaseModel):
    name: Optional[str] = None
    mould_type: Optional[str] = None
    capacity: Optional[int] = None
    cycle_time_hours: Optional[float] = None
    active: Optional[bool] = None


# Data model for mould.
# Maps object fields to storage columns/constraints.
class Mould(ORMModel, MouldBase):
    id: int

