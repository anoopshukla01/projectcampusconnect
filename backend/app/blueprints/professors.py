"""
Professor Blueprint — Endpoints P1–P12

ENDPOINT SUMMARY (all at /api/v1/professors):
  P1  GET /professors/me                         — get own profile
  P2  PATCH /professors/me                       — update own profile
  P3  GET /professors/<uuid:prof_id>             — get specific professor (admin only)
  P4  GET /professors                            — list professors (admin only)
  P5  PATCH /professors/<uuid:prof_id>           — admin update (audited)
  P6  DELETE /professors/<uuid:prof_id>          — admin soft delete (audited)
  P7  GET /professors/me/classes                 — list own class assignments (IDOR anchor)
  P8  GET /professors/me/classes/<code>/roster   — roster for one class (academic view)
  P9  GET /professors/me/classes/<code>/students/<uuid:sid> — academic drill-down for one student
  P10 GET /professors/me/dashboard-stats         — live numbers for the dashboard
  P11 POST /professors/me/admin-detail-request   — request admin access for a student's admin details
  P12 GET /professors/me/admin-detail-requests   — list own pending/approved/rejected requests

SELF-REVIEW CHECKLIST:
  [x] Auth check present          — all routes decorated with @require_auth
  [x] Role check present          — RBAC enforced (professor role)
  [x] IDOR guard present          — P7-P9 anchor on ProfessorClassAssignment.professor_user_id = me
  [x] Input validated             — Marshmallow handles PATCH requests
  [x] Errors handled safely       — 404/403 errors and transaction rollback
  [x] Transaction/rollback        — db.session.commit() with rollback on error
  [x] Admin fields masked         — student phone/email/address never sent unless access is approved
"""

from datetime import datetime, timezone, timedelta

from flask import Blueprint, jsonify, request, g
from marshmallow import ValidationError
from sqlalchemy import func

from app.auth.permissions import require_auth, require_roles, get_current_user
from app.extensions import db
from app.models.user import UserRole
from app.models.professor import ProfessorProfile, ApprovalStatus
from app.models.student import StudentProfile
from app.models.academic import (
    ProfessorClassAssignment, Assignment, AssignmentSubmission,
    AttendanceRecord, Grade,
)
from app.models.community import AdminDetailRequest
from app.models.content import MentorshipRequest, MentorshipRequestStatus
from app.schemas.professor import ProfessorResponseSchema, ProfessorUpdateSchema, AdminProfessorUpdateSchema
from app.utils.audit import audit_action
from app.utils.errors import error_response, internal_error_response, validation_error_response

professors_bp = Blueprint("professors", __name__)

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _get_my_assignments(user):
    """Return ProfessorClassAssignment rows for the authenticated professor.
    This is the IDOR anchor — never pass professor_id from the client."""
    return ProfessorClassAssignment.query.filter_by(
        professor_user_id=user.id, is_active=True
    ).all()

def _assert_owns_class(user, course_code):
    """Raise 403 if this professor is not assigned to the given course_code."""
    assignment = ProfessorClassAssignment.query.filter_by(
        professor_user_id=user.id, course_code=course_code, is_active=True
    ).first()
    return assignment  # caller checks for None → 403

# Admin-detail fields that are masked unless approved access exists
_MASKED_FIELDS = ("hostel_address",)

def _admin_access_approved(prof_user_id, student_profile_id):
    """Check if professor has an approved admin-detail-request for this student."""
    req = AdminDetailRequest.query.filter_by(
        professor_user_id=prof_user_id,
        student_id=student_profile_id,
        status="approved",
    ).first()
    if not req:
        return False
    if req.expires_at and req.expires_at < datetime.now(timezone.utc):
        return False
    return True

def _serialize_student_academic(sp, prof_user_id, include_admin=False):
    """Serialise StudentProfile for the professor's class roster.
    Academic fields always visible; admin fields masked unless access approved."""
    has_access = include_admin or _admin_access_approved(prof_user_id, sp.id)
    return {
        "id":               str(sp.id),
        "roll_no":          sp.roll_no,
        "full_name":        sp.full_name,
        "branch":           sp.branch,
        "semester":         sp.semester,
        "batch_year":       sp.batch_year,
        "cgpa":             float(sp.cgpa) if sp.cgpa is not None else None,
        "attendance_pct":   float(sp.attendance_pct) if sp.attendance_pct is not None else None,
        "active_backlogs":  sp.active_backlogs,
        # Administrative details — masked unless access granted
        "hostel_address":   sp.hostel_address if has_access else "***",
        "admin_access_granted": has_access,
    }


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
        id=prof_id, college_id=g.current_user.college_id, is_deleted=False
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

    query = db.session.query(ProfessorProfile).filter(
        ProfessorProfile.college_id == g.current_user.college_id,
        ProfessorProfile.is_deleted == False
    ) # noqa: E712

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
        id=prof_id, college_id=g.current_user.college_id, is_deleted=False
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
        id=prof_id, college_id=g.current_user.college_id, is_deleted=False
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


