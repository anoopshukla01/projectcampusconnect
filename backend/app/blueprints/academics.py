"""
Academics Blueprint — Grades, Attendance, Timetable, Assignments
"""

from flask import Blueprint, jsonify, request, g
from app.auth.permissions import require_auth, require_roles, get_current_user
from app.extensions import db
from app.models.student import StudentProfile
from app.models.academic import Grade, AttendanceRecord, TimetableSlot, Assignment, AssignmentSubmission
from app.utils.errors import error_response, internal_error_response

academics_bp = Blueprint("academics", __name__)

# ── GET /academics/grades ─────────────────────────────────────────────────────
@academics_bp.route("/grades", methods=["GET"])
@require_auth
def get_grades():
    user = get_current_user()
    student = StudentProfile.query.filter_by(user_id=user.id, is_deleted=False).first()
    if not student:
        return jsonify({"grades": [], "total_credits": 0, "total_points": 0, "cgpa": "--"}), 200

    grades = Grade.query.filter_by(student_id=student.id).all()
    res = []
    total_credits = 0
    total_points = 0
    for g in grades:
        res.append({
            "id": str(g.id),
            "name": g.course_name,
            "code": g.course_code,
            "internal": g.internal_marks,
            "mid": g.mid_sem_marks,
            "credits": g.credits,
            "grade": g.grade,
            "gp": g.grade_point
        })
        total_credits += g.credits
        total_points += (g.grade_point * g.credits)

    cgpa = f"{(total_points / total_credits):.2f}" if total_credits > 0 else "--"

    return jsonify({
        "grades": res,
        "total_credits": total_credits,
        "total_points": total_points,
        "cgpa": cgpa
    }), 200


# ── GET /academics/attendance ──────────────────────────────────────────────────
@academics_bp.route("/attendance", methods=["GET"])
@require_auth
def get_attendance():
    user = get_current_user()
    student = StudentProfile.query.filter_by(user_id=user.id, is_deleted=False).first()
    if not student:
        return jsonify({"subjects": []}), 200

    records = AttendanceRecord.query.filter_by(student_id=student.id).all()
    res = []
    for r in records:
        pct = round((r.attended_classes / r.total_classes) * 100) if r.total_classes > 0 else 0
        res.append({
            "id": str(r.id),
            "name": r.subject_name,
            "code": r.subject_code,
            "attended": r.attended_classes,
            "total": r.total_classes,
            "pct": pct
        })
    return jsonify({"subjects": res}), 200


# ── GET /academics/timetable ───────────────────────────────────────────────────
@academics_bp.route("/timetable", methods=["GET"])
@require_auth
def get_timetable():
    user = get_current_user()
    student = StudentProfile.query.filter_by(user_id=user.id, is_deleted=False).first()

    branch = student.branch if student else None
    role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)

    # Query matching slots
    slots = TimetableSlot.query.filter(
        (TimetableSlot.user_id == user.id) |
        (TimetableSlot.branch == branch) |
        (TimetableSlot.role == role_str)
    ).all()

    res = {"Mon": [], "Tue": [], "Wed": [], "Thu": [], "Fri": []}
    for s in slots:
        day = s.day_of_week
        if day in res:
            res[day].append({
                "id": str(s.id),
                "time": s.time_slot,
                "name": s.course_name,
                "code": s.course_code,
                "room": s.room,
                "prof": s.professor_name,
                "type": s.slot_type
            })

    return jsonify({"timetable": res}), 200


# ── GET /academics/assignments ─────────────────────────────────────────────────
@academics_bp.route("/assignments", methods=["GET"])
@require_auth
def get_assignments():
    user = get_current_user()
    student = StudentProfile.query.filter_by(user_id=user.id, is_deleted=False).first()
    branch = student.branch if student else None

    # Query assignments
    assignments = Assignment.query.filter(
        (Assignment.branch == branch) | (Assignment.branch.is_(None))
    ).all()

    # Get student submissions map
    submissions_map = {}
    if student:
        subs = AssignmentSubmission.query.filter_by(student_id=student.id).all()
        for sub in subs:
            submissions_map[str(sub.assignment_id)] = sub

    res = []
    for a in assignments:
        sub = submissions_map.get(str(a.id))
        res.append({
            "id": str(a.id),
            "name": a.title,
            "subject": a.subject,
            "due": a.due_date,
            "points": a.points,
            "status": sub.status if sub else "pending",
            "desc": a.description,
            "attachment": a.attachment_url,
            "grade": sub.grade if sub else None,
            "feedback": sub.feedback if sub else None
        })

    return jsonify({"assignments": res}), 200


# ── POST /academics/timetable/slots ──────────────────────────────────────────
@academics_bp.route("/timetable/slots", methods=["POST"])
@require_auth
@require_roles("professor", "admin")
def create_or_update_timetable_slot():
    """
    Create or edit a timetable slot. Only professors (for their classes) or admins.
    """
    user = get_current_user()
    data = request.get_json() or {}

    day = data.get("day_of_week") or data.get("day")
    time_slot = data.get("time_slot") or data.get("time")
    course_name = data.get("course_name") or data.get("name")
    course_code = data.get("course_code") or data.get("code")
    room = data.get("room")
    slot_id = data.get("id")

    if not day or not time_slot or not course_name:
        return error_response("Day, time_slot, and course_name are required.", 400)

    try:
        if slot_id:
            slot = db.session.get(TimetableSlot, slot_id)
            if not slot:
                return error_response("Timetable slot not found.", 404)
            # Ownership check: if professor, must own slot or be admin
            if user.role.value == "professor" and slot.user_id and str(slot.user_id) != str(user.id):
                return error_response("You can only edit your own timetable slots.", 403)
        else:
            slot = TimetableSlot(user_id=user.id)
            db.session.add(slot)

        slot.day_of_week = day
        slot.time_slot = time_slot
        slot.course_name = course_name
        slot.course_code = course_code or "CS101"
        slot.room = room or "LH-101"
        slot.professor_name = data.get("professor_name") or user.email.split("@")[0].capitalize()
        slot.branch = data.get("branch")
        slot.slot_type = data.get("slot_type", "lecture")

        db.session.commit()
        return jsonify({"message": "Timetable slot saved successfully.", "id": str(slot.id)}), 200
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "timetable_slot_save")


# ── POST /academics/timetable/extra-class ─────────────────────────────────────
@academics_bp.route("/timetable/extra-class", methods=["POST"])
@require_auth
@require_roles("professor", "admin")
def add_extra_class():
    """
    Add an extra/makeup class to the timetable.
    """
    user = get_current_user()
    data = request.get_json() or {}

    day = data.get("day") or "Sat"
    time_slot = data.get("time") or "10:00 - 11:30"
    course_name = data.get("name") or data.get("course_name")
    course_code = data.get("code") or "CS-EXTRA"
    room = data.get("room") or "LH-201"

    if not course_name:
        return error_response("Course name is required for extra class.", 400)

    try:
        slot = TimetableSlot(
            user_id=user.id,
            day_of_week=day,
            time_slot=time_slot,
            course_name=course_name,
            course_code=course_code,
            room=room,
            professor_name=data.get("prof") or user.email.split("@")[0].capitalize(),
            branch=data.get("branch"),
            slot_type="extra"
        )
        db.session.add(slot)
        db.session.commit()
        return jsonify({"message": "Extra class scheduled successfully.", "id": str(slot.id)}), 201
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "add_extra_class")
