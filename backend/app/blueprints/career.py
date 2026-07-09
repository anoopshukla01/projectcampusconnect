"""
Career Blueprint — Lectures, Mock Interviews, Mentorship

ENDPOINT SUMMARY (all at /api/v1/career):
  GET  /lectures                      — student: branch-scoped recordings + syllabus
  POST /lectures                      — professor: upload lecture recording
  PATCH /lectures/<id>/progress       — professor: update syllabus progress %
  GET  /mock-interviews               — list active sessions
  POST /mock-interviews/<id>/book     — student: book a slot (idempotent)
  GET  /mentors                       — list active mentor profiles
  POST /mentors/<id>/request          — student: send mentorship request
  GET  /mentors/requests              — professor: view incoming requests
  PATCH /mentors/requests/<id>        — professor: accept / decline request

SECURITY: @require_auth on every endpoint; @require_roles where restricted.
IDOR: booking and request endpoints check student_id == current user.
"""

from flask import Blueprint, jsonify, request
from app.auth.permissions import require_auth, require_roles, get_current_user
from app.extensions import db
from app.models.user import UserRole
from app.models.student import StudentProfile
from app.utils.errors import error_response, internal_error_response
from app.utils.audit import audit_action

career_bp = Blueprint("career", __name__)


def _student_name(user):
    sp = getattr(user, "student_profile", None)
    if sp:
        return sp.full_name
    pp = getattr(user, "professor_profile", None)
    if pp:
        return pp.full_name
    return (user.email or "").split("@")[0].capitalize()


# ─────────────────────────────────────────────────────────────────────────────
# Lectures
# ─────────────────────────────────────────────────────────────────────────────

@career_bp.route("/lectures", methods=["GET"])
@require_auth
def get_lectures():
    """Student: branch-scoped recordings + syllabus. Professor: own recordings."""
    from app.models.content import LectureRecording, SyllabusProgress
    user    = get_current_user()
    student = StudentProfile.query.filter_by(user_id=user.id, is_deleted=False).first()
    branch  = student.branch if student else None

    if user.role == UserRole.PROFESSOR:
        recordings = LectureRecording.query.filter_by(
            uploaded_by_id=user.id
        ).order_by(LectureRecording.created_at.desc()).all()
        syllabus   = SyllabusProgress.query.filter_by(
            professor_id=user.id
        ).all()
    else:
        recordings = LectureRecording.query.filter(
            (LectureRecording.branch == branch) | (LectureRecording.branch.is_(None))
        ).order_by(LectureRecording.created_at.desc()).limit(50).all()
        syllabus   = SyllabusProgress.query.filter(
            (SyllabusProgress.branch == branch) | (SyllabusProgress.branch.is_(None))
        ).all()

    rec_list = [{
        "id":      str(r.id),
        "title":   r.title,
        "subject": r.subject,
        "code":    r.course_code,
        "prof":    r.professor_name,
        "duration": r.duration,
        "url":     r.video_url,
        "date":    r.created_at.strftime("%b %d, %Y") if r.created_at else "",
    } for r in recordings]

    syl_list = [{
        "name":     s.subject,
        "code":     s.course_code,
        "module":   s.module_info,
        "progress": s.progress_pct,
    } for s in syllabus]

    return jsonify({"recordings": rec_list, "syllabus": syl_list}), 200


@career_bp.route("/lectures", methods=["POST"])
@require_auth
@require_roles("professor", "admin")
def upload_lecture():
    """Professor: add a lecture recording entry."""
    from app.models.content import LectureRecording
    user = get_current_user()
    data = request.get_json() or {}
    title   = data.get("title")
    subject = data.get("subject")
    if not title or not subject:
        return error_response("title and subject are required.", 400)

    pp = getattr(user, "professor_profile", None)
    prof_name = pp.full_name if pp else (user.email or "").split("@")[0].capitalize()

    try:
        r = LectureRecording(
            title          = title,
            subject        = subject,
            course_code    = data.get("code"),
            professor_name = prof_name,
            uploaded_by_id = user.id,
            branch         = data.get("branch"),
            video_url      = data.get("url") or data.get("video_url"),
            duration       = data.get("duration"),
        )
        db.session.add(r)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "upload_lecture")

    return jsonify({"message": "Lecture uploaded.", "id": str(r.id)}), 201


@career_bp.route("/lectures/<uuid:recording_id>/progress", methods=["PATCH"])
@require_auth
@require_roles("professor", "admin")
def update_syllabus_progress(recording_id):
    """Professor: update or upsert syllabus progress for a course."""
    from app.models.content import SyllabusProgress
    user = get_current_user()
    data = request.get_json() or {}

    course_code = data.get("course_code") or data.get("code")
    subject     = data.get("subject")
    progress    = data.get("progress")

    if progress is None:
        return error_response("progress (0-100) is required.", 400)

    try:
        sp = SyllabusProgress.query.filter_by(
            course_code=course_code, professor_id=user.id
        ).first()
        if not sp:
            sp = SyllabusProgress(
                subject=subject or course_code or "Unknown",
                course_code=course_code or "CS000",
                professor_id=user.id,
                branch=data.get("branch"),
            )
            db.session.add(sp)
        sp.progress_pct = min(100, max(0, int(progress)))
        if data.get("module_info"):
            sp.module_info = data["module_info"]
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_syllabus_progress")

    return jsonify({"message": "Progress updated.", "progress": sp.progress_pct}), 200


