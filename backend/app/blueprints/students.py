"""
Student Blueprint — Endpoints S1–S8

ENDPOINT SUMMARY (all at /api/v1/students):
  S1  GET /students/me                 — get own profile
  S2  PATCH /students/me               — update own profile (metrics locked)
  S3  GET /students/<uuid:student_id>  — get specific student (admin/TPO only)
  S4  GET /students                    — list students (admin/TPO only)
  S5  PATCH /students/<uuid:student_id>— admin update (metrics editable; audited)
  S6  DELETE /students/<uuid:student_id>— admin soft delete (audited)
  S7  GET /students/<uuid:student_id>/applications — list applications (owner/admin/TPO; IDOR checked)
  S8  GET /students/<uuid:student_id>/offers       — list offers (owner/admin/TPO; IDOR checked)

SELF-REVIEW CHECKLIST:
  [x] Auth check present          — all routes decorated with @require_auth
  [x] Role check present          — RBAC enforced using @require_roles or decorators
  [x] IDOR guard present          — @require_self_or_roles guards owner check for S7, S8, S1, S2 (implicit)
  [x] Input validated             — Marshmallow handles PATCH requests
  [x] Errors handled safely       — 404/403 errors and transaction rollback
  [x] Transaction/rollback        — S5 database edits use db.session.commit() with rollback
  [x] Tests written               — see tests/test_students.py
"""

import uuid
from flask import Blueprint, jsonify, request, g
from marshmallow import ValidationError

from app.auth.permissions import require_auth, require_roles, require_self_or_roles, get_current_user, assert_college_match
from app.extensions import db
from app.models.user import User, UserRole
from app.models.student import StudentProfile
from app.models.placement import DriveApplication, PlacementOffer
from app.schemas.student import StudentResponseSchema, StudentUpdateSchema, AdminStudentUpdateSchema
from app.utils.audit import audit_action
from app.utils.errors import error_response, internal_error_response, validation_error_response

students_bp = Blueprint("students", __name__)


# ── S1: GET /students/me ──────────────────────────────────────────────────────

@students_bp.get("/me")
@require_auth
@require_roles("student")
def get_own_profile():
    user = get_current_user()
    profile = user.student_profile
    if not profile or profile.is_deleted:
        return error_response("Student profile not found.", 404)

    schema = StudentResponseSchema(context={"role": "student", "is_owner": True})
    return jsonify(schema.dump(profile)), 200


# ── S2: PATCH /students/me ────────────────────────────────────────────────────

@students_bp.patch("/me")
@require_auth
@require_roles("student")
def update_own_profile():
    user = get_current_user()
    profile = user.student_profile
    if not profile or profile.is_deleted:
        return error_response("Student profile not found.", 404)

    try:
        data = StudentUpdateSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    try:
        # Update allowed fields only
        for field, val in data.items():
            setattr(profile, field, val)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_own_profile")

    audit_action("student.profile.update", target_type="student_profile", target_id=str(profile.id))
    schema = StudentResponseSchema(context={"role": "student", "is_owner": True})
    return jsonify(schema.dump(profile)), 200


# ── S3: GET /students/<uuid:student_id> ───────────────────────────────────────

@students_bp.get("/<uuid:student_id>")
@require_auth
@require_roles("admin", "placement_cell")
def get_student_by_id(student_id):
    profile = db.session.query(StudentProfile).filter_by(
        id=student_id, college_id=g.current_user.college_id, is_deleted=False
    ).first()

    if not profile:
        return error_response("Student profile not found.", 404)

    # Audit placement cell reading student data
    user = get_current_user()
    if user.role == UserRole.PLACEMENT_CELL:
        audit_action("placement.student.read", target_type="student_profile", target_id=str(student_id))

    schema = StudentResponseSchema(context={"role": user.role.value, "is_owner": False})
    return jsonify(schema.dump(profile)), 200


# ── S4: GET /students ─────────────────────────────────────────────────────────

@students_bp.get("")
@require_auth
@require_roles("admin", "placement_cell")
def list_students():
    # S4 — Paginated student directory with filters
    branch = request.args.get("branch")
    batch_year = request.args.get("batch_year", type=int)
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    query = db.session.query(StudentProfile).filter(
        StudentProfile.college_id == g.current_user.college_id,
        StudentProfile.is_deleted == False
    ) # noqa: E712

    if branch:
        query = query.filter(StudentProfile.branch == branch)
    if batch_year:
        query = query.filter(StudentProfile.batch_year == batch_year)

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    user = get_current_user()
    schema = StudentResponseSchema(many=True, context={"role": user.role.value, "is_owner": False})

    return jsonify({
        "students": schema.dump(paginated.items),
        "total": paginated.total,
        "page": paginated.page,
        "pages": paginated.pages
    }), 200


