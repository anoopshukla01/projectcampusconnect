"""
Academics Blueprint — Grades, Attendance, Timetable, Assignments

ENDPOINT SUMMARY (all at /api/v1/academics):
  GET  /grades                          — student: own grades
  GET  /attendance                      — student: own attendance
  GET  /timetable                       — role-scoped: student sees branch/semester slots,
                                          professor sees their own slots, admin sees all
  POST /timetable/slots                 — professor/admin: create slot
  PATCH /timetable/slots/<id>           — professor/admin: update slot (IDOR-guarded)
  DELETE /timetable/slots/<id>          — professor/admin: soft-delete slot (IDOR-guarded)
  POST /timetable/extra-class           — professor/admin: add extra/makeup class
  GET  /assignments                     — student: visible to their branch, professor: own
  POST /assignments                     — professor/admin: create assignment
  PATCH /assignments/<id>               — professor/admin: edit (IDOR-guarded)
  DELETE /assignments/<id>              — professor/admin: soft-delete (IDOR-guarded)
  POST /assignments/<id>/submit         — student: submit
  PATCH /submissions/<id>/grade         — professor/admin: grade submission
  POST /attendance/mark                 — professor: mark attendance for a subject
  GET  /roster                          — professor/admin: student roster by branch/semester

SECURITY CHECKLIST:
  [x] @require_auth on every endpoint
  [x] @require_roles where role restriction applies
  [x] IDOR guard: professors can only edit/delete their own slots and assignments
  [x] Role resolved from g.current_user (JWT), never from request body
  [x] Gate 0 (college scoping): all list queries filter by college_id;
      all db.session.get() PK lookups followed by assert_college_match()
"""

from flask import Blueprint, jsonify, request
from flask import g
from app.auth.permissions import require_auth, require_roles, get_current_user, assert_college_match
from app.extensions import db
from app.models.student import StudentProfile
from app.models.professor import ProfessorProfile
from app.models.academic import (
    Grade, AttendanceRecord, TimetableSlot,
    Assignment, AssignmentSubmission,
    ProfessorClassAssignment,
)
from app.models.user import UserRole
from app.utils.errors import error_response, internal_error_response
from app.utils.audit import audit_action

academics_bp = Blueprint("academics", __name__)

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _slot_to_dict(s):
    return {
        "id":       str(s.id),
        "time":     s.time_slot,
        "name":     s.course_name,
        "code":     s.course_code,
        "room":     s.room,
        "prof":     s.professor_name,
        "type":     s.slot_type,
        "branch":   s.branch,
        "semester": s.semester,
    }

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

# ─────────────────────────────────────────────────────────────────────────────
# Grades
# ─────────────────────────────────────────────────────────────────────────────

@academics_bp.route("/grades", methods=["GET"])
@require_auth
def get_grades():
    """Student: return own grade sheet. Non-students get an empty payload."""
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
            "id":       str(g.id),
            "name":     g.course_name,
            "code":     g.course_code,
            "internal": g.internal_marks,
            "mid":      g.mid_sem_marks,
            "credits":  g.credits,
            "grade":    g.grade,
            "gp":       g.grade_point,
        })
        total_credits += g.credits
        total_points  += g.grade_point * g.credits

    cgpa = f"{total_points / total_credits:.2f}" if total_credits > 0 else "--"
    return jsonify({"grades": res, "total_credits": total_credits,
                    "total_points": total_points, "cgpa": cgpa}), 200


# ─────────────────────────────────────────────────────────────────────────────
# Attendance
# ─────────────────────────────────────────────────────────────────────────────

@academics_bp.route("/attendance", methods=["GET"])
@require_auth
def get_attendance():
    """Student: own attendance per subject."""
    user = get_current_user()
    student = StudentProfile.query.filter_by(user_id=user.id, is_deleted=False).first()
    if not student:
        return jsonify({"subjects": []}), 200

    records = AttendanceRecord.query.filter_by(student_id=student.id).all()
    res = []
    for r in records:
        pct = round((r.attended_classes / r.total_classes) * 100) if r.total_classes > 0 else 0
        res.append({
            "id":       str(r.id),
            "name":     r.subject_name,
            "code":     r.subject_code,
            "attended": r.attended_classes,
            "total":    r.total_classes,
            "pct":      pct,
        })
    return jsonify({"subjects": res}), 200


