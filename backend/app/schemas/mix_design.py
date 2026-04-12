from typing import Optional
from pydantic import BaseModel

from .common import ORMModel


class MixDesignBase(BaseModel):
    name: str
    target_strength_mpa: Optional[int] = None
    active: bool = True


class MixDesignCreate(MixDesignBase):
    pass


class MixDesignUpdate(BaseModel):
    name: Optional[str] = None
    target_strength_mpa: Optional[int] = None
    active: Optional[bool] = None


class MixDesign(ORMModel, MixDesignBase):
    id: int