# ── P7: GET /professors/me/classes ────────────────────────────────────────────

@professors_bp.get("/me/classes")
@require_auth
@require_roles("professor")
def get_my_classes():
    """Return the list of class/subject assignments for the authenticated professor.
    IDOR: professor_user_id is derived from JWT, never from a query param."""
    user = get_current_user()
    assignments = _get_my_assignments(user)
    return jsonify({
        "classes": [
            {
                "id":            str(a.id),
                "course_name":   a.course_name,
                "course_code":   a.course_code,
                "branch":        a.branch,
                "semester":      a.semester,
                "academic_year": a.academic_year,
            }
            for a in assignments
        ]
    }), 200


# ── P8: GET /professors/me/classes/<code>/roster ──────────────────────────────

@professors_bp.get("/me/classes/<string:code>/roster")
@require_auth
@require_roles("professor")
def get_class_roster(code):
    """Return the student roster for one of the professor's own classes.
    Only academic fields are returned by default; admin-details masked.
    IDOR: professor must own the class via ProfessorClassAssignment."""
    user = get_current_user()
    assignment = _assert_owns_class(user, code)
    if not assignment:
        return error_response("You are not assigned to this class.", 403)

    students = StudentProfile.query.filter_by(
        college_id=user.college_id,
        branch=assignment.branch,
        semester=assignment.semester,
        is_deleted=False,
    ).all()

    search = request.args.get("search", "").lower()
    sort_by = request.args.get("sort_by", "name")  # name | cgpa | attendance
    order = request.args.get("order", "asc")  # asc | desc

    if search:
        students = [
            s for s in students
            if search in s.full_name.lower() or search in s.roll_no.lower()
        ]

    def sort_key(s):
        if sort_by == "cgpa":
            return float(s.cgpa or 0)
        if sort_by == "attendance":
            return float(s.attendance_pct or 0)
        return s.full_name.lower()

    students.sort(key=sort_key, reverse=(order == "desc"))

    return jsonify({
        "course_name":   assignment.course_name,
        "course_code":   assignment.course_code,
        "branch":        assignment.branch,
        "semester":      assignment.semester,
        "total_students": len(students),
        "students": [_serialize_student_academic(s, user.id) for s in students],
    }), 200


# ── P9: GET /professors/me/classes/<code>/students/<uuid:sid> ─────────────────

@professors_bp.get("/me/classes/<string:code>/students/<uuid:sid>")
@require_auth
@require_roles("professor")
def get_student_academic_profile(code, sid):
    """Academic drill-down for a single student in the professor's class.
    Only data relevant to teaching is returned — no private chats, marketplace, etc."""
    user = get_current_user()
    assignment = _assert_owns_class(user, code)
    if not assignment:
        return error_response("You are not assigned to this class.", 403)

    sp = StudentProfile.query.filter_by(id=sid, college_id=user.college_id, is_deleted=False).first()
    if not sp:
        return error_response("Student not found.", 404)

    # IDOR: student must be in the professor's branch+semester
    if sp.branch != assignment.branch or sp.semester != assignment.semester:
        return error_response("This student is not in your class.", 403)

    # Attendance for this course
    att = AttendanceRecord.query.filter_by(
        student_id=sid, subject_code=code
    ).first()

    # Grades for this course
    grades = Grade.query.filter_by(student_id=sid, course_code=code).all()

    # Submissions for assignments posted by this professor for this course
    assignment_ids = [
        a.id for a in Assignment.query.filter_by(
            professor_id=user.id
        ).all()
    ]
    submissions = (
        AssignmentSubmission.query
        .filter(AssignmentSubmission.assignment_id.in_(assignment_ids))
        .filter_by(student_id=sid, is_current=True)
        .all()
    ) if assignment_ids else []

    return jsonify({
        "student":     _serialize_student_academic(sp, user.id),
        "attendance":  {
            "attended":  att.attended_classes if att else 0,
            "total":     att.total_classes    if att else 0,
            "pct":       round(att.attended_classes / att.total_classes * 100, 1)
                         if att and att.total_classes else 0,
        },
        "grades": [
            {
                "course_code":    g.course_code,
                "internal_marks": g.internal_marks,
                "mid_sem_marks":  g.mid_sem_marks,
                "grade":          g.grade,
                "grade_point":    g.grade_point,
                "credits":        g.credits,
            }
            for g in grades
        ],
        "submissions": [
            {
                "assignment_id": str(s.assignment_id),
                "status":        s.status,
                "grade":         s.grade,
                "feedback":      s.feedback,
                "submitted_at":  s.submitted_at.isoformat() if s.submitted_at else None,
            }
            for s in submissions
        ],
    }), 200


# ── P10: GET /professors/me/dashboard-stats ───────────────────────────────────

