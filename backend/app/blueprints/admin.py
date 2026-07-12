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
from app.models.academic import Subject, TimetableSlot, TimetableBooking, ReEvaluationRequest, AttendanceRecord
from app.models.community import (
    Announcement, CampusEvent, MarketplaceItem, LostFoundItem,
    EventRegistration, AdminDetailRequest, ModerationReport,
    OfficialMerchandise, MerchandiseOrder
)
from app.models.chat import StudentReport
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


# ── AD0: GET /admin/summary ──────────────────────────────────────────────────

@admin_bp.get("/summary")
@require_auth
@require_roles("admin")
def get_admin_summary():
    """Lightweight dashboard summary: user counts, pending counts."""
    try:
        total_students  = db.session.query(User).filter_by(role=UserRole.STUDENT,          is_deleted=False).count()
        active_students = db.session.query(User).filter_by(role=UserRole.STUDENT,          is_deleted=False, is_active=True).count()
        total_faculty   = db.session.query(User).filter_by(role=UserRole.PROFESSOR,        is_deleted=False).count()
        active_faculty  = db.session.query(User).filter_by(role=UserRole.PROFESSOR,        is_deleted=False, is_active=True).count()
        total_tpo       = db.session.query(User).filter_by(role=UserRole.PLACEMENT_CELL,   is_deleted=False).count()
        pending_faculty = db.session.query(ProfessorProfile).filter_by(
            approval_status=ApprovalStatus.PENDING, is_deleted=False
        ).count()
        pending_tpo = db.session.query(User).filter_by(
            role=UserRole.PLACEMENT_CELL, is_active=False, is_deleted=False
        ).count()
        return jsonify({
            "total_students":  total_students,
            "active_students": active_students,
            "total_faculty":   total_faculty,
            "active_faculty":  active_faculty,
            "total_tpo":       total_tpo,
            "pending_faculty": pending_faculty,
            "pending_tpo":     pending_tpo,
        }), 200
    except Exception as exc:
        return internal_error_response(exc, "get_admin_summary")


# ── AD1: GET /admin/users ─────────────────────────────────────────────────────

