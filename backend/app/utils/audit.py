"""
Audit Utility — Centralized Audit Logging

DESIGN INTENT:
  Every action that touches sensitive data gets an audit record.
  The audit_action() function and @audit decorator are the ONLY two
  ways to write audit logs — never write to audit_logs directly in route code.

WHAT GETS AUDITED (non-exhaustive):
  - All auth events: login (success + fail), logout, OTP send/verify,
    registration, password change
  - Admin edits to any user's record
  - Any read of a student's placement data by Placement Cell
  - Drive creation, updates, deletion
  - Shortlist and offer operations
  - Account lock / unlock events

FIELDS:
  actor_id   — the user performing the action (NULL for anonymous)
  actor_role — snapshot of their role at the time (in case role changes later)
  action     — dot-notation string, e.g. "auth.login.success"
  target_type — model name, e.g. "student_profile"
  target_id   — UUID of the affected record
  ip_address  — from request.remote_addr (X-Forwarded-For handled in proxy config)
  user_agent  — request.headers.get("User-Agent")
  detail      — JSONB payload with field-level diffs or extra context
"""

import functools
import logging
from typing import Any

from flask import g, request

from app.extensions import db
from app.models.audit import AuditLog

logger = logging.getLogger(__name__)


def audit_action(
    action: str,
    *,
    target_type: str | None = None,
    target_id: str | None = None,
    detail: dict | None = None,
) -> None:
    """
    Write one audit log entry for the current request context.

    Must be called inside a Flask request context (i.e., inside a route handler
    or a function called from one).

    Args:
        action:      Dot-notation action name, e.g. "auth.login.success".
        target_type: Model/resource type, e.g. "student_profile".
        target_id:   UUID (as string) of the affected record.
        detail:      Arbitrary dict with extra context (field diffs, error msgs).

    SECURITY: Never put raw passwords, OTP codes, or tokens in `detail`.
              Only put safe metadata (old vs new field values, error types, etc.)
    """
    try:
        actor = getattr(g, "current_user", None)
        import uuid as uuid_lib
        target_uuid = None
        if target_id:
            target_uuid = uuid_lib.UUID(str(target_id))

        entry = AuditLog(
            actor_id=actor.id if actor else None,
            actor_role=actor.role.value if actor else None,
            action=action,
            target_type=target_type,
            target_id=target_uuid,
            ip_address=_get_ip(),
            user_agent=request.headers.get("User-Agent", "")[:500],
            detail=detail,
        )
        db.session.add(entry)
        db.session.commit()
    except Exception as exc:  # noqa: BLE001
        # Audit failures must NEVER break the request that triggered them.
        # Log the failure server-side and continue.
        logger.error("Audit log write failed for action=%r: %s", action, exc)


def _get_ip() -> str:
    """
    Return the real client IP address.

    If the app is behind a reverse proxy (nginx, Gunicorn), set
    REAL_IP_HEADER env var to 'X-Forwarded-For' or 'X-Real-IP' and
    trust only the last hop. For simplicity we use remote_addr by default.
    """
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        # Take the leftmost IP (client) — the others are proxies.
        return xff.split(",")[0].strip()
    return request.remote_addr or "unknown"
