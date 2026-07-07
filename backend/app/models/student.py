import uuid
from datetime import datetime, timezone
from app.extensions import db

class StudentProfile(db.Model):
    __tablename__ = "student_profiles"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), unique=True, nullable=False)
    roll_no = db.Column(db.String(20), unique=True, nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    branch = db.Column(db.String(50), nullable=False)
    batch_year = db.Column(db.Integer, nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    cgpa = db.Column(db.Numeric(4, 2), nullable=False)
    attendance_pct = db.Column(db.Numeric(5, 2), nullable=True)
    active_backlogs = db.Column(db.Integer, default=0, nullable=False)
    hostel_address = db.Column(db.Text, nullable=True)
    linkedin_url = db.Column(db.String(500), nullable=True)
    resume_url = db.Column(db.String(1000), nullable=True)
    dpdp_consent_given = db.Column(db.Boolean, default=False, nullable=False)
    dpdp_consent_at = db.Column(db.DateTime, nullable=True)
    profile_complete = db.Column(db.Boolean, default=False, nullable=False)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship("User", back_populates="student_profile")