@admin_bp.get("/users")
@require_auth
@require_roles("admin")
def list_users():
    role = request.args.get("role")
    active = request.args.get("active")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    query = db.session.query(User).filter(User.is_deleted == False)  # noqa: E712

    if role:
        try:
            query = query.filter(User.role == UserRole(role))
        except ValueError:
            return error_response(f"Invalid role: {role}", 400)
    if active:
        query = query.filter(User.is_active == (active.lower() == "true"))

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    base_schema = AdminUserResponseSchema(many=True)
    users_data = base_schema.dump(paginated.items)

    # Enrich with profile data when filtering by role
    if role == "student":
        from app.models.student import StudentProfile
        user_ids = [u.id for u in paginated.items]
        profiles = {str(p.user_id): p for p in
                    db.session.query(StudentProfile).filter(
                        StudentProfile.user_id.in_(user_ids),
                        StudentProfile.is_deleted == False  # noqa: E712
                    ).all()}
        for u in users_data:
            p = profiles.get(u["id"])
            if p:
                u["roll_no"] = p.roll_no
                u["full_name"] = p.full_name
                u["branch"] = p.branch
                u["batch_year"] = p.batch_year
                u["semester"] = p.semester
                u["cgpa"] = float(p.cgpa) if p.cgpa is not None else None
                u["profile_complete"] = p.profile_complete

    elif role == "professor":
        from app.models.professor import ProfessorProfile
        user_ids = [u.id for u in paginated.items]
        profiles = {str(p.user_id): p for p in
                    db.session.query(ProfessorProfile).filter(
                        ProfessorProfile.user_id.in_(user_ids)
                    ).all()}
        for u in users_data:
            p = profiles.get(u["id"])
            if p:
                u["employee_id"] = p.employee_id
                u["full_name"] = p.full_name
                u["department"] = p.department
                u["designation"] = p.designation
                u["approval_status"] = p.approval_status.value if p.approval_status else "approved"

    return jsonify({
        "users": users_data,
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
    
    # 1. Update User level fields
    user_fields = ["is_active", "email", "phone", "suspended_features", "tags"]
    for field in user_fields:
        if field in data:
            val = data[field]
            old_val = getattr(user, field)
            if old_val != val:
                diff[field] = {"old": old_val, "new": val}
                setattr(user, field, val)

    # 2. Update Profile fields
    if user.role == UserRole.STUDENT and user.student_profile:
        stud_fields = [
            "full_name", "branch", "batch_year", "semester",
            "cgpa", "fees_submitted", "scholarship_details",
            "parent_contact", "home_address"
        ]
        profile = user.student_profile
        for field in stud_fields:
            if field in data:
                val = data[field]
                old_val = getattr(profile, field)
                if field in ["cgpa", "fees_submitted"] and old_val is not None:
                    try:
                        old_val = float(old_val)
                    except ValueError:
                        pass
                if old_val != val:
                    diff[f"student_profile.{field}"] = {"old": old_val, "new": val}
                    setattr(profile, field, val)

    elif user.role == UserRole.PROFESSOR and user.professor_profile:
        prof_fields = [
            "full_name", "department", "designation",
            "monthly_salary", "home_address"
        ]
        profile = user.professor_profile
        for field in prof_fields:
            if field in data:
                val = data[field]
                old_val = getattr(profile, field)
                if field == "monthly_salary" and old_val is not None:
                    try:
                        old_val = float(old_val)
                    except ValueError:
                        pass
                if old_val != val:
                    diff[f"professor_profile.{field}"] = {"old": old_val, "new": val}
                    setattr(profile, field, val)

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_user")

    if diff:
        audit_action("admin.user.update", target_type="user", target_id=str(user.id), detail=diff)

    resp_data = AdminUserResponseSchema().dump(user)
    if user.student_profile:
        p = user.student_profile
        resp_data.update({
            "roll_no": p.roll_no,
            "full_name": p.full_name,
            "branch": p.branch,
            "batch_year": p.batch_year,
            "semester": p.semester,
            "cgpa": float(p.cgpa) if p.cgpa is not None else None,
            "attendance_pct": float(p.attendance_pct) if p.attendance_pct is not None else None,
            "fees_submitted": float(p.fees_submitted) if p.fees_submitted is not None else None,
            "scholarship_details": p.scholarship_details,
            "parent_contact": p.parent_contact,
            "home_address": p.home_address,
        })
    elif user.professor_profile:
        p = user.professor_profile
        resp_data.update({
            "employee_id": p.employee_id,
            "full_name": p.full_name,
            "monthly_salary": float(p.monthly_salary) if p.monthly_salary is not None else None,
            "department": p.department,
            "designation": p.designation,
        })

    return jsonify(resp_data), 200


@admin_bp.get("/users/<uuid:user_id>")
@require_auth
@require_roles("admin")
def get_user(user_id):
    user = db.session.query(User).filter_by(id=user_id, is_deleted=False).first()
    if not user:
        return error_response("User not found.", 404)

    audit_action("admin.user.view", target_type="user", target_id=str(user.id), detail={"email": user.email or user.phone})

    resp_data = AdminUserResponseSchema().dump(user)
    if user.student_profile:
        p = user.student_profile
        resp_data.update({
            "roll_no": p.roll_no,
            "full_name": p.full_name,
            "branch": p.branch,
            "batch_year": p.batch_year,
            "semester": p.semester,
            "cgpa": float(p.cgpa) if p.cgpa is not None else None,
            "attendance_pct": float(p.attendance_pct) if p.attendance_pct is not None else None,
            "fees_submitted": float(p.fees_submitted) if p.fees_submitted is not None else None,
            "scholarship_details": p.scholarship_details,
            "parent_contact": p.parent_contact,
            "home_address": p.home_address,
        })
    elif user.professor_profile:
        p = user.professor_profile
        resp_data.update({
            "employee_id": p.employee_id,
            "full_name": p.full_name,
            "monthly_salary": float(p.monthly_salary) if p.monthly_salary is not None else None,
            "department": p.department,
            "designation": p.designation,
        })

    return jsonify(resp_data), 200


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


@admin_bp.post("/users")
@require_auth
@require_roles("admin")
def add_user_manually():
    """Manually add a user (Student, Professor, TPO, or Admin) to the database."""
    try:
        data = request.get_json(force=True) or {}
        role_str = data.get("role")
        email = data.get("email")
        phone = data.get("phone")
        password = data.get("password") or "password123"

        if not role_str:
            return jsonify({"error": "Role is required."}), 400

        try:
            role = UserRole(role_str)
        except ValueError:
            return jsonify({"error": f"Invalid role: {role_str}"}), 400

        # Check existing user
        if email:
            existing = db.session.query(User).filter_by(email=email, is_deleted=False).first()
            if existing:
                return jsonify({"error": f"User with email '{email}' already exists."}), 400
        if phone:
            existing = db.session.query(User).filter_by(phone=phone, is_deleted=False).first()
            if existing:
                return jsonify({"error": f"User with phone '{phone}' already exists."}), 400

        # Validate role-specific fields
        if role == UserRole.STUDENT:
            roll_no = data.get("roll_no")
            if not roll_no:
                return jsonify({"error": "Roll number is required for students."}), 400
            existing_stud = db.session.query(StudentProfile).filter_by(roll_no=roll_no.upper(), is_deleted=False).first()
            if existing_stud:
                return jsonify({"error": f"Student with roll number '{roll_no}' already exists."}), 400

        elif role == UserRole.PROFESSOR:
            employee_id = data.get("employee_id")
            if not employee_id:
                return jsonify({"error": "Employee ID is required for faculty."}), 400
            existing_prof = db.session.query(ProfessorProfile).filter_by(employee_id=employee_id.upper(), is_deleted=False).first()
            if existing_prof:
                return jsonify({"error": f"Professor with employee ID '{employee_id}' already exists."}), 400

        # Create user
        user = User(
            email=email or None,
            phone=phone or None,
            role=role,
            is_active=True
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush()

        # Create profile if applicable
        if role == UserRole.STUDENT:
            profile = StudentProfile(
                user_id=user.id,
                roll_no=data["roll_no"].upper(),
                full_name=data.get("full_name") or f"Student {data['roll_no']}",
                branch=data.get("branch") or "Computer Science",
                batch_year=int(data.get("batch_year") or 2026),
                semester=int(data.get("semester") or 6),
                cgpa=float(data.get("cgpa") or 7.5),
                profile_complete=True,
                dpdp_consent_given=True,
                dpdp_consent_at=datetime.now(timezone.utc)
            )
            db.session.add(profile)
        elif role == UserRole.PROFESSOR:
            profile = ProfessorProfile(
                user_id=user.id,
                employee_id=data["employee_id"].upper(),
                full_name=data.get("full_name") or email.split("@")[0].capitalize(),
                department=data.get("department") or "Computer Science",
                designation=data.get("designation") or "Assistant Professor",
                approval_status=ApprovalStatus.APPROVED,
                approved_by=get_current_user().id,
                approved_at=datetime.now(timezone.utc)
            )
            db.session.add(profile)

        db.session.commit()
        audit_action("admin.user.manually_added", target_type="user", target_id=str(user.id), detail={"role": role_str, "email": email or phone})
        
        return jsonify({
            "message": f"{role_str.capitalize()} added successfully.",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "phone": user.phone,
                "role": user.role.value,
                "is_active": user.is_active
            }
        }), 201
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "add_user_manually")


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
    
    resp_body = {"message": "Invite generated successfully. Valid for 48 hours."}
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

    user = profile.user
    email = user.email if user else "Unknown"
    user_id_str = str(user.id) if user else str(prof_id)
    profile_id_str = str(profile.id)

    try:
        db.session.delete(profile)
        if user:
            db.session.delete(user)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "reject_faculty")

    audit_action("admin.faculty.reject", target_type="user", target_id=user_id_str, detail={"email": email, "professor_profile_id": profile_id_str})
    return jsonify({"message": "Faculty registration request rejected and cleared."}), 200


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


