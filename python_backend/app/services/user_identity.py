"""Resolve persisted account identities without trusting token role claims."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user_id_alias_model import UserIdAlias
from app.models.user_model import User


def resolve_user_by_id(db: Session, user_id: object) -> User | None:
    if isinstance(user_id, bool) or not isinstance(user_id, (str, int)):
        return None
    try:
        parsed_id = int(user_id)
    except ValueError:
        return None
    if parsed_id < 0 or parsed_id > 2_147_483_647:
        return None
    if isinstance(user_id, str) and str(parsed_id) != user_id:
        return None

    current = db.get(User, parsed_id)
    target_id = db.scalar(select(UserIdAlias.user_id).where(UserIdAlias.old_user_id == parsed_id))
    if target_id is None:
        return current
    # An old ID must remain reserved. Refuse ambiguous identities if operations
    # accidentally reuse it; an old token must never become a different account.
    if current is not None:
        return None
    return db.get(User, target_id)