# ── S5: PATCH /students/<uuid:student_id> ─────────────────────────────────────

@students_bp.patch("/<uuid:student_id>")
@require_auth
@require_roles("admin")
def admin_update_student(student_id):
    profile = db.session.query(StudentProfile).filter_by(
        id=student_id, college_id=g.current_user.college_id, is_deleted=False
    ).first()

    if not profile:
        return error_response("Student profile not found.", 404)

    try:
        data = AdminStudentUpdateSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    # Keep track of differences for auditing
    diff = {}
    for field, val in data.items():
        if field == "is_active":
            if profile.user.is_active != val:
                diff["is_active"] = {"old": profile.user.is_active, "new": val}
                profile.user.is_active = val
        else:
            old_val = getattr(profile, field)
            if old_val != val:
                diff[field] = {"old": str(old_val) if old_val is not None else None, "new": str(val) if val is not None else None}
                setattr(profile, field, val)

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "admin_update_student")

    if diff:
        audit_action("admin.student.update", target_type="student_profile",
                     target_id=str(profile.id), detail=diff)

    schema = StudentResponseSchema(context={"role": "admin", "is_owner": False})
    return jsonify(schema.dump(profile)), 200


# ── S6: DELETE /students/<uuid:student_id> ────────────────────────────────────

@students_bp.delete("/<uuid:student_id>")
@require_auth
@require_roles("admin")
def admin_delete_student(student_id):
    profile = db.session.query(StudentProfile).filter_by(
        id=student_id, college_id=g.current_user.college_id, is_deleted=False
    ).first()

    if not profile:
        return error_response("Student profile not found.", 404)

    try:
        # Soft delete both user and student profile
        profile.is_deleted = True
        profile.user.is_deleted = True
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "admin_delete_student")

    audit_action("admin.student.delete", target_type="student_profile", target_id=str(profile.id))
    return jsonify({"message": "Student profile soft-deleted successfully."}), 200


# ── S7: GET /students/<uuid:student_id>/applications ──────────────────────────

@students_bp.get("/<uuid:student_id>/applications")
@require_auth
@require_self_or_roles("student_id", "admin", "placement_cell")
def get_student_applications(student_id):
    # Retrieve student user
    student_user = db.session.get(User, student_id)
    if not student_user or student_user.is_deleted or student_user.role != UserRole.STUDENT:
        return error_response("Student not found.", 404)
    err = assert_college_match(student_user, g.current_user)
    if err:
        return err

    applications = db.session.query(DriveApplication).filter_by(
        student_id=student_id, is_deleted=False
    ).all()

    # Simple inline serialization for applications
    result = []
    for app in applications:
        result.append({
            "id": str(app.id),
            "drive_id": str(app.drive_id),
            "company_name": app.drive.company_name,
            "role_title": app.drive.role_title,
            "applied_at": app.applied_at.isoformat(),
            "status": app.status.value
        })

    return jsonify(result), 200


# ── S8: GET /students/<uuid:student_id>/offers ────────────────────────────────

@students_bp.get("/<uuid:student_id>/offers")
@require_auth
@require_self_or_roles("student_id", "admin", "placement_cell")
def get_student_offers(student_id):
    student_user = db.session.get(User, student_id)
    if not student_user or student_user.is_deleted or student_user.role != UserRole.STUDENT:
        return error_response("Student not found.", 404)
    err = assert_college_match(student_user, g.current_user)
    if err:
        return err

    offers = db.session.query(PlacementOffer).filter_by(
        student_id=student_id, is_deleted=False
    ).all()

    result = []
    for off in offers:
        result.append({
            "id": str(off.id),
            "drive_id": str(off.drive_id),
            "company_name": off.drive.company_name,
            "role_title": off.drive.role_title,
            "ctc_offered": off.ctc_offered,
            "status": off.status.value,
            "offer_date": off.offer_date.isoformat(),
            "acceptance_deadline": off.acceptance_deadline.isoformat() if off.acceptance_deadline else None
        })

    return jsonify(result), 200


# ── Resume Builder: Save, List, & Get Versions ───────────────────────────────

