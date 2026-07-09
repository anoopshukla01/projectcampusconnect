"""
Notifications Blueprint

ENDPOINT SUMMARY (all at /api/v1/notifications):
  GET  /                      — paginated list for current user (newest first)
  GET  /unread-count          — { count: N } — used by bell badge
  PATCH /<uuid:id>/read       — mark a single notification read
  POST /mark-all-read         — mark every unread notification read

SECURITY:
  [x] @require_auth on every endpoint
  [x] IDOR: every query filters by user_id == g.current_user.id — users
      can only see / modify their own notifications.
"""

from flask import Blueprint, jsonify, request
from app.auth.permissions import require_auth, get_current_user
from app.extensions import db
from app.models.notification import Notification
from app.utils.errors import error_response, internal_error_response

notifications_bp = Blueprint("notifications", __name__)


# ── GET /notifications ─────────────────────────────────────────────────────────
@notifications_bp.route("", methods=["GET"])
@require_auth
def list_notifications():
    """
    Return paginated notifications for the current user.
    Query params:
      page     (default 1)
      per_page (default 20, max 50)
      unread   (boolean — only return unread if true)
    """
    user     = get_current_user()
    page     = request.args.get("page",     1,  type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 50)
    only_unread = request.args.get("unread", "false").lower() == "true"

    q = Notification.query.filter_by(user_id=user.id)
    if only_unread:
        q = q.filter_by(is_read=False)
    q = q.order_by(Notification.created_at.desc())

    total   = q.count()
    notifs  = q.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        "notifications": [n.to_dict() for n in notifs],
        "total":   total,
        "page":    page,
        "pages":   (total + per_page - 1) // per_page if per_page else 1,
        "unread":  Notification.query.filter_by(user_id=user.id, is_read=False).count(),
    }), 200


# ── GET /notifications/unread-count ───────────────────────────────────────────
@notifications_bp.route("/unread-count", methods=["GET"])
@require_auth
def unread_count():
    """Lightweight endpoint polled by the bell badge."""
    user  = get_current_user()
    count = Notification.query.filter_by(user_id=user.id, is_read=False).count()
    return jsonify({"count": count}), 200


# ── PATCH /notifications/<id>/read ────────────────────────────────────────────
@notifications_bp.route("/<uuid:notif_id>/read", methods=["PATCH"])
@require_auth
def mark_read(notif_id):
    """Mark a single notification as read. IDOR-guarded by user_id filter."""
    user  = get_current_user()
    notif = Notification.query.filter_by(id=notif_id, user_id=user.id).first()
    if not notif:
        return error_response("Notification not found.", 404)
    try:
        notif.is_read = True
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "mark_read")
    return jsonify({"message": "Marked as read."}), 200


# ── POST /notifications/mark-all-read ─────────────────────────────────────────
@notifications_bp.route("/mark-all-read", methods=["POST"])
@require_auth
def mark_all_read():
    """Mark every unread notification read for the current user."""
    user = get_current_user()
    try:
        Notification.query.filter_by(
            user_id=user.id, is_read=False
        ).update({"is_read": True})
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "mark_all_read")
    return jsonify({"message": "All notifications marked as read."}), 200
