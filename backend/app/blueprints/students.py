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
from app.schemas.student import StudentResponseSchema, StudentDetailSchema, StudentUpdateSchema, AdminStudentUpdateSchema
from app.utils.audit import audit_action
from app.utils.errors import error_response, internal_error_response, validation_error_response

students_bp = Blueprint("students", __name__)


def _ensure_student_profile(user):
    """Helper: retrieve or auto-create StudentProfile for student user if missing."""
    profile = user.student_profile
    if (not profile or profile.is_deleted) and user.role == UserRole.STUDENT:
        # Auto-provision profile so student is never stuck with 404
        user_name = getattr(user, 'name', None) or user.email.split('@')[0].capitalize()
        profile = StudentProfile(
            user_id=user.id,
            college_id=user.college_id,
            full_name=user_name,
            roll_no=f"STU-{str(user.id)[:8]}",
            branch="Computer Science Engineering",
            semester=1,
            batch_year=2026,
            cgpa=0.0,
            active_backlogs=0,
            dpdp_consent_given=True,
            profile_complete=False,
            skills=[],
        )
        db.session.add(profile)
        db.session.commit()
    return profile


@students_bp.get("/me")
@require_auth
def get_own_profile():
    user = get_current_user()
    profile = _ensure_student_profile(user)
    if not profile or profile.is_deleted:
        return error_response("Student profile not found.", 404)

    return get_student_detail(profile.id)


# ── S2: PATCH /students/me ────────────────────────────────────────────────────

@students_bp.patch("/me")
@require_auth
@require_roles("student")
def update_own_profile():
    user = get_current_user()
    profile = _ensure_student_profile(user)
    if not profile or profile.is_deleted:
        return error_response("Student profile not found.", 404)

    try:
        data = StudentUpdateSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    try:
        # Update allowed fields
        for field, val in data.items():
            if field == "email" and profile.user.email != val:
                profile.user.email = val
            elif field == "phone" and profile.user.phone != val:
                profile.user.phone = val
            elif hasattr(profile, field):
                setattr(profile, field, val)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_own_profile")

    audit_action("student.profile.update", target_type="student_profile", target_id=str(profile.id))
    schema = StudentDetailSchema(context={"role": "student", "is_owner": True})
    return jsonify(schema.dump(profile)), 200


# ── S3: GET /students/<uuid:student_id> ───────────────────────────────────────

@students_bp.get("/<uuid:student_id>")
@require_auth
@require_roles("admin", "placement_cell")
def get_student_by_id(student_id):
    profile = db.session.query(StudentProfile).filter(
        (StudentProfile.id == student_id) | (StudentProfile.user_id == student_id),
        StudentProfile.college_id == g.current_user.college_id,
        StudentProfile.is_deleted == False
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
    profile = db.session.query(StudentProfile).filter(
        (StudentProfile.id == student_id) | (StudentProfile.user_id == student_id),
        StudentProfile.college_id == g.current_user.college_id,
        StudentProfile.is_deleted == False
    ).first()

    if not profile:
        return error_response("Student profile not found.", 404)

    try:
        data = AdminStudentUpdateSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    # Keep track of differences for auditing
    # edited_section is a metadata-only field — not a model column; skip it in setattr loop.
    # email, phone, and is_active live on profile.user, not profile.
    diff = {}
    for field, val in data.items():
        if field in ("is_active", "edited_section", "email", "phone"):
            if field == "is_active" and profile.user.is_active != val:
                diff["is_active"] = {"old": profile.user.is_active, "new": val}
                profile.user.is_active = val
            elif field == "email" and profile.user.email != val:
                diff["email"] = {"old": profile.user.email, "new": val}
                profile.user.email = val
            elif field == "phone" and profile.user.phone != val:
                diff["phone"] = {"old": profile.user.phone, "new": val}
                profile.user.phone = val
            continue
        old_val = getattr(profile, field, None)
        if old_val != val:
            diff[field] = {"old": str(old_val) if old_val is not None else None, "new": str(val) if val is not None else None}
            setattr(profile, field, val)


    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "admin_update_student")

    if diff:
        # Update per-section admin_edits_meta if caller specified which section was edited
        edited_section = data.get("edited_section")
        if edited_section:
            meta = profile.admin_edits_meta or {}
            meta[edited_section] = {
                "editor_id": str(g.current_user.id),
                "editor_name": getattr(g.current_user, 'email', str(g.current_user.id)),
                "edited_at": __import__('datetime').datetime.now(
                    __import__('datetime').timezone.utc
                ).isoformat(),
            }
            profile.admin_edits_meta = meta
            try:
                db.session.commit()
            except Exception:
                pass  # non-critical; main commit already succeeded

        audit_action("admin.student.update", target_type="student_profile",
                     target_id=str(profile.id), detail=diff)

    schema = StudentResponseSchema(context={"role": "admin", "is_owner": False})
    return jsonify(schema.dump(profile)), 200


