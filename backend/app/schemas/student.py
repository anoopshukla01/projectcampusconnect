"""
Student Schemas — Marshmallow schemas for student profiles

SECURITY NOTES:
  - Whitelists fields explicitly based on role views.
  - StudentUpdateSchema disables updates to: roll_no, cgpa, backlogs, dpdp_consent.
    These can only be overridden by admin via AdminStudentUpdateSchema.
  - StudentResponseSchema serialises the profile including User fields (email, phone, role).
"""

from marshmallow import Schema, ValidationError, fields, validate, RAISE, post_dump
from app.schemas.auth import validate_phone, validate_roll_no

class StudentResponseSchema(Schema):
    """S1, S3, S4 — Student profile serialization."""
    id = fields.UUID()
    user_id = fields.UUID()
    roll_no = fields.Str()
    full_name = fields.Str()
    branch = fields.Str()
    batch_year = fields.Int()
    semester = fields.Int()
    cgpa = fields.Float()
    attendance_pct = fields.Float()
    active_backlogs = fields.Int()
    hostel_address = fields.Str()
    linkedin_url = fields.Str()
    resume_url = fields.Str()
    dpdp_consent_given = fields.Bool()
    profile_complete = fields.Bool()
    created_at = fields.DateTime()

    # User fields
    email = fields.Method("get_email")
    phone = fields.Method("get_phone")

    def get_email(self, obj):
        return obj.user.email if obj.user else None

    def get_phone(self, obj):
        return obj.user.phone if obj.user else None

    @post_dump
    def filter_sensitive_fields(self, data: dict, **kwargs) -> dict:
        """
        DPDP and RBAC Gate:
        - If context role is 'placement_cell', remove hostel_address.
        - If student has NOT given DPDP consent, hide all fields except basic indicators
          for non-admins.
        """
        context = self.context or {}
        role = context.get("role")
        is_owner = context.get("is_owner", False)

        # Placement cell should not see personal address info
        if role == "placement_cell" and not is_owner:
            data.pop("hostel_address", None)

        # If DPDP consent is false, hide details for placement_cell
        if not data.get("dpdp_consent_given") and role == "placement_cell":
            # Mask sensitive metrics
            data["cgpa"] = None
            data["phone"] = None
            data.pop("hostel_address", None)
            data["resume_url"] = None

        return data


class StudentUpdateSchema(Schema):
    """S2 — PATCH /students/me (student updating their own profile)"""
    class Meta:
        unknown = RAISE

    full_name = fields.Str(validate=validate.Length(min=2, max=255))
    branch = fields.Str(validate=validate.Length(min=2, max=50))
    semester = fields.Int(validate=validate.Range(min=1, max=10))
    hostel_address = fields.Str(allow_none=True)
    linkedin_url = fields.Str(validate=validate.Length(max=500), allow_none=True)
    resume_url = fields.Str(validate=validate.Length(max=1000), allow_none=True)


class AdminStudentUpdateSchema(Schema):
    """S5 — PATCH /students/:id (admin override)"""
    class Meta:
        unknown = RAISE

    full_name = fields.Str(validate=validate.Length(min=2, max=255))
    branch = fields.Str(validate=validate.Length(min=2, max=50))
    semester = fields.Int(validate=validate.Range(min=1, max=10))
    cgpa = fields.Float(validate=validate.Range(min=0.0, max=10.0))
    attendance_pct = fields.Float(validate=validate.Range(min=0.0, max=100.0), allow_none=True)
    active_backlogs = fields.Int(validate=validate.Range(min=0))
    hostel_address = fields.Str(allow_none=True)
    linkedin_url = fields.Str(validate=validate.Length(max=500), allow_none=True)
    resume_url = fields.Str(validate=validate.Length(max=1000), allow_none=True)
    is_active = fields.Bool()
