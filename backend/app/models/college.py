import uuid
from datetime import datetime, timezone
from app.extensions import db

DEFAULT_COLLEGE_ID = uuid.UUID("a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d")


class College(db.Model):
    """
    Tenant root model.

    Every user, student, professor, company, branch placement, and subject
    belongs to exactly one College row. This is the sole anchor for all
    per-college data isolation — never use deployment-level env vars
    (COLLEGE_NAME / ALLOWED_EMAIL_DOMAIN) for this purpose.

    Columns
    -------
    id           UUID primary key — referenced as FK from all tenant-scoped tables.
    name         Human-readable college name (e.g. "Campus Connect College").
                 Unique across the platform — used in Admin UI and reports.
    slug         URL-safe identifier (e.g. "campus-connect-college"), reserved for
                 future subdomain routing. Not used by any route yet.
    code         Short alphanumeric string (e.g. "CC2024") that students type during
                 the registration claim flow to identify their college.
                 Must be communicated out-of-band to students by their Admin.
    is_active    Soft-disable a college without deleting its data.
                 Inactive colleges: login blocked, registration blocked.
    created_at   UTC timestamp of row creation.

    Future work
    -----------
    A SUPER_ADMIN role (platform owner only) will be able to query across all
    colleges. Until that role exists, every query MUST filter by college_id.
    See: app/auth/permissions.py — require_same_college decorator.
    """

    __tablename__ = "colleges"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = db.Column(db.String(255), nullable=False, unique=True)
    slug = db.Column(db.String(255), nullable=False, unique=True)
    code = db.Column(db.String(20), nullable=False, unique=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self) -> str:
        return f"<College id={self.id} name={self.name!r} code={self.code!r}>"
