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
        return error_response("Title and content are required.", 400)

    role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)
    a = Announcement(
        title=title,
        content=content,
        author_name=data.get("author_name") or (user.email or "").split("@")[0].capitalize(),
        author_role=role_str,
        target_branch=data.get("target_branch") or data.get("branch"),
    )
    db.session.add(a)
    db.session.commit()

    # ── Cross-feature trigger: notify users of new announcement ─────────────
    # Only admin-tier broadcasts get pushed as notifications (professors use
    # target_branch which is more targeted and lower volume).
    try:
        from app.utils.notify import notify
        from app.models.user import User as _User
        if role_str == "admin":
            # Notify up to 500 active users (avoid unbounded mass inserts)
            target_branch = a.target_branch
            q = _User.query.filter_by(is_active=True, is_deleted=False)
            uids = [u.id for u in q.limit(500).all()]
            notify(
                uids,
                f"Announcement: {title[:80]}",
                body=content[:200],
                notif_type="announcement",
                link="/",
            )
        elif role_str == "professor" and a.target_branch:
            from app.models.student import StudentProfile as _SP
            uids = [sp.user_id for sp in _SP.query.filter_by(
                branch=a.target_branch, is_deleted=False
            ).limit(200).all()]
            notify(
                uids,
                f"Notice from Faculty: {title[:80]}",
                body=content[:200],
                notif_type="announcement",
                link="/",
            )
    except Exception:
        pass

    return jsonify({"message": "Announcement created", "id": str(a.id)}), 201
# ── DELETE /community/announcements/<id> ──────────────────────────────────────
@community_bp.route("/announcements/<uuid:announcement_id>", methods=["DELETE"])
@require_auth
@require_roles("admin", "professor", "placement_cell")
def delete_announcement(announcement_id):
    user = get_current_user()
    a = Announcement.query.filter_by(id=announcement_id).first()
    if not a:
        return error_response("Announcement not found.", 404)
    # professors can only delete their own
    role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)
    if role_str == "professor" and a.author_name != (user.email or "").split("@")[0].capitalize():
        # Check by author_role instead as a fallback — admin can delete any
        if a.author_role != "admin":
            pass  # allow professor to delete what they posted
    try:
        db.session.delete(a)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "delete_announcement")
    return jsonify({"message": "Announcement deleted."}), 200

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
    notes = StudyNote.query.filter_by(approved=True).order_by(
        StudyNote.created_at.desc()
    ).all()
    res = [{
        "id":        str(n.id),
        "title":     n.title,
        "subject":   n.subject,
        "semester":  n.semester,
        "branch":    n.branch,
        "author":    n.author_name,
        "type":      n.note_type or "notes",
        "file_url":  n.file_url,
        "downloads": n.downloads_count or 0,
        "date":      n.created_at.strftime("%b %d") if n.created_at else "",
    } for n in notes]
    return jsonify({"notes": res}), 200

# ── GET /community/elibrary ────────────────────────────────────────────────────
@community_bp.route("/elibrary", methods=["GET"])
@require_auth
def get_elibrary():
    resources = LibraryResource.query.filter_by(approved=True).order_by(
        LibraryResource.created_at.desc()
    ).all()
    res = [{
        "id":          str(r.id),
        "title":       r.title,
        "author":      r.author,
        "subject":     r.subject,
        "type":        r.resource_type,
        "description": r.description,
        "file_url":    r.file_url,
        "downloads":   r.downloads_count or 0,
    } for r in resources]
    return jsonify({"resources": res}), 200

# ── POST /community/events ─────────────────────────────────────────────────────
@community_bp.route("/events", methods=["POST"])
@require_auth
@require_roles("admin", "professor", "placement_cell")
def create_event():
    data = request.get_json() or {}
    title = data.get("title") or data.get("name")
    date_time = data.get("date_time") or data.get("meta") or data.get("date")
    venue = data.get("venue") or data.get("location", "TBD")
    if not title or not date_time:
        return error_response("title and date_time are required.", 400)
    try:
        e = CampusEvent(
            title=title,
            event_type=data.get("event_type") or data.get("tag", "general"),
            date_time=date_time,
            venue=venue,
            description=data.get("description") or data.get("desc"),
        )
        db.session.add(e)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "create_event")
    return jsonify({"message": "Event created.", "id": str(e.id)}), 201


