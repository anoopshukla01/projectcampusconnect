"""
Centralised Access-Control — Auth, RBAC, and IDOR Guards

SECURITY CONTRACT — every protected route MUST stack these decorators
in this order:

    @bp.route("/students/<uuid:student_id>", methods=["GET"])
    @require_auth
    @require_roles("admin", "placement_cell")
    def get_student(student_id):
        ...

THREE-GATE CHECK (per the implementation plan):
  Gate 1: Is the user authenticated?           → @require_auth
  Gate 2: Does their role permit this action?  → @require_roles(*roles)
  Gate 3: Are they accessing their own record? → require_self_or_admin(url_id, roles)

  Never skip a gate. Never inline these checks in route bodies.
  Duplicated checks are where bugs hide.

IMPORTANT: g.current_user is set by @require_auth and is ALWAYS a real,
non-deleted User object from the database. It is safe to read g.current_user
in any downstream function inside a protected request.
"""

import functools
import uuid

from flask import g, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

from app.extensions import db
from app.models.user import User, UserRole


# ── Gate 1: Authentication ────────────────────────────────────────────────────

def require_auth(fn):
    """
    Decorator — Gate 1.

    Validates the JWT in the Authorization header.
    Loads the User from the database and stores it on flask.g.current_user.

    Rejects with 401 if:
      - No token present
      - Token is expired, malformed, or revoked (blocklist check in __init__.py)
      - User record no longer exists or is soft-deleted
      - User account is not active (is_active=False)
    """
    @functools.wraps(fn)
    def decorated(*args, **kwargs):
        # Raises JWTExtendedException subclass → caught by global error handlers
        verify_jwt_in_request()

        user_id = get_jwt_identity()
        user = db.session.get(User, uuid.UUID(user_id))

        if not user or user.is_deleted:
            return jsonify({"error": "User account not found."}), 401

        if not user.is_active:
            return jsonify({"error": "Account not yet activated. Please contact the administrator."}), 403

        g.current_user = user
        return fn(*args, **kwargs)

    return decorated


# ── Gate 2: Role-Based Access Control ─────────────────────────────────────────

def require_roles(*roles: str):
    """
    Decorator factory — Gate 2.

    Accepts role name strings: "student", "professor", "admin", "placement_cell".
    Must be applied AFTER @require_auth (depends on g.current_user).

    Usage:
        @require_auth
        @require_roles("admin", "placement_cell")
        def some_view():
            ...

    Returns 403 if the authenticated user's role is not in the allowed set.
    Returns 403 (not 401) because we know WHO the user is — they just don't
    have PERMISSION. This distinction matters for security auditing.
    """
    allowed = {UserRole(r) for r in roles}

    def decorator(fn):
        @functools.wraps(fn)
        def decorated(*args, **kwargs):
            if g.current_user.role not in allowed:
                return jsonify({"error": "You do not have permission to perform this action."}), 403
            return fn(*args, **kwargs)
        return decorated

    return decorator


# ── Gate 3: Object-Level Access (IDOR prevention) ─────────────────────────────

def require_self_or_roles(url_param: str, *privileged_roles: str):
    """
    Decorator factory — Gate 3 (IDOR guard).

    Allows access if:
      (a) The requesting user IS the resource owner (url_param matches their id), OR
      (b) The requesting user has one of the privileged_roles.

    Returns 403 for everyone else — including authenticated users of the right
    role type who try to access another user's specific record.

    IDOR = Insecure Direct Object Reference. Example: Student A calls
    GET /students/student-b-uuid — without this check, A could read B's data.

    Args:
        url_param:        Name of the URL parameter holding the target user's UUID.
                          e.g., "student_id" for /students/<uuid:student_id>
        privileged_roles: Roles that bypass the self-check (e.g., "admin").

    Usage:
        @require_auth
        @require_self_or_roles("student_id", "admin", "placement_cell")
        def get_student(student_id):
            ...
    """
    allowed_roles = {UserRole(r) for r in privileged_roles}

    def decorator(fn):
        @functools.wraps(fn)
        def decorated(*args, **kwargs):
            user = g.current_user

            # Gate 2a: privileged roles bypass IDOR check
            if user.role in allowed_roles:
                return fn(*args, **kwargs)

            # Gate 2b: resource owner check
            target_id = kwargs.get(url_param)
            if target_id is None:
                # Programmer error: wrong param name in decorator
                return jsonify({"error": "Access control misconfiguration."}), 500

            if str(user.id) != str(target_id):
                # Return 403, not 404 — don't confirm or deny the resource exists.
                # (Returning 404 would let an attacker enumerate valid UUIDs.)
                return jsonify({"error": "You do not have permission to access this resource."}), 403

            return fn(*args, **kwargs)

        return decorated

    return decorator


# ── Central System Permission Matrix ──────────────────────────────────────────

PERMISSION_MATRIX = {
    # Timetable
    "timetable:view": ["student", "professor", "placement_cell", "admin"],
    "timetable:edit": ["professor", "admin"],
    "timetable:add_extra": ["professor", "admin"],

    # Placement
    "placement:view_drives": ["student", "placement_cell", "admin"],
    "placement:manage_drives": ["placement_cell", "admin"],
    "placement:apply": ["student"],
    "placement:shortlist": ["placement_cell", "admin"],
    "placement:extend_offer": ["placement_cell", "admin"],

    # User Profiles
    "profile:edit_own": ["student", "professor", "placement_cell", "admin"],
    "profile:view_all": ["admin", "placement_cell"],

    # Administration
    "users:manage": ["admin"],
    "invites:generate": ["admin"],
    "csv:import": ["admin"],
    "accreditation:reports": ["admin"],

    # Community & Content
    "announcements:create": ["admin", "professor", "placement_cell"],
}


def require_permission(action: str):
    """
    Decorator factory — Action-based Permission Check.
    Checks the user's role against the central PERMISSION_MATRIX.
    Must be applied AFTER @require_auth.
    """
    allowed_role_strs = PERMISSION_MATRIX.get(action, [])
    allowed = {UserRole(r) for r in allowed_role_strs}

    def decorator(fn):
        @functools.wraps(fn)
        def decorated(*args, **kwargs):
            if g.current_user.role not in allowed:
                return jsonify({"error": f"You do not have permission to perform '{action}'."}), 403
            return fn(*args, **kwargs)
        return decorated

    return decorator


def require_ownership_or_roles(get_owner_id_fn, *privileged_roles: str):
    """
    Decorator factory — Row-Level Ownership Guard.
    Calls `get_owner_id_fn(**kwargs)` to retrieve the resource owner's UUID.
    Access is granted if current user IS owner OR user possesses a privileged_role.
    """
    allowed_roles = {UserRole(r) for r in privileged_roles}

    def decorator(fn):
        @functools.wraps(fn)
        def decorated(*args, **kwargs):
            user = g.current_user
            if user.role in allowed_roles:
                return fn(*args, **kwargs)

            owner_id = get_owner_id_fn(*args, **kwargs)
            if owner_id is None or str(user.id) != str(owner_id):
                return jsonify({"error": "You do not own this resource or lack authorization."}), 403

            return fn(*args, **kwargs)

        return decorated

    return decorator


# ── Convenience shortcut ───────────────────────────────────────────────────────

def get_current_user() -> User:
    """
    Returns g.current_user.
    Only call this inside a route protected by @require_auth.
    """
    return g.current_user