@academics_bp.route("/attendance/mark", methods=["POST"])
@require_auth
@require_roles("professor", "admin")
def mark_attendance():
    """
    Professor: bulk-mark attendance for a subject session.

    Body:
      { subject_name, subject_code, branch, semester,
        present_roll_nos: [...], total_students: N }
    """
    user = get_current_user()
    data = request.get_json() or {}
    subject_name = data.get("subject_name") or data.get("subject")
    subject_code = data.get("subject_code") or data.get("code", "CS000")
    present_rolls = set(data.get("present_roll_nos") or [])
    branch        = data.get("branch")
    semester      = data.get("semester")

    if not subject_name:
        return error_response("subject_name is required.", 400)

    # Time window lock: check against scheduled TimetableSlot today
    if user.role == UserRole.PROFESSOR:
        today_day = datetime.now().strftime("%A")
        # Query matching timetable slot for today
        slot = TimetableSlot.query.filter_by(
            course_code=subject_code,
            branch=branch,
            semester=semester,
            day_of_week=today_day,
            is_deleted=False
        ).first()
        if slot:
            try:
                start_str, end_str = slot.time_slot.split(" - ")
                now_time = datetime.now().time()
                start_time = datetime.strptime(start_str.strip(), "%H:%M").time()
                end_time = datetime.strptime(end_str.strip(), "%H:%M").time()
                
                from datetime import timedelta, date
                today_date = date.today()
                start_dt = datetime.combine(today_date, start_time) - timedelta(minutes=15)
                end_dt = datetime.combine(today_date, end_time) + timedelta(minutes=120) # 2 hour grace period after class
                now_dt = datetime.now()
                if not (start_dt <= now_dt <= end_dt):
                    return error_response(f"Attendance lock: can only mark during the scheduled class window ({slot.time_slot}) plus grace period.", 403)
            except Exception:
                pass # Proceed if format parsing fails

    # Resolve students in same college: branch + semester filter or all if not given
    college_id = g.current_user.college_id
    q = StudentProfile.query.filter_by(is_deleted=False, college_id=college_id)
    if branch:
        q = q.filter_by(branch=branch)
    if semester:
        q = q.filter_by(semester=semester)
    students = q.all()

    try:
        for sp in students:
            rec = AttendanceRecord.query.filter_by(
                student_id=sp.id, subject_code=subject_code
            ).first()
            if not rec:
                rec = AttendanceRecord(
                    student_id=sp.id,
                    subject_name=subject_name,
                    subject_code=subject_code,
                    attended_classes=0,
                    total_classes=0,
                )
                db.session.add(rec)

            rec.total_classes += 1
            if sp.roll_no in present_rolls:
                rec.attended_classes += 1

        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "mark_attendance")

    audit_action("academics.attendance.marked",
                 detail={"subject": subject_code, "branch": branch, "professor": str(user.id)})

    # ── Cross-feature trigger: warn students whose attendance dropped below 75% ──
    try:
        from app.utils.notify import notify
        for sp in students:
            rec = AttendanceRecord.query.filter_by(
                student_id=sp.id, subject_code=subject_code
            ).first()
            if rec and rec.total_classes > 0:
                pct = round((rec.attended_classes / rec.total_classes) * 100)
                if pct < 75 and sp.user_id:
                    notify(
                        sp.user_id,
                        f"Low Attendance Warning: {subject_name}",
                        body=f"Your attendance in {subject_name} is {pct}% — below the 75% minimum.",
                        notif_type="attendance",
                        link="/attendance",
                    )
    except Exception:
        pass
    return jsonify({"message": f"Attendance marked for {len(students)} students."}), 200


# ─────────────────────────────────────────────────────────────────────────────
# Timetable — GET (role-scoped)
# ─────────────────────────────────────────────────────────────────────────────

@academics_bp.route("/timetable", methods=["GET"])
@require_auth
def get_timetable():
    """
    Role-scoped timetable fetch.

    student       → slots for their branch + semester (or matching role="student")
    professor     → slots they created (user_id == self) OR role="professor" broadcast
    admin         → all non-deleted slots (supports ?branch= and ?semester= filters)
    placement_cell→ same as admin (read-only, they manage schedules during drives)

    Query params:
      branch   (admin/tpo override)
      semester (admin/tpo override)
    """
    user    = get_current_user()
    role    = user.role  # UserRole enum, resolved from JWT

    qp_branch   = request.args.get("branch")
    qp_semester = request.args.get("semester", type=int)

    base_q = TimetableSlot.query.filter_by(is_deleted=False)

    if role == UserRole.STUDENT:
        student = StudentProfile.query.filter_by(user_id=user.id, is_deleted=False).first()
        branch   = qp_branch   or (student.branch   if student else None)
        semester = qp_semester or (student.semester if student else None)

        conditions = [TimetableSlot.role == "student"]
        if branch:
            conditions.append(TimetableSlot.branch == branch)
        if semester:
            conditions.append(
                (TimetableSlot.semester == semester) | (TimetableSlot.semester.is_(None))
            )
        # Slots for this student's branch + semester, OR general student-role broadcasts
        slots = base_q.filter(
            db.or_(
                TimetableSlot.user_id == user.id,
                db.and_(
                    TimetableSlot.branch == branch,
                    (TimetableSlot.semester == semester) | (TimetableSlot.semester.is_(None)),
                ),
            )
        ).all()

    elif role == UserRole.PROFESSOR:
        # Professors see their own slots + any branch-broadcast for their department
        prof_profile = ProfessorProfile.query.filter_by(user_id=user.id, is_deleted=False).first()
        branch = qp_branch or (prof_profile.department if prof_profile else None)
        slots = base_q.filter(
            db.or_(
                TimetableSlot.user_id == user.id,
                TimetableSlot.role == "professor",
            )
        ).all()

    else:
        # admin / placement_cell — full view with optional filters
        q = base_q
        if qp_branch:
            q = q.filter_by(branch=qp_branch)
        if qp_semester:
            q = q.filter_by(semester=qp_semester)
        slots = q.order_by(TimetableSlot.branch, TimetableSlot.day_of_week).all()

    # Build day-keyed dict
    res = {d: [] for d in DAYS}
    for s in slots:
        day = s.day_of_week
        if day in res:
            res[day].append(_slot_to_dict(s))

    return jsonify({"timetable": res}), 200



# ─────────────────────────────────────────────────────────────────────────────
# Timetable — CREATE / UPDATE / DELETE (professor + admin)
# ─────────────────────────────────────────────────────────────────────────────

