"""
Content Models — Mentorship, Mock Interviews, Lecture Recordings, Syllabus
"""

import uuid
import enum
from datetime import datetime, timezone
from app.extensions import db


class MentorProfile(db.Model):
    __tablename__ = "mentor_profiles"

    id            = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id       = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    name          = db.Column(db.String(255), nullable=False)
    role_title    = db.Column(db.String(255), nullable=False, default="Faculty Mentor")
    expertise     = db.Column(db.String(500), nullable=True)  # comma-separated
    rating        = db.Column(db.Numeric(3, 1), default=4.5)
    sessions_count = db.Column(db.Integer, default=0, nullable=False)
    is_available  = db.Column(db.Boolean, default=True, nullable=False)
    is_active     = db.Column(db.Boolean, default=True, nullable=False)
    created_at    = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", foreign_keys=[user_id])


class MentorshipRequestStatus(enum.Enum):
    PENDING   = "pending"
    ACCEPTED  = "accepted"
    DECLINED  = "declined"
    COMPLETED = "completed"


class MentorshipRequest(db.Model):
    __tablename__ = "mentorship_requests"

    id          = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mentor_id   = db.Column(db.UUID(as_uuid=True), db.ForeignKey("mentor_profiles.id"), nullable=False)
    student_id  = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    topic       = db.Column(db.String(255), nullable=False)
    message     = db.Column(db.Text, nullable=True)
    status      = db.Column(db.Enum(MentorshipRequestStatus),
                             default=MentorshipRequestStatus.PENDING, nullable=False)
    created_at  = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at  = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                             onupdate=lambda: datetime.now(timezone.utc))

    mentor  = db.relationship("MentorProfile", foreign_keys=[mentor_id])
    student = db.relationship("User", foreign_keys=[student_id])


class MockInterviewSession(db.Model):
    __tablename__ = "mock_interview_sessions"

    id             = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_type   = db.Column(db.String(100), nullable=False)   # "Technical", "HR", "System Design"
    company_style  = db.Column(db.String(100), nullable=True)    # "Google-style", "Amazon LP"
    difficulty     = db.Column(db.String(20),  default="Medium") # Easy | Medium | Hard
    duration_minutes = db.Column(db.Integer,   default=45)
    scheduled_at   = db.Column(db.DateTime,    nullable=True)
    capacity       = db.Column(db.Integer,     default=10)
    is_active      = db.Column(db.Boolean,     default=True, nullable=False)
    created_at     = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class MockInterviewBooking(db.Model):
    __tablename__ = "mock_interview_bookings"

    id         = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = db.Column(db.UUID(as_uuid=True),
                            db.ForeignKey("mock_interview_sessions.id"), nullable=False)
    student_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    session = db.relationship("MockInterviewSession", foreign_keys=[session_id])
    student = db.relationship("User", foreign_keys=[student_id])

    __table_args__ = (
        db.UniqueConstraint("session_id", "student_id", name="uq_booking_session_student"),
    )


class LectureRecording(db.Model):
    __tablename__ = "lecture_recordings"

    id             = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title          = db.Column(db.String(255), nullable=False)
    subject        = db.Column(db.String(255), nullable=False)
    course_code    = db.Column(db.String(50),  nullable=True)
    professor_name = db.Column(db.String(255), nullable=False)
    uploaded_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    branch         = db.Column(db.String(50),  nullable=True)   # NULL = broadcast all
    video_url      = db.Column(db.String(1000), nullable=True)
    duration       = db.Column(db.String(20),  nullable=True)   # e.g. "45:30"
    created_at     = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    uploader = db.relationship("User", foreign_keys=[uploaded_by_id])


class SyllabusProgress(db.Model):
    __tablename__ = "syllabus_progress"

    id           = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject      = db.Column(db.String(255), nullable=False)
    course_code  = db.Column(db.String(50),  nullable=False)
    module_info  = db.Column(db.String(255), nullable=True)
    progress_pct = db.Column(db.Integer,     default=0, nullable=False)
    branch       = db.Column(db.String(50),  nullable=True)
    professor_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    updated_at   = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                              onupdate=lambda: datetime.now(timezone.utc))

    professor = db.relationship("User", foreign_keys=[professor_id])
