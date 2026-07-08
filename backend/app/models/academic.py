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
    role = db.Column(db.String(50), nullable=True)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    day_of_week = db.Column(db.String(20), nullable=False) # Mon, Tue, etc.
    time_slot = db.Column(db.String(50), nullable=False)   # e.g. "09:00 - 10:30"
    course_name = db.Column(db.String(255), nullable=False)
    course_code = db.Column(db.String(50), nullable=False)
    room = db.Column(db.String(50), nullable=False)
    professor_name = db.Column(db.String(255), nullable=False)
    slot_type = db.Column(db.String(50), default="lecture")

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

    assignment = db.relationship("Assignment", backref="submissions")
    student = db.relationship("StudentProfile", backref="assignment_submissions")


class Subject(db.Model):
    __tablename__ = "subjects"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = db.Column(db.String(255), nullable=False)
    code = db.Column(db.String(50), nullable=False, unique=True)
    branch = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
