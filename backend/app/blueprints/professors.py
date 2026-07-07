"""
Professor Blueprint — Endpoints P1–P6

ENDPOINT SUMMARY (all at /api/v1/professors):
  P1  GET /professors/me                 — get own profile
  P2  PATCH /professors/me               — update own profile
  P3  GET /professors/<uuid:prof_id>     — get specific professor (admin only)
  P4  GET /professors                    — list professors (admin only)
  P5  PATCH /professors/<uuid:prof_id>   — admin update (audited)
  P6  DELETE /professors/<uuid:prof_id>  — admin soft delete (audited)

SELF-REVIEW CHECKLIST:
  [x] Auth check present          — all routes decorated with @require_auth
  [x] Role check present          — RBAC enforced
  [x] IDOR guard present          — implicit in me routes; S3/S4/S5/S6 restricted to admin
  [x] Input validated             — Marshmallow handles PATCH requests
  [x] Errors handled safely       — 404/403 errors and transaction rollback
  [x] Transaction/rollback        — P5 database edits use db.session.commit() with rollback
  [x] Tests written               — see tests/test_professors.py
"""

from flask import Blueprint, jsonify, request
from marshmallow import ValidationError

from app.auth.permissions import require_auth, require_roles, get_current_user
from app.extensions import db
from app.models.professor import ProfessorProfile, ApprovalStatus
from app.schemas.professor import ProfessorResponseSchema, ProfessorUpdateSchema, AdminProfessorUpdateSchema
from app.utils.audit import audit_action
from app.utils.errors import error_response, internal_error_response, validation_error_response

professors_bp = Blueprint("professors", __name__)


# ── P1: GET /professors/me ────────────────────────────────────────────────────

@professors_bp.get("/me")
@require_auth
@require_roles("professor")
def get_own_profile():
    user = get_current_user()
    profile = user.professor_profile
    if not profile or profile.is_deleted:
        return error_response("Professor profile not found.", 404)

    return jsonify(ProfessorResponseSchema().dump(profile)), 200


# ── P2: PATCH /professors/me ──────────────────────────────────────────────────

@professors_bp.patch("/me")
@require_auth
@require_roles("professor")
def update_own_profile():
    user = get_current_user()
    profile = user.professor_profile
    if not profile or profile.is_deleted:
        return error_response("Professor profile not found.", 404)

    try:
        data = ProfessorUpdateSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    try:
        for field, val in data.items():
            setattr(profile, field, val)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_own_profile")

    audit_action("professor.profile.update", target_type="professor_profile", target_id=str(profile.id))
    return jsonify(ProfessorResponseSchema().dump(profile)), 200


# ── P3: GET /professors/<uuid:prof_id> ────────────────────────────────────────

@professors_bp.get("/<uuid:prof_id>")
@require_auth
@require_roles("admin")
def get_professor_by_id(prof_id):
    profile = db.session.query(ProfessorProfile).filter_by(
        id=prof_id, is_deleted=False
    ).first()

    if not profile:
        return error_response("Professor profile not found.", 404)

    return jsonify(ProfessorResponseSchema().dump(profile)), 200


# ── P4: GET /professors ───────────────────────────────────────────────────────

@professors_bp.get("")
@require_auth
@require_roles("admin")
def list_professors():
    department = request.args.get("department")
    status = request.args.get("status")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    query = db.session.query(ProfessorProfile).filter(ProfessorProfile.is_deleted == False) # noqa: E712

    if department:
        query = query.filter(ProfessorProfile.department == department)
    if status:
        query = query.filter(ProfessorProfile.approval_status == ApprovalStatus(status))

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    schema = ProfessorResponseSchema(many=True)

    return jsonify({
        "professors": schema.dump(paginated.items),
        "total": paginated.total,
        "page": paginated.page,
        "pages": paginated.pages
    }), 200


# ── P5: PATCH /professors/<uuid:prof_id> ──────────────────────────────────────

@professors_bp.patch("/<uuid:prof_id>")
@require_auth
@require_roles("admin")
def admin_update_professor(prof_id):
    profile = db.session.query(ProfessorProfile).filter_by(
        id=prof_id, is_deleted=False
    ).first()

    if not profile:
        return error_response("Professor profile not found.", 404)

    try:
        data = AdminProfessorUpdateSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    diff = {}
    for field, val in data.items():
        if field == "is_active":
            if profile.user.is_active != val:
                diff["is_active"] = {"old": profile.user.is_active, "new": val}
                profile.user.is_active = val
        elif field == "approval_status":
            old_enum = profile.approval_status
            new_enum = ApprovalStatus(val)
            if old_enum != new_enum:
                diff["approval_status"] = {"old": old_enum.value, "new": new_enum.value}
                profile.approval_status = new_enum
                # If approved, activate the user automatically
                if new_enum == ApprovalStatus.APPROVED:
                    profile.user.is_active = True
                    profile.approved_by = get_current_user().id
                    from datetime import datetime, timezone
                    profile.approved_at = datetime.now(timezone.utc)
        else:
            old_val = getattr(profile, field)
            if old_val != val:
                diff[field] = {"old": str(old_val) if old_val is not None else None, "new": str(val) if val is not None else None}
                setattr(profile, field, val)

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "admin_update_professor")

    if diff:
        audit_action("admin.professor.update", target_type="professor_profile",
                     target_id=str(profile.id), detail=diff)

    return jsonify(ProfessorResponseSchema().dump(profile)), 200


# ── P6: DELETE /professors/<uuid:prof_id> ─────────────────────────────────────

@professors_bp.delete("/<uuid:prof_id>")
@require_auth
@require_roles("admin")
def admin_delete_professor(prof_id):
    profile = db.session.query(ProfessorProfile).filter_by(
        id=prof_id, is_deleted=False
    ).first()

    if not profile:
        return error_response("Professor profile not found.", 404)

    try:
        profile.is_deleted = True
        profile.user.is_deleted = True
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "admin_delete_professor")

    audit_action("admin.professor.delete", target_type="professor_profile", target_id=str(profile.id))
    return jsonify({"message": "Professor profile soft-deleted successfully."}), 200
