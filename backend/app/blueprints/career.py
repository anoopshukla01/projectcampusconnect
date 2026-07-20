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
            college_id=user.college_id,
            uploaded_by_id=user.id
        ).order_by(LectureRecording.created_at.desc()).all()
        syllabus   = SyllabusProgress.query.filter_by(
            college_id=user.college_id,
            professor_id=user.id
        ).all()
    else:
        recordings = LectureRecording.query.filter(
            LectureRecording.college_id == user.college_id,
            (LectureRecording.branch == branch) | (LectureRecording.branch.is_(None))
        ).order_by(LectureRecording.created_at.desc()).limit(50).all()
        syllabus   = SyllabusProgress.query.filter(
            SyllabusProgress.college_id == user.college_id,
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
            college_id     = user.college_id,
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
            college_id=user.college_id,
            course_code=course_code, professor_id=user.id
        ).first()
        if not sp:
            sp = SyllabusProgress(
                college_id=user.college_id,
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
    sessions = MockInterviewSession.query.filter_by(college_id=user.college_id, is_active=True).order_by(
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
    session = MockInterviewSession.query.filter_by(id=session_id, college_id=user.college_id, is_active=True).first()
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
        
        # Create timetable slot for student
        from app.models.academic import TimetableSlot
        from datetime import timedelta
        day_map = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}
        day_str = "Mon"
        time_str = "09:00 - 09:45"
        if session.scheduled_at:
            day_str = day_map.get(session.scheduled_at.weekday(), "Mon")
            duration = session.duration_minutes or 45
            end_time = session.scheduled_at + timedelta(minutes=duration)
            time_str = f"{session.scheduled_at.strftime('%H:%M')} - {end_time.strftime('%H:%M')}"
            
        slot = TimetableSlot(
            college_id=user.college_id,
            branch=None,
            semester=None,
            role=None,
            user_id=user.id,
            day_of_week=day_str,
            time_slot=time_str,
            course_name=f"Mock Interview: {session.session_type}",
            course_code="MOCK-INT",
            room="Online (Daily.co)",
            professor_name="Placement Panel",
            slot_type="meeting"
        )
        db.session.add(slot)
        
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

    # Check if student already has an active mentorship
    active = MentorshipRequest.query.filter_by(
        student_id=user.id,
        status=MentorshipRequestStatus.ACCEPTED
    ).first()
    if active:
        return error_response("You already have an active mentorship. You cannot apply to a second mentor.", 400)

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
            
            # 1. Initialize direct chat conversation
            from app.models.chat import Conversation, ConversationType, GroupMembership, GroupRole
            existing_conv = db.session.query(Conversation).join(GroupMembership).filter(
                Conversation.type == ConversationType.DIRECT,
                GroupMembership.user_id.in_([req.student_id, mentor.user_id])
            ).group_by(Conversation.id).having(db.func.count(GroupMembership.user_id) == 2).first()

            if not existing_conv:
                conv = Conversation(
                    name=f"Mentorship: {mentor.name}",
                    type=ConversationType.DIRECT,
                    is_accepted=True
                )
                db.session.add(conv)
                db.session.flush()

                m1 = GroupMembership(conversation_id=conv.id, user_id=req.student_id, role=GroupRole.MEMBER)
                m2 = GroupMembership(conversation_id=conv.id, user_id=mentor.user_id, role=GroupRole.ADMIN)
                db.session.add(m1)
                db.session.add(m2)

            # 2. Add timetable slots for student and professor
            from app.models.academic import TimetableSlot
            from app.models.student import StudentProfile
            student_prof = StudentProfile.query.filter_by(user_id=req.student_id).first()
            
            slot_student = TimetableSlot(
                branch=None,
                semester=None,
                role=None,
                user_id=req.student_id,
                day_of_week="Fri",
                time_slot="15:00 - 16:00",
                course_name="Mentorship Session",
                course_code="MENT-001",
                room="Professor Cabin",
                professor_name=mentor.name,
                slot_type="meeting"
            )
            slot_professor = TimetableSlot(
                branch=None,
                semester=None,
                role=None,
                user_id=mentor.user_id,
                day_of_week="Fri",
                time_slot="15:00 - 16:00",
                course_name=f"Mentorship Session ({student_prof.full_name if student_prof else 'Student'})",
                course_code="MENT-001",
                room="Professor Cabin",
                professor_name=mentor.name,
                slot_type="meeting"
            )
            db.session.add(slot_student)
            db.session.add(slot_professor)

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
# Mock Interview: Student Status & Feedback, Professor Approve
# ─────────────────────────────────────────────────────────────────────────────

@career_bp.route("/mock-interviews/me", methods=["GET"])
@require_auth
@require_roles("student")
def get_my_mock_interview_bookings():
    """Student: view their own mock interview bookings with current status."""
    from app.models.content import MockInterviewBooking, MockInterviewSession
    user = get_current_user()
    bookings = MockInterviewBooking.query.filter_by(student_id=user.id).order_by(
        MockInterviewBooking.created_at.desc()
    ).all()

    result = []
    for b in bookings:
        s = b.session
        result.append({
            "booking_id":   str(b.id),
            "session_id":   str(s.id) if s else None,
            "session_type": s.session_type if s else None,
            "company":      s.company_style or "General" if s else None,
            "difficulty":   s.difficulty if s else None,
            "scheduled_at": s.scheduled_at.strftime("%b %d · %I:%M %p") if s and s.scheduled_at else "TBD",
            "status":       getattr(b, "status", "pending"),
            "feedback":     getattr(b, "feedback", None),
            "score":        getattr(b, "score", None),
            "room_url":     getattr(b, "room_url", None),
        })

    return jsonify({"bookings": result}), 200


@career_bp.route("/mock-interviews/<uuid:booking_id>/feedback", methods=["POST"])
@require_auth
@require_roles("professor", "admin")
def submit_mock_interview_feedback(booking_id):
    """Professor: submit feedback and score for a student's mock interview booking."""
    from app.models.content import MockInterviewBooking, MentorProfile
    user    = get_current_user()
    booking = MockInterviewBooking.query.filter_by(id=booking_id).first()
    if not booking:
        return error_response("Booking not found.", 404)

    data     = request.get_json() or {}
    feedback = data.get("feedback", "").strip()
    score    = data.get("score")
    status   = data.get("status", "completed")  # "completed" | "no_show"

    if not feedback:
        return error_response("Feedback is required.", 400)
    if status not in ("completed", "no_show"):
        return error_response("status must be 'completed' or 'no_show'.", 400)

    try:
        if hasattr(booking, "feedback"):
            booking.feedback = feedback
        if hasattr(booking, "score") and score is not None:
            booking.score = score
        if hasattr(booking, "status"):
            booking.status = status
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "submit_mock_interview_feedback")

    audit_action("career.mock_interview.feedback_submitted",
                 target_type="mock_interview_booking", target_id=str(booking_id))

    # Notify student
    try:
        from app.utils.notify import notify
        score_str = f" (Score: {score}/10)" if score is not None else ""
        notify(
            booking.student_id,
            "Mock Interview Feedback Ready",
            body=f"Your mock interview feedback is available.{score_str}",
            notif_type="general",
            link="/mock",
        )
    except Exception:
        pass

    return jsonify({"message": "Feedback submitted successfully."}), 200