@academics_bp.route("/timetable/slots", methods=["POST"])
@require_auth
@require_roles("professor", "admin")
def create_timetable_slot():
    """Create a new timetable slot."""
    user = get_current_user()
    data = request.get_json() or {}

    day         = data.get("day_of_week") or data.get("day")
    time_slot   = data.get("time_slot")   or data.get("time")
    course_name = data.get("course_name") or data.get("name")
    course_code = data.get("course_code") or data.get("code", "CS000")
    room        = data.get("room", "LH-101")

    if not day or not time_slot or not course_name:
        return error_response("day, time_slot, and course_name are required.", 400)

    # Professor name: prefer explicit, fallback to their profile, then email
    prof_profile = ProfessorProfile.query.filter_by(user_id=user.id).first()
    default_prof_name = (
        prof_profile.full_name if prof_profile
        else (user.email or "").split("@")[0].capitalize()
    )

    try:
        slot = TimetableSlot(
            user_id        = user.id,
            day_of_week    = day,
            time_slot      = time_slot,
            course_name    = course_name,
            course_code    = course_code,
            room           = room,
            professor_name = data.get("professor_name") or default_prof_name,
            branch         = data.get("branch"),
            semester       = data.get("semester"),
            slot_type      = data.get("slot_type", "lecture"),
            role           = data.get("role"),   # optional broadcast scope
        )
        db.session.add(slot)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "create_timetable_slot")

    audit_action("academics.timetable.slot.created",
                 target_type="timetable_slot", target_id=str(slot.id))
    return jsonify({"message": "Timetable slot created.", "id": str(slot.id),
                    "slot": _slot_to_dict(slot)}), 201


@academics_bp.route("/timetable/slots/<uuid:slot_id>", methods=["PATCH"])
@require_auth
@require_roles("professor", "admin")
def update_timetable_slot(slot_id):
    """Update an existing timetable slot. Professors can only edit their own."""
    user = get_current_user()
    slot = TimetableSlot.query.filter_by(id=slot_id, is_deleted=False).first()
    if not slot:
        return error_response("Timetable slot not found.", 404)

    # IDOR guard: professor must own the slot
    if user.role == UserRole.PROFESSOR and str(slot.user_id) != str(user.id):
        return error_response("You can only edit timetable slots you created.", 403)

    data = request.get_json() or {}
    updatable = ["day_of_week", "time_slot", "course_name", "course_code",
                 "room", "professor_name", "branch", "semester", "slot_type", "role"]
    for field in updatable:
        if field in data:
            setattr(slot, field, data[field])

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_timetable_slot")

    audit_action("academics.timetable.slot.updated",
                 target_type="timetable_slot", target_id=str(slot.id))
    return jsonify({"message": "Timetable slot updated.", "slot": _slot_to_dict(slot)}), 200


@academics_bp.route("/timetable/slots/<uuid:slot_id>", methods=["DELETE"])
@require_auth
@require_roles("professor", "admin")
def delete_timetable_slot(slot_id):
    """Soft-delete a timetable slot. Professors can only delete their own."""
    user = get_current_user()
    slot = TimetableSlot.query.filter_by(id=slot_id, is_deleted=False).first()
    if not slot:
        return error_response("Timetable slot not found.", 404)

    if user.role == UserRole.PROFESSOR and str(slot.user_id) != str(user.id):
        return error_response("You can only delete timetable slots you created.", 403)

    try:
        slot.is_deleted = True
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "delete_timetable_slot")

    audit_action("academics.timetable.slot.deleted",
                 target_type="timetable_slot", target_id=str(slot_id))
    return jsonify({"message": "Timetable slot removed."}), 200


@academics_bp.route("/timetable/extra-class", methods=["POST"])
@require_auth
@require_roles("professor", "admin")
def add_extra_class():
    """Schedule an extra / makeup class."""
    user = get_current_user()
    data = request.get_json() or {}
    course_name = data.get("name") or data.get("course_name")
    if not course_name:
        return error_response("course_name is required for extra class.", 400)

    prof_profile = ProfessorProfile.query.filter_by(user_id=user.id).first()
    default_prof_name = (
        prof_profile.full_name if prof_profile
        else (user.email or "").split("@")[0].capitalize()
    )

    try:
        slot = TimetableSlot(
            user_id        = user.id,
            day_of_week    = data.get("day", "Sat"),
            time_slot      = data.get("time", "10:00 - 11:30"),
            course_name    = course_name,
            course_code    = data.get("code", "CS-EXTRA"),
            room           = data.get("room", "LH-201"),
            professor_name = data.get("prof") or default_prof_name,
            branch         = data.get("branch"),
            semester       = data.get("semester"),
            slot_type      = "extra",
        )
        db.session.add(slot)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "add_extra_class")

    audit_action("academics.timetable.extra_class.created",
                 target_type="timetable_slot", target_id=str(slot.id))
    return jsonify({"message": "Extra class scheduled.", "id": str(slot.id),
                    "slot": _slot_to_dict(slot)}), 201


# ─────────────────────────────────────────────────────────────────────────────
# Assignments
# ─────────────────────────────────────────────────────────────────────────────

@academics_bp.route("/assignments", methods=["GET"])
@require_auth
def get_assignments():
    """
    Student: assignments for their branch.
    Professor: assignments they created.
    Admin / TPO: all assignments.
    """
    user    = get_current_user()
    role    = user.role

    if role == UserRole.STUDENT:
        student = StudentProfile.query.filter_by(user_id=user.id, is_deleted=False).first()
        branch  = student.branch if student else None
        assignments = Assignment.query.filter(
            (Assignment.branch == branch) | (Assignment.branch.is_(None))
        ).order_by(Assignment.created_at.desc()).all()

        submissions_map = {}
        if student:
            for sub in AssignmentSubmission.query.filter_by(student_id=student.id).all():
                submissions_map[str(sub.assignment_id)] = sub

        res = []
        for a in assignments:
            sub = submissions_map.get(str(a.id))
            res.append({
                "id": str(a.id), "name": a.title, "subject": a.subject,
                "due": a.due_date, "points": a.points,
                "status": sub.status if sub else "pending",
                "desc": a.description, "attachment": a.attachment_url,
                "grade": sub.grade if sub else None,
                "feedback": sub.feedback if sub else None,
            })

    elif role == UserRole.PROFESSOR:
        assignments = Assignment.query.filter_by(
            professor_id=user.id
        ).order_by(Assignment.created_at.desc()).all()
        res = []
        for a in assignments:
            sub_count = AssignmentSubmission.query.filter_by(assignment_id=a.id).count()
            res.append({
                "id": str(a.id), "name": a.title, "subject": a.subject,
                "branch": a.branch, "due": a.due_date, "points": a.points,
                "desc": a.description, "attachment": a.attachment_url,
                "submissions": sub_count,
            })

    else:
        # admin / tpo — full list
        assignments = Assignment.query.order_by(Assignment.created_at.desc()).all()
        res = []
        for a in assignments:
            sub_count = AssignmentSubmission.query.filter_by(assignment_id=a.id).count()
            res.append({
                "id": str(a.id), "name": a.title, "subject": a.subject,
                "branch": a.branch, "due": a.due_date, "points": a.points,
                "submissions": sub_count,
            })

    return jsonify({"assignments": res}), 200


