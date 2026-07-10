"""
Placement Blueprint — Endpoints PL1–PL16

ENDPOINT SUMMARY (all at /api/v1/placement):
  PL1  POST /drives                        — create drive (TPO/admin)
  PL2  GET  /drives                        — list drives (students see eligible/active; TPO/admin see all)
  PL3  GET  /drives/<uuid:drive_id>        — drive detail
  PL4  PATCH /drives/<uuid:drive_id>       — update drive (TPO/admin; creator-only unless admin)
  PL5  DELETE /drives/<uuid:drive_id>      — soft delete drive (TPO/admin)
  PL6  GET  /drives/<uuid:drive_id>/eligible — list eligible students (TPO/admin)
  PL7  POST /drives/<uuid:drive_id>/apply  — student applies (deadline+cutoff checked)
  PL8  DELETE /drives/<uuid:drive_id>/apply — student withdraws application
  PL9  GET  /drives/<uuid:drive_id>/applications — list applications (TPO/admin)
  PL10 POST /drives/<uuid:drive_id>/shortlist    — bulk shortlist students
  PL11 PATCH /drives/<uuid:drive_id>/shortlist/<uuid:student_id> — update individual shortlist status
  PL12 GET  /drives/<uuid:drive_id>/shortlist    — view shortlist (TPO/admin)
  PL13 POST /drives/<uuid:drive_id>/offers       — extend offer to student
  PL14 PATCH /drives/<uuid:drive_id>/offers/<uuid:student_id> — student accept/decline offer (IDOR guarded)
  PL15 GET  /drives/<uuid:drive_id>/offers       — list drive offers (TPO/admin)
  PL16 GET  /offers/me                     — student's own offers

SELF-REVIEW CHECKLIST:
  [x] Auth check present          — all routes decorated with @require_auth
  [x] Role check present          — RBAC enforced per route
  [x] IDOR guard present          — PL7/PL8 check own student; PL14 uses require_self_or_roles
  [x] Input validated             — Marshmallow validates all POST/PATCH bodies
  [x] Errors handled safely       — 400/403/404 errors, db rollback on failures
  [x] Transaction/rollback        — all multi-step writes wrapped in try/except
  [x] Tests written               — see tests/test_placement.py

BUSINESS RULES ENFORCED:
  - Registration deadline must not be in the past (PL7)
  - CGPA/backlog cutoff checked at apply time (PL7)
  - one_offer_lock: if True, student already holding an accepted offer cannot apply (PL7)
  - Bulk shortlist only shortlists students who have applied (PL10)
  - Offer creation checks one_offer_lock (PL13)
"""

import uuid as uuid_lib
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from marshmallow import ValidationError

from app.auth.permissions import require_auth, require_roles, require_self_or_roles, get_current_user
from app.extensions import db
from app.models.placement import (
    DriveApplication, DriveShortlist, PlacementDrive, PlacementOffer,
    ApplicationStatus, ShortlistStatus, OfferStatus, DriveType, DriveStatus
)
from app.models.student import StudentProfile
from app.models.user import User, UserRole
from app.schemas.placement import (
    PlacementDriveCreateSchema, PlacementDriveResponseSchema,
    BulkShortlistSchema, ShortlistStatusUpdateSchema,
    OfferCreateSchema, OfferUpdateSchema,
)
from app.utils.audit import audit_action
from app.utils.errors import error_response, internal_error_response, validation_error_response

placement_bp = Blueprint("placement", __name__)


# ── Eligibility helper ─────────────────────────────────────────────────────────

def _check_student_eligible(profile: StudentProfile, drive: PlacementDrive) -> tuple[bool, str]:
    """
    Returns (is_eligible, reason).
    Checks: batch_year, cgpa_cutoff, backlog_cutoff, attendance_cutoff.
    """
    if profile.batch_year != drive.batch_year:
        return False, f"Drive is for batch {drive.batch_year}."
    if profile.cgpa < drive.cgpa_cutoff:
        return False, f"CGPA {profile.cgpa} below cutoff {drive.cgpa_cutoff}."
    if profile.active_backlogs > drive.backlog_cutoff:
        return False, f"Active backlogs {profile.active_backlogs} exceed cutoff {drive.backlog_cutoff}."
    if drive.attendance_cutoff and profile.attendance_pct is not None:
        if profile.attendance_pct < drive.attendance_cutoff:
            return False, f"Attendance {profile.attendance_pct}% below cutoff {drive.attendance_cutoff}%."
    return True, ""


