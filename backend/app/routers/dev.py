from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.seed import seed_demo_data
from ..auth.dependencies import require_role

router = APIRouter(prefix="/dev", tags=["development"])


@router.post("/seed")
def seed_database(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin"])),
):
    # Only "super admin" (factory_id == None) can reseed.
    if current_user.factory_id is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    return seed_demo_data(db)