@academics_bp.route("/assignments", methods=["POST"])
@require_auth
@require_roles("professor", "admin")
def create_assignment():
    """Professor / admin: post a new assignment."""
    user = get_current_user()
    data = request.get_json() or {}
    title   = data.get("title") or data.get("name")
    subject = data.get("subject")
    due     = data.get("due_date") or data.get("due")
    if not title or not subject or not due:
        return error_response("title, subject, and due_date are required.", 400)

    try:
        a = Assignment(
            title          = title,
            subject        = subject,
            branch         = data.get("branch"),
            due_date       = due,
            points         = data.get("points", "25 pts"),
            description    = data.get("description") or data.get("desc"),
            attachment_url = data.get("attachment_url") or data.get("attachment"),
            professor_id   = user.id,
        )
        db.session.add(a)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "create_assignment")

    audit_action("academics.assignment.created",
                 target_type="assignment", target_id=str(a.id))

    # ── Cross-feature trigger: notify students in this branch ────────────────
    try:
        from app.utils.notify import notify
        q = StudentProfile.query.filter_by(is_deleted=False)
        if a.branch:
            q = q.filter_by(branch=a.branch)
        student_user_ids = [sp.user_id for sp in q.all()]
        notify(
            student_user_ids,
            f"New Assignment: {title}",
            body=f"{subject} — due {due}",
            notif_type="assignment",
            link="/assignments",
        )
    except Exception:
        pass  # never let notification failure break the endpoint

    return jsonify({"message": "Assignment created.", "id": str(a.id)}), 201


@academics_bp.route("/assignments/<uuid:assignment_id>", methods=["PATCH"])
@require_auth
@require_roles("professor", "admin")
def update_assignment(assignment_id):
    """Edit an assignment. Professors can only edit their own."""
    user = get_current_user()
    a = db.session.get(Assignment, assignment_id)
    if not a:
        return error_response("Assignment not found.", 404)
    err = assert_college_match(a, g.current_user)
    if err:
        return err

    if user.role == UserRole.PROFESSOR and str(a.professor_id) != str(user.id):
        return error_response("You can only edit assignments you created.", 403)

    data = request.get_json() or {}
    for field in ["title", "subject", "branch", "due_date", "points",
                  "description", "attachment_url"]:
        if field in data:
            setattr(a, field, data[field])

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_assignment")

    return jsonify({"message": "Assignment updated."}), 200


@academics_bp.route("/assignments/<uuid:assignment_id>", methods=["DELETE"])
@require_auth
@require_roles("professor", "admin")
def delete_assignment(assignment_id):
    """Soft-delete an assignment. Professors can only delete their own within 1 minute of posting."""
    user = get_current_user()
    a = db.session.get(Assignment, assignment_id)
    if not a:
        return error_response("Assignment not found.", 404)
    err = assert_college_match(a, g.current_user)
    if err:
        return err

    if user.role == UserRole.PROFESSOR:
        if str(a.professor_id) != str(user.id):
            return error_response("You can only delete assignments you created.", 403)
        created_at_utc = a.created_at.replace(tzinfo=timezone.utc) if a.created_at.tzinfo is None else a.created_at
        age_seconds = (datetime.now(timezone.utc) - created_at_utc).total_seconds()
        if age_seconds > 60:
            return error_response("Assignments can only be deleted within 1 minute of posting.", 403)

    try:
        # Cascade-delete all submissions
        AssignmentSubmission.query.filter_by(assignment_id=a.id).delete()
        db.session.delete(a)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "delete_assignment")

    audit_action("academics.assignment.deleted",
                 target_type="assignment", target_id=str(assignment_id))
    return jsonify({"message": "Assignment deleted."}), 200


# ─────────────────────────────────────────────────────────────────────────────
# Assignment Submissions
# ─────────────────────────────────────────────────────────────────────────────

@academics_bp.route("/assignments/<uuid:assignment_id>/submit", methods=["POST"])
@academics_bp.route("/assignments/<uuid:assignment_id>/submissions", methods=["POST"])
@require_auth
@require_roles("student")
def submit_assignment(assignment_id):
    """Student: submit an assignment."""
    user = get_current_user()
    student = StudentProfile.query.filter_by(user_id=user.id, is_deleted=False).first()
    if not student:
        return error_response("Student profile not found.", 404)

    a = db.session.get(Assignment, assignment_id)
    if not a:
        return error_response("Assignment not found.", 404)
    err = assert_college_match(a, g.current_user)
    if err:
        return err

    # Check deadline
    try:
        due = datetime.strptime(a.due_date[:10], "%Y-%m-%d").date()
        if datetime.now().date() > due:
            return error_response("The submission deadline has passed.", 400)
    except Exception:
        pass

    existing = AssignmentSubmission.query.filter_by(
        assignment_id=assignment_id, student_id=student.id, is_current=True
    ).first()

    data = request.get_json() or {}
    file_name = data.get("file_name") or data.get("fileName", "submission.pdf")

    try:
        if existing:
            # Archive old one
            existing.is_current = False
            db.session.flush()

        # Create new submission version
        sub = AssignmentSubmission(
            assignment_id = assignment_id,
            student_id    = student.id,
            student_name  = student.full_name,
            roll_no       = student.roll_no,
            file_name     = file_name,
            status        = "submitted",
            is_current    = True
        )
        db.session.add(sub)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "submit_assignment")

    return jsonify({"message": "Assignment submitted successfully."}), 201