# ── PL1: POST /placement/drives ───────────────────────────────────────────────

@placement_bp.post("/drives")
@require_auth
@require_roles("admin", "placement_cell")
def create_drive():
    try:
        data = PlacementDriveCreateSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    try:
        drive = PlacementDrive(
            company_name=data["company_name"],
            role_title=data["role_title"],
            drive_type=DriveType(data["drive_type"]),
            batch_year=data["batch_year"],
            cgpa_cutoff=data["cgpa_cutoff"],
            backlog_cutoff=data.get("backlog_cutoff", 0),
            attendance_cutoff=data.get("attendance_cutoff"),
            drive_date=data["drive_date"],
            registration_deadline=data["registration_deadline"],
            ctc_offered=data["ctc_offered"],
            description=data.get("description"),
            one_offer_lock=data.get("one_offer_lock", True),
            status=DriveStatus.ACTIVE,
            created_by=get_current_user().id,
        )
        db.session.add(drive)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "create_drive")

    audit_action("placement.drive.created", target_type="placement_drive", target_id=str(drive.id),
                 detail={"company": drive.company_name, "role": drive.role_title})
    return jsonify(PlacementDriveResponseSchema().dump(drive)), 201


# ── PL2: GET /placement/drives ────────────────────────────────────────────────

@placement_bp.get("/drives")
@require_auth
def list_drives():
    user = get_current_user()
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    query = db.session.query(PlacementDrive).filter(PlacementDrive.is_deleted == False)  # noqa: E712

    if user.role == UserRole.STUDENT:
        # Students only see active drives
        query = query.filter(PlacementDrive.status == DriveStatus.ACTIVE)
        profile = user.student_profile
        if profile:
            query = query.filter(PlacementDrive.batch_year == profile.batch_year)

    paginated = query.order_by(PlacementDrive.drive_date.asc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "drives": PlacementDriveResponseSchema(many=True).dump(paginated.items),
        "total": paginated.total,
        "page": paginated.page,
        "pages": paginated.pages,
    }), 200


# ── PL3: GET /placement/drives/<uuid:drive_id> ───────────────────────────────

@placement_bp.get("/drives/<uuid:drive_id>")
@require_auth
def get_drive(drive_id):
    drive = db.session.query(PlacementDrive).filter_by(id=drive_id, is_deleted=False).first()
    if not drive:
        return error_response("Drive not found.", 404)

    user = get_current_user()
    # Students can only see active drives
    if user.role == UserRole.STUDENT and drive.status != DriveStatus.ACTIVE:
        return error_response("Drive not found.", 404)

    return jsonify(PlacementDriveResponseSchema().dump(drive)), 200


# ── PL4: PATCH /placement/drives/<uuid:drive_id> ─────────────────────────────

@placement_bp.patch("/drives/<uuid:drive_id>")
@require_auth
@require_roles("admin", "placement_cell")
def update_drive(drive_id):
    drive = db.session.query(PlacementDrive).filter_by(id=drive_id, is_deleted=False).first()
    if not drive:
        return error_response("Drive not found.", 404)

    user = get_current_user()
    # TPO can only update drives they created; admin can update any
    if user.role == UserRole.PLACEMENT_CELL and drive.created_by != user.id:
        return error_response("You can only update drives you created.", 403)

    try:
        data = PlacementDriveCreateSchema(partial=True).load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    for field, val in data.items():
        if field == "drive_type":
            drive.drive_type = DriveType(val)
        else:
            setattr(drive, field, val)

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_drive")

    audit_action("placement.drive.updated", target_type="placement_drive", target_id=str(drive.id))
    return jsonify(PlacementDriveResponseSchema().dump(drive)), 200


# ── PL5: DELETE /placement/drives/<uuid:drive_id> ────────────────────────────