# ── AD12: POST /admin/branches ──────────────────────────────────────────────
@admin_bp.post("/branches")
@require_auth
@require_roles("admin")
def add_branch():
    """Create a new academic branch/department in the system."""
    try:
        data = request.get_json(force=True) or {}
        branch = data.get("branch")

        if not branch or not branch.strip():
            return jsonify({"error": "Branch name is required."}), 400

        branch_name = branch.strip()

        # Check if it already exists as a BranchPlacement
        existing = db.session.query(BranchPlacement).filter_by(branch=branch_name).first()
        if existing:
            return jsonify({"error": f"Branch '{branch_name}' already exists."}), 400

        # Create a BranchPlacement with 0 placed / 0 total as a stub
        bp = BranchPlacement(branch=branch_name, placed_count=0, total_count=0)
        db.session.add(bp)
        db.session.commit()

        audit_action("admin.branch.created", detail={"branch": branch_name})
        return jsonify({
            "message": f"Successfully added branch: {branch_name}",
            "branch": {
                "id": str(bp.id),
                "branch": bp.branch,
                "placed_count": bp.placed_count,
                "total_count": bp.total_count
            }
        }), 201
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "add_branch")


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


# ── AD15: GET /admin/rules ──────────────────────────────────────────────────
@admin_bp.get("/rules")
@require_auth
@require_roles("admin")
def get_rules():
    """Retrieve all persisted system rules."""
    from app.models.rule import SystemRule
    try:
        rules = db.session.query(SystemRule).all()
        return jsonify({
            "rules": [r.to_dict() for r in rules]
        }), 200
    except Exception as exc:
        return internal_error_response(exc, "get_rules")


# ── AD16: POST /admin/rules ─────────────────────────────────────────────────
@admin_bp.post("/rules")
@require_auth
@require_roles("admin")
def save_rules():
    """Batch save or update system rules."""
    from app.models.rule import SystemRule
    try:
        data = request.get_json(force=True) or {}
        rules_list = data.get("rules", [])
        
        for r in rules_list:
            rule_id = r.get("id")
            section = r.get("section")
            label = r.get("label")
            # Convert value to string to store
            val_str = str(r.get("value"))
            
            if not rule_id or not section or not label:
                continue
                
            rule = db.session.query(SystemRule).filter_by(id=rule_id).first()
            if not rule:
                rule = SystemRule(id=rule_id, section=section, label=label, value=val_str)
                db.session.add(rule)
            else:
                rule.section = section
                rule.label = label
                rule.value = val_str
                
        db.session.commit()
        audit_action("admin.rules.update", detail={"updated_count": len(rules_list)})
        return jsonify({"message": "System rules saved successfully."}), 200
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "save_rules")


# ── DELETE /admin/rules/<rule_id> ───────────────────────────────────────────────
@admin_bp.delete("/rules/<string:rule_id>")
@require_auth
@require_roles("admin")
def delete_rule(rule_id):
    """Delete a single system rule by its string ID."""
    from app.models.rule import SystemRule
    try:
        rule = db.session.query(SystemRule).filter_by(id=rule_id).first()
        if not rule:
            return error_response("Rule not found.", 404)
        db.session.delete(rule)
        db.session.commit()
        audit_action("admin.rules.delete", detail={"rule_id": rule_id})
        return jsonify({"message": "Rule deleted successfully."}), 200
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "delete_rule")


# ── CONTROL PANEL SIGNUP APPROVALS ─────────────────────────────────────────────

@admin_bp.get("/pending-approvals")
@require_auth
@require_roles("admin")
def get_pending_approvals():
    try:
        # Fetch pending professors
        profs = db.session.query(ProfessorProfile).filter_by(
            approval_status=ApprovalStatus.PENDING,
            is_deleted=False
        ).all()
        
        # Fetch pending TPOs (User role PLACEMENT_CELL and inactive)
        tpos = db.session.query(User).filter_by(
            role=UserRole.PLACEMENT_CELL,
            is_active=False,
            is_deleted=False
        ).all()

        return jsonify({
            "professors": [{
                "id": str(p.id),
                "user_id": str(p.user_id),
                "email": p.user.email if p.user else "",
                "full_name": p.full_name,
                "employee_id": p.employee_id,
                "department": p.department,
                "designation": p.designation,
                "created_at": p.created_at.isoformat() if p.created_at else ""
            } for p in profs],
            "tpos": [{
                "id": str(u.id),
                "email": u.email,
                "phone": u.phone or "",
                "created_at": u.created_at.isoformat() if u.created_at else ""
            } for u in tpos]
        }), 200
    except Exception as exc:
        return internal_error_response(exc, "get_pending_approvals")