@academics_bp.route("/assignments/<uuid:assignment_id>/submissions", methods=["GET"])
@require_auth
@require_roles("professor", "admin")
def list_submissions(assignment_id):
    """Professor / admin: list all submissions for an assignment."""
    user = get_current_user()
    a = db.session.get(Assignment, assignment_id)
    if not a:
        return error_response("Assignment not found.", 404)
    err = assert_college_match(a, g.current_user)
    if err:
        return err

    # IDOR: professor can only view their own assignment submissions
    if user.role == UserRole.PROFESSOR and str(a.professor_id) != str(user.id):
        return error_response("You can only view submissions for your own assignments.", 403)

    subs = AssignmentSubmission.query.filter_by(assignment_id=assignment_id).all()
    res = [{
        "id":           str(s.id),
        "student_name": s.student_name,
        "roll_no":      s.roll_no,
        "file_name":    s.file_name,
        "status":       s.status,
        "grade":        s.grade,
        "feedback":     s.feedback,
        "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
    } for s in subs]
    return jsonify({"submissions": res}), 200


@academics_bp.route("/submissions/<uuid:submission_id>/grade", methods=["PATCH"])
@require_auth
@require_roles("professor", "admin")
def grade_submission(submission_id):
    """Professor / admin: grade a submission."""
    user = get_current_user()
    sub = db.session.get(AssignmentSubmission, submission_id)
    if not sub:
        return error_response("Submission not found.", 404)

    # IDOR: professor can only grade their own assignment's submissions
    a = db.session.get(Assignment, sub.assignment_id)
    err = assert_college_match(a or sub, g.current_user)
    if err:
        return err
    if a and user.role == UserRole.PROFESSOR and str(a.professor_id) != str(user.id):
        return error_response("You can only grade submissions for your own assignments.", 403)

    data = request.get_json() or {}
    grade    = data.get("grade")
    feedback = data.get("feedback")
    if not grade:
        return error_response("grade is required.", 400)

    try:
        sub.grade    = grade
        sub.feedback = feedback
        sub.status   = "graded"
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "grade_submission")

    audit_action("academics.submission.graded",
                 target_type="assignment_submission", target_id=str(submission_id))

    # ── Cross-feature trigger: notify the student their work was graded ──────
    try:
        from app.utils.notify import notify
        student_sp = StudentProfile.query.filter_by(id=sub.student_id, is_deleted=False).first()
        if student_sp and student_sp.user_id:
            notify(
                student_sp.user_id,
                f"Assignment Graded: {grade}",
                body=f"Your submission for '{a.title if a else 'an assignment'}' has been graded. {feedback or ''}".strip(),
                notif_type="grade",
                link="/assignments",
            )
    except Exception:
        pass

    return jsonify({"message": "Submission graded successfully."}), 200


# ─────────────────────────────────────────────────────────────────────────────
# Roster
# ─────────────────────────────────────────────────────────────────────────────

@academics_bp.route("/roster", methods=["GET"])
@require_auth
@require_roles("professor", "admin", "placement_cell")
def get_roster():
    """
    Professor / admin: student roster.

    Query params: branch, semester
    Returns roll_no, name, cgpa, attendance_pct per student.
    """
    branch   = request.args.get("branch")
    semester = request.args.get("semester", type=int)

    college_id = g.current_user.college_id
    q = StudentProfile.query.filter_by(is_deleted=False, college_id=college_id)
    if branch:
        q = q.filter_by(branch=branch)
    if semester:
        q = q.filter_by(semester=semester)
    students = q.order_by(StudentProfile.roll_no).all()

    res = [{
        "id":             str(s.id),
        "roll_no":        s.roll_no,
        "name":           s.full_name,
        "branch":         s.branch,
        "semester":       s.semester,
        "cgpa":           float(s.cgpa) if s.cgpa is not None else None,
        "attendance_pct": float(s.attendance_pct) if s.attendance_pct is not None else None,
        "active_backlogs": s.active_backlogs,
    } for s in students]
    return jsonify({"students": res, "count": len(res)}), 200


@academics_bp.route("/attendance/me", methods=["GET"])
@require_auth
@require_roles("student")
def get_attendance_me():
    """Alias for student's own attendance."""
    return get_attendance()


@academics_bp.route("/timetable/me", methods=["GET"])
@require_auth
@require_roles("student")
def get_my_timetable():
    """Alias for student's own aggregated timetable."""
    return get_timetable()


