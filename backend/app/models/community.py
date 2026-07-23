import uuid
import sqlalchemy as sa
from datetime import datetime, timezone
from app.extensions import db
from app.models.college import DEFAULT_COLLEGE_ID

class Announcement(db.Model):
    __tablename__ = "announcements"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    college_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("colleges.id"), nullable=False, default=lambda: DEFAULT_COLLEGE_ID, index=True)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    author_name = db.Column(db.String(255), nullable=False)
    author_role = db.Column(db.String(50), nullable=False, default="admin")
    target_branch = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class CampusEvent(db.Model):
    __tablename__ = "campus_events"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    college_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("colleges.id"), nullable=False, default=lambda: DEFAULT_COLLEGE_ID, index=True)
    title = db.Column(db.String(255), nullable=False)
    event_type = db.Column(db.String(50), nullable=False, default="hackathon")
    date_time = db.Column(db.String(100), nullable=False)
    venue = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    # Professor-created events: must be approved by Admin before going live
    created_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    # class scope: only students in this branch see it (null = global/admin event)
    class_branch = db.Column(db.String(50), nullable=True)
    class_course_code = db.Column(db.String(50), nullable=True)
    # approval_status: 'live' (admin/TPO) | 'pending' | 'approved' | 'rejected'
    approval_status = db.Column(db.String(20), default="live", nullable=False)
    approved_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    creator = db.relationship("User", foreign_keys=[created_by_id])
    approver = db.relationship("User", foreign_keys=[approved_by_id])

class MarketplaceItem(db.Model):
    __tablename__ = "marketplace_items"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    college_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("colleges.id"), nullable=False, default=lambda: DEFAULT_COLLEGE_ID, index=True)
    seller_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    seller_name = db.Column(db.String(255), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    price = db.Column(db.String(50), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    contact_info = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(50), default="active")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class LostFoundItem(db.Model):
    __tablename__ = "lost_found_items"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    college_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("colleges.id"), nullable=False, default=lambda: DEFAULT_COLLEGE_ID, index=True)
    reporter_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    reporter_name = db.Column(db.String(255), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    item_type = db.Column(db.String(20), nullable=False, default="lost") # lost or found
    category = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(255), nullable=False)
    date_reported = db.Column(db.String(100), nullable=False)
    contact_info = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(50), default="open")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class StudyNote(db.Model):
    __tablename__ = "study_notes"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    college_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("colleges.id"), nullable=False, default=lambda: DEFAULT_COLLEGE_ID, index=True)
    title = db.Column(db.String(255), nullable=False)
    subject = db.Column(db.String(255), nullable=False)
    semester = db.Column(db.Integer, nullable=False, default=1)
    branch = db.Column(db.String(50), nullable=False, default="General")
    author_name = db.Column(db.String(255), nullable=False)
    uploaded_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    file_url = db.Column(db.String(1000), nullable=True)
    note_type = db.Column(db.String(50), default="notes")        # notes | slides | pyq
    description = db.Column(db.Text, nullable=True)
    approved = db.Column(db.Boolean, default=False, nullable=False)  # professor must approve student uploads
    downloads_count = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    uploader = db.relationship("User", foreign_keys=[uploaded_by_id])


class LibraryResource(db.Model):
    __tablename__ = "library_resources"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    college_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("colleges.id"), nullable=False, default=lambda: DEFAULT_COLLEGE_ID, index=True)
    title = db.Column(db.String(255), nullable=False)
    author = db.Column(db.String(255), nullable=False)
    subject = db.Column(db.String(255), nullable=False)
    resource_type = db.Column(db.String(50), default="book")
    uploaded_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    file_url = db.Column(db.String(1000), nullable=True)
    description = db.Column(db.Text, nullable=True)
    approved = db.Column(db.Boolean, default=True, nullable=False)   # professor/admin uploads auto-approved
    downloads_count = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    uploader = db.relationship("User", foreign_keys=[uploaded_by_id])


import enum

class LibraryRequestStatus(enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class LibraryRequest(db.Model):
    __tablename__ = "library_requests"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("library_resources.id"), nullable=False)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.Enum(LibraryRequestStatus), default=LibraryRequestStatus.PENDING, nullable=False)
    request_type = db.Column(db.String(50), default="individual") # individual, class
    branch = db.Column(db.String(50), nullable=True) # for class request
    semester = db.Column(db.Integer, nullable=True) # for class request
    expires_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    resource = db.relationship("LibraryResource", backref="requests")
    user = db.relationship("User", foreign_keys=[user_id])


class EventRegistration(db.Model):
    __tablename__ = "event_registrations"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("campus_events.id"), nullable=False)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    ticket_code = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    event = db.relationship("CampusEvent", backref="registrations")
    user = db.relationship("User", foreign_keys=[user_id])


# ── Admin Detail Access Request (professor → Admin approval) ──────────────────

class AdminDetailRequest(db.Model):
    """Professor requests access to a specific student's administrative details
    (phone, personal email, address, parent contact). Requires Admin approval."""
    __tablename__ = "admin_detail_requests"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    professor_user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    student_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("student_profiles.id"), nullable=False)
    reason = db.Column(db.Text, nullable=True)
    # pending | approved | rejected
    status = db.Column(db.String(20), default="pending", nullable=False)
    approved_by_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True)  # access window post-approval
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_at = db.Column(db.DateTime, nullable=True)

    professor = db.relationship("User", foreign_keys=[professor_user_id])
    student = db.relationship("StudentProfile", foreign_keys=[student_id])
    approver = db.relationship("User", foreign_keys=[approved_by_id])


# ── Moderation Report (TPO / Student / Company complaints) ─────────────────────

class ModerationReport(db.Model):
    __tablename__ = "moderation_reports"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    target_type = db.Column(db.String(50), nullable=False) # "student", "company", "drive", "internship"
    target_id = db.Column(db.String(255), nullable=False)    # student_id, company_id/name, drive_id, etc.
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), default="pending", nullable=False) # "pending", "resolved", "dismissed"
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    reporter = db.relationship("User", foreign_keys=[reporter_id])


class OfficialMerchandise(db.Model):
    __tablename__ = "official_merchandise"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seller_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    seller_role = db.Column(db.String(30), nullable=False) # "admin" or "placement_cell"
    college_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("colleges.id"), nullable=True, index=True)
    title = db.Column(db.String(255), nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    description = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.String(1000), nullable=True)
    upi_id = db.Column(db.String(100), nullable=True)
    bank_account = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(50), default="active", nullable=False) # "active" | "inactive"
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    seller = db.relationship("User", foreign_keys=[seller_id])
    college = db.relationship("College", foreign_keys=[college_id], lazy="joined")



class MerchandiseOrder(db.Model):
    __tablename__ = "merchandise_orders"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("official_merchandise.id"), nullable=False)
    buyer_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    quantity = db.Column(db.Integer, default=1, nullable=False)
    total_price = db.Column(db.Numeric(10, 2), nullable=False)
    payment_reference = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(50), default="pending", nullable=False) # "pending", "shipped", "delivered", "fulfilled"
    shipping_address = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    item = db.relationship("OfficialMerchandise", backref="orders")
    buyer = db.relationship("User", foreign_keys=[buyer_id])


