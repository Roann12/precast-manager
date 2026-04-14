# File overview: API route handlers and request orchestration for app/routers/wetcasting.py.
from datetime import date, datetime, time, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth.dependencies import get_current_factory_id, get_current_user
from ..database import get_db
from ..models.user import User
from ..models.wetcasting_activity import WetcastingActivity

router = APIRouter(prefix="/wetcasting", tags=["wetcasting"])


# Handles  to utc iso z flow.
def _to_utc_iso_z(dt: datetime) -> str:
    # DB values are stored as UTC-naive; mark as UTC explicitly for client parsing.
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


@router.get("/activity")
# Handles list activity flow.
def list_activity(
    section: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[int] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    factory_id = get_current_factory_id(current_user)
    q = (
        db.query(WetcastingActivity)
        .join(User, WetcastingActivity.user_id == User.id)
        .filter(WetcastingActivity.factory_id == factory_id)
        .order_by(WetcastingActivity.created_at.desc(), WetcastingActivity.id.desc())
    )
    if section:
        q = q.filter(WetcastingActivity.section == section.strip().lower())
    if action:
        q = q.filter(WetcastingActivity.action == action.strip().lower())
    if user_id is not None:
        q = q.filter(WetcastingActivity.user_id == int(user_id))
    if from_date is not None:
        q = q.filter(WetcastingActivity.created_at >= datetime.combine(from_date, time.min))
    if to_date is not None:
        q = q.filter(WetcastingActivity.created_at <= datetime.combine(to_date, time.max))

    rows = q.limit(max(1, min(int(limit), 200))).all()
    return [
        {
            "id": r.id,
            "created_at": _to_utc_iso_z(r.created_at),
            "section": r.section,
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "details": r.details,
            "user_id": r.user_id,
            "user_name": (r.user.name if r.user else None),
        }
        for r in rows
    ]


@router.get("/activity/filters")
# Handles list activity filters flow.
def list_activity_filters(
    section: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    factory_id = get_current_factory_id(current_user)
    user_query = (
        db.query(WetcastingActivity.user_id, func.max(User.name).label("user_name"))
        .join(User, WetcastingActivity.user_id == User.id)
        .filter(WetcastingActivity.factory_id == factory_id)
    )
    action_query = db.query(WetcastingActivity.action).filter(
        WetcastingActivity.factory_id == factory_id
    )
    if section:
        section_value = section.strip().lower()
        user_query = user_query.filter(WetcastingActivity.section == section_value)
        action_query = action_query.filter(WetcastingActivity.section == section_value)

    users = (
        user_query.group_by(WetcastingActivity.user_id).order_by(func.max(User.name).asc()).all()
    )
    actions = [row[0] for row in action_query.distinct().order_by(WetcastingActivity.action.asc()).all()]
    return {
        "users": [{"user_id": int(u.user_id), "user_name": u.user_name} for u in users],
        "actions": actions,
    }