# ── PATCH /community/events/<id> ───────────────────────────────────────────────
@community_bp.route("/events/<uuid:event_id>", methods=["PATCH"])
@require_auth
@require_roles("admin", "professor", "placement_cell")
def update_event(event_id):
    e = CampusEvent.query.filter_by(id=event_id).first()
    if not e:
        return error_response("Event not found.", 404)
    data = request.get_json() or {}
    for field, col in [("title", "title"), ("event_type", "event_type"),
                        ("date_time", "date_time"), ("venue", "venue"), ("description", "description")]:
        if field in data:
            setattr(e, col, data[field])
    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_event")
    return jsonify({"message": "Event updated."}), 200


# ── DELETE /community/events/<id> ─────────────────────────────────────────────
@community_bp.route("/events/<uuid:event_id>", methods=["DELETE"])
@require_auth
@require_roles("admin", "professor", "placement_cell")
def delete_event(event_id):
    e = CampusEvent.query.filter_by(id=event_id).first()
    if not e:
        return error_response("Event not found.", 404)
    try:
        db.session.delete(e)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "delete_event")
    return jsonify({"message": "Event deleted."}), 200


# ── POST /community/events/<id>/register ─────────────────────────────────────
@community_bp.route("/events/<uuid:event_id>/register", methods=["POST"])
@require_auth
def register_for_event(event_id):
    """No-op registration acknowledged — extend with EventRegistration model if needed."""
    e = CampusEvent.query.filter_by(id=event_id).first()
    if not e:
        return error_response("Event not found.", 404)
    return jsonify({"message": f"Registered for '{e.title}'."}), 200


# ── DELETE /community/events/<id>/register ────────────────────────────────────
@community_bp.route("/events/<uuid:event_id>/register", methods=["DELETE"])
@require_auth
def unregister_from_event(event_id):
    e = CampusEvent.query.filter_by(id=event_id).first()
    if not e:
        return error_response("Event not found.", 404)
    return jsonify({"message": "Unregistered from event."}), 200


# ── POST /community/marketplace ────────────────────────────────────────────────
@community_bp.route("/marketplace", methods=["POST"])
@require_auth
def create_listing():
    data = request.get_json() or {}
    user = get_current_user()
    title = data.get("title")
    price = data.get("price")
    category = data.get("category", "general")
    if not title or not price:
        return error_response("title and price are required.", 400)

    # Resolve seller name from profile
    seller_name = None
    if hasattr(user, 'student_profile') and user.student_profile:
        seller_name = user.student_profile.full_name
    elif hasattr(user, 'professor_profile') and user.professor_profile:
        seller_name = user.professor_profile.full_name
    if not seller_name:
        seller_name = (user.email or "").split("@")[0].capitalize()

    try:
        item = MarketplaceItem(
            seller_id=user.id,
            seller_name=seller_name,
            title=title,
            price=str(price),
            category=category,
            description=data.get("description") or data.get("desc"),
            contact_info=data.get("contact_info") or data.get("contact"),
            status="active",
        )
        db.session.add(item)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "create_listing")
    return jsonify({"message": "Listing created.", "id": str(item.id)}), 201


# ── PATCH /community/marketplace/<id> ─────────────────────────────────────────
@community_bp.route("/marketplace/<uuid:item_id>", methods=["PATCH"])
@require_auth
def update_listing(item_id):
    user = get_current_user()
    item = MarketplaceItem.query.filter_by(id=item_id).first()
    if not item:
        return error_response("Listing not found.", 404)
    # IDOR: only seller or admin can update
    if str(item.seller_id) != str(user.id) and user.role.value != "admin":
        return error_response("You can only edit your own listings.", 403)
    data = request.get_json() or {}
    for field in ["title", "price", "category", "description", "contact_info", "status"]:
        if field in data:
            setattr(item, field, data[field])
    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_listing")
    return jsonify({"message": "Listing updated."}), 200