# ─────────────────────────────────────────────────────────────────────────────
# Mock Interviews
# ─────────────────────────────────────────────────────────────────────────────

@career_bp.route("/mock-interviews", methods=["GET"])
@require_auth
def get_mock_interviews():
    """List active mock interview sessions with booking count."""
    from app.models.content import MockInterviewSession, MockInterviewBooking
    user     = get_current_user()
    sessions = MockInterviewSession.query.filter_by(is_active=True).order_by(
        MockInterviewSession.scheduled_at.asc()
    ).all()

    # Collect sessions current user already booked
    booked_ids = set()
    if user.role == UserRole.STUDENT:
        bookings = MockInterviewBooking.query.filter_by(student_id=user.id).all()
        booked_ids = {str(b.session_id) for b in bookings}

    res = [{
        "id":         str(s.id),
        "type":       s.session_type,
        "company":    s.company_style or "General",
        "difficulty": s.difficulty,
        "duration":   s.duration_minutes,
        "slots":      s.scheduled_at.strftime("%b %d · %I:%M %p") if s.scheduled_at else "TBD",
        "booked":     str(s.id) in booked_ids,
    } for s in sessions]

    return jsonify({"sessions": res}), 200


@career_bp.route("/mock-interviews/<uuid:session_id>/book", methods=["POST"])
@require_auth
@require_roles("student")
def book_mock_interview(session_id):
    """Student: book a mock interview slot (idempotent)."""
    from app.models.content import MockInterviewSession, MockInterviewBooking
    user    = get_current_user()
    session = MockInterviewSession.query.filter_by(id=session_id, is_active=True).first()
    if not session:
        return error_response("Session not found or not active.", 404)

    existing = MockInterviewBooking.query.filter_by(
        session_id=session_id, student_id=user.id
    ).first()
    if existing:
        return jsonify({"message": "Already booked.", "already_booked": True}), 200

    try:
        booking = MockInterviewBooking(session_id=session.id, student_id=user.id)
        db.session.add(booking)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "book_mock_interview")

    audit_action("career.mock_interview.booked",
                 target_type="mock_interview_session", target_id=str(session_id))

    # ── Cross-feature trigger: confirm booking to student ────────────────────
    try:
        from app.utils.notify import notify
        slot_str = session.scheduled_at.strftime("%b %d · %I:%M %p") if session.scheduled_at else "TBD"
        notify(
            user.id,
            f"Mock Interview Booked: {session.session_type}",
            body=f"Your {session.session_type} mock interview ({session.difficulty}) is booked for {slot_str}.",
            notif_type="general",
            link="/mock",
        )
    except Exception:
        pass

    return jsonify({"message": "Slot booked successfully.", "booking_id": str(booking.id)}), 201


# ─────────────────────────────────────────────────────────────────────────────
# Mentorship
# ─────────────────────────────────────────────────────────────────────────────

@career_bp.route("/mentors", methods=["GET"])
@require_auth
def get_mentors():
    """List active mentor profiles."""
    from app.models.content import MentorProfile, MentorshipRequest, MentorshipRequestStatus
    user    = get_current_user()
    mentors = MentorProfile.query.filter_by(is_active=True).order_by(
        MentorProfile.rating.desc()
    ).all()

    # Mark which ones the current student has already requested
    requested_ids = set()
    if user.role == UserRole.STUDENT:
        reqs = MentorshipRequest.query.filter_by(
            student_id=user.id,
            status=MentorshipRequestStatus.PENDING,
        ).all()
        requested_ids = {str(r.mentor_id) for r in reqs}

    res = [{
        "id":        str(m.id),
        "name":      m.name,
        "role":      m.role_title,
        "expertise": m.expertise.split(",") if m.expertise else [],
        "rating":    float(m.rating) if m.rating else 4.5,
        "sessions":  m.sessions_count,
        "available": m.is_available,
        "requested": str(m.id) in requested_ids,
    } for m in mentors]

    return jsonify({"mentors": res}), 200