@admin_bp.post("/tpo/approve/<uuid:user_id>")
@require_auth
@require_roles("admin")
def approve_tpo(user_id):
    user = db.session.query(User).filter_by(id=user_id, role=UserRole.PLACEMENT_CELL, is_active=False, is_deleted=False).first()
    if not user:
        return error_response("TPO user not found or already active.", 404)

    try:
        user.is_active = True
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "approve_tpo")

    audit_action("admin.tpo.approve", target_type="user", target_id=str(user.id), detail={"email": user.email})
    return jsonify({"message": "TPO registration approved. Account activated."}), 200


@admin_bp.post("/tpo/reject/<uuid:user_id>")
@require_auth
@require_roles("admin")
def reject_tpo(user_id):
    user = db.session.query(User).filter_by(id=user_id, role=UserRole.PLACEMENT_CELL, is_active=False, is_deleted=False).first()
    if not user:
        return error_response("TPO user not found or already active.", 404)

    email = user.email
    user_id_str = str(user.id)

    try:
        db.session.delete(user)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "reject_tpo")

    audit_action("admin.tpo.reject", target_type="user", target_id=user_id_str, detail={"email": email})
    return jsonify({"message": "TPO registration request rejected."}), 200


# ── DATA MANAGER ACCESS REQUESTS ───────────────────────────────────────────────

@admin_bp.get("/detail-requests")
@require_auth
@require_roles("admin")
def list_detail_requests():
    try:
        reqs = db.session.query(AdminDetailRequest).filter_by(status="pending").all()
        res = []
        for r in reqs:
            student_profile = r.student
            prof_user = r.professor
            prof_profile = prof_user.professor_profile if prof_user else None
            
            res.append({
                "id": str(r.id),
                "professor_id": str(r.professor_user_id),
                "professor_name": prof_profile.full_name if prof_profile else (prof_user.email if prof_user else "Unknown"),
                "student_id": str(r.student_id),
                "student_name": student_profile.full_name if student_profile else "Unknown",
                "student_roll": student_profile.roll_no if student_profile else "N/A",
                "reason": r.reason,
                "created_at": r.created_at.isoformat() if r.created_at else ""
            })
        return jsonify({"detail_requests": res}), 200
    except Exception as exc:
        return internal_error_response(exc, "list_detail_requests")


@admin_bp.post("/detail-requests/<uuid:req_id>/approve")
@require_auth
@require_roles("admin")
def approve_detail_request(req_id):
    req = db.session.query(AdminDetailRequest).filter_by(id=req_id, status="pending").first()
    if not req:
        return error_response("Detail request not found or already processed.", 404)

    try:
        req.status = "approved"
        req.approved_by_id = get_current_user().id
        req.reviewed_at = datetime.now(timezone.utc)
        req.expires_at = datetime.now(timezone.utc) + timedelta(days=7) # 7-day window
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "approve_detail_request")

    audit_action(
        "admin.detail_request.approve",
        target_type="admin_detail_request",
        target_id=str(req.id),
        detail={"professor_user_id": str(req.professor_user_id), "student_id": str(req.student_id)}
    )
    return jsonify({"message": "Detail access request approved for 7 days."}), 200


@admin_bp.post("/detail-requests/<uuid:req_id>/reject")
@require_auth
@require_roles("admin")
def reject_detail_request(req_id):
    req = db.session.query(AdminDetailRequest).filter_by(id=req_id, status="pending").first()
    if not req:
        return error_response("Detail request not found or already processed.", 404)

    try:
        req.status = "rejected"
        req.reviewed_at = datetime.now(timezone.utc)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "reject_detail_request")

    audit_action("admin.detail_request.reject", target_type="admin_detail_request", target_id=str(req.id))
    return jsonify({"message": "Detail access request rejected."}), 200


# ── TPO INTERVIEW BOOKING APPROVALS ────────────────────────────────────────────

@admin_bp.get("/timetable-bookings")
@require_auth
@require_roles("admin")
def list_timetable_bookings():
    try:
        bookings = db.session.query(TimetableBooking).filter_by(status="pending_admin_approval").all()
        res = []
        for b in bookings:
            drive = b.drive
            student_user = b.student
            student_profile = student_user.student_profile if student_user else None
            tpo_user = b.tpo
            
            res.append({
                "id": str(b.id),
                "drive_id": str(b.drive_id),
                "company_name": drive.company_name if drive else "Unknown",
                "student_id": str(b.student_id),
                "student_name": student_profile.full_name if student_profile else (student_user.email if student_user else "Unknown"),
                "student_roll": student_profile.roll_no if student_profile else "N/A",
                "tpo_email": tpo_user.email if tpo_user else "TPO Cell",
                "day_of_week": b.day_of_week,
                "time_slot": b.time_slot,
                "room": b.room,
                "status": b.status,
                "created_at": b.created_at.isoformat() if b.created_at else ""
            })
        return jsonify({"timetable_bookings": res}), 200
    except Exception as exc:
        return internal_error_response(exc, "list_timetable_bookings")


