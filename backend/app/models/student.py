import uuid
from datetime import datetime, timezone
from app.extensions import db
from app.models.college import DEFAULT_COLLEGE_ID

class StudentProfile(db.Model):
    __tablename__ = "student_profiles"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), unique=True, nullable=False)
    # college_id is nullable during migration backfill only; becomes NOT NULL via Alembic.
    # Global unique on roll_no is removed — replaced by composite (college_id, roll_no) below.
    college_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("colleges.id"), nullable=False, default=lambda: DEFAULT_COLLEGE_ID, index=True)
    roll_no = db.Column(db.String(20), nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    branch = db.Column(db.String(50), nullable=False)
    batch_year = db.Column(db.Integer, nullable=False)
    semester = db.Column(db.Integer, nullable=False)
    cgpa = db.Column(db.Numeric(4, 2), nullable=False)
    attendance_pct = db.Column(db.Numeric(5, 2), nullable=True)
    active_backlogs = db.Column(db.Integer, default=0, nullable=False)
    hostel_address = db.Column(db.Text, nullable=True)
    home_address = db.Column(db.Text, nullable=True)
    parent_contact = db.Column(db.String(50), nullable=True)
    fees_submitted = db.Column(db.Numeric(10, 2), nullable=True, default=0.0)
    scholarship_details = db.Column(db.String(255), nullable=True)
    linkedin_url = db.Column(db.String(500), nullable=True)
    github_url = db.Column(db.String(500), nullable=True)
    social_links_visibility = db.Column(db.JSON, nullable=True) # e.g. {"github": true, "linkedin": true}
    resume_url = db.Column(db.String(1000), nullable=True)
    dpdp_consent_given = db.Column(db.Boolean, default=False, nullable=False)
    dpdp_consent_at = db.Column(db.DateTime, nullable=True)
    profile_complete = db.Column(db.Boolean, default=False, nullable=False)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


    # Relationships
    user = db.relationship("User", back_populates="student_profile")
    college = db.relationship("College", foreign_keys=[college_id], lazy="joined")

    __table_args__ = (
        db.UniqueConstraint("college_id", "roll_no", name="uq_college_roll_no"),
    )


class StudentResume(db.Model):
    __tablename__ = "student_resumes"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("student_profiles.id"), nullable=False)
    version = db.Column(db.Integer, nullable=False) # 1, 2, or 3
    raw_json = db.Column(db.JSON, nullable=True)
    pdf_url = db.Column(db.String(1000), nullable=True)
    is_active = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    student = db.relationship("StudentProfile", backref="resumes")