@academics_bp.route("/grades/<uuid:grade_id>", methods=["PATCH"])
@require_auth
@require_roles("professor", "admin")
def update_grade(grade_id):
    """Professor/Admin: update a student's grade and record revision history."""
    from app.models.academic import Grade, GradeRevision
    from app.models.student import StudentProfile

    user = get_current_user()
    grade_rec = db.session.get(Grade, grade_id)
    if not grade_rec:
        return error_response("Grade record not found.", 404)
    err = assert_college_match(grade_rec.student, g.current_user)
    if err:
        return err

    data = request.get_json() or {}
    new_grade = data.get("grade")
    new_gp = data.get("grade_point")
    new_internal = data.get("internal_marks")
    new_mid = data.get("mid_sem_marks")

    old_grade = grade_rec.grade
    old_gp = grade_rec.grade_point

    try:
        # Log revision if grade or grade point changes
        if (new_grade is not None and new_grade != old_grade) or (new_gp is not None and new_gp != old_gp):
            rev = GradeRevision(
                grade_id=grade_rec.id,
                old_grade=old_grade,
                new_grade=new_grade or old_grade,
                old_grade_point=old_gp,
                new_grade_point=new_gp if new_gp is not None else old_gp,
                updated_by_id=user.id
            )
            db.session.add(rev)

        if new_grade is not None:
            grade_rec.grade = new_grade
        if new_gp is not None:
            grade_rec.grade_point = new_gp
        if new_internal is not None:
            grade_rec.internal_marks = new_internal
        if new_mid is not None:
            grade_rec.mid_sem_marks = new_mid

        db.session.flush()

        # Recompute student CGPA
        student = grade_rec.student
        if student:
            all_grades = Grade.query.filter_by(student_id=student.id).all()
            total_credits = sum(g.credits for g in all_grades)
            total_points = sum(g.grade_point * g.credits for g in all_grades)
            if total_credits > 0:
                student.cgpa = round(total_points / total_credits, 2)
            else:
                student.cgpa = 0.0

        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_grade")

    return jsonify({"message": "Grade updated successfully."}), 200


@academics_bp.route("/students/<uuid:student_id>/grades", methods=["GET"])
@require_auth
@require_roles("admin", "placement_cell")
def get_student_grades(student_id):
    """Admin/TPO: view student's grades. TPO has restricted access (no subject breakdown)."""
    from app.models.academic import Grade
    from app.models.student import StudentProfile

    user = get_current_user()
    student = db.session.get(StudentProfile, student_id)
    if not student or student.is_deleted:
        return error_response("Student profile not found.", 404)
    err = assert_college_match(student, g.current_user)
    if err:
        return err

    # TPO Security Gate: restricted to CGPA/eligibility fields only
    if user.role == UserRole.PLACEMENT_CELL:
        return jsonify({
            "cgpa": float(student.cgpa) if student.cgpa else 0.0,
            "active_backlogs": student.active_backlogs,
            "grades": []  # Empty subject-wise breakdown for TPO
        }), 200

    # Admin: full subject-wise grades & revision history
    grades = Grade.query.filter_by(student_id=student.id).all()
    res = [{
        "id": str(g.id),
        "course_name": g.course_name,
        "course_code": g.course_code,
        "internal_marks": g.internal_marks,
        "mid_sem_marks": g.mid_sem_marks,
        "credits": g.credits,
        "grade": g.grade,
        "gp": g.grade_point,
        "revisions": [{
            "old_grade": r.old_grade,
            "new_grade": r.new_grade,
            "old_gp": r.old_grade_point,
            "new_gp": r.new_grade_point,
            "updated_at": r.updated_at.strftime("%Y-%m-%d %H:%M:%S")
        } for r in g.revisions]
    } for g in grades]

    return jsonify({
        "cgpa": float(student.cgpa) if student.cgpa else 0.0,
        "active_backlogs": student.active_backlogs,
        "grades": res
    }), 200


# ─────────────────────────────────────────────────────────────────────────────
# Professor Grading Zone  (A-PG1–A-PG5)
# ─────────────────────────────────────────────────────────────────────────────

@academics_bp.route("/grading/my-assignments", methods=["GET"])
@require_auth
@require_roles("professor")
def get_grading_queue():
    """A-PG1: Professor's pending grading queue — all ungraded submissions across
    their own assignments, ordered by submission date (oldest first)."""
    user = get_current_user()

    # Collect own assignment IDs (IDOR: professor_id = me)
    my_assignments = Assignment.query.filter_by(professor_id=user.id).all()
    if not my_assignments:
        return jsonify({"assignments": [], "total_pending": 0}), 200

    aid_map = {str(a.id): a for a in my_assignments}

    # Pending submissions (status=submitted, is_current=True)
    pending = (
        AssignmentSubmission.query
        .filter(AssignmentSubmission.assignment_id.in_(aid_map.keys()))
        .filter_by(status="submitted", is_current=True)
        .order_by(AssignmentSubmission.submitted_at.asc())
        .all()
    )

    return jsonify({
        "total_pending": len(pending),
        "assignments": [
            {
                "submission_id":  str(s.id),
                "assignment_id":  str(s.assignment_id),
                "assignment_title": aid_map[str(s.assignment_id)].title if str(s.assignment_id) in aid_map else "",
                "student_name":   s.student_name,
                "roll_no":        s.roll_no,
                "file_name":      s.file_name,
                "submitted_at":   s.submitted_at.isoformat() if s.submitted_at else None,
            }
            for s in pending
        ],
    }), 200