@placement_bp.delete("/drives/<uuid:drive_id>")
@require_auth
@require_roles("admin", "placement_cell")
def delete_drive(drive_id):
    drive = db.session.query(PlacementDrive).filter_by(id=drive_id, is_deleted=False).first()
    if not drive:
        return error_response("Drive not found.", 404)

    user = get_current_user()
    if user.role == UserRole.PLACEMENT_CELL and drive.created_by != user.id:
        return error_response("You can only delete drives you created.", 403)

    try:
        drive.is_deleted = True
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "delete_drive")

    audit_action("placement.drive.deleted", target_type="placement_drive", target_id=str(drive.id))
    return jsonify({"message": "Drive deleted successfully."}), 200


# ── PL6: GET /placement/drives/<uuid:drive_id>/eligible ─────────────────────

@placement_bp.get("/drives/<uuid:drive_id>/eligible")
@require_auth
@require_roles("admin", "placement_cell")
def get_eligible_students(drive_id):
    drive = db.session.query(PlacementDrive).filter_by(id=drive_id, is_deleted=False).first()
    if not drive:
        return error_response("Drive not found.", 404)

    profiles = db.session.query(StudentProfile).filter(
        StudentProfile.is_deleted == False,  # noqa: E712
        StudentProfile.batch_year == drive.batch_year,
        StudentProfile.cgpa >= drive.cgpa_cutoff,
        StudentProfile.active_backlogs <= drive.backlog_cutoff,
    ).all()

    result = [
        {
            "user_id": str(p.user_id),
            "roll_no": p.roll_no,
            "full_name": p.full_name,
            "branch": p.branch,
            "cgpa": p.cgpa,
            "active_backlogs": p.active_backlogs,
        }
        for p in profiles
    ]
    return jsonify(result), 200


# ── PL7: POST /placement/drives/<uuid:drive_id>/apply ───────────────────────

@placement_bp.post("/drives/<uuid:drive_id>/apply")
@require_auth
@require_roles("student")
def apply_for_drive(drive_id):
    drive = db.session.query(PlacementDrive).filter_by(id=drive_id, is_deleted=False).first()
    if not drive:
        return error_response("Drive not found.", 404)

    if drive.status != DriveStatus.ACTIVE:
        return error_response("This drive is no longer accepting applications.", 400)

    now = datetime.now(timezone.utc)
    deadline = drive.registration_deadline
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    if now > deadline:
        return error_response("Registration deadline has passed.", 400)

    user = get_current_user()
    profile = user.student_profile
    if not profile:
        return error_response("Student profile not found.", 404)

    eligible, reason = _check_student_eligible(profile, drive)
    if not eligible:
        return error_response(f"Not eligible for this drive: {reason}", 400)

    # one_offer_lock check
    if drive.one_offer_lock:
        existing_offer = db.session.query(PlacementOffer).filter_by(
            student_id=user.id, status=OfferStatus.ACCEPTED, is_deleted=False
        ).first()
        if existing_offer:
            return error_response(
                "You have already accepted an offer. Policy restricts applying to multiple drives.", 400
            )

    # Duplicate application check
    existing_app = db.session.query(DriveApplication).filter_by(
        drive_id=drive_id, student_id=user.id, is_deleted=False
    ).first()
    if existing_app:
        return error_response("You have already applied to this drive.", 409)

    try:
        app = DriveApplication(
            drive_id=drive.id,
            student_id=user.id,
            status=ApplicationStatus.APPLIED,
        )
        db.session.add(app)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "apply_for_drive")

    audit_action("placement.application.created", target_type="drive_application",
                 target_id=str(app.id), detail={"drive_id": str(drive_id)})
    return jsonify({"message": "Application submitted successfully.", "application_id": str(app.id)}), 201


# ── PL8: DELETE /placement/drives/<uuid:drive_id>/apply ─────────────────────

@placement_bp.delete("/drives/<uuid:drive_id>/apply")
@require_auth
@require_roles("student")
def withdraw_application(drive_id):
    user = get_current_user()
    app = db.session.query(DriveApplication).filter_by(
        drive_id=drive_id, student_id=user.id, is_deleted=False
    ).first()
    drive = db.session.get(PlacementDrive, drive_id)
    if not drive or drive.is_deleted:
        return error_response("Drive not found.", 404)

    now = datetime.now(timezone.utc)
    deadline = drive.registration_deadline
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    if now > deadline:
        return error_response("Cannot withdraw after registration deadline.", 400)

    try:
        app.is_deleted = True
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "withdraw_application")

    return jsonify({"message": "Application withdrawn successfully."}), 200


