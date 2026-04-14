# File overview: API route handlers and request orchestration for app/routers/mix_designs.py.
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth.dependencies import get_current_user, require_role
from ..models.mix_design import MixDesign as MixDesignModel
from ..schemas.mix_design import MixDesign, MixDesignCreate, MixDesignUpdate

router = APIRouter(prefix="/mix-designs", tags=["mix-designs"])


@router.get("", response_model=List[MixDesign])
# Handles list mix designs flow.
def list_mix_designs(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = db.query(MixDesignModel).order_by(MixDesignModel.active.desc(), MixDesignModel.name)
    # Factories must not see other factories' confidential mix designs.
    if current_user.factory_id is not None:
        q = q.filter(MixDesignModel.factory_id == current_user.factory_id)
    return q.all()


@router.post("", response_model=MixDesign, status_code=201)
# Handles create mix design flow.
def create_mix_design(
    body: MixDesignCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["planner", "admin"])),
):
    if current_user.factory_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Factory-scoped access required")
    obj = MixDesignModel(**body.dict(), factory_id=current_user.factory_id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{mix_design_id}", response_model=MixDesign)
# Handles get mix design flow.
def get_mix_design(mix_design_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    obj = db.get(MixDesignModel, mix_design_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mix design not found")
    if current_user.factory_id is not None and obj.factory_id != current_user.factory_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mix design not found")
    return obj


@router.put("/{mix_design_id}", response_model=MixDesign)
# Handles update mix design flow.
def update_mix_design(
    mix_design_id: int,
    body: MixDesignUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["planner", "admin"])),
):
    obj = db.get(MixDesignModel, mix_design_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mix design not found")
    if current_user.factory_id is None or obj.factory_id != current_user.factory_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mix design not found")
    for k, v in body.dict(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{mix_design_id}", status_code=204)
# Handles delete mix design flow.
def delete_mix_design(
    mix_design_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["planner", "admin"])),
):
    obj = db.get(MixDesignModel, mix_design_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mix design not found")
    if current_user.factory_id is None or obj.factory_id != current_user.factory_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mix design not found")
    db.delete(obj)
    db.commit()
    return None

