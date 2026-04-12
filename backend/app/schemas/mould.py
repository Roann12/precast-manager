from pydantic import BaseModel
from typing import Optional

from .common import ORMModel


class MouldBase(BaseModel):
    name: str
    mould_type: str
    capacity: int
    cycle_time_hours: float
    active: bool = True


class MouldCreate(MouldBase):
    pass


class MouldUpdate(BaseModel):
    name: Optional[str] = None
    mould_type: Optional[str] = None
    capacity: Optional[int] = None
    cycle_time_hours: Optional[float] = None
    active: Optional[bool] = None


class Mould(ORMModel, MouldBase):
    id: int

