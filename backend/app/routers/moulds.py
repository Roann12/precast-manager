# File overview: API route handlers and request orchestration for app/routers/moulds.py.
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth.dependencies import get_current_factory_id, get_current_user, require_role
from ..models.user import User
from ..models.mould import Mould as MouldModel
from ..schemas.mould import Mould, MouldCreate, MouldUpdate

router = APIRouter(prefix="/moulds", tags=["moulds"])


@router.get("", response_model=List[Mould])
# Handles list moulds flow.
def list_moulds(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    factory_id = get_current_factory_id(current_user)
    return db.query(MouldModel).filter(MouldModel.factory_id == factory_id).order_by(MouldModel.name).all()


@router.post("", response_model=Mould, status_code=201)
# Handles create mould flow.
def create_mould(
    body: MouldCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    mould = MouldModel(**body.dict(), factory_id=factory_id)
    db.add(mould)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(mould)
    return mould


@router.get("/{mould_id}", response_model=Mould)
# Handles get mould flow.
def get_mould(
    mould_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    factory_id = get_current_factory_id(current_user)
    mould = db.query(MouldModel).filter(MouldModel.id == mould_id, MouldModel.factory_id == factory_id).first()
    if not mould:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mould not found")
    return mould


@router.put("/{mould_id}", response_model=Mould)
# Handles update mould flow.
def update_mould(
    mould_id: int,
    body: MouldUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    mould = db.query(MouldModel).filter(MouldModel.id == mould_id, MouldModel.factory_id == factory_id).first()
    if not mould:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mould not found")

    for field, value in body.dict(exclude_unset=True).items():
        setattr(mould, field, value)

    db.commit()
    db.refresh(mould)
    return mould


@router.delete("/{mould_id}", status_code=204)
# Handles delete mould flow.
def delete_mould(
    mould_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["planner", "admin"])),
):
    factory_id = get_current_factory_id(current_user)
    mould = db.query(MouldModel).filter(MouldModel.id == mould_id, MouldModel.factory_id == factory_id).first()
    if not mould:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mould not found")
    db.delete(mould)
    db.commit()

