"""
Admin Blueprint — Endpoints AD1–AD11

ENDPOINT SUMMARY (all at /api/v1/admin):
  AD1  GET /users                — list all users (filter by role, status)
  AD2  PATCH /users/<uuid:id>    — edit user fields (is_active, email, phone; audited)
  AD3  DELETE /users/<uuid:id>   — soft delete user (audited)
  AD4  POST /invites             — create admin/TPO invite (generates token; audited)
  AD5  GET /invites              — list pending invites
  AD6  DELETE /invites/<uuid:id> — revoke invite (audited)
  AD7  POST /faculty/approve/<uuid:id> — approve pending professor (audited)
  AD8  POST /faculty/reject/<uuid:id>  — reject professor request (audited)
  AD9  GET /audit-logs           — get audit logs trail (paginated, filterable)
  AD10 GET /analytics/placement  — aggregated placement stats
  AD11 GET /analytics/profiles   — profile completeness + DPDP consent stats

SELF-REVIEW CHECKLIST:
  [x] Auth check present          — all routes decorated with @require_auth
  [x] Role check present          — @require_roles("admin") protects every single route
  [x] IDOR guard present          — N/A (Admin level access, can view/edit everything)
  [x] Input validated             — Marshmallow validates invites, updates
  [x] Errors handled safely       — 400/404 errors, db rollbacks on transaction failures
  [x] Transaction/rollback        — Multi-step DB writes wrapped in try-except with rollback
  [x] Tests written               — see tests/test_admin.py
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone, date
from flask import Blueprint, jsonify, request
from marshmallow import ValidationError
from sqlalchemy import func, case

from app.auth.permissions import require_auth, require_roles, get_current_user
from app.extensions import db
from app.models.user import User, UserRole
from app.models.student import StudentProfile
from app.models.professor import ProfessorProfile, ApprovalStatus
from app.models.placement import PlacementDrive, PlacementOffer, OfferStatus, BranchPlacement
from app.models.academic import Subject
from app.models.token import Invite
from app.models.audit import AuditLog
from app.schemas.admin import (
    AdminUserResponseSchema,
    AdminUserUpdateSchema,
    AdminInviteCreateSchema,
    AdminInviteResponseSchema,
    AuditLogResponseSchema,
)
from app.utils.audit import audit_action
from app.utils.errors import error_response, internal_error_response, validation_error_response

admin_bp = Blueprint("admin", __name__)


# ── AD1: GET /admin/users ─────────────────────────────────────────────────────

@admin_bp.get("/users")
@require_auth
@require_roles("admin")
def list_users():
    role = request.args.get("role")
    active = request.args.get("active")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    query = db.session.query(User).filter(User.is_deleted == False) # noqa: E712

    if role:
        query = query.filter(User.role == UserRole(role))
    if active:
        query = query.filter(User.is_active == (active.lower() == "true"))

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    schema = AdminUserResponseSchema(many=True)

    return jsonify({
        "users": schema.dump(paginated.items),
        "total": paginated.total,
        "page": paginated.page,
        "pages": paginated.pages
    }), 200


# ── AD2: PATCH /admin/users/<uuid:user_id> ────────────────────────────────────

@admin_bp.patch("/users/<uuid:user_id>")
@require_auth
@require_roles("admin")
def update_user(user_id):
    user = db.session.query(User).filter_by(id=user_id, is_deleted=False).first()
    if not user:
        return error_response("User not found.", 404)

    try:
        data = AdminUserUpdateSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    diff = {}
    for field, val in data.items():
        old_val = getattr(user, field)
        if old_val != val:
            diff[field] = {"old": old_val, "new": val}
            setattr(user, field, val)

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_user")

    if diff:
        audit_action("admin.user.update", target_type="user", target_id=str(user.id), detail=diff)

    return jsonify(AdminUserResponseSchema().dump(user)), 200


# ── AD3: DELETE /admin/users/<uuid:user_id> ────────────────────────────────────

@admin_bp.delete("/users/<uuid:user_id>")
@require_auth
@require_roles("admin")
def delete_user(user_id):
    user = db.session.query(User).filter_by(id=user_id, is_deleted=False).first()
    if not user:
        return error_response("User not found.", 404)

    try:
        user.is_deleted = True
        if user.student_profile:
            user.student_profile.is_deleted = True
        if user.professor_profile:
            user.professor_profile.is_deleted = True
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "delete_user")

    audit_action("admin.user.delete", target_type="user", target_id=str(user.id))
    return jsonify({"message": "User soft-deleted successfully."}), 200


# ── AD4: POST /admin/invites ──────────────────────────────────────────────────

@admin_bp.post("/invites")
@require_auth
@require_roles("admin")
def create_invite():
    try:
        data = AdminInviteCreateSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    # Check if user already exists
    existing_user = db.session.query(User).filter_by(email=data["email"], is_deleted=False).first()
    if existing_user:
        return error_response("A user with this email already exists.", 409)

    # Invalidate old unused invites to same email
    db.session.query(Invite).filter_by(email=data["email"], is_used=False).update({"is_used": True})

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expiry = datetime.now(timezone.utc) + timedelta(hours=48)

    invite = Invite(
        email=data["email"],
        role=data["role"],
        invited_by=get_current_user().id,
        token_hash=token_hash,
        expires_at=expiry
    )

    try:
        db.session.add(invite)
        db.session.commit()
        # In a real app, send email here. In tests, we log or return the token for testing.
        # Returning it in response facilitates QA / testing since we don't have mail server set.
        token_to_return = raw_token
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "create_invite")

    audit_action("admin.invite.created", target_type="invite", target_id=str(invite.id), detail={"email": invite.email})
    
    # Return 201 with the token ONLY in non-production environments to aid automated tests/QA.
    # Production should only return success message.
    from flask import current_app
    resp_body = {"message": "Invite generated successfully. Valid for 48 hours."}
    if not current_app.config.get("ENV") == "production":
        resp_body["token"] = token_to_return

    return jsonify(resp_body), 201


# ── AD5: GET /admin/invites ───────────────────────────────────────────────────

@admin_bp.get("/invites")
@require_auth
@require_roles("admin")
def list_invites():
    invites = db.session.query(Invite).filter_by(is_used=False).all()
    return jsonify(AdminInviteResponseSchema(many=True).dump(invites)), 200


# ── AD6: DELETE /admin/invites/<uuid:invite_id> ───────────────────────────────

@admin_bp.delete("/invites/<uuid:invite_id>")
@require_auth
@require_roles("admin")
def revoke_invite(invite_id):
    invite = db.session.query(Invite).filter_by(id=invite_id, is_used=False).first()
    if not invite:
        return error_response("Active invitation not found.", 404)

    try:
        invite.is_used = True
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "revoke_invite")

    audit_action("admin.invite.revoked", target_type="invite", target_id=str(invite.id), detail={"email": invite.email})
    return jsonify({"message": "Invitation revoked successfully."}), 200


# ── AD7: POST /admin/faculty/approve/<uuid:prof_id> ───────────────────────────

@admin_bp.post("/faculty/approve/<uuid:prof_id>")
@require_auth
@require_roles("admin")
def approve_faculty(prof_id):
    profile = db.session.query(ProfessorProfile).filter_by(id=prof_id, is_deleted=False).first()
    if not profile:
        return error_response("Faculty profile not found.", 404)

    if profile.approval_status != ApprovalStatus.PENDING:
        return error_response("Faculty request is not in pending state.", 400)

    try:
        profile.approval_status = ApprovalStatus.APPROVED
        profile.user.is_active = True
        profile.approved_by = get_current_user().id
        profile.approved_at = datetime.now(timezone.utc)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "approve_faculty")

    audit_action("admin.faculty.approve", target_type="professor_profile", target_id=str(profile.id))
    return jsonify({"message": "Faculty registration approved. Account activated."}), 200


# ── AD8: POST /admin/faculty/reject/<uuid:prof_id> ────────────────────────────

@admin_bp.post("/faculty/reject/<uuid:prof_id>")
@require_auth
@require_roles("admin")
def reject_faculty(prof_id):
    profile = db.session.query(ProfessorProfile).filter_by(id=prof_id, is_deleted=False).first()
    if not profile:
        return error_response("Faculty profile not found.", 404)

    if profile.approval_status != ApprovalStatus.PENDING:
        return error_response("Faculty request is not in pending state.", 400)

    try:
        profile.approval_status = ApprovalStatus.REJECTED
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "reject_faculty")

    audit_action("admin.faculty.reject", target_type="professor_profile", target_id=str(profile.id))
    return jsonify({"message": "Faculty registration rejected."}), 200


# ── AD9: GET /admin/audit-logs ────────────────────────────────────────────────

@admin_bp.get("/audit-logs")
@require_auth
@require_roles("admin")
def list_audit_logs():
    action = request.args.get("action")
    actor_id = request.args.get("actor_id")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)

    query = db.session.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action.ilike(f"{action}%"))
    if actor_id:
        import uuid as uuid_lib
        try:
            actor_uuid = uuid_lib.UUID(actor_id)
            query = query.filter(AuditLog.actor_id == actor_uuid)
        except ValueError:
            return error_response("Invalid actor_id format. Must be a valid UUID.", 400)

    query = query.order_by(AuditLog.timestamp.desc())

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    schema = AuditLogResponseSchema(many=True)

    return jsonify({
        "logs": schema.dump(paginated.items),
        "total": paginated.total,
        "page": paginated.page,
        "pages": paginated.pages
    }), 200


# ── AD10: GET /admin/analytics/placement ──────────────────────────────────────

@admin_bp.get("/analytics/placement")
@require_auth
@require_roles("admin")
def get_placement_analytics():
    """
    Returns aggregated placement metrics:
      - Placements this year vs last year (accepted offers)
      - Average Package (accepted offers)
      - Branch-wise placement percentage
      - Company participation trends
    """
    try:
        curr_year = datetime.now(timezone.utc).year
        prev_year = curr_year - 1

        # 1. Total Placements (Accepted offers)
        total_curr = (
            db.session.query(func.count(PlacementOffer.id))
            .join(PlacementDrive)
            .filter(
                PlacementOffer.status == OfferStatus.ACCEPTED,
                PlacementDrive.drive_date.between(date(curr_year, 1, 1), date(curr_year, 12, 31)),
                PlacementOffer.is_deleted == False # noqa: E712
            ).scalar() or 0
        )

        total_prev = (
            db.session.query(func.count(PlacementOffer.id))
            .join(PlacementDrive)
            .filter(
                PlacementOffer.status == OfferStatus.ACCEPTED,
                PlacementDrive.drive_date.between(date(prev_year, 1, 1), date(prev_year, 12, 31)),
                PlacementOffer.is_deleted == False # noqa: E712
            ).scalar() or 0
        )

        # 2. Average Package
        # We need to extract average CTC value. Since CTC is stored as string in model (e.g. "₹12 LPA"),
        # we try casting parsed floats if possible, or fallback to an average computed via standard method.
        # Since CTC can have format issues, we'll parse numeric values from CTC strings.
        # For simplicity and robust DB compatibility, we will compute it from a custom float converter or
        # extract numeric values. In our drives table we store `ctc_offered` as string. If we want average package,
        # we can fetch accepted offers and compute average in python (preventing SQL syntax incompatibilities).
        accepted_offers = (
            db.session.query(PlacementOffer.ctc_offered)
            .filter(PlacementOffer.status == OfferStatus.ACCEPTED, PlacementOffer.is_deleted == False) # noqa: E712
            .all()
        )

        packages = []
        for (ctc_str,) in accepted_offers:
            # Parse number from e.g. "12 LPA", "₹15.5 LPA"
            clean_str = "".join(c for c in ctc_str if c.isdigit() or c == ".").strip()
            if clean_str:
                try:
                    packages.append(float(clean_str))
                except ValueError:
                    pass

        avg_package = sum(packages) / len(packages) if packages else 0.0

        # 3. Branch-wise placement percentage
        # Get count of total students per branch vs placed students per branch
        total_by_branch = (
            db.session.query(StudentProfile.branch, func.count(StudentProfile.id))
            .filter(StudentProfile.is_deleted == False) # noqa: E712
            .group_by(StudentProfile.branch)
            .all()
        )

        placed_by_branch = (
            db.session.query(StudentProfile.branch, func.count(StudentProfile.id))
            .join(User, User.id == StudentProfile.user_id)
            .join(PlacementOffer, PlacementOffer.student_id == User.id)
            .filter(
                StudentProfile.is_deleted == False, # noqa: E712
                PlacementOffer.status == OfferStatus.ACCEPTED,
                PlacementOffer.is_deleted == False # noqa: E712
            )
            .group_by(StudentProfile.branch)
            .all()
        )

        placed_map = {b: count for b, count in placed_by_branch}
        
        # Load overrides from BranchPlacement table
        custom_placements = {bp.branch: bp.placed_count for bp in BranchPlacement.query.all()}
        custom_totals = {bp.branch: bp.total_count for bp in BranchPlacement.query.all()}
        
        all_branches = set([b for b, _ in total_by_branch if b] + list(custom_placements.keys()))
        if not all_branches:
            all_branches.add("Computer Science")

        branch_stats = []
        for branch in all_branches:
            total = custom_totals.get(branch)
            if total is None:
                total = next((t for b, t in total_by_branch if b == branch), 0)
            
            placed = custom_placements.get(branch)
            if placed is None:
                placed = placed_map.get(branch, 0)
                
            pct = (placed / total) * 100 if total > 0 else 0.0
            branch_stats.append({
                "branch": branch,
                "total_students": total,
                "placed_students": placed,
                "placement_pct": round(pct, 2)
            })

        # 4. Company Participation Trend (drives count per company)
        company_trends = (
            db.session.query(PlacementDrive.company_name, func.count(PlacementDrive.id))
            .filter(PlacementDrive.is_deleted == False) # noqa: E712
            .group_by(PlacementDrive.company_name)
            .order_by(func.count(PlacementDrive.id).desc())
            .limit(10)
            .all()
        )

        participation = [{"company_name": name, "drives_count": count} for name, count in company_trends]

        return jsonify({
            "placements_this_year": total_curr,
            "placements_last_year": total_prev,
            "avg_package_lpa": round(avg_package, 2),
            "branch_performance": branch_stats,
            "company_participation": participation
        }), 200

    except Exception as exc:
        return internal_error_response(exc, "get_placement_analytics")


# ── AD11: GET /admin/analytics/profiles ──────────────────────────────────────

@admin_bp.get("/analytics/profiles")
@require_auth
@require_roles("admin")
def get_profile_analytics():
    """
    Returns data completeness and compliance statistics:
      - Complete vs Incomplete student profiles
      - DPDP Act consent statistics (how many students consented)
    """
    try:
        total_students = db.session.query(func.count(StudentProfile.id)).filter(StudentProfile.is_deleted == False).scalar() or 0 # noqa: E712

        consented = db.session.query(func.count(StudentProfile.id)).filter(
            StudentProfile.is_deleted == False, # noqa: E712
            StudentProfile.dpdp_consent_given == True # noqa: E712
        ).scalar() or 0

        completed = db.session.query(func.count(StudentProfile.id)).filter(
            StudentProfile.is_deleted == False, # noqa: E712
            StudentProfile.profile_complete == True # noqa: E712
        ).scalar() or 0

        return jsonify({
            "total_students": total_students,
            "profile_completeness": {
                "completed": completed,
                "incomplete": total_students - completed,
                "completed_pct": round((completed / total_students * 100), 2) if total_students > 0 else 0.0
            },
            "dpdp_compliance": {
                "consented": consented,
                "pending": total_students - consented,
                "consent_pct": round((consented / total_students * 100), 2) if total_students > 0 else 0.0
            }
        }), 200

    except Exception as exc:
        return internal_error_response(exc, "get_profile_analytics")


# ── AD12: POST /admin/students/import-csv ─────────────────────────────────────

@admin_bp.post("/students/import-csv")
@require_auth
@require_roles("admin")
def import_students_csv():
    """
    Bulk import student records (via CSV file upload or JSON payload).
    Pre-creates stub User & StudentProfile records allowing students to claim them via Roll Number + OTP.
    """
    import csv, io

    students_data = []

    # 1. Check file upload
    if "file" in request.files:
        file = request.files["file"]
        stream = io.StringIO(file.stream.read().decode("utf8"), newline=None)
        reader = csv.DictReader(stream)
        for row in reader:
            students_data.append({
                "roll_no": row.get("roll_no") or row.get("Roll No"),
                "full_name": row.get("full_name") or row.get("Name"),
                "branch": row.get("branch") or row.get("Branch") or "Computer Science",
                "batch_year": int(row.get("batch_year") or row.get("Batch") or 2026),
                "semester": int(row.get("semester") or row.get("Semester") or 6),
                "cgpa": float(row.get("cgpa") or row.get("CGPA") or 8.0)
            })
    # 2. Check JSON payload
    elif request.is_json:
        json_body = request.get_json(force=True) or {}
        students_data = json_body.get("students", [])

    if not students_data:
        return error_response("No student records provided. Upload a valid CSV file or JSON body.", 400)

    imported_count = 0
    skipped_count = 0

    try:
        for item in students_data:
            roll_no = item.get("roll_no")
            if not roll_no:
                continue

            existing = db.session.query(StudentProfile).filter_by(roll_no=roll_no, is_deleted=False).first()
            if existing:
                skipped_count += 1
                continue

            # Create inactive stub User & StudentProfile
            user = User(role=UserRole.STUDENT, is_active=False)
            db.session.add(user)
            db.session.flush()

            profile = StudentProfile(
                user_id=user.id,
                roll_no=roll_no.upper(),
                full_name=item.get("full_name") or f"Student {roll_no}",
                branch=item.get("branch") or "Computer Science",
                batch_year=int(item.get("batch_year") or 2026),
                semester=int(item.get("semester") or 6),
                cgpa=float(item.get("cgpa") or 7.5),
                profile_complete=False
            )
            db.session.add(profile)
            imported_count += 1

        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "import_students_csv")

    audit_action("admin.students.bulk_imported", detail={"imported": imported_count, "skipped": skipped_count})
    return jsonify({
        "message": f"Successfully imported {imported_count} student records.",
        "imported_count": imported_count,
        "skipped_count": skipped_count
    }), 201


# ── AD12: POST /admin/subjects ──────────────────────────────────────────────
@admin_bp.post("/subjects")
@require_auth
@require_roles("admin")
def add_subject():
    """Create a new academic subject/course in the system."""
    try:
        data = request.get_json(force=True) or {}
        name = data.get("name")
        code = data.get("code")
        branch = data.get("branch")

        if not name or not code:
            return jsonify({"error": "Subject name and code are required."}), 400

        # Check if code already exists
        existing = db.session.query(Subject).filter_by(code=code).first()
        if existing:
            return jsonify({"error": f"Subject with code '{code}' already exists."}), 400

        sub = Subject(name=name, code=code, branch=branch)
        db.session.add(sub)
        db.session.commit()

        audit_action("admin.subject.created", detail={"code": code, "name": name})
        return jsonify({
            "message": f"Successfully added subject: {name} ({code})",
            "subject": {
                "id": str(sub.id),
                "name": sub.name,
                "code": sub.code,
                "branch": sub.branch
            }
        }), 201
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "add_subject")


# ── AD13: GET /admin/subjects ───────────────────────────────────────────────
@admin_bp.get("/subjects")
@require_auth
@require_roles("admin")
def get_subjects():
    """Get all academic subjects in the system."""
    try:
        subjects = db.session.query(Subject).order_by(Subject.code).all()
        res = [{
            "id": str(s.id),
            "name": s.name,
            "code": s.code,
            "branch": s.branch
        } for s in subjects]
        return jsonify({"subjects": res}), 200
    except Exception as exc:
        return internal_error_response(exc, "get_subjects")


# ── AD14: POST /admin/branch-placements ─────────────────────────────────────
@admin_bp.post("/branch-placements")
@require_auth
@require_roles("admin")
def add_branch_placement():
    """Create or update manual placement stats override for a branch."""
    try:
        data = request.get_json(force=True) or {}
        branch = data.get("branch")
        placed_count = data.get("placed_count")
        total_count = data.get("total_count", 0)

        if not branch:
            return jsonify({"error": "Branch name is required."}), 400

        try:
            placed_count = int(placed_count)
            total_count = int(total_count)
        except (ValueError, TypeError):
            return jsonify({"error": "Placed count and total count must be valid integers."}), 400

        # Upsert logic
        bp = db.session.query(BranchPlacement).filter_by(branch=branch).first()
        if not bp:
            bp = BranchPlacement(branch=branch, placed_count=placed_count, total_count=total_count)
            db.session.add(bp)
            msg = f"Created placement override for {branch}."
        else:
            bp.placed_count = placed_count
            bp.total_count = total_count
            msg = f"Updated placement override for {branch}."

        db.session.commit()
        audit_action("admin.branch_placement.upsert", detail={"branch": branch, "placed": placed_count, "total": total_count})
        
        return jsonify({
            "message": msg,
            "branch_placement": {
                "id": str(bp.id),
                "branch": bp.branch,
                "placed_count": bp.placed_count,
                "total_count": bp.total_count
            }
        }), 200
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "add_branch_placement")
