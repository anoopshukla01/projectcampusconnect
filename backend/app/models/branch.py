"""
Branch model — per-college branch management.

Each Branch row represents one academic branch (e.g. CSE, ECE) within a college.
Branches are soft-deactivated only — no hard delete, so existing records
referencing branch strings on other tables stay intact.

Columns
-------
id           UUID primary key.
college_id   FK -> colleges.id. Every branch is isolated to one college.
name         Human-readable name, e.g. "Computer Science Engineering".
code         Short code, e.g. "CSE". Unique per college.
is_active    False = deactivated; disappears from selection dropdowns but
             existing records referencing this code are unaffected.
created_at   UTC creation timestamp.
"""

import uuid
from datetime import datetime, timezone
from app.extensions import db


class Branch(db.Model):
    __tablename__ = "branches"

    id         = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    college_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("colleges.id"), nullable=False, index=True)
    name       = db.Column(db.String(100), nullable=False)
    code       = db.Column(db.String(20),  nullable=False)
    is_active  = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    college = db.relationship("College", foreign_keys=[college_id], lazy="joined")

    __table_args__ = (
        db.UniqueConstraint("college_id", "code", name="uq_branch_college_code"),
    )

    def __repr__(self) -> str:
        return f"<Branch id={self.id} code={self.code!r} college_id={self.college_id}>"