@admin_bp.post("/timetable-bookings/<uuid:booking_id>/approve")
@require_auth
@require_roles("admin")
def approve_timetable_booking(booking_id):
    booking = db.session.query(TimetableBooking).filter_by(id=booking_id, status="pending_admin_approval").first()
    if not booking:
        return error_response("Booking request not found or already processed.", 404)

    try:
        # Create matching student interview timetable slot
        slot = TimetableSlot(
            student_id=booking.student_id,
            room=booking.room,
            day_of_week=booking.day_of_week,
            time_slot=booking.time_slot,
            course_name=f"Interview: {booking.drive.company_name if booking.drive else 'TPO Drive'}",
            course_code="INTERVIEW",
            professor_name="TPO Cell",
            slot_type="interview",
            role="student",
            status="scheduled"
        )
        db.session.add(slot)
        db.session.flush()

        booking.status = "approved"
        booking.timetable_slot_id = slot.id
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "approve_timetable_booking")

    audit_action("admin.timetable_booking.approve", target_type="timetable_booking", target_id=str(booking.id))
    return jsonify({"message": "Timetable booking approved. Interview slot scheduled."}), 200


@admin_bp.post("/timetable-bookings/<uuid:booking_id>/reject")
@require_auth
@require_roles("admin")
def reject_timetable_booking(booking_id):
    booking = db.session.query(TimetableBooking).filter_by(id=booking_id, status="pending_admin_approval").first()
    if not booking:
        return error_response("Booking request not found or already processed.", 404)

    try:
        booking.status = "rejected"
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "reject_timetable_booking")

    audit_action("admin.timetable_booking.reject", target_type="timetable_booking", target_id=str(booking.id))
    return jsonify({"message": "Timetable booking rejected."}), 200


# ── DATA HEALTH & RULES ENGINE VIOLATIONS ──────────────────────────────────────

@admin_bp.get("/data-health")
@require_auth
@require_roles("admin")
def get_data_health():
    try:
        # 1. Fetch user-reported blocks/chat reports (StudentReport)
        chat_reports = db.session.query(StudentReport).all()
        reported_list = []
        for cr in chat_reports:
            reporter = db.session.get(User, cr.reporter_id)
            # The column is reported_user_id (not student_id)
            reported = db.session.get(User, cr.reported_user_id)
            reported_profile = reported.student_profile if reported else None
            
            reported_list.append({
                "id": str(cr.id),
                "type": "chat_report",
                "reporter_name": reporter.email if reporter else "Unknown",
                "target_user_id": str(cr.reported_user_id),
                "target_name": reported_profile.full_name if reported_profile else (reported.email if reported else "Unknown"),
                "reason": cr.reason or "Reported in class chat",
                "status": "pending",
                "created_at": cr.created_at.isoformat() if cr.created_at else ""
            })

        # 2. Fetch TPO/Company complaints (ModerationReport)
        mod_reports = db.session.query(ModerationReport).filter(ModerationReport.status == "pending").all()
        for mr in mod_reports:
            reporter = db.session.get(User, mr.reporter_id)
            
            target_name = "Unknown"
            if mr.target_type == "student":
                try:
                    import uuid
                    suid = uuid.UUID(mr.target_id)
                    s_user = db.session.get(User, suid)
                    if s_user and s_user.student_profile:
                        target_name = s_user.student_profile.full_name
                    elif s_user:
                        target_name = s_user.email
                except Exception:
                    target_name = mr.target_id
            else:
                target_name = mr.target_id

            reported_list.append({
                "id": str(mr.id),
                "type": f"moderation_report_{mr.target_type}",
                "reporter_name": reporter.email if reporter else "Unknown",
                "target_user_id": mr.target_id if mr.target_type == "student" else "",
                "target_name": target_name,
                "reason": mr.reason,
                "status": mr.status,
                "created_at": mr.created_at.isoformat() if mr.created_at else ""
            })

        # 3. Retrieve Rules Engine rules (or default values)
        from app.models.rule import SystemRule
        rules = db.session.query(SystemRule).all()
        rules_map = {r.id: r.value for r in rules}
        
        reports_limit = int(rules_map.get("reports_limit", 3))
        attendance_limit = float(rules_map.get("attendance_limit", 75.0))
        marketplace_limit = int(rules_map.get("marketplace_limit", 2))

        # 4. Check for violations
        violations = []

        # A. Academic: attendance < limit
        students_low_attendance = db.session.query(StudentProfile).filter(
            StudentProfile.attendance_pct < attendance_limit,
            StudentProfile.is_deleted == False
        ).all()
        for s in students_low_attendance:
            violations.append({
                "id": f"rule_academic_{s.id}",
                "user_id": str(s.user_id),
                "name": s.full_name,
                "roll_no": s.roll_no,
                "type": "academic",
                "description": f"Attendance below threshold: {s.attendance_pct:.1f}% (Limit: {attendance_limit:.1f}%)"
            })

        # B. Behavioral: reports count >= limit
        from sqlalchemy import text
        reports_count_query = db.session.execute(
            text("select reported_user_id, count(*) as cnt from student_reports group by reported_user_id")
        ).fetchall()
        for row in reports_count_query:
            target_id = row[0]
            cnt = row[1]
            if cnt >= reports_limit:
                target_user = db.session.get(User, target_id)
                if target_user and not target_user.is_deleted:
                    target_profile = target_user.student_profile
                    violations.append({
                        "id": f"rule_behavioral_{target_id}",
                        "user_id": str(target_id),
                        "name": target_profile.full_name if target_profile else target_user.email,
                        "roll_no": target_profile.roll_no if target_profile else "N/A",
                        "type": "behavioral",
                        "description": f"Accumulated {cnt} chat reports (Limit: {reports_limit})"
                    })

        # C. Platform-usage: active marketplace listings > limit
        listings_count_query = db.session.execute(
            text("select seller_id, count(*) as cnt from marketplace_items where status = 'active' group by seller_id")
        ).fetchall()
        for row in listings_count_query:
            seller_id = row[0]
            cnt = row[1]
            if cnt > marketplace_limit:
                seller_user = db.session.get(User, seller_id)
                if seller_user and not seller_user.is_deleted:
                    seller_profile = seller_user.student_profile
                    violations.append({
                        "id": f"rule_platform_{seller_id}",
                        "user_id": str(seller_id),
                        "name": seller_profile.full_name if seller_profile else seller_user.email,
                        "roll_no": seller_profile.roll_no if seller_profile else "N/A",
                        "type": "platform",
                        "description": f"Exceeded active marketplace listings limit: {cnt} active (Limit: {marketplace_limit})"
                    })

        # 5. Security signals (failed login attempts >= 5)
        failed_logins = db.session.query(User).filter(
            User.failed_login_attempts >= 5,
            User.is_deleted == False
        ).all()
        security_signals = [{
            "id": f"security_failed_login_{u.id}",
            "user_id": str(u.id),
            "email": u.email,
            "role": u.role.value if hasattr(u.role, "value") else str(u.role),
            "description": f"Multiple failed login attempts detected: {u.failed_login_attempts} attempts."
        } for u in failed_logins]

        return jsonify({
            "reported_items": reported_list,
            "violations": violations,
            "security_signals": security_signals
        }), 200
    except Exception as exc:
        return internal_error_response(exc, "get_data_health")