@career_bp.route("/mock-interviews/<uuid:session_id>/approve", methods=["PATCH"])
@require_auth
@require_roles("professor", "admin")
def approve_mock_interview_session(session_id):
    """Professor: approve/reopen a mock interview session and optionally set a room URL."""
    from app.models.content import MockInterviewSession
    session = MockInterviewSession.query.filter_by(id=session_id).first()
    if not session:
        return error_response("Session not found.", 404)

    data     = request.get_json() or {}
    is_active = data.get("is_active")
    room_url  = data.get("room_url")

    try:
        if is_active is not None:
            session.is_active = bool(is_active)
        if room_url and hasattr(session, "room_url"):
            session.room_url = room_url
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "approve_mock_interview_session")

    audit_action("career.mock_interview.session_updated",
                 target_type="mock_interview_session", target_id=str(session_id))
    return jsonify({"message": "Session updated.", "is_active": session.is_active}), 200


# ─────────────────────────────────────────────────────────────────────────────
# Mentorship: Complete a session
# ─────────────────────────────────────────────────────────────────────────────

@career_bp.route("/mentors/requests/<uuid:request_id>/complete", methods=["POST"])
@require_auth
@require_roles("professor")
def complete_mentorship_session(request_id):
    """Professor: mark a mentorship session as complete and optionally add notes."""
    from app.models.content import MentorProfile, MentorshipRequest, MentorshipRequestStatus
    user = get_current_user()
    req  = MentorshipRequest.query.filter_by(id=request_id).first()
    if not req:
        return error_response("Mentorship request not found.", 404)

    mentor = MentorProfile.query.filter_by(user_id=user.id).first()
    if not mentor or str(req.mentor_id) != str(mentor.id):
        return error_response("You can only complete sessions for your mentor profile.", 403)

    if req.status != MentorshipRequestStatus.ACCEPTED:
        return error_response("Only accepted requests can be marked complete.", 400)

    data          = request.get_json() or {}
    session_notes = data.get("session_notes", "").strip()

    try:
        req.status = MentorshipRequestStatus.COMPLETED if hasattr(
            MentorshipRequestStatus, "COMPLETED"
        ) else MentorshipRequestStatus.ACCEPTED
        if hasattr(req, "session_notes") and session_notes:
            req.session_notes = session_notes
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "complete_mentorship_session")

    audit_action("career.mentorship.completed",
                 target_type="mentorship_request", target_id=str(request_id))

    # Notify student
    try:
        from app.utils.notify import notify
        notify(
            req.student_id,
            "Mentorship Session Completed",
            body=f"Your mentorship session with {mentor.name} has been marked as complete.",
            notif_type="mentorship",
            link="/mentorship",
        )
    except Exception:
        pass

    return jsonify({"message": "Session marked as complete."}), 200


