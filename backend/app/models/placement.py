import uuid
import enum
from datetime import datetime, timezone
from app.extensions import db

class DriveType(enum.Enum):
    FULL_TIME = "full_time"
    INTERNSHIP = "internship"
    CONTRACT = "contract"

class DriveStatus(enum.Enum):
    UPCOMING = "upcoming"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class ApplicationStatus(enum.Enum):
    APPLIED = "applied"
    WITHDRAWN = "withdrawn"
    INELIGIBLE_AT_APPLY = "ineligible_at_apply"

class ShortlistStatus(enum.Enum):
    SHORTLISTED = "shortlisted"
    CLEARED = "cleared"
    REJECTED = "rejected"
    NO_SHOW = "no_show"

class OfferStatus(enum.Enum):
    EXTENDED = "extended"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    REVOKED = "revoked"

class Company(db.Model):
    __tablename__ = "companies"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = db.Column(db.String(255), nullable=False, unique=True)
    sector = db.Column(db.String(255), nullable=True)
    website = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class PlacementDrive(db.Model):
    __tablename__ = "placement_drives"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("companies.id"), nullable=True)
    company_name = db.Column(db.String(255), nullable=False)
    role_title = db.Column(db.String(255), nullable=False)
    drive_type = db.Column(db.Enum(DriveType), nullable=False)
    batch_year = db.Column(db.Integer, nullable=False)
    cgpa_cutoff = db.Column(db.Numeric(4, 2), nullable=False)
    backlog_cutoff = db.Column(db.Integer, default=0, nullable=False)
    attendance_cutoff = db.Column(db.Numeric(5, 2), nullable=True)
    target_branches = db.Column(db.String(500), nullable=True)
    drive_date = db.Column(db.Date, nullable=False)
    registration_deadline = db.Column(db.DateTime, nullable=False)
    ctc_offered = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.Enum(DriveStatus), default=DriveStatus.UPCOMING, nullable=False)
    one_offer_lock = db.Column(db.Boolean, default=True, nullable=False)
    rounds = db.Column(db.JSON, nullable=True) # e.g. [{"name": "OA", "order": 1}, {"name": "Technical", "order": 2}]
    created_by = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    company = db.relationship("Company", backref="drives")
    creator = db.relationship("User", foreign_keys=[created_by])
    applications = db.relationship("DriveApplication", back_populates="drive", cascade="all, delete-orphan")
    shortlists = db.relationship("DriveShortlist", back_populates="drive", cascade="all, delete-orphan")
    offers = db.relationship("PlacementOffer", back_populates="drive", cascade="all, delete-orphan")


class DriveApplication(db.Model):
    __tablename__ = "drive_applications"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drive_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("placement_drives.id"), nullable=False)
    student_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.Enum(ApplicationStatus), default=ApplicationStatus.APPLIED, nullable=False)
    applied_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)

    __table_args__ = (
        db.UniqueConstraint("drive_id", "student_id", name="uq_drive_student_application"),
    )

    # Relationships
    drive = db.relationship("PlacementDrive", back_populates="applications")
    student = db.relationship("User", foreign_keys=[student_id])


class DriveShortlist(db.Model):
    __tablename__ = "drive_shortlists"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drive_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("placement_drives.id"), nullable=False)
    student_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    round = db.Column(db.Integer, default=1, nullable=False)
    status = db.Column(db.Enum(ShortlistStatus), nullable=False)
    notes = db.Column(db.Text, nullable=True) # internal notes, not exposed to student
    created_by = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint("drive_id", "student_id", "round", name="uq_drive_student_round_shortlist"),
    )

    # Relationships
    drive = db.relationship("PlacementDrive", back_populates="shortlists")
    student = db.relationship("User", foreign_keys=[student_id])
    creator = db.relationship("User", foreign_keys=[created_by])


class PlacementOffer(db.Model):
    __tablename__ = "placement_offers"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drive_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("placement_drives.id"), nullable=False)
    student_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    ctc_offered = db.Column(db.String(50), nullable=False)
    status = db.Column(db.Enum(OfferStatus), default=OfferStatus.EXTENDED, nullable=False)
    offer_date = db.Column(db.Date, nullable=False)
    acceptance_deadline = db.Column(db.Date, nullable=True)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)

    __table_args__ = (
        db.UniqueConstraint("drive_id", "student_id", name="uq_drive_student_offer"),
    )

    # Relationships
    drive = db.relationship("PlacementDrive", back_populates="offers")
    student = db.relationship("User", foreign_keys=[student_id])


class BranchPlacement(db.Model):
    __tablename__ = "branch_placements"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch = db.Column(db.String(100), nullable=False, unique=True)
    placed_count = db.Column(db.Integer, nullable=False, default=0)
    total_count = db.Column(db.Integer, nullable=False, default=0)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class EligibilityOverride(db.Model):
    __tablename__ = "eligibility_overrides"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drive_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("placement_drives.id"), nullable=False)
    student_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    rank = db.Column(db.Integer, nullable=True) # manually overridden rank order
    excluded = db.Column(db.Boolean, default=False, nullable=False) # excluded manually by TPO
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint("drive_id", "student_id", name="uq_drive_student_override"),
    )

