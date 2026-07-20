import uuid
from datetime import datetime, timezone
from app.extensions import db

class Grade(db.Model):
    __tablename__ = "grades"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("student_profiles.id"), nullable=False)
    course_name = db.Column(db.String(255), nullable=False)
    course_code = db.Column(db.String(50), nullable=False)
    internal_marks = db.Column(db.Integer, nullable=False, default=0)
    mid_sem_marks = db.Column(db.Integer, nullable=False, default=0)
    credits = db.Column(db.Integer, nullable=False, default=4)
    grade = db.Column(db.String(10), nullable=False, default="A")
    grade_point = db.Column(db.Integer, nullable=False, default=9)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    student = db.relationship("StudentProfile", backref="grades")

class AttendanceRecord(db.Model):
    __tablename__ = "attendance_records"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("student_profiles.id"), nullable=False)
    subject_name = db.Column(db.String(255), nullable=False)
    subject_code = db.Column(db.String(50), nullable=False)
    attended_classes = db.Column(db.Integer, nullable=False, default=0)
    total_classes = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    student = db.relationship("StudentProfile", backref="attendance_records")

class TimetableSlot(db.Model):
    __tablename__ = "timetable_slots"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch = db.Column(db.String(50), nullable=True)
    semester = db.Column(db.Integer, nullable=True)          # e.g. 4 — scopes slot to a semester
    role = db.Column(db.String(50), nullable=True)           # "student" | "professor" — broadcast scope
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)  # owning professor
    day_of_week = db.Column(db.String(20), nullable=False)   # Mon, Tue, Wed, Thu, Fri, Sat
    time_slot = db.Column(db.String(50), nullable=False)     # e.g. "09:00 - 10:30"
    course_name = db.Column(db.String(255), nullable=False)
    course_code = db.Column(db.String(50), nullable=False)
    room = db.Column(db.String(50), nullable=False)
    professor_name = db.Column(db.String(255), nullable=False)
    slot_type = db.Column(db.String(50), default="lecture")  # lecture | lab | extra | cancelled
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class Assignment(db.Model):
    __tablename__ = "assignments"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = db.Column(db.String(255), nullable=False)
    subject = db.Column(db.String(255), nullable=False)
    branch = db.Column(db.String(50), nullable=True)
    due_date = db.Column(db.String(50), nullable=False)
    points = db.Column(db.String(20), nullable=False, default="25 pts")
    description = db.Column(db.Text, nullable=True)
    attachment_url = db.Column(db.String(1000), nullable=True)
    professor_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class AssignmentSubmission(db.Model):
    __tablename__ = "assignment_submissions"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("assignments.id"), nullable=False)
    student_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("student_profiles.id"), nullable=False)
    student_name = db.Column(db.String(255), nullable=False)
    roll_no = db.Column(db.String(50), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(50), default="pending") # pending, submitted, graded
    grade = db.Column(db.String(20), nullable=True)
    feedback = db.Column(db.Text, nullable=True)
    submitted_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    is_current = db.Column(db.Boolean, default=True, nullable=False)

    assignment = db.relationship("Assignment", backref="submissions")
    student = db.relationship("StudentProfile", backref="assignment_submissions")


class GradeRevision(db.Model):
    __tablename__ = "grade_revisions"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grade_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("grades.id"), nullable=False)
    old_grade = db.Column(db.String(10), nullable=False)
    new_grade = db.Column(db.String(10), nullable=False)
    old_grade_point = db.Column(db.Integer, nullable=False)
    new_grade_point = db.Column(db.Integer, nullable=False)
    updated_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    grade_rel = db.relationship("Grade", backref="revisions")


import enum as _enum
from app.models.college import DEFAULT_COLLEGE_ID

