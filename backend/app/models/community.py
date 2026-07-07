import uuid
from datetime import datetime, timezone
from app.extensions import db

class Announcement(db.Model):
    __tablename__ = "announcements"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    author_name = db.Column(db.String(255), nullable=False)
    author_role = db.Column(db.String(50), nullable=False, default="admin")
    target_branch = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class CampusEvent(db.Model):
    __tablename__ = "campus_events"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = db.Column(db.String(255), nullable=False)
    event_type = db.Column(db.String(50), nullable=False, default="hackathon")
    date_time = db.Column(db.String(100), nullable=False)
    venue = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class MarketplaceItem(db.Model):
    __tablename__ = "marketplace_items"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
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
    title = db.Column(db.String(255), nullable=False)
    subject = db.Column(db.String(255), nullable=False)
    semester = db.Column(db.Integer, nullable=False, default=1)
    branch = db.Column(db.String(50), nullable=False)
    author_name = db.Column(db.String(255), nullable=False)
    file_url = db.Column(db.String(1000), nullable=True)
    downloads_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class LibraryResource(db.Model):
    __tablename__ = "library_resources"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = db.Column(db.String(255), nullable=False)
    author = db.Column(db.String(255), nullable=False)
    subject = db.Column(db.String(255), nullable=False)
    resource_type = db.Column(db.String(50), default="book")
    file_url = db.Column(db.String(1000), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
