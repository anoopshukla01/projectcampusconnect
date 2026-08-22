import uuid
from datetime import datetime, timezone
from app.extensions import db

class UserConsent(db.Model):
    __tablename__ = "user_consents"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    college_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("colleges.id", ondelete="CASCADE"), nullable=True, index=True)

    # Consented Permissions
    location_consent = db.Column(db.Boolean, default=False, nullable=False)  # Required for geofenced automated attendance
    storage_consent = db.Column(db.Boolean, default=False, nullable=False)   # Required for ID card photo & file uploads
    notif_consent = db.Column(db.Boolean, default=False, nullable=False)     # Required for broadcasts & placement alerts

    # Legal Agreement
    terms_accepted = db.Column(db.Boolean, default=False, nullable=False)
    guidelines_accepted = db.Column(db.Boolean, default=False, nullable=False)
    agreement_version = db.Column(db.String(20), default="1.0.0", nullable=False)
    accepted_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    ip_address = db.Column(db.String(45), nullable=True)  # Supports IPv4 and IPv6
    user_agent = db.Column(db.String(500), nullable=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = db.relationship("User", back_populates="consents")
    college = db.relationship("College", foreign_keys=[college_id], lazy="joined")

    __table_args__ = (
        db.UniqueConstraint("user_id", "agreement_version", name="uq_user_agreement_version"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "location_consent": self.location_consent,
            "storage_consent": self.storage_consent,
            "notif_consent": self.notif_consent,
            "terms_accepted": self.terms_accepted,
            "guidelines_accepted": self.guidelines_accepted,
            "agreement_version": self.agreement_version,
            "accepted_at": self.accepted_at.isoformat() if self.accepted_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
