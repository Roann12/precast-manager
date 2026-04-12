from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from ..models.wetcasting_activity import WetcastingActivity


def log_wetcasting_activity(
    db: Session,
    *,
    factory_id: int,
    user_id: int,
    section: str,
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    db.add(
        WetcastingActivity(
            factory_id=factory_id,
            user_id=user_id,
            section=section,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or None,
        )
    )
