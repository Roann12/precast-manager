# File overview: Pydantic schemas for validation/serialization in app/schemas/common.py.
from pydantic import BaseModel, ConfigDict


# Data model for ormmodel.
# Maps object fields to storage columns/constraints.
class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

