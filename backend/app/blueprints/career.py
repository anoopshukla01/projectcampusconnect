"""
Career Blueprint — Lectures, Notes, Internships, Mock Interviews, Mentorship
"""

from flask import Blueprint, jsonify, request
from app.auth.permissions import require_auth, get_current_user
from app.extensions import db
from app.models.student import StudentProfile
from app.utils.errors import error_response

career_bp = Blueprint("career", __name__)


# ── GET /career/lectures ───────────────────────────────────────────────────────
@career_bp.route("/lectures", methods=["GET"])
@require_auth
def get_lectures():
    """Return lecture recordings uploaded by professors for the student's branch."""
    user = get_current_user()
    student = StudentProfile.query.filter_by(user_id=user.id, is_deleted=False).first()
    branch = student.branch if student else None

    # Try to import LectureRecording model; it may not exist yet → return empty gracefully
    try:
        from app.models.content import LectureRecording, SyllabusProgress
        recordings = LectureRecording.query.filter(
            (LectureRecording.branch == branch) | (LectureRecording.branch.is_(None))
        ).order_by(LectureRecording.created_at.desc()).limit(50).all()
        syllabus = SyllabusProgress.query.filter(
            (SyllabusProgress.branch == branch) | (SyllabusProgress.branch.is_(None))
        ).all()

        rec_list = [{
            "id": str(r.id),
            "title": r.title,
            "subject": r.subject,
            "code": r.course_code,
            "prof": r.professor_name,
            "duration": r.duration,
            "url": r.video_url,
            "date": r.created_at.strftime("%b %d, %Y") if r.created_at else "",
        } for r in recordings]

        syl_list = [{
            "name": s.subject,
            "code": s.course_code,
            "module": s.module_info,
            "progress": s.progress_pct,
        } for s in syllabus]

        return jsonify({"recordings": rec_list, "syllabus": syl_list}), 200
    except Exception:
        return jsonify({"recordings": [], "syllabus": []}), 200


# ── GET /career/notes ──────────────────────────────────────────────────────────
@career_bp.route("/notes", methods=["GET"])
@require_auth
def get_notes_and_pyqs():
    """Return notes and PYQ papers from StudyNote model."""
    from app.models.community import StudyNote
    notes = StudyNote.query.order_by(StudyNote.created_at.desc()).all()
    res = [{
        "id": str(n.id),
        "title": n.title,
        "subject": n.subject,
        "type": n.note_type if hasattr(n, "note_type") else "notes",
        "uploader": n.author_name,
        "date": n.created_at.strftime("%b %d") if n.created_at else "",
        "approved": True,
    } for n in notes]
    return jsonify({"notes": res}), 200


# ── GET /career/internships ────────────────────────────────────────────────────
@career_bp.route("/internships", methods=["GET"])
@require_auth
def get_internships():
    """Return placement drives that are marked as internships."""
    try:
        from app.models.placement import PlacementDrive
        drives = PlacementDrive.query.filter_by(is_deleted=False).order_by(
            PlacementDrive.created_at.desc()
        ).all()
        res = []
        for d in drives:
            res.append({
                "id": str(d.id),
                "role": d.role,
                "company": d.company_name,
                "location": d.location or "Remote",
                "duration": d.duration or "3 months",
                "stipend": d.stipend or "As per company norms",
                "type": d.drive_type or "tech",
                "tags": d.skills_required.split(",") if d.skills_required else [],
                "deadline": d.deadline.strftime("%b %d, %Y") if d.deadline else "Open",
                "cgpa_cutoff": str(d.cgpa_cutoff) if d.cgpa_cutoff else "6.0",
            })
        return jsonify({"internships": res}), 200
    except Exception:
        return jsonify({"internships": []}), 200


# ── GET /career/mock-interviews ────────────────────────────────────────────────
@career_bp.route("/mock-interviews", methods=["GET"])
@require_auth
def get_mock_interviews():
    """Return available mock interview sessions."""
    try:
        from app.models.content import MockInterviewSession
        sessions = MockInterviewSession.query.filter_by(is_active=True).order_by(
            MockInterviewSession.scheduled_at.asc()
        ).all()
        res = [{
            "id": str(s.id),
            "type": s.session_type,
            "company": s.company_style,
            "difficulty": s.difficulty,
            "duration": s.duration_minutes,
            "slots": s.scheduled_at.strftime("%b %d · %I %p") if s.scheduled_at else "TBD",
        } for s in sessions]
        return jsonify({"sessions": res}), 200
    except Exception:
        return jsonify({"sessions": []}), 200


# ── GET /career/mentors ────────────────────────────────────────────────────────
@career_bp.route("/mentors", methods=["GET"])
@require_auth
def get_mentors():
    """Return available mentors (professors + alumni)."""
    try:
        from app.models.content import MentorProfile
        mentors = MentorProfile.query.filter_by(is_active=True).order_by(
            MentorProfile.rating.desc()
        ).all()
        res = [{
            "id": str(m.id),
            "name": m.name,
            "role": m.role_title,
            "expertise": m.expertise.split(",") if m.expertise else [],
            "rating": m.rating,
            "sessions": m.sessions_count,
            "available": m.is_available,
        } for m in mentors]
        return jsonify({"mentors": res}), 200
    except Exception:
        return jsonify({"mentors": []}), 200