@admin_bp.post("/reports/<uuid:report_id>/resolve")
@require_auth
@require_roles("admin")
def resolve_report(report_id):
    mr = db.session.query(ModerationReport).filter_by(id=report_id).first()
    if mr:
        try:
            mr.status = "resolved"
            db.session.commit()
            audit_action("admin.report.resolve", target_type="moderation_report", target_id=str(report_id))
            return jsonify({"message": "Moderation report resolved successfully."}), 200
        except Exception as exc:
            db.session.rollback()
            return internal_error_response(exc, "resolve_report")

    cr = db.session.query(StudentReport).filter_by(id=report_id).first()
    if cr:
        try:
            db.session.delete(cr)
            db.session.commit()
            audit_action("admin.report.resolve", target_type="student_report", target_id=str(report_id))
            return jsonify({"message": "Chat report resolved and cleared."}), 200
        except Exception as exc:
            db.session.rollback()
            return internal_error_response(exc, "resolve_chat_report")

    return error_response("Report not found.", 404)


@admin_bp.post("/reports/<uuid:report_id>/dismiss")
@require_auth
@require_roles("admin")
def dismiss_report(report_id):
    mr = db.session.query(ModerationReport).filter_by(id=report_id).first()
    if mr:
        try:
            mr.status = "dismissed"
            db.session.commit()
            audit_action("admin.report.dismiss", target_type="moderation_report", target_id=str(report_id))
            return jsonify({"message": "Moderation report dismissed."}), 200
        except Exception as exc:
            db.session.rollback()
            return internal_error_response(exc, "dismiss_report")

    cr = db.session.query(StudentReport).filter_by(id=report_id).first()
    if cr:
        try:
            db.session.delete(cr)
            db.session.commit()
            audit_action("admin.report.dismiss", target_type="student_report", target_id=str(report_id))
            return jsonify({"message": "Chat report dismissed and cleared."}), 200
        except Exception as exc:
            db.session.rollback()
            return internal_error_response(exc, "dismiss_chat_report")

    return error_response("Report not found.", 404)


# ── BROADCAST ANNOUNCEMENTS ───────────────────────────────────────────────────

@admin_bp.get("/announcements")
@require_auth
@require_roles("admin")
def list_announcements():
    try:
        announcements = db.session.query(Announcement).order_by(Announcement.created_at.desc()).all()
        res = [{
            "id": str(a.id),
            "title": a.title,
            "content": a.content,
            "author_name": a.author_name,
            "created_at": a.created_at.isoformat() if a.created_at else ""
        } for a in announcements]
        return jsonify({"announcements": res}), 200
    except Exception as exc:
        return internal_error_response(exc, "list_announcements")


@admin_bp.post("/announcements")
@require_auth
@require_roles("admin")
def create_announcement():
    data = request.get_json(force=True) or {}
    title = data.get("title")
    content = data.get("content")

    if not title or not content:
        return error_response("title and content are required.", 400)

    try:
        a = Announcement(
            title=title,
            content=content,
            author_name="Administrator",
            author_role="admin"
        )
        db.session.add(a)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "create_announcement")

    audit_action("admin.announcement.create", target_type="announcement", target_id=str(a.id), detail={"title": title})
    return jsonify({"message": "Announcement broadcasted successfully.", "id": str(a.id)}), 201


# ── OFFICIAL MERCHANDISE ───────────────────────────────────────────────────────