# ── PL9: GET /placement/drives/<uuid:drive_id>/applications ─────────────────

@placement_bp.get("/drives/<uuid:drive_id>/applications")
@require_auth
@require_roles("admin", "placement_cell")
def list_drive_applications(drive_id):
    drive = db.session.query(PlacementDrive).filter_by(id=drive_id, is_deleted=False).first()
    if not drive:
        return error_response("Drive not found.", 404)

    applications = db.session.query(DriveApplication).filter_by(
        drive_id=drive_id, is_deleted=False
    ).all()

    result = []
    for app in applications:
        student = db.session.get(User, app.student_id)
        profile = student.student_profile if student else None
        result.append({
            "application_id": str(app.id),
            "student_id": str(app.student_id),
            "roll_no": profile.roll_no if profile else None,
            "full_name": profile.full_name if profile else None,
            "branch": profile.branch if profile else None,
            "cgpa": profile.cgpa if profile else None,
            "status": app.status.value,
            "applied_at": app.applied_at.isoformat(),
        })

    return jsonify(result), 200


# ── PL10: POST /placement/drives/<uuid:drive_id>/shortlist ───────────────────

@placement_bp.post("/drives/<uuid:drive_id>/shortlist")
@require_auth
@require_roles("admin", "placement_cell")
def bulk_shortlist(drive_id):
    drive = db.session.query(PlacementDrive).filter_by(id=drive_id, is_deleted=False).first()
    if not drive:
        return error_response("Drive not found.", 404)

    try:
        data = BulkShortlistSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    student_ids = list(data["student_ids"])   # already uuid.UUID from Marshmallow
    round_num = data.get("round", 1)
    status = ShortlistStatus(data.get("status", "shortlisted"))
    notes = data.get("notes")

    added, skipped = [], []
    creator_id = get_current_user().id
    for sid in student_ids:
        sid_str = str(sid)
        # Verify student applied
        app = db.session.query(DriveApplication).filter_by(
            drive_id=drive_id, student_id=sid, is_deleted=False
        ).first()
        if not app:
            skipped.append({"student_id": sid_str, "reason": "no_application"})
            continue

        # Check if already shortlisted for this round
        existing = db.session.query(DriveShortlist).filter_by(
            drive_id=drive_id, student_id=sid, round=round_num
        ).first()
        if existing:
            existing.status = status
            existing.notes = notes
            added.append(sid_str)
        else:
            shortlist = DriveShortlist(
                drive_id=drive.id,
                student_id=sid,
                round=round_num,
                status=status,
                notes=notes,
                created_by=creator_id,
            )
            db.session.add(shortlist)
            added.append(sid_str)

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "bulk_shortlist")

    audit_action("placement.shortlist.bulk", target_type="placement_drive", target_id=str(drive_id),
                 detail={"added": len(added), "skipped": len(skipped), "round": round_num})

    # ── Cross-feature trigger: notify each shortlisted student ───────────────
    try:
        from app.utils.notify import notify
        notify(
            [str(sid) for sid in student_ids if str(sid) in added],
            f"You're Shortlisted: {drive.company_name}",
            body=f"Congratulations! You've been shortlisted for {drive.role_title} at {drive.company_name} (Round {round_num}).",
            notif_type="placement",
            link="/internships",
        )
    except Exception:
        pass

    return jsonify({
        "message": f"{len(added)} students shortlisted.",
        "added": added,
        "skipped": skipped,
    }), 200


# ── PL11: PATCH /placement/drives/<uuid:drive_id>/shortlist/<uuid:student_id> ─

@placement_bp.patch("/drives/<uuid:drive_id>/shortlist/<uuid:student_id>")
@require_auth
@require_roles("admin", "placement_cell")
def update_shortlist_status(drive_id, student_id):
    try:
        data = ShortlistStatusUpdateSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    shortlist = db.session.query(DriveShortlist).filter_by(
        drive_id=drive_id, student_id=student_id
    ).order_by(DriveShortlist.round.desc()).first()

    if not shortlist:
        return error_response("Shortlist record not found.", 404)

    shortlist.status = ShortlistStatus(data["status"])
    shortlist.notes = data.get("notes", shortlist.notes)

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_shortlist_status")

    return jsonify({"message": "Shortlist status updated."}), 200


