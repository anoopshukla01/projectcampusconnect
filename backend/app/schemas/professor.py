"""
Professor Schemas — Marshmallow schemas for professor profiles

SECURITY NOTES:
  - Whitelists fields explicitly.
  - ProfessorUpdateSchema disables updates to: employee_id, joined_date.
    These can only be overridden by admin.
"""

from marshmallow import Schema, fields, validate, RAISE

class ProfessorResponseSchema(Schema):
    """P1, P3, P4 — Professor profile serialization."""
    id = fields.UUID()
    user_id = fields.UUID()
    employee_id = fields.Str()
    full_name = fields.Str()
    department = fields.Str()
    designation = fields.Str()
    joined_date = fields.Date()
    publications_count = fields.Int()
    approval_status = fields.Method("get_approval_status")
    created_at = fields.DateTime()

    # User fields
    email = fields.Method("get_email")

    def get_email(self, obj):
        return obj.user.email if obj.user else None

    def get_approval_status(self, obj):
        return obj.approval_status.value if obj.approval_status else None


class ProfessorUpdateSchema(Schema):
    """P2 — PATCH /professors/me (professor updating own profile)"""
    class Meta:
        unknown = RAISE

    full_name = fields.Str(validate=validate.Length(min=2, max=255))
    department = fields.Str(validate=validate.Length(min=2, max=50))
    designation = fields.Str(validate=validate.Length(min=2, max=100))
    publications_count = fields.Int(validate=validate.Range(min=0))


class AdminProfessorUpdateSchema(Schema):
    """P5 — PATCH /professors/:id (admin override)"""
    class Meta:
        unknown = RAISE

    full_name = fields.Str(validate=validate.Length(min=2, max=255))
    department = fields.Str(validate=validate.Length(min=2, max=50))
    designation = fields.Str(validate=validate.Length(min=2, max=100))
    publications_count = fields.Int(validate=validate.Range(min=0))
    joined_date = fields.Date()
    approval_status = fields.Str(validate=validate.OneOf(["pending", "approved", "rejected"]))
    is_active = fields.Bool()