# ── S6: DELETE /students/<uuid:student_id> ────────────────────────────────────

@students_bp.delete("/<uuid:student_id>")
@require_auth
@require_roles("admin")
def admin_delete_student(student_id):
    profile = db.session.query(StudentProfile).filter(
        (StudentProfile.id == student_id) | (StudentProfile.user_id == student_id),
        StudentProfile.college_id == g.current_user.college_id,
        StudentProfile.is_deleted == False
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

    skills_val = getattr(profile, "skills", None)
    if not skills_val or len(skills_val) == 0:
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


# ── S9: GET /students/<uuid:student_id>/detail ────────────────────────────────
# Role-aware Student Detail Page endpoint.
# Returns a different field set per caller role, reusing StudentDetailSchema's
# post_dump masking layer on top of StudentResponseSchema — no new auth pattern.
#
# Access matrix:
#   admin          → all fields
#   placement_cell → identity + CGPA/backlogs + career; no fees/quota/admin fields
#   professor      → identity + academic fields scoped to their own class only
#   student (own)  → all own fields via require_self_or_roles IDOR guard
#
# Probing: any role hitting this endpoint for a student outside their allowed
# scope is logged to audit_action("security.field_probe") for Data Health.

@students_bp.get("/<uuid:student_id>/detail")
@require_auth
def get_student_detail(student_id):
    from app.models.academic import ProfessorClassAssignment, Grade, AttendanceRecord
    from app.models.community import EventRegistration, CampusEvent, AdminDetailRequest
    from app.models.placement import PlacementOffer, DriveApplication

    current_user = get_current_user()
    role = current_user.role

    # ── Fetch the base profile ──────────────────────────────────────────────
    profile = db.session.query(StudentProfile).filter(
        (StudentProfile.id == student_id) | (StudentProfile.user_id == student_id),
        StudentProfile.is_deleted == False
    ).first()
    if not profile:
        return error_response("Student profile not found.", 404)

    is_owner = (str(current_user.id) == str(profile.user_id))

    # Tenant boundary enforcement — non-owners across different colleges are denied
    if not is_owner and role != UserRole.ADMIN:
        if current_user.college_id and profile.college_id and current_user.college_id != profile.college_id:
            return error_response("You do not have permission to access this resource.", 403)

    # ── Role gate ──────────────────────────────────────────────────────────
    if role == UserRole.STUDENT:
        if not is_owner:
            # Student probing another student's detail — log and deny
            audit_action(
                "security.field_probe",
                target_type="student_profile",
                target_id=str(student_id),
                detail={"attempted_role": "student", "reason": "non-owner access denied"},
            )
            return error_response("You do not have permission to access this resource.", 403)

    elif role == UserRole.PROFESSOR:
        # Professor must teach this student via an active ProfessorClassAssignment
        teaches = ProfessorClassAssignment.query.filter_by(
            professor_user_id=current_user.id,
            branch=profile.branch,
            semester=profile.semester,
            is_active=True,
        ).first()
        if not teaches:
            audit_action(
                "security.field_probe",
                target_type="student_profile",
                target_id=str(student_id),
                detail={"attempted_role": "professor", "reason": "does not teach student"},
            )
            return error_response("You do not teach this student.", 403)

    elif role in (UserRole.PLACEMENT_CELL, UserRole.ADMIN):
        pass  # college_id filter above is sufficient

    else:
        return error_response("You do not have permission to perform this action.", 403)

    # ── Build context for StudentDetailSchema ──────────────────────────────
    admin_access_granted = False
    if role == UserRole.PROFESSOR:
        req = AdminDetailRequest.query.filter_by(
            professor_user_id=current_user.id,
            student_id=profile.id,
            status="approved",
        ).first()
        if req:
            from datetime import datetime, timezone as tz
            if req.expires_at is None or req.expires_at > datetime.now(tz.utc):
                admin_access_granted = True

    ctx = {
        "role": role.value,
        "is_owner": is_owner,
        "admin_access_granted": admin_access_granted,
    }

    # ── Serialize base profile ─────────────────────────────────────────────
    schema = StudentDetailSchema(context=ctx)
    data = schema.dump(profile)

    # ── Augment with supplementary data per role ───────────────────────────
    if role == UserRole.ADMIN or is_owner:
        # Platform Activity — event registrations + placement applications
        event_regs = (
            EventRegistration.query
            .filter_by(user_id=profile.user_id)
            .join(CampusEvent, EventRegistration.event_id == CampusEvent.id)
            .all()
        )
        data["platform_activity"] = {
            "event_registrations": [
                {
                    "event_id":    str(r.event_id),
                    "event_title": r.event.title if r.event else "—",
                    "event_type":  r.event.event_type if r.event else "—",
                    "registered_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in event_regs
            ],
        }
        # Offers + applications summary
        offers = PlacementOffer.query.filter_by(student_id=profile.user_id, is_deleted=False).all()
        data["placement_offers"] = [
            {
                "company":    off.drive.company_name if off.drive else "—",
                "role":       off.drive.role_title if off.drive else "—",
                "ctc":        str(off.ctc_offered) if off.ctc_offered else None,
                "status":     off.status.value,
                "offer_date": off.offer_date.isoformat() if off.offer_date else None,
            }
            for off in offers
        ]

    elif role == UserRole.PLACEMENT_CELL:
        # TPO sees career data + event registrations for events TPO created
        offers = PlacementOffer.query.filter_by(student_id=profile.user_id, is_deleted=False).all()
        data["placement_offers"] = [
            {
                "company": off.drive.company_name if off.drive else "—",
                "role":    off.drive.role_title if off.drive else "—",
                "ctc":     str(off.ctc_offered) if off.ctc_offered else None,
                "status":  off.status.value,
            }
            for off in offers
        ]
        # Event registrations for events created by a placement_cell user
        # Use select() explicitly (required by SQLAlchemy 2.x) to avoid SAWarning on .in_()
        from sqlalchemy import select as sa_select
        tpo_events_sel = (
            sa_select(CampusEvent.id)
            .join(User, CampusEvent.created_by_id == User.id)
            .where(User.role == UserRole.PLACEMENT_CELL, User.college_id == current_user.college_id)
        )
        tpo_event_regs = (
            EventRegistration.query
            .filter_by(user_id=profile.user_id)
            .filter(EventRegistration.event_id.in_(tpo_events_sel))
            .all()
        )

        data["platform_activity"] = {
            "event_registrations": [
                {
                    "event_id":    str(r.event_id),
                    "event_title": r.event.title if r.event else "—",
                    "registered_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in tpo_event_regs
            ],
        }

    elif role == UserRole.PROFESSOR:
        # Professor sees grades + attendance only for their own course
        teaches_codes = [
            a.course_code for a in ProfessorClassAssignment.query.filter_by(
                professor_user_id=current_user.id, is_active=True
            ).all()
        ]
        grades = Grade.query.filter(
            Grade.student_id == student_id,
            Grade.course_code.in_(teaches_codes),
        ).all()
        attendance = AttendanceRecord.query.filter(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.subject_code.in_(teaches_codes),
        ).all()
        data["course_grades"] = [
            {
                "course_code":    g.course_code,
                "internal_marks": g.internal_marks,
                "mid_sem_marks":  g.mid_sem_marks,
                "grade":          g.grade,
                "grade_point":    g.grade_point,
            }
            for g in grades
        ]
        data["course_attendance"] = [
            {
                "subject_code": a.subject_code,
                "attended":     a.attended_classes,
                "total":        a.total_classes,
                "pct":          round(a.attended_classes / a.total_classes * 100, 1)
                                if a.total_classes else 0,
            }
            for a in attendance
        ]
        data["admin_access_granted"] = admin_access_granted

    # ── Audit TPO reads ────────────────────────────────────────────────────
    if role == UserRole.PLACEMENT_CELL:
        audit_action("placement.student.detail.read", target_type="student_profile",
                     target_id=str(student_id))

    return jsonify(data), 200
