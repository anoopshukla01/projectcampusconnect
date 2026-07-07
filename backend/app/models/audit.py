import uuid
from datetime import datetime, timezone
from app.extensions import db

class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True) # NULL for anonymous (e.g. failed login)
    actor_role = db.Column(db.String(30), nullable=True) # snapshot of role at time of action
    action = db.Column(db.String(100), nullable=False) # e.g. "auth.login", "student.cgpa_edit"
    target_type = db.Column(db.String(50), nullable=True) # e.g. "student_profile"
    target_id = db.Column(db.UUID(as_uuid=True), nullable=True)
    ip_address = db.Column(db.String(45), nullable=False) # IPv4 or IPv6
    user_agent = db.Column(db.String(500), nullable=True)
    detail = db.Column(db.JSON, nullable=True) # field-level diffs or metadata
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    actor = db.relationship("User", foreign_keys=[actor_id])
