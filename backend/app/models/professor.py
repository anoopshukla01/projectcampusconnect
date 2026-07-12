import uuid
import enum
from datetime import datetime, timezone
from app.extensions import db

class ApprovalStatus(enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class ProfessorProfile(db.Model):
    __tablename__ = "professor_profiles"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), unique=True, nullable=False)
    employee_id = db.Column(db.String(30), unique=True, nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    department = db.Column(db.String(50), nullable=False)
    designation = db.Column(db.String(100), nullable=False)
    joined_date = db.Column(db.Date, nullable=True)
    publications_count = db.Column(db.Integer, default=0, nullable=False)
    monthly_salary = db.Column(db.Numeric(10, 2), nullable=True, default=0.0)
    home_address = db.Column(db.Text, nullable=True)
    approval_status = db.Column(db.Enum(ApprovalStatus), default=ApprovalStatus.PENDING, nullable=False)
    approved_by = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship("User", back_populates="professor_profile", foreign_keys=[user_id])
    approver = db.relationship("User", foreign_keys=[approved_by])