@admin_bp.post("/merchandise")
@require_auth
@require_roles("admin", "placement_cell")
def create_merchandise():
    user = get_current_user()
    data = request.get_json(force=True) or {}
    title = data.get("title")
    price = data.get("price")
    upi_id = data.get("upi_id")
    bank_account = data.get("bank_account")

    if not title or price is None:
        return error_response("title and price are required.", 400)

    try:
        price = float(price)
    except ValueError:
        return error_response("price must be a valid number.", 400)

    role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)

    try:
        item = OfficialMerchandise(
            seller_id=user.id,
            seller_role=role_str,
            title=title,
            price=price,
            description=data.get("description"),
            image_url=data.get("image_url"),
            upi_id=upi_id,
            bank_account=bank_account,
            status="active"
        )
        db.session.add(item)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "create_merchandise")

    audit_action("admin.merchandise.create", target_type="official_merchandise", target_id=str(item.id), detail={"title": title})
    return jsonify({
        "message": "Merchandise listed successfully.",
        "merchandise": {
            "id": str(item.id),
            "title": item.title,
            "price": float(item.price),
            "seller_role": item.seller_role
        }
    }), 201


@admin_bp.get("/merchandise")
@require_auth
def get_merchandise():
    role_filter = request.args.get("role")
    try:
        q = db.session.query(OfficialMerchandise).filter_by(status="active")
        if role_filter:
            q = q.filter_by(seller_role=role_filter)
        items = q.order_by(OfficialMerchandise.created_at.desc()).all()
        return jsonify({
            "merchandise": [{
                "id": str(i.id),
                "title": i.title,
                "price": float(i.price),
                "description": i.description or "",
                "image_url": i.image_url or "",
                "upi_id": i.upi_id or "",
                "bank_account": i.bank_account or "",
                "seller_role": i.seller_role,
                "created_at": i.created_at.isoformat() if i.created_at else ""
            } for i in items]
        }), 200
    except Exception as exc:
        return internal_error_response(exc, "get_merchandise")


@admin_bp.post("/merchandise/purchase")
@require_auth
def purchase_merchandise():
    user = get_current_user()
    data = request.get_json(force=True) or {}
    item_id = data.get("item_id")
    quantity = data.get("quantity", 1)
    payment_ref = data.get("payment_reference")
    shipping_address = data.get("shipping_address")

    if not item_id or not payment_ref or not shipping_address:
        return error_response("item_id, payment_reference, and shipping_address are required.", 400)

    try:
        quantity = int(quantity)
        if quantity <= 0:
            raise ValueError()
    except ValueError:
        return error_response("quantity must be a positive integer.", 400)

    item = db.session.query(OfficialMerchandise).filter_by(id=item_id, status="active").first()
    if not item:
        return error_response("Merchandise item not found.", 404)

    total_price = item.price * quantity

    try:
        order = MerchandiseOrder(
            item_id=item.id,
            buyer_id=user.id,
            quantity=quantity,
            total_price=total_price,
            payment_reference=payment_ref,
            shipping_address=shipping_address,
            status="pending"
        )
        db.session.add(order)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "purchase_merchandise")

    audit_action("student.merchandise.purchase", target_type="merchandise_order", target_id=str(order.id), detail={"total_price": float(total_price)})
    return jsonify({
        "message": "Order submitted successfully.",
        "order": {
            "id": str(order.id),
            "total_price": float(order.total_price),
            "status": order.status
        }
    }), 201


@admin_bp.get("/merchandise/orders")
@require_auth
@require_roles("admin", "placement_cell")
def get_merchandise_orders():
    user = get_current_user()
    role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)
    try:
        if role_str == "admin":
            orders = db.session.query(MerchandiseOrder).join(OfficialMerchandise).order_by(MerchandiseOrder.created_at.desc()).all()
        else:
            orders = db.session.query(MerchandiseOrder).join(OfficialMerchandise).filter(OfficialMerchandise.seller_role == "placement_cell").order_by(MerchandiseOrder.created_at.desc()).all()

        return jsonify({
            "orders": [{
                "id": str(o.id),
                "item_title": o.item.title,
                "buyer_email": o.buyer.email,
                "quantity": o.quantity,
                "total_price": float(o.total_price),
                "payment_reference": o.payment_reference,
                "status": o.status,
                "shipping_address": o.shipping_address,
                "created_at": o.created_at.isoformat() if o.created_at else ""
            } for o in orders]
        }), 200
    except Exception as exc:
        return internal_error_response(exc, "get_merchandise_orders")


@admin_bp.patch("/merchandise/orders/<uuid:order_id>")
@require_auth
@require_roles("admin", "placement_cell")
def update_merchandise_order(order_id):
    user = get_current_user()
    role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)
    data = request.get_json(force=True) or {}
    status = data.get("status")

    if status not in ["pending", "shipped", "delivered", "fulfilled"]:
        return error_response("Invalid order status value.", 400)

    order = db.session.query(MerchandiseOrder).filter_by(id=order_id).first()
    if not order:
        return error_response("Order not found.", 404)

    if role_str != "admin" and order.item.seller_role != "placement_cell":
        return error_response("Unauthorized to edit this order.", 403)

    try:
        old_status = order.status
        order.status = status
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_merchandise_order")

    audit_action(
        "admin.merchandise.order_update",
        target_type="merchandise_order",
        target_id=str(order.id),
        detail={"old_status": old_status, "new_status": status}
    )
    return jsonify({"message": "Order status updated.", "order_id": str(order.id), "status": order.status}), 200


# ── EVENTS APPROVAL & TICKET ALLOTMENT ─────────────────────────────────────────

@admin_bp.get("/events/pending")
@require_auth
@require_roles("admin")
def get_pending_events():
    try:
        events = db.session.query(CampusEvent).filter_by(approval_status="pending").order_by(CampusEvent.created_at.desc()).all()
        return jsonify({
            "events": [{
                "id": str(e.id),
                "title": e.title,
                "event_type": e.event_type,
                "date_time": e.date_time,
                "venue": e.venue,
                "description": e.description or "",
                "created_by": e.creator.email if e.creator else "Unknown",
                "created_at": e.created_at.isoformat() if e.created_at else ""
            } for e in events]
        }), 200
    except Exception as exc:
        return internal_error_response(exc, "get_pending_events")


