"""
notify() — Central notification dispatch utility.

Usage (inside any blueprint route that should fire a notification):

    from app.utils.notify import notify

    # Notify a single user
    notify(user_id, "Assignment posted", body="Networks Lab due Dec 10",
           notif_type="assignment", link="/assignments")

    # Notify a list of user IDs (bulk — e.g. entire branch)
    notify([id1, id2, id3], "New announcement", notif_type="announcement")

SAFE-FAIL: notification errors never propagate — they are logged and swallowed
so that a failed notification never breaks the triggering operation.
"""

import logging
import uuid
from typing import Union

from app.extensions import db
from app.models.notification import Notification

logger = logging.getLogger(__name__)


def notify(
    user_ids: Union[str, uuid.UUID, list],
    title: str,
    *,
    body:       str  = None,
    notif_type: str  = "general",
    link:       str  = None,
) -> None:
    """
    Create one or more Notification rows.

    Args:
        user_ids:   Single user UUID (str/UUID) or list of them.
        title:      Short headline shown in the bell dropdown.
        body:       Optional longer description.
        notif_type: Category string (assignment/grade/placement/mentorship/…).
        link:       Optional relative URL ("/drives/uuid") for click-through.
    """
    if not user_ids:
        return

    # Normalise to a flat list of UUID strings
    if not isinstance(user_ids, list):
        user_ids = [user_ids]

    try:
        for uid in user_ids:
            n = Notification(
                user_id    = uuid.UUID(str(uid)) if not isinstance(uid, uuid.UUID) else uid,
                title      = title,
                body       = body,
                notif_type = notif_type,
                link       = link,
            )
            db.session.add(n)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        logger.error("notify() failed for title=%r: %s", title, exc)
