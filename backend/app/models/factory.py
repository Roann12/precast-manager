# File overview: ORM models and persistence mapping for app/models/factory.py.
from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship

from ..database import Base


# Data model for factory.
# Maps object fields to storage columns/constraints.
class Factory(Base):
    __tablename__ = "factories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    is_active = Column(Boolean, nullable=False, default=True)

    # Backrefs are optional; main relationships live on the factory_id columns.
    users = relationship("User", back_populates="factory")