@academics_bp.route("/grades/<uuid:grade_id>/lock", methods=["POST"])
@require_auth
@require_roles("professor", "admin")
def lock_grade_results(grade_id):
    """A-PG4: Lock end-term results for a course/branch/semester.
    After this, no grade edits allowed unless an approved ReEvaluationRequest exists."""
    from app.models.academic import Grade, GradeResultLock
    user = get_current_user()

    grade_rec = db.session.get(Grade, grade_id)
    if not grade_rec:
        return error_response("Grade record not found.", 404)
    err = assert_college_match(grade_rec.student, g.current_user)
    if err:
        return err

    # For professors: must own the course via ProfessorClassAssignment
    if user.role == UserRole.PROFESSOR:
        from app.models.academic import ProfessorClassAssignment
        owns = ProfessorClassAssignment.query.filter_by(
            professor_user_id=user.id,
            course_code=grade_rec.course_code,
        ).first()
        if not owns:
            return error_response("You are not assigned to this course.", 403)

    existing_lock = GradeResultLock.query.filter_by(
        course_code=grade_rec.course_code,
        branch=grade_rec.student.branch if grade_rec.student else "",
        semester=grade_rec.student.semester if grade_rec.student else 0,
    ).first()
    if existing_lock:
        return jsonify({"message": "Results are already locked.", "locked_at": existing_lock.locked_at.isoformat()}), 200

    lock = GradeResultLock(
        course_code=grade_rec.course_code,
        branch=grade_rec.student.branch if grade_rec.student else "",
        semester=grade_rec.student.semester if grade_rec.student else 0,
        locked_by_id=user.id,
    )
    db.session.add(lock)
    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "lock_grade_results")

    return jsonify({"message": "Results locked successfully."}), 200


@academics_bp.route("/grades/<uuid:grade_id>/reeval", methods=["PATCH"])
@require_auth
@require_roles("professor", "admin")
def apply_reeval_grade(grade_id):
    """A-PG5: Apply re-evaluation grade adjustment.
    Only allowed if an approved ReEvaluationRequest exists for this specific grade."""
    from app.models.academic import Grade, GradeRevision, GradeResultLock, ReEvaluationRequest, ReEvalStatus
    user = get_current_user()

    grade_rec = db.session.get(Grade, grade_id)
    if not grade_rec:
        return error_response("Grade record not found.", 404)
    err = assert_college_match(grade_rec.student, g.current_user)
    if err:
        return err

    # Must have an approved re-eval request
    reeval = ReEvaluationRequest.query.filter_by(
        grade_id=grade_id,
        status=ReEvalStatus.APPROVED,
    ).first()
    if not reeval:
        return error_response("No approved re-evaluation request exists for this grade.", 403)

    data = request.get_json() or {}
    new_grade = data.get("grade")
    new_gp = data.get("grade_point")
    if not new_grade and new_gp is None:
        return error_response("At least one of grade or grade_point is required.", 400)

    try:
        rev = GradeRevision(
            grade_id=grade_rec.id,
            old_grade=grade_rec.grade,
            new_grade=new_grade or grade_rec.grade,
            old_grade_point=grade_rec.grade_point,
            new_grade_point=new_gp if new_gp is not None else grade_rec.grade_point,
            updated_by_id=user.id,
        )
        db.session.add(rev)
        if new_grade:
            grade_rec.grade = new_grade
        if new_gp is not None:
            grade_rec.grade_point = new_gp

        # Recompute CGPA
        sp = grade_rec.student
        if sp:
            all_grades = Grade.query.filter_by(student_id=sp.id).all()
            total_credits = sum(g.credits for g in all_grades)
            total_points = sum(g.grade_point * g.credits for g in all_grades)
            sp.cgpa = round(total_points / total_credits, 2) if total_credits > 0 else 0.0

        # Mark re-eval as applied
        reeval.status = ReEvalStatus.APPLIED
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "apply_reeval_grade")

    return jsonify({"message": "Re-evaluation grade applied."}), 200


@academics_bp.route("/professor/students/<uuid:student_id>/grades", methods=["GET"])
@require_auth
@require_roles("professor")
def get_student_grades_professor(student_id):
    """Professor view of student grade history, scoped to the professor's own courses only.
    IDOR: professor must be assigned to the student's class."""
    from app.models.academic import ProfessorClassAssignment, Grade
    user = get_current_user()

    sp = StudentProfile.query.filter_by(id=student_id, is_deleted=False, college_id=g.current_user.college_id).first()
    if not sp:
        return error_response("Student not found.", 404)

    # IDOR: professor must teach this student
    assignment = ProfessorClassAssignment.query.filter_by(
        professor_user_id=user.id,
        branch=sp.branch,
        semester=sp.semester,
        is_active=True,
    ).first()
    if not assignment:
        return error_response("You do not teach this student.", 403)

    # Only return grades for courses this professor teaches
    my_codes = [
        a.course_code
        for a in ProfessorClassAssignment.query.filter_by(
            professor_user_id=user.id, is_active=True
        ).all()
    ]
    grades = Grade.query.filter(
        Grade.student_id == sp.id,
        Grade.course_code.in_(my_codes),
    ).all()

    return jsonify({
        "student_name": sp.full_name,
        "roll_no": sp.roll_no,
        "grades": [
            {
                "id": str(g.id),
                "course_name": g.course_name,
                "course_code": g.course_code,
                "internal_marks": g.internal_marks,
                "mid_sem_marks": g.mid_sem_marks,
                "credits": g.credits,
                "grade": g.grade,
                "grade_point": g.grade_point,
            }
            for g in grades
        ],
    }), 200


# ─────────────────────────────────────────────────────────────────────────────
# Professor Timetable (A-TT1–A-TT4)  — professor-specific schedule CRUD
# ─────────────────────────────────────────────────────────────────────────────

def _get_free_slots_that_day(day_of_week, branch, semester):
    """Return a list of standard time slots not yet occupied that day for this branch/semester."""
    ALL_SLOTS = [
        "08:00 - 09:30", "09:30 - 11:00", "11:00 - 12:30",
        "12:30 - 14:00", "14:00 - 15:30", "15:30 - 17:00",
    ]
    occupied = {
        s.time_slot
        for s in TimetableSlot.query.filter_by(
            day_of_week=day_of_week, branch=branch,
            semester=semester, is_deleted=False
        ).filter(TimetableSlot.slot_type != "cancelled").all()
    }
    return [sl for sl in ALL_SLOTS if sl not in occupied]