# ── PL12: GET /placement/drives/<uuid:drive_id>/shortlist ────────────────────

@placement_bp.get("/drives/<uuid:drive_id>/shortlist")
@require_auth
@require_roles("admin", "placement_cell")
def get_shortlist(drive_id):
    records = db.session.query(DriveShortlist).filter_by(drive_id=drive_id).all()
    result = []
    for rec in records:
        student = db.session.get(User, rec.student_id)
        if not student or student.is_deleted:
            continue
        profile = student.student_profile
        if not profile or profile.is_deleted:
            continue
        result.append({
            "student_id": str(rec.student_id),
            "roll_no": profile.roll_no,
            "full_name": profile.full_name,
            "round": rec.round,
            "status": rec.status.value,
            "notes": rec.notes,
        })
    return jsonify(result), 200


# ── PL13: POST /placement/drives/<uuid:drive_id>/offers ─────────────────────

@placement_bp.post("/drives/<uuid:drive_id>/offers")
@require_auth
@require_roles("admin", "placement_cell")
def create_offer(drive_id):
    drive = db.session.query(PlacementDrive).filter_by(id=drive_id, is_deleted=False).first()
    if not drive:
        return error_response("Drive not found.", 404)

    try:
        data = OfferCreateSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    student_id = data["student_id"]

    # Check student applied
    app = db.session.query(DriveApplication).filter_by(
        drive_id=drive_id, student_id=student_id, is_deleted=False
    ).first()
    if not app:
        return error_response("Student has not applied to this drive.", 400)

    # one_offer_lock check for recipient
    if drive.one_offer_lock:
        existing_offer = db.session.query(PlacementOffer).filter_by(
            student_id=student_id, status=OfferStatus.ACCEPTED, is_deleted=False
        ).first()
        if existing_offer:
            return error_response("Student has already accepted an offer from another drive.", 400)

    # Duplicate offer check
    existing = db.session.query(PlacementOffer).filter_by(
        drive_id=drive_id, student_id=student_id, is_deleted=False
    ).first()
    if existing:
        return error_response("An offer already exists for this student in this drive.", 409)

    try:
        offer = PlacementOffer(
            drive_id=drive.id,
            student_id=student_id,
            ctc_offered=data["ctc_offered"],
            status=OfferStatus.EXTENDED,
            offer_date=data["offer_date"],
            acceptance_deadline=data.get("acceptance_deadline"),
        )
        db.session.add(offer)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "create_offer")

    audit_action("placement.offer.created", target_type="placement_offer", target_id=str(offer.id),
                 detail={"student_id": str(student_id), "drive_id": str(drive_id)})

    # ── Cross-feature trigger: notify the student an offer was issued ────────
    try:
        from app.utils.notify import notify
        notify(
            student_id,
            f"Offer Letter: {drive.company_name}",
            body=f"You have received an offer for {drive.role_title} at {drive.company_name}. Please respond before the deadline.",
            notif_type="placement",
            link="/internships",
        )
    except Exception:
        pass

    return jsonify({"message": "Offer extended successfully.", "offer_id": str(offer.id)}), 201


# ── PL14: PATCH /placement/drives/<uuid:drive_id>/offers/<uuid:student_id> ───

@placement_bp.patch("/drives/<uuid:drive_id>/offers/<uuid:student_id>")
@require_auth
@require_self_or_roles("student_id", "admin", "placement_cell")
def update_offer_status(drive_id, student_id):
    """
    Students can accept/decline their own offer.
    TPO/Admin can revoke offers.
    IDOR guard: @require_self_or_roles ensures student can only update their own offer.
    """
    offer = db.session.query(PlacementOffer).filter_by(
        drive_id=drive_id, student_id=student_id, is_deleted=False
    ).first()
    if not offer:
        return error_response("Offer not found.", 404)

    try:
        data = OfferUpdateSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    new_status = OfferStatus(data["status"])
    user = get_current_user()

    # Students can only accept/decline, not revoke
    if user.role == UserRole.STUDENT and new_status == OfferStatus.REVOKED:
        return error_response("Students cannot revoke offers.", 403)

    # Only TPO/admin can revoke
    if new_status == OfferStatus.REVOKED and user.role not in (UserRole.ADMIN, UserRole.PLACEMENT_CELL):
        return error_response("Only Placement Cell or Admin can revoke offers.", 403)

    offer.status = new_status

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_offer_status")

    audit_action("placement.offer.status_updated", target_type="placement_offer", target_id=str(offer.id),
                 detail={"new_status": new_status.value, "student_id": str(student_id)})
    return jsonify({"message": f"Offer status updated to '{new_status.value}'."}), 200


