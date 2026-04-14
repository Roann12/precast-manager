# File overview: Authentication and authorization helpers for app/auth/dependencies.py.
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from ..core.config import settings
from ..database import get_db
from ..models.factory import Factory
from ..models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


# Handles get current user flow.
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id_raw = payload.get("sub")
        if user_id_raw is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    try:
        user_id = int(user_id_raw)
    except (TypeError, ValueError):
        raise credentials_exception

    user = db.get(User, user_id)
    if user is None:
        raise credentials_exception

    # Factory isolation + lifecycle enforcement:
    # - if the user's factory is suspended, block all access.
    if user.factory_id is not None:
        factory = db.query(Factory).filter(Factory.id == user.factory_id).first()
        if not factory or not factory.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Factory is suspended",
            )
    return user


# Handles require role flow.
def require_role(allowed_roles: list[str]):
    """
    FastAPI dependency factory for role-based access control.

    Usage:
      user: User = Depends(get_current_user)
      Depends(require_role(["admin", "planner"]))
    """

    # Handles  checker flow.
    def _checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return current_user

    return _checker


# Handles get current factory id flow.
def get_current_factory_id(current_user: User = Depends(get_current_user)) -> int:
    if current_user.factory_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not assigned to a factory",
        )
    return int(current_user.factory_id)

