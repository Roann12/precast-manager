# File overview: ORM models and persistence mapping for app/models/user.py.
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from ..database import Base


# Data model for user.
# Maps object fields to storage columns/constraints.
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    must_change_password = Column(Boolean, nullable=False, default=False)
    role = Column(String(50), nullable=False, default="user")
    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    factory = relationship("Factory", back_populates="users")