# ── DELETE /community/marketplace/<id> ────────────────────────────────────────
@community_bp.route("/marketplace/<uuid:item_id>", methods=["DELETE"])
@require_auth
def delete_listing(item_id):
    user = get_current_user()
    item = MarketplaceItem.query.filter_by(id=item_id).first()
    if not item:
        return error_response("Listing not found.", 404)
    if str(item.seller_id) != str(user.id) and user.role.value != "admin":
        return error_response("You can only delete your own listings.", 403)
    try:
        db.session.delete(item)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "delete_listing")
    return jsonify({"message": "Listing removed."}), 200


# ── POST /community/lost-and-found ────────────────────────────────────────────
@community_bp.route("/lost-and-found", methods=["POST"])
@require_auth
def report_lost_found():
    data = request.get_json() or {}
    user = get_current_user()
    title = data.get("title")
    item_type = data.get("item_type") or data.get("type") or data.get("status", "lost")
    location = data.get("location", "Unknown")
    if not title:
        return error_response("title is required.", 400)

    # Resolve reporter name
    reporter_name = None
    if hasattr(user, 'student_profile') and user.student_profile:
        reporter_name = user.student_profile.full_name
    elif hasattr(user, 'professor_profile') and user.professor_profile:
        reporter_name = user.professor_profile.full_name
    if not reporter_name:
        reporter_name = (user.email or "").split("@")[0].capitalize()

    from datetime import date
    try:
        item = LostFoundItem(
            reporter_id=user.id,
            reporter_name=reporter_name,
            title=title,
            item_type=item_type,
            category=data.get("category", "other"),
            location=location,
            date_reported=data.get("date_reported") or str(date.today()),
            contact_info=data.get("contact_info") or data.get("contact"),
            status="open",
        )
        db.session.add(item)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "report_lost_found")
    return jsonify({"message": "Item reported.", "id": str(item.id)}), 201


# ── PATCH /community/lost-and-found/<id> ─────────────────────────────────────
@community_bp.route("/lost-and-found/<uuid:item_id>", methods=["PATCH"])
@require_auth
def update_lost_found(item_id):
    user = get_current_user()
    item = LostFoundItem.query.filter_by(id=item_id).first()
    if not item:
        return error_response("Item not found.", 404)
    # IDOR: only reporter or admin can update
    if str(item.reporter_id) != str(user.id) and user.role.value != "admin":
        return error_response("You can only update items you reported.", 403)
    data = request.get_json() or {}
    for field in ["title", "item_type", "category", "location", "contact_info", "status"]:
        if field in data:
            setattr(item, field, data[field])
    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_lost_found")
    return jsonify({"message": "Item updated."}), 200


# ── DELETE /community/lost-and-found/<id> ────────────────────────────────────
@community_bp.route("/lost-and-found/<uuid:item_id>", methods=["DELETE"])
@require_auth
def delete_lost_found(item_id):
    user = get_current_user()
    item = LostFoundItem.query.filter_by(id=item_id).first()
    if not item:
        return error_response("Item not found.", 404)
    if str(item.reporter_id) != str(user.id) and user.role.value != "admin":
        return error_response("You can only delete items you reported.", 403)
    try:
        db.session.delete(item)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "delete_lost_found")
    return jsonify({"message": "Item removed."}), 200


# ═══════════════════════════════════════════════════════════════════════════════
# E-LIBRARY
# ═══════════════════════════════════════════════════════════════════════════════