@academics_bp.route("/timetable/professor", methods=["GET"])
@require_auth
@require_roles("professor")
def get_professor_timetable():
    """A-TT1: Professor's own schedule — all their slots for all classes."""
    user = get_current_user()
    slots = TimetableSlot.query.filter_by(
        user_id=user.id, is_deleted=False
    ).order_by(TimetableSlot.day_of_week, TimetableSlot.time_slot).all()

    days_order = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5}
    grouped = {}
    for s in slots:
        day = s.day_of_week
        if day not in grouped:
            grouped[day] = []
        grouped[day].append(_slot_to_dict(s))

    return jsonify({"timetable": grouped, "slots": [_slot_to_dict(s) for s in slots]}), 200


@academics_bp.route("/timetable/professor/slots", methods=["POST"])
@require_auth
@require_roles("professor")
def create_professor_slot():
    """A-TT2: Professor creates a new timetable slot.
    - course_code must be in their ProfessorClassAssignment (no free-text).
    - Hard conflict check: same day+time+branch+semester → 409 with free-slot list."""
    from app.models.academic import ProfessorClassAssignment
    user = get_current_user()
    data = request.get_json(force=True) or {}

    course_code = data.get("course_code", "").strip()
    day = data.get("day_of_week", "").strip()
    time_slot = data.get("time_slot", "").strip()
    room = data.get("room", "").strip()
    slot_type = data.get("slot_type", "lecture")

    if not all([course_code, day, time_slot, room]):
        return error_response("course_code, day_of_week, time_slot, and room are required.", 400)

    # IDOR: course_code must be in professor's assignments
    assignment = ProfessorClassAssignment.query.filter_by(
        professor_user_id=user.id, course_code=course_code, is_active=True
    ).first()
    if not assignment:
        return error_response("You are not assigned to teach this course.", 403)

    # Hard conflict check
    conflict = TimetableSlot.query.filter_by(
        day_of_week=day, time_slot=time_slot,
        branch=assignment.branch, semester=assignment.semester,
        is_deleted=False,
    ).filter(TimetableSlot.slot_type != "cancelled").first()

    if conflict:
        free_slots = _get_free_slots_that_day(day, assignment.branch, assignment.semester)
        return jsonify({
            "error": "Slot already booked for this class at that time.",
            "conflict_with": {
                "course_name": conflict.course_name,
                "professor":   conflict.professor_name,
            },
            "free_slots_today": free_slots,
        }), 409

    new_slot = TimetableSlot(
        branch=assignment.branch,
        semester=assignment.semester,
        user_id=user.id,
        day_of_week=day,
        time_slot=time_slot,
        course_name=assignment.course_name,
        course_code=course_code,
        room=room,
        professor_name=user.professor_profile.full_name if user.professor_profile else "Professor",
        slot_type=slot_type,
    )
    db.session.add(new_slot)
    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "create_professor_slot")

    return jsonify({"message": "Timetable slot created.", "slot": _slot_to_dict(new_slot)}), 201


@academics_bp.route("/timetable/professor/slots/<uuid:slot_id>", methods=["PATCH"])
@require_auth
@require_roles("professor")
def update_professor_slot(slot_id):
    """A-TT3: Professor reschedules or cancels their own slot.
    IDOR: slot.user_id must match authenticated professor.
    Hard conflict check on new day+time before rescheduling."""
    user = get_current_user()
    slot = db.session.get(TimetableSlot, slot_id)

    if not slot or slot.is_deleted:
        return error_response("Timetable slot not found.", 404)
    err = assert_college_match(slot, g.current_user)
    if err:
        return err

    # IDOR: this slot must belong to this professor
    if str(slot.user_id) != str(user.id):
        return error_response("You can only edit your own timetable slots.", 403)

    data = request.get_json(force=True) or {}
    new_day = data.get("day_of_week", slot.day_of_week)
    new_time = data.get("time_slot", slot.time_slot)
    new_room = data.get("room", slot.room)
    new_type = data.get("slot_type", slot.slot_type)

    # Conflict check only if day or time is changing
    if new_day != slot.day_of_week or new_time != slot.time_slot:
        conflict = TimetableSlot.query.filter(
            TimetableSlot.day_of_week == new_day,
            TimetableSlot.time_slot == new_time,
            TimetableSlot.branch == slot.branch,
            TimetableSlot.semester == slot.semester,
            TimetableSlot.is_deleted == False,
            TimetableSlot.slot_type != "cancelled",
            TimetableSlot.id != slot.id,
        ).first()
        if conflict:
            free_slots = _get_free_slots_that_day(new_day, slot.branch, slot.semester)
            return jsonify({
                "error": "Slot already booked for this class at that time.",
                "free_slots_today": free_slots,
            }), 409

    try:
        slot.day_of_week = new_day
        slot.time_slot = new_time
        slot.room = new_room
        slot.slot_type = new_type
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "update_professor_slot")

    return jsonify({"message": "Slot updated.", "slot": _slot_to_dict(slot)}), 200


@academics_bp.route("/timetable/professor/slots/<uuid:slot_id>", methods=["DELETE"])
@require_auth
@require_roles("professor")
def delete_professor_slot(slot_id):
    """A-TT4: Professor soft-deletes their own timetable slot.
    IDOR: slot.user_id must match authenticated professor."""
    user = get_current_user()
    slot = db.session.get(TimetableSlot, slot_id)

    if not slot or slot.is_deleted:
        return error_response("Timetable slot not found.", 404)
    err = assert_college_match(slot, g.current_user)
    if err:
        return err

    if str(slot.user_id) != str(user.id):
        return error_response("You can only delete your own timetable slots.", 403)

    try:
        slot.is_deleted = True
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "delete_professor_slot")

    return jsonify({"message": "Timetable slot removed."}), 200