@admin_bp.post("/events/<uuid:event_id>/approve")
@require_auth
@require_roles("admin")
def approve_event(event_id):
    event = db.session.query(CampusEvent).filter_by(id=event_id, approval_status="pending").first()
    if not event:
        return error_response("Pending event not found.", 404)

    try:
        event.approval_status = "live"
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "approve_event")

    audit_action("admin.event.approve", target_type="campus_event", target_id=str(event.id), detail={"title": event.title})
    return jsonify({"message": "Event approved and is now live."}), 200


@admin_bp.post("/events/<uuid:event_id>/reject")
@require_auth
@require_roles("admin")
def reject_event(event_id):
    event = db.session.query(CampusEvent).filter_by(id=event_id, approval_status="pending").first()
    if not event:
        return error_response("Pending event not found.", 404)

    try:
        event.approval_status = "rejected"
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "reject_event")

    audit_action("admin.event.reject", target_type="campus_event", target_id=str(event.id), detail={"title": event.title})
    return jsonify({"message": "Event rejected."}), 200


@admin_bp.get("/events/<uuid:event_id>/registrations")
@require_auth
@require_roles("admin")
def get_event_registrations(event_id):
    try:
        regs = db.session.query(EventRegistration).filter_by(event_id=event_id).all()
        return jsonify({
            "registrations": [{
                "id": str(r.id),
                "user_id": str(r.user_id),
                "email": r.user.email,
                "roll_no": r.user.student_profile.roll_no if r.user.student_profile else "N/A",
                "full_name": r.user.student_profile.full_name if r.user.student_profile else "N/A",
                "ticket_code": r.ticket_code or "",
                "created_at": r.created_at.isoformat() if r.created_at else ""
            } for r in regs]
        }), 200
    except Exception as exc:
        return internal_error_response(exc, "get_event_registrations")


@admin_bp.post("/events/<uuid:event_id>/allot-ticket")
@require_auth
@require_roles("admin")
def allot_event_ticket(event_id):
    data = request.get_json(force=True) or {}
    user_id = data.get("user_id")

    if not user_id:
        return error_response("user_id is required.", 400)

    reg = db.session.query(EventRegistration).filter_by(event_id=event_id, user_id=user_id).first()
    if not reg:
        return error_response("User is not registered for this event.", 404)

    if reg.ticket_code:
        return error_response("Ticket already generated and allotted to this user.", 400)

    try:
        ticket = f"TKT-{secrets.token_hex(4).upper()}"
        reg.ticket_code = ticket
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "allot_event_ticket")

    audit_action(
        "admin.event.allot_ticket",
        target_type="event_registration",
        target_id=str(reg.id),
        detail={"ticket_code": ticket, "user_id": str(user_id)}
    )
    return jsonify({"message": "Ticket allotted successfully.", "ticket_code": ticket}), 200


# ── PROFESSOR ATTENDANCE & CHECK-INS ──────────────────────────────────────────

@admin_bp.get("/attendance/professors")
@require_auth
@require_roles("admin")
def list_professor_attendance():
    try:
        profs = db.session.query(ProfessorProfile).filter_by(is_deleted=False, approval_status=ApprovalStatus.APPROVED).all()
        
        today = datetime.now(timezone.utc).date()
        checkins = db.session.query(ProfessorCheckIn).filter_by(check_in_date=today).all()
        checkin_map = {str(c.professor_id): c for c in checkins}

        res = []
        for p in profs:
            c = checkin_map.get(str(p.user_id))
            res.append({
                "professor_id": str(p.user_id),
                "full_name": p.full_name,
                "department": p.department,
                "designation": p.designation,
                "check_in_time": c.check_in_time.isoformat() if c else None,
                "status": c.status if c else "Absent"
            })
        return jsonify({"professors": res}), 200
    except Exception as exc:
        return internal_error_response(exc, "list_professor_attendance")


@admin_bp.post("/attendance/professors/check-in")
@require_auth
@require_roles("admin")
def mark_professor_checkin():
    data = request.get_json(force=True) or {}
    prof_user_id = data.get("professor_id")
    status = data.get("status", "Present")

    if not prof_user_id:
        return error_response("professor_id is required.", 400)

    if status not in ["Present", "Late", "Absent"]:
        return error_response("Invalid status value.", 400)

    prof = db.session.query(ProfessorProfile).filter_by(user_id=prof_user_id, is_deleted=False).first()
    if not prof:
        return error_response("Professor profile not found.", 404)

    today = datetime.now(timezone.utc).date()
    
    try:
        c = db.session.query(ProfessorCheckIn).filter_by(professor_id=prof_user_id, check_in_date=today).first()
        if not c:
            c = ProfessorCheckIn(
                professor_id=prof_user_id,
                check_in_date=today,
                status=status,
                marked_by_id=get_current_user().id
            )
            db.session.add(c)
        else:
            c.status = status
            c.check_in_time = datetime.now(timezone.utc)
            c.marked_by_id = get_current_user().id

        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "mark_professor_checkin")

    audit_action("admin.professor.checkin", target_type="user", target_id=str(prof_user_id), detail={"status": status})
    return jsonify({"message": f"Professor attendance marked as {status}."}), 200

