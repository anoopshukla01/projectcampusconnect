"""
Community Blueprint — Announcements, Events, Marketplace, Lost & Found, Notes, E-Library
"""

from flask import Blueprint, jsonify, request, g
from app.auth.permissions import require_auth, require_roles, get_current_user
from app.extensions import db
from app.models.community import Announcement, CampusEvent, MarketplaceItem, LostFoundItem, StudyNote, LibraryResource
from app.utils.errors import error_response, internal_error_response

community_bp = Blueprint("community", __name__)

# ── GET /community/announcements ──────────────────────────────────────────────
@community_bp.route("/announcements", methods=["GET"])
@require_auth
def get_announcements():
    announcements = Announcement.query.order_by(Announcement.created_at.desc()).all()
    res = [{
        "id": str(a.id),
        "title": a.title,
        "content": a.content,
        "source": a.author_name,
        "time": a.created_at.strftime("%b %d, %Y") if a.created_at else "Today"
    } for a in announcements]
    return jsonify({"announcements": res}), 200

# ── POST /community/announcements ─────────────────────────────────────────────
@community_bp.route("/announcements", methods=["POST"])
@require_auth
@require_roles("admin", "professor", "placement_cell")
def create_announcement():
    data = request.get_json() or {}
    user = get_current_user()
    title = data.get("title")
    content = data.get("content")
    if not title or not content:
        return error_response(400, "MISSING_FIELDS", "Title and content are required")

    role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)
    a = Announcement(
        title=title,
        content=content,
        author_name=data.get("author_name", user.email.split("@")[0]),
        author_role=role_str
    )
    db.session.add(a)
    db.session.commit()
    return jsonify({"message": "Announcement created", "id": str(a.id)}), 201

# ── GET /community/events ──────────────────────────────────────────────────────
@community_bp.route("/events", methods=["GET"])
@require_auth
def get_events():
    events = CampusEvent.query.order_by(CampusEvent.created_at.desc()).all()
    res = [{
        "id": str(e.id),
        "name": e.title,
        "tag": e.event_type,
        "meta": e.date_time,
        "venue": e.venue,
        "desc": e.description
    } for e in events]
    return jsonify({"events": res}), 200

# ── GET /community/marketplace ─────────────────────────────────────────────────
@community_bp.route("/marketplace", methods=["GET"])
@require_auth
def get_marketplace():
    items = MarketplaceItem.query.filter_by(status="active").order_by(MarketplaceItem.created_at.desc()).all()
    res = [{
        "id": str(i.id),
        "title": i.title,
        "price": i.price,
        "category": i.category,
        "desc": i.description,
        "seller": i.seller_name,
        "contact": i.contact_info
    } for i in items]
    return jsonify({"items": res}), 200

# ── GET /community/lost-and-found ──────────────────────────────────────────────
@community_bp.route("/lost-and-found", methods=["GET"])
@require_auth
def get_lost_found():
    items = LostFoundItem.query.filter_by(status="open").order_by(LostFoundItem.created_at.desc()).all()
    res = [{
        "id": str(i.id),
        "title": i.title,
        "type": i.item_type,
        "category": i.category,
        "location": i.location,
        "date": i.date_reported,
        "reporter": i.reporter_name,
        "contact": i.contact_info
    } for i in items]
    return jsonify({"items": res}), 200

# ── GET /community/notes ───────────────────────────────────────────────────────
@community_bp.route("/notes", methods=["GET"])
@require_auth
def get_notes():
    notes = StudyNote.query.order_by(StudyNote.created_at.desc()).all()
    res = [{
        "id": str(n.id),
        "title": n.title,
        "subject": n.subject,
        "semester": n.semester,
        "branch": n.branch,
        "author": n.author_name,
        "downloads": n.downloads_count
    } for n in notes]
    return jsonify({"notes": res}), 200

# ── GET /community/elibrary ────────────────────────────────────────────────────
@community_bp.route("/elibrary", methods=["GET"])
@require_auth
def get_elibrary():
    resources = LibraryResource.query.order_by(LibraryResource.created_at.desc()).all()
    res = [{
        "id": str(r.id),
        "title": r.title,
        "author": r.author,
        "subject": r.subject,
        "type": r.resource_type
    } for r in resources]
    return jsonify({"resources": res}), 200