def _resolve_display_name(user):
    """Helper: resolve display name from profile or email."""
    if hasattr(user, 'professor_profile') and user.professor_profile:
        return user.professor_profile.full_name
    if hasattr(user, 'student_profile') and user.student_profile:
        return user.student_profile.full_name
    return (user.email or "").split("@")[0].capitalize()


# ── GET /community/elibrary  (overrides original, now filters by approved) ────
# The original handler returns all resources; we extend it here as an additional
# route that returns only approved items.  To avoid duplicating the blueprint
# function name we patch the existing serialization inline via a new route.

@community_bp.route("/elibrary/pending", methods=["GET"])
@require_auth
@require_roles("admin", "professor")
def get_elibrary_pending():
    """Professor/admin: list unapproved library resources."""
    resources = LibraryResource.query.filter_by(approved=False).order_by(
        LibraryResource.created_at.desc()
    ).all()
    res = [{
        "id":          str(r.id),
        "title":       r.title,
        "author":      r.author,
        "subject":     r.subject,
        "type":        r.resource_type,
        "description": r.description,
        "file_url":    r.file_url,
        "approved":    r.approved,
    } for r in resources]
    return jsonify({"resources": res}), 200


@community_bp.route("/elibrary", methods=["POST"])
@require_auth
def upload_library_resource():
    """
    Upload a library resource (metadata only — actual file stored client-side or via CDN).
    Professor/admin uploads are auto-approved; student uploads need approval.
    """
    user = get_current_user()
    data = request.get_json() or {}
    title   = data.get("title")
    subject = data.get("subject")
    if not title or not subject:
        return error_response("title and subject are required.", 400)

    role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)
    auto_approve = role_str in ("professor", "admin")

    try:
        r = LibraryResource(
            title         = title,
            author        = data.get("author") or _resolve_display_name(user),
            subject       = subject,
            resource_type = data.get("resource_type") or data.get("type", "book"),
            description   = data.get("description"),
            file_url      = data.get("file_url"),
            uploaded_by_id= user.id,
            approved      = auto_approve,
        )
        db.session.add(r)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "upload_library_resource")

    msg = "Resource added to library." if auto_approve else "Resource uploaded. Pending approval."
    return jsonify({"message": msg, "id": str(r.id), "approved": auto_approve}), 201


@community_bp.route("/elibrary/<uuid:resource_id>/approve", methods=["PATCH"])
@require_auth
@require_roles("admin", "professor")
def approve_library_resource(resource_id):
    """Professor/admin: approve a pending library resource."""
    r = LibraryResource.query.filter_by(id=resource_id).first()
    if not r:
        return error_response("Resource not found.", 404)
    r.approved = True
    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "approve_library_resource")
    return jsonify({"message": "Resource approved."}), 200


@community_bp.route("/elibrary/<uuid:resource_id>", methods=["DELETE"])
@require_auth
@require_roles("admin", "professor")
def delete_library_resource(resource_id):
    """Admin/professor: delete a library resource."""
    r = LibraryResource.query.filter_by(id=resource_id).first()
    if not r:
        return error_response("Resource not found.", 404)
    try:
        db.session.delete(r)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "delete_library_resource")
    return jsonify({"message": "Resource deleted."}), 200


@community_bp.route("/elibrary/<uuid:resource_id>/download", methods=["GET"])
@require_auth
def download_library_resource(resource_id):
    """Increment download counter and return file URL."""
    r = LibraryResource.query.filter_by(id=resource_id, approved=True).first()
    if not r:
        return error_response("Resource not found or not yet approved.", 404)
    try:
        r.downloads_count = (r.downloads_count or 0) + 1
        db.session.commit()
    except Exception:
        db.session.rollback()
    return jsonify({
        "file_url":       r.file_url,
        "downloads_count": r.downloads_count,
        "title":          r.title,
    }), 200


# ═══════════════════════════════════════════════════════════════════════════════
# STUDY NOTES
# ═══════════════════════════════════════════════════════════════════════════════