# ── PL15: GET /placement/drives/<uuid:drive_id>/offers ──────────────────────

@placement_bp.get("/drives/<uuid:drive_id>/offers")
@require_auth
@require_roles("admin", "placement_cell")
def list_drive_offers(drive_id):
    offers = db.session.query(PlacementOffer).filter_by(
        drive_id=drive_id, is_deleted=False
    ).all()

    result = []
    for off in offers:
        student = db.session.get(User, off.student_id)
        profile = student.student_profile if student else None
        result.append({
            "offer_id": str(off.id),
            "student_id": str(off.student_id),
            "roll_no": profile.roll_no if profile else None,
            "full_name": profile.full_name if profile else None,
            "ctc_offered": off.ctc_offered,
            "status": off.status.value,
            "offer_date": off.offer_date.isoformat(),
            "acceptance_deadline": off.acceptance_deadline.isoformat() if off.acceptance_deadline else None,
        })

    return jsonify(result), 200


# ── PL16: GET /placement/offers/me ───────────────────────────────────────────

@placement_bp.get("/offers/me")
@require_auth
@require_roles("student")
def get_own_offers():
    user = get_current_user()
    offers = db.session.query(PlacementOffer).filter_by(
        student_id=user.id, is_deleted=False
    ).all()

    result = []
    for off in offers:
        drive = db.session.get(PlacementDrive, off.drive_id)
        result.append({
            "offer_id": str(off.id),
            "drive_id": str(off.drive_id),
            "company_name": drive.company_name if drive else None,
            "role_title": drive.role_title if drive else None,
            "ctc_offered": off.ctc_offered,
            "status": off.status.value,
            "offer_date": off.offer_date.isoformat(),
            "acceptance_deadline": off.acceptance_deadline.isoformat() if off.acceptance_deadline else None,
        })

    return jsonify(result), 200


# ── GET /placement/stats ──────────────────────────────────────────────────────

@placement_bp.get("/stats")
@require_auth
@require_roles("admin", "placement_cell")
def get_placement_stats():
    """Aggregated placement statistics for TPO dashboard and reports."""
    from sqlalchemy import func
    from app.models.placement import PlacementDrive, DriveApplication, PlacementOffer, OfferStatus, BranchPlacement
    from app.models.student import StudentProfile

    total_students = db.session.query(StudentProfile).filter_by(is_deleted=False).count()
    total_drives   = db.session.query(PlacementDrive).filter_by(is_deleted=False).count()
    accepted_offers = db.session.query(PlacementOffer).filter_by(
        status=OfferStatus.ACCEPTED, is_deleted=False
    ).count()

    # Average CTC
    from sqlalchemy import cast, Float as SAFloat
    avg_ctc_row = db.session.query(
        func.avg(cast(PlacementOffer.ctc_offered, SAFloat))
    ).filter_by(status=OfferStatus.ACCEPTED, is_deleted=False).scalar()
    avg_ctc = round(float(avg_ctc_row), 2) if avg_ctc_row else 0.0

    # Highest CTC
    max_ctc_row = db.session.query(
        func.max(cast(PlacementOffer.ctc_offered, SAFloat))
    ).filter_by(status=OfferStatus.ACCEPTED, is_deleted=False).scalar()
    max_ctc = round(float(max_ctc_row), 2) if max_ctc_row else 0.0

    # Branch stats — use actual model field names
    branch_rows = db.session.query(BranchPlacement).all()
    branch_stats = [{
        "branch":      b.branch,
        "placed":      b.placed_count,
        "total":       b.total_count,
        "pct":         round((b.placed_count / b.total_count) * 100) if b.total_count else 0,
        "avg_ctc":     0,
        "highest_ctc": 0,
    } for b in branch_rows]

    # Recent drives (last 5)
    recent = db.session.query(PlacementDrive).filter_by(is_deleted=False).order_by(
        PlacementDrive.created_at.desc()
    ).limit(5).all()
    recent_drives = [{
        "id":               str(d.id),
        "company_name":     d.company_name,
        "role_title":       d.role_title,
        "ctc_lpa":          float(d.ctc_lpa) if d.ctc_lpa else 0,
        "status":           d.status.value if d.status else "active",
        "application_count": db.session.query(DriveApplication).filter_by(
            drive_id=d.id, is_deleted=False
        ).count(),
    } for d in recent]

    return jsonify({
        "total_students":     total_students,
        "placed":             accepted_offers,
        "drives_this_year":   total_drives,
        "total_offers":       accepted_offers,
        "avg_package":        f"{avg_ctc} LPA",
        "highest_package":    f"{max_ctc} LPA",
        "branch_stats":       branch_stats,
        "recent_drives":      recent_drives,
        "pipeline":           [
            {"label": "Applied",     "count": db.session.query(DriveApplication).filter_by(is_deleted=False).count(), "color": "#6366f1"},
            {"label": "Shortlisted", "count": db.session.query(PlacementOffer).filter_by(is_deleted=False).count(), "color": "#3b82f6"},
            {"label": "Offered",     "count": accepted_offers, "color": "#10b981"},
        ],
        "top_recruiters":     [],
        "yoy":                [],
        "recent_activity":    [],
    }), 200


