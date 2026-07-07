import uuid
import enum
from datetime import datetime, timezone
from app.extensions import db

class OTPPurpose(enum.Enum):
    REGISTRATION = "registration"
    LOGIN = "login"
    PASSWORD_RESET = "password_reset"

class OTPToken(db.Model):
    __tablename__ = "otp_tokens"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    identifier = db.Column(db.String(20), nullable=False) # phone or roll_no
    purpose = db.Column(db.Enum(OTPPurpose), nullable=False)
    otp_hash = db.Column(db.String(255), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_used = db.Column(db.Boolean, default=False, nullable=False)
    attempt_count = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class RefreshToken(db.Model):
    __tablename__ = "refresh_tokens"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    token_hash = db.Column(db.String(255), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_revoked = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_used_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    user = db.relationship("User")


class Invite(db.Model):
    __tablename__ = "invites"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(30), nullable=False) # e.g. "admin", "placement_cell"
    invited_by = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    token_hash = db.Column(db.String(255), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_used = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    inviter = db.relationship("User", foreign_keys=[invited_by])