@career_bp.route("/mentors/<uuid:mentor_id>/request", methods=["POST"])
@require_auth
@require_roles("student")
def request_mentorship(mentor_id):
    """Student: send a mentorship request."""
    from app.models.content import MentorProfile, MentorshipRequest, MentorshipRequestStatus
    user   = get_current_user()
    mentor = MentorProfile.query.filter_by(id=mentor_id, is_active=True).first()
    if not mentor:
        return error_response("Mentor not found.", 404)
    if not mentor.is_available:
        return error_response("This mentor is currently unavailable.", 400)

    # Idempotency: one pending request per student+mentor at a time
    existing = MentorshipRequest.query.filter_by(
        mentor_id=mentor_id,
        student_id=user.id,
        status=MentorshipRequestStatus.PENDING,
    ).first()
    if existing:
        return jsonify({"message": "Request already sent.", "already_requested": True}), 200

    data    = request.get_json() or {}
    topic   = data.get("topic") or data.get("message", "General guidance")
    message = data.get("message")

    try:
        req = MentorshipRequest(
            mentor_id  = mentor.id,
            student_id = user.id,
            topic      = topic,
            message    = message,
        )
        db.session.add(req)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "request_mentorship")

    audit_action("career.mentorship.requested",
                 target_type="mentor_profile", target_id=str(mentor_id))
    return jsonify({"message": f"Request sent to {mentor.name}.", "id": str(req.id)}), 201


@career_bp.route("/mentors/requests", methods=["GET"])
@require_auth
@require_roles("professor", "admin")
def get_mentor_requests():
    """Professor: list all pending mentorship requests for them."""
    from app.models.content import MentorProfile, MentorshipRequest, MentorshipRequestStatus
    user   = get_current_user()
    # Find this professor's mentor profile
    mentor = MentorProfile.query.filter_by(user_id=user.id).first()
    if not mentor:
        return jsonify({"requests": []}), 200

    reqs = MentorshipRequest.query.filter_by(
        mentor_id=mentor.id,
        status=MentorshipRequestStatus.PENDING,
    ).order_by(MentorshipRequest.created_at.asc()).all()

    res = []
    for r in reqs:
        sp = getattr(r.student, "student_profile", None)
        res.append({
            "id":           str(r.id),
            "student_name": sp.full_name if sp else _student_name(r.student),
            "roll":         sp.roll_no   if sp else "—",
            "topic":        r.topic,
            "message":      r.message,
            "created_at":   r.created_at.isoformat() if r.created_at else None,
        })

    return jsonify({"requests": res}), 200


@career_bp.route("/mentors/requests/<uuid:request_id>", methods=["PATCH"])
@require_auth
@require_roles("professor", "admin")
def respond_to_mentor_request(request_id):
    """Professor: accept or decline a mentorship request."""
    from app.models.content import MentorProfile, MentorshipRequest, MentorshipRequestStatus
    user = get_current_user()
    req  = MentorshipRequest.query.filter_by(id=request_id).first()
    if not req:
        return error_response("Request not found.", 404)

    # IDOR: professor can only respond to requests for their mentor profile
    mentor = MentorProfile.query.filter_by(user_id=user.id).first()
    if not mentor or str(req.mentor_id) != str(mentor.id):
        return error_response("You can only respond to requests for your mentor profile.", 403)

    data   = request.get_json() or {}
    action = data.get("action")  # "accept" | "decline"
    if action not in ("accept", "decline"):
        return error_response("action must be 'accept' or 'decline'.", 400)

    try:
        req.status = (MentorshipRequestStatus.ACCEPTED
                      if action == "accept"
                      else MentorshipRequestStatus.DECLINED)
        if action == "accept":
            mentor.sessions_count = (mentor.sessions_count or 0) + 1
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "respond_to_mentor_request")

    audit_action(f"career.mentorship.{action}d",
                 target_type="mentorship_request", target_id=str(request_id))

    # ── Cross-feature trigger: notify the student of the decision ────────────
    try:
        from app.utils.notify import notify
        if action == "accept":
            notify(
                req.student_id,
                f"Mentorship Approved: {mentor.name}",
                body=f"Prof. {mentor.name} has accepted your mentorship request for '{req.topic}'.",
                notif_type="mentorship",
                link="/mentorship",
            )
        else:
            notify(
                req.student_id,
                f"Mentorship Declined: {mentor.name}",
                body=f"Your mentorship request for '{req.topic}' was declined. Try requesting another mentor.",
                notif_type="mentorship",
                link="/mentorship",
            )
    except Exception:
        pass

    return jsonify({"message": f"Request {action}d."}), 200


# ─────────────────────────────────────────────────────────────────────────────
# Notes (alias — delegates to community.notes)
# ─────────────────────────────────────────────────────────────────────────────

@career_bp.route("/notes", methods=["GET"])
@require_auth
def get_notes_and_pyqs():
    """Proxy to community notes — returns approved notes for career tab."""
    from app.models.community import StudyNote
    notes = StudyNote.query.filter_by(approved=True).order_by(
        StudyNote.created_at.desc()
    ).all()
    res = [{
        "id":       str(n.id),
        "title":    n.title,
        "subject":  n.subject,
        "type":     n.note_type or "notes",
        "uploader": n.author_name,
        "date":     n.created_at.strftime("%b %d") if n.created_at else "",
    } for n in notes]
    return jsonify({"notes": res}), 200