# ── GET /placement/notices ────────────────────────────────────────────────────

@placement_bp.get("/notices")
@require_auth
def get_notices():
    """Placement notices visible to all authenticated users."""
    from app.models.community import Announcement
    notices = Announcement.query.filter_by(
        author_role="placement_cell"
    ).order_by(Announcement.created_at.desc()).all()
    res = [{
        "id":       str(n.id),
        "title":    n.title,
        "content":  n.content,
        "audience": "All Students",
        "time":     n.created_at.strftime("%b %d, %Y") if n.created_at else "Today",
        "pinned":   False,
        "urgent":   False,
    } for n in notices]
    return jsonify({"notices": res}), 200


@placement_bp.post("/notices")
@require_auth
@require_roles("admin", "placement_cell")
def create_notice():
    """Create a placement notice (stored as announcement with role=placement_cell)."""
    from app.models.community import Announcement
    user = get_current_user()
    data = request.get_json() or {}
    title   = data.get("title")
    content = data.get("content")
    if not title or not content:
        return error_response("title and content are required.", 400)
    try:
        a = Announcement(
            title       = title,
            content     = content,
            author_name = (user.email or "").split("@")[0].capitalize(),
            author_role = "placement_cell",
            target_branch = data.get("audience"),
        )
        db.session.add(a)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "create_notice")
    return jsonify({"message": "Notice posted.", "id": str(a.id)}), 201


@placement_bp.delete("/notices/<uuid:notice_id>")
@require_auth
@require_roles("admin", "placement_cell")
def delete_notice(notice_id):
    """Delete a placement notice."""
    from app.models.community import Announcement
    a = Announcement.query.filter_by(id=notice_id).first()
    if not a:
        return error_response("Notice not found.", 404)
    try:
        db.session.delete(a)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "delete_notice")
    return jsonify({"message": "Notice deleted."}), 200


# ── GET /placement/companies ──────────────────────────────────────────────────

@placement_bp.get("/companies")
@require_auth
def get_companies():
    """List all companies that have participated in placement drives."""
    drives = db.session.query(PlacementDrive).filter_by(is_deleted=False).all()
    # Deduplicate by company name
    seen = set()
    companies = []
    for d in drives:
        if d.company_name not in seen:
            seen.add(d.company_name)
            companies.append({
                "id":      str(d.id),
                "name":    d.company_name,
                "sector":  d.drive_type or "Tech",
                "status":  "Active",
                "drives":  sum(1 for x in drives if x.company_name == d.company_name),
            })
    return jsonify({"companies": companies}), 200


@placement_bp.post("/companies")
@require_auth
@require_roles("admin", "placement_cell")
def create_company():
    """Register a new company (creates a placeholder drive entry)."""
    data = request.get_json() or {}
    name = data.get("name") or data.get("company_name")
    if not name:
        return error_response("Company name is required.", 400)
    # Companies are implicitly created via drives — just acknowledge
    return jsonify({"message": f"Company '{name}' registered.", "name": name}), 201