@professors_bp.get("/me/dashboard-stats")
@require_auth
@require_roles("professor")
def get_dashboard_stats():
    """Real-time numbers for the professor dashboard cards."""
    user = get_current_user()
    assignments = _get_my_assignments(user)

    # Active classes count
    active_classes = len(assignments)

    # Distinct students across all assigned classes
    student_ids = set()
    for a in assignments:
        students = StudentProfile.query.filter_by(
            college_id=user.college_id, branch=a.branch, semester=a.semester, is_deleted=False
        ).with_entities(StudentProfile.id).all()
        for (sid,) in students:
            student_ids.add(sid)
    total_students = len(student_ids)

    # Ungraded submissions across professor's own assignments
    prof_assignment_ids = [
        a.id for a in Assignment.query.filter_by(professor_id=user.id).all()
    ]
    pending_grading = 0
    if prof_assignment_ids:
        pending_grading = (
            AssignmentSubmission.query
            .filter(AssignmentSubmission.assignment_id.in_(prof_assignment_ids))
            .filter_by(status="submitted", is_current=True)
            .count()
        )

    # Pending mentorship requests
    profile = user.professor_profile
    mentor_profile = None
    if profile:
        from app.models.content import MentorProfile
        mentor_profile = MentorProfile.query.filter_by(user_id=user.id).first()
    pending_mentorship = 0
    if mentor_profile:
        pending_mentorship = MentorshipRequest.query.filter_by(
            mentor_id=mentor_profile.id,
            status=MentorshipRequestStatus.PENDING,
        ).count()

    # Today's schedule
    from app.models.academic import TimetableSlot
    today = datetime.now(timezone.utc).strftime("%A")[:3]  # Mon, Tue, ...
    todays_slots = TimetableSlot.query.filter_by(
        user_id=user.id, day_of_week=today, is_deleted=False
    ).order_by(TimetableSlot.time_slot).all()

    return jsonify({
        "active_classes":    active_classes,
        "total_students":    total_students,
        "pending_grading":   pending_grading,
        "pending_mentorship": pending_mentorship,
        "todays_schedule": [
            {
                "id":          str(s.id),
                "course_name": s.course_name,
                "course_code": s.course_code,
                "time_slot":   s.time_slot,
                "room":        s.room,
                "slot_type":   s.slot_type,
            }
            for s in todays_slots
        ],
    }), 200


# ── P11: POST /professors/me/admin-detail-request ─────────────────────────────

@professors_bp.post("/me/admin-detail-request")
@require_auth
@require_roles("professor")
def request_admin_details():
    """Professor submits a request to view a specific student's administrative
    details. The Admin must approve before the masked fields are revealed.
    IDOR: professor_user_id set server-side from JWT."""
    user = get_current_user()
    data = request.get_json(force=True) or {}

    student_id_str = data.get("student_id")
    reason = (data.get("reason") or "").strip()

    if not student_id_str:
        return error_response("student_id is required.", 400)

    import uuid as _uuid
    try:
        student_uuid = _uuid.UUID(student_id_str)
    except (ValueError, AttributeError):
        return error_response("Invalid student_id.", 400)

    sp = StudentProfile.query.filter_by(id=student_uuid, college_id=user.college_id, is_deleted=False).first()
    if not sp:
        return error_response("Student not found.", 404)

    # IDOR: professor must teach this student
    teaches = any(
        a.branch == sp.branch and a.semester == sp.semester
        for a in _get_my_assignments(user)
    )
    if not teaches:
        return error_response("You do not teach this student.", 403)

    # Check for an existing pending/approved request
    existing = AdminDetailRequest.query.filter(
        AdminDetailRequest.professor_user_id == user.id,
        AdminDetailRequest.student_id == sp.id,
        AdminDetailRequest.status.in_(["pending", "approved"]),
    ).first()
    if existing:
        return jsonify({
            "message": "A request already exists.",
            "status":  existing.status,
            "id":      str(existing.id),
        }), 200

    req = AdminDetailRequest(
        professor_user_id=user.id,
        student_id=sp.id,
        reason=reason,
        status="pending",
    )
    db.session.add(req)
    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "request_admin_details")

    return jsonify({
        "message": "Request submitted. Awaiting Admin approval.",
        "id":      str(req.id),
        "status":  "pending",
    }), 201


# ── P12: GET /professors/me/admin-detail-requests ─────────────────────────────

@professors_bp.get("/me/admin-detail-requests")
@require_auth
@require_roles("professor")
def list_admin_detail_requests():
    """List all admin-detail-requests submitted by this professor,
    with their current status (pending / approved / rejected)."""
    user = get_current_user()
    reqs = (
        AdminDetailRequest.query
        .filter_by(professor_user_id=user.id)
        .order_by(AdminDetailRequest.created_at.desc())
        .all()
    )
    return jsonify({
        "requests": [
            {
                "id":         str(r.id),
                "student_id": str(r.student_id),
                "student_name": r.student.full_name if r.student else "Unknown",
                "reason":     r.reason,
                "status":     r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                "expires_at": r.expires_at.isoformat() if r.expires_at else None,
            }
            for r in reqs
        ]
    }), 200