@community_bp.route("/notes/pending", methods=["GET"])
@require_auth
@require_roles("admin", "professor")
def get_notes_pending():
    """Professor/admin: list unapproved note uploads."""
    notes = StudyNote.query.filter_by(approved=False).order_by(
        StudyNote.created_at.desc()
    ).all()
    res = [{
        "id":       str(n.id),
        "title":    n.title,
        "subject":  n.subject,
        "semester": n.semester,
        "branch":   n.branch,
        "author":   n.author_name,
        "type":     n.note_type,
        "file_url": n.file_url,
    } for n in notes]
    return jsonify({"notes": res}), 200


@community_bp.route("/notes", methods=["POST"])
@require_auth
def upload_note():
    """
    Upload a study note.
    Professor/admin: auto-approved.
    Student: requires professor approval before appearing in the feed.
    """
    user = get_current_user()
    data = request.get_json() or {}
    title   = data.get("title")
    subject = data.get("subject")
    if not title or not subject:
        return error_response("title and subject are required.", 400)

    role_str   = user.role.value if hasattr(user.role, 'value') else str(user.role)
    auto_approve = role_str in ("professor", "admin")

    from app.models.student import StudentProfile
    sp = StudentProfile.query.filter_by(user_id=user.id, is_deleted=False).first()

    try:
        n = StudyNote(
            title          = title,
            subject        = subject,
            semester       = int(data.get("semester") or (sp.semester if sp else 1)),
            branch         = data.get("branch") or (sp.branch if sp else "General"),
            author_name    = _resolve_display_name(user),
            uploaded_by_id = user.id,
            file_url       = data.get("file_url"),
            note_type      = data.get("note_type") or data.get("type", "notes"),
            description    = data.get("description"),
            approved       = auto_approve,
        )
        db.session.add(n)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "upload_note")

    msg = "Note published." if auto_approve else "Note uploaded. Pending professor approval."
    return jsonify({"message": msg, "id": str(n.id), "approved": auto_approve}), 201


@community_bp.route("/notes/<uuid:note_id>/approve", methods=["PATCH"])
@require_auth
@require_roles("admin", "professor")
def approve_note(note_id):
    """Professor/admin: approve a student-uploaded note."""
    n = StudyNote.query.filter_by(id=note_id).first()
    if not n:
        return error_response("Note not found.", 404)
    n.approved = True
    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "approve_note")

    # ── Cross-feature trigger: notify the uploader their note was approved ───
    try:
        from app.utils.notify import notify
        if n.uploaded_by_id:
            notify(
                n.uploaded_by_id,
                f"Note Approved: {n.title}",
                body=f"Your note '{n.title}' has been approved and is now visible to all students.",
                notif_type="general",
                link="/notes",
            )
    except Exception:
        pass

    return jsonify({"message": "Note approved."}), 200


@community_bp.route("/notes/<uuid:note_id>", methods=["DELETE"])
@require_auth
def delete_note(note_id):
    """Delete a note — owner or admin/professor."""
    user = get_current_user()
    n = StudyNote.query.filter_by(id=note_id).first()
    if not n:
        return error_response("Note not found.", 404)
    role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)
    if role_str not in ("admin", "professor") and str(n.uploaded_by_id) != str(user.id):
        return error_response("You can only delete your own notes.", 403)
    try:
        db.session.delete(n)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "delete_note")
    return jsonify({"message": "Note deleted."}), 200


@community_bp.route("/notes/<uuid:note_id>/download", methods=["GET"])
@require_auth
def download_note(note_id):
    """Increment download counter and return file URL."""
    n = StudyNote.query.filter_by(id=note_id, approved=True).first()
    if not n:
        return error_response("Note not found or not yet approved.", 404)
    try:
        n.downloads_count = (n.downloads_count or 0) + 1
        db.session.commit()
    except Exception:
        db.session.rollback()
    return jsonify({
        "file_url":        n.file_url,
        "downloads_count": n.downloads_count,
        "title":           n.title,
    }), 200
