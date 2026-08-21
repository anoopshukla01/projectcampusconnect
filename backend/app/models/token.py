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
    __table_args__ = (
        # Fast lookup by identifier (phone or email) + college + purpose + used status.
        # college_id may be NULL for phone-based OTPs (legacy).
        db.Index(
            "ix_otp_tokens_lookup",
            "identifier", "college_id", "purpose", "is_used",
        ),
    )

    id           = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Holds either a 10-digit phone number or an email address (up to 254 chars).
    identifier   = db.Column(db.String(255), nullable=False)
    purpose      = db.Column(db.Enum(OTPPurpose), nullable=False)
    otp_hash     = db.Column(db.String(255), nullable=False)
    expires_at   = db.Column(db.DateTime, nullable=False)
    is_used      = db.Column(db.Boolean, default=False, nullable=False)
    attempt_count = db.Column(db.Integer, default=0, nullable=False)
    created_at   = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    # Multi-tenancy: email OTPs are scoped to a college so a student from
    # College A cannot accidentally be verified against College B's OTP.
    # NULL is allowed for phone-based OTPs to preserve backward compatibility.
    college_id   = db.Column(
        db.UUID(as_uuid=True),
        db.ForeignKey("colleges.id", ondelete="CASCADE"),
        nullable=True,
    )

    # Relationships
    college = db.relationship("College", foreign_keys=[college_id])


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
    # college_id is set from the inviting Admin's own college — never from client input.
    # This ensures faculty/TPO accounts can only be created in the Admin's own tenant.
    college_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("colleges.id"), nullable=True)
    token_hash = db.Column(db.String(255), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_used = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    inviter = db.relationship("User", foreign_keys=[invited_by])
    college = db.relationship("College", foreign_keys=[college_id])