class Subject(db.Model):
    __tablename__ = "subjects"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # college_id: nullable during migration backfill only; becomes NOT NULL via Alembic.
    # Global unique on code is removed — replaced by composite (college_id, code) below.
    college_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("colleges.id"), nullable=False, default=lambda: DEFAULT_COLLEGE_ID, index=True)
    name = db.Column(db.String(255), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    branch = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    college = db.relationship("College", foreign_keys=[college_id])

    __table_args__ = (
        db.UniqueConstraint("college_id", "code", name="uq_college_subject_code"),
    )


# ── Professor teaching assignments (IDOR anchor for all class-scoped queries) ──

class ProfessorClassAssignment(db.Model):
    """Links a professor to the class/subject combos they are authorised to teach.
    All class-scoped professor endpoints MUST join this table to prevent IDOR."""
    __tablename__ = "professor_class_assignments"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    professor_user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True)
    course_name = db.Column(db.String(255), nullable=False)
    course_code = db.Column(db.String(50), nullable=False)
    branch = db.Column(db.String(50), nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    academic_year = db.Column(db.String(20), nullable=True)  # e.g. "2025-26"
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    professor = db.relationship("User", foreign_keys=[professor_user_id])

    __table_args__ = (
        db.UniqueConstraint(
            "professor_user_id", "course_code", "branch", "semester",
            name="uq_prof_class_assignment"
        ),
    )


# ── End-term grade lock ────────────────────────────────────────────────────────

class GradeResultLock(db.Model):
    """Once created, all Grade rows for this course/branch/semester are read-only
    unless an approved ReEvaluationRequest exists for a specific grade."""
    __tablename__ = "grade_result_locks"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_code = db.Column(db.String(50), nullable=False)
    branch = db.Column(db.String(50), nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    locked_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    locked_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    locked_by = db.relationship("User", foreign_keys=[locked_by_id])

    __table_args__ = (
        db.UniqueConstraint(
            "course_code", "branch", "semester",
            name="uq_grade_result_lock"
        ),
    )


# ── Re-evaluation request (15-day window after lock) ──────────────────────────

class ReEvalStatus(_enum.Enum):
    PENDING   = "pending"
    APPROVED  = "approved"
    REJECTED  = "rejected"
    APPLIED   = "applied"  # professor has updated the grade


class ReEvaluationRequest(db.Model):
    """Student requests re-evaluation within 15 days of results being locked.
    Only when this row has status=APPROVED may the professor edit that grade."""
    __tablename__ = "re_evaluation_requests"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grade_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("grades.id"), nullable=False, index=True)
    student_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    reason = db.Column(db.Text, nullable=True)
    status = db.Column(db.Enum(ReEvalStatus), default=ReEvalStatus.PENDING, nullable=False)
    reviewed_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    requested_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_at = db.Column(db.DateTime, nullable=True)

    grade = db.relationship("Grade", foreign_keys=[grade_id])
    student = db.relationship("User", foreign_keys=[student_id])
    reviewer = db.relationship("User", foreign_keys=[reviewed_by_id])


# ── Timetable Booking for drives (requires Admin approval) ────────────────────

class TimetableBooking(db.Model):
    __tablename__ = "timetable_bookings"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drive_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("placement_drives.id"), nullable=False)
    student_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    tpo_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    day_of_week = db.Column(db.String(10), nullable=False) # e.g. "Mon"
    time_slot = db.Column(db.String(50), nullable=False)   # e.g. "09:00 - 10:30"
    room = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(50), default="pending_admin_approval", nullable=False)
    timetable_slot_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("timetable_slots.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    drive = db.relationship("PlacementDrive", foreign_keys=[drive_id])
    student = db.relationship("User", foreign_keys=[student_id])
    tpo = db.relationship("User", foreign_keys=[tpo_id])
    timetable_slot = db.relationship("TimetableSlot", foreign_keys=[timetable_slot_id])


class ProfessorCheckIn(db.Model):
    __tablename__ = "professor_check_ins"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    professor_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    check_in_date = db.Column(db.Date, nullable=False, default=lambda: datetime.now(timezone.utc).date())
    check_in_time = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    status = db.Column(db.String(50), default="Present", nullable=False) # "Present" | "Late" | "Absent"
    marked_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)

    professor = db.relationship("User", foreign_keys=[professor_id])
    marker = db.relationship("User", foreign_keys=[marked_by_id])