@students_bp.post("/me/resume")
@require_auth
@require_roles("student")
def save_resume():
    """Student: save/update resume JSON. Maximum 3 saved versions."""
    from app.models.student import StudentResume

    user = get_current_user()
    profile = user.student_profile
    if not profile or profile.is_deleted:
        return error_response("Student profile not found.", 404)

    data = request.get_json(force=True) or {}
    raw_json = data.get("resume_json")
    pdf_url = data.get("pdf_url")

    if not raw_json:
        return error_response("resume_json is required.", 400)

    # Check version count — max 3
    versions = StudentResume.query.filter_by(student_id=profile.id).all()
    if len(versions) >= 3:
        return error_response("You have reached the maximum limit of 3 saved resumes. Please delete an old version before saving a new one.", 400)

    # Get next version number
    latest = StudentResume.query.filter_by(student_id=profile.id).order_by(
        StudentResume.version.desc()
    ).first()
    next_version = (latest.version + 1) if latest else 1

    try:
        rev = StudentResume(
            student_id=profile.id,
            version=next_version,
            raw_json=raw_json,
            pdf_url=pdf_url
        )
        db.session.add(rev)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "save_resume")

    return jsonify({
        "message": "Resume saved successfully.",
        "version_number": next_version,
        "id": str(rev.id)
    }), 201


@students_bp.get("/me/resume")
@require_auth
@require_roles("student")
def list_resume_versions():
    """Student: list all resume versions (max 3)."""
    from app.models.student import StudentResume

    user = get_current_user()
    profile = user.student_profile
    if not profile or profile.is_deleted:
        return error_response("Student profile not found.", 404)

    versions = StudentResume.query.filter_by(student_id=profile.id).order_by(
        StudentResume.version.desc()
    ).all()

    return jsonify({
        "versions": [{
            "id": str(v.id),
            "version_number": v.version,
            "pdf_url": v.pdf_url,
            "created_at": v.created_at.strftime("%Y-%m-%d %H:%M:%S")
        } for v in versions]
    }), 200


@students_bp.get("/me/resume/<int:version_number>")
@require_auth
@require_roles("student")
def get_resume_version(version_number):
    """Student: get a specific resume version's JSON."""
    from app.models.student import StudentResume

    user = get_current_user()
    profile = user.student_profile
    if not profile or profile.is_deleted:
        return error_response("Student profile not found.", 404)

    rev = StudentResume.query.filter_by(
        student_id=profile.id,
        version=version_number
    ).first()

    if not rev:
        return error_response(f"Resume version {version_number} not found.", 404)

    return jsonify({
        "id": str(rev.id),
        "version_number": rev.version,
        "resume_json": rev.raw_json,
        "pdf_url": rev.pdf_url,
        "created_at": rev.created_at.strftime("%Y-%m-%d %H:%M:%S")
    }), 200


@students_bp.get("/me/resume/suggestions")
@require_auth
@require_roles("student")
def resume_suggestions():
    """Student: get AI-powered resume improvement suggestions based on their profile."""
    user = get_current_user()
    profile = user.student_profile
    if not profile or profile.is_deleted:
        return error_response("Student profile not found.", 404)

    suggestions = []

    if not profile.skills or not profile.skills.strip():
        suggestions.append({
            "field": "skills",
            "tip": "Add your technical and soft skills to improve placement eligibility visibility."
        })
    if not getattr(profile, "linkedin_url", None):
        suggestions.append({
            "field": "linkedin_url",
            "tip": "Add a LinkedIn profile URL to strengthen your professional credibility."
        })
    if not getattr(profile, "github_url", None):
        suggestions.append({
            "field": "github_url",
            "tip": "Add a GitHub profile to showcase your project portfolio to recruiters."
        })
    if profile.cgpa and float(profile.cgpa) < 7.0:
        suggestions.append({
            "field": "cgpa",
            "tip": "Your CGPA is below 7.0. Focus on improving grades to unlock more placement drives."
        })
    if profile.active_backlogs and int(profile.active_backlogs) > 0:
        suggestions.append({
            "field": "active_backlogs",
            "tip": f"You have {profile.active_backlogs} active backlog(s). Clearing them will improve your eligibility."
        })
    if not suggestions:
        suggestions.append({
            "field": "general",
            "tip": "Your profile looks great! Keep it up-to-date before each placement season."
        })

    return jsonify({"suggestions": suggestions}), 200