# ─────────────────────────────────────────────────────────────────────────────
# Notes (alias — delegates to community.notes)
# ─────────────────────────────────────────────────────────────────────────────

@career_bp.route("/notes", methods=["GET"])
@require_auth
def get_notes_and_pyqs():
    """Proxy to community notes — returns approved notes for career tab."""
    from app.models.community import StudyNote
    user = get_current_user()
    notes = StudyNote.query.filter_by(college_id=user.college_id, approved=True).order_by(
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


@career_bp.route("/mentors/terminate/<uuid:request_id>", methods=["POST"])
@require_auth
def terminate_mentorship(request_id):
    from app.models.content import MentorProfile, MentorshipRequest, MentorshipRequestStatus
    from app.models.chat import Conversation, ConversationType, GroupMembership
    from app.models.academic import TimetableSlot
    
    user = get_current_user()
    req = MentorshipRequest.query.filter_by(id=request_id).first()
    if not req:
        return error_response("Mentorship not found.", 404)
        
    mentor = MentorProfile.query.filter_by(id=req.mentor_id).first()
    if not mentor:
        return error_response("Mentor profile not found.", 404)
        
    # Check authorization: student or professor/mentor
    if str(user.id) != str(req.student_id) and str(user.id) != str(mentor.user_id):
        return error_response("Unauthorized to terminate this mentorship.", 403)
        
    try:
        # Update mentorship status
        req.status = MentorshipRequestStatus.COMPLETED
        
        # 1. Revoke chat access (delete direct chat conversation memberships)
        conversation_ids = db.session.query(GroupMembership.conversation_id).join(Conversation).filter(
            Conversation.type == ConversationType.DIRECT,
            GroupMembership.user_id.in_([req.student_id, mentor.user_id])
        ).group_by(GroupMembership.conversation_id).having(db.func.count(GroupMembership.user_id) == 2).all()
        
        for row in conversation_ids:
            GroupMembership.query.filter_by(conversation_id=row[0]).delete()
            Conversation.query.filter_by(id=row[0]).delete()
            
        # 2. Revoke timetable slots
        TimetableSlot.query.filter(
            TimetableSlot.user_id.in_([req.student_id, mentor.user_id]),
            TimetableSlot.course_code == "MENT-001"
        ).delete(synchronize_session=False)
        
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "terminate_mentorship")
        
    audit_action("career.mentorship.terminated", target_type="mentorship_request", target_id=str(request_id))
    return jsonify({"message": "Mentorship terminated successfully. Timetable and chat access revoked."}), 200


@career_bp.route("/webhooks/daily", methods=["POST"])
def daily_webhook():
    # Public endpoint called by Daily.co when events happen
    import os, hmac, hashlib
    webhook_secret = os.environ.get("DAILY_WEBHOOK_SECRET")
    if webhook_secret:
        sig = request.headers.get("X-Daily-Signature")
        if not sig:
            return jsonify({"error": "Missing signature"}), 401
        computed = hmac.new(webhook_secret.encode("utf-8"), request.get_data(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(computed, sig):
            return jsonify({"error": "Invalid signature"}), 401

    data = request.get_json() or {}
    event_type = data.get("event")
    
    if event_type == "recording.ready":
        recording_info = data.get("payload", {})
        recording_url = recording_info.get("download_url")
        room_name = recording_info.get("room_name")
        
        if room_name and recording_url:
            from app.models.content import MockInterviewBooking
            booking = MockInterviewBooking.query.filter(
                MockInterviewBooking.room_url.like(f"%{room_name}%")
            ).first()
            if booking:
                try:
                    booking.room_url = recording_url
                    booking.status = "completed"
                    db.session.commit()
                    audit_action("career.mock_interview.recording_attached", 
                                 target_type="mock_interview_booking", target_id=str(booking.id))
                except Exception as exc:
                    db.session.rollback()
                    return jsonify({"error": str(exc)}), 500
                    
    return jsonify({"received": True}), 200
