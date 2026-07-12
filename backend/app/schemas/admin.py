"""
Admin Schemas — Marshmallow schemas for administrator dashboards.

Enforces:
  - Whitelisting of user update parameters.
  - Structure of invites, audit logs, and analytical metrics.
"""

from marshmallow import Schema, fields, validate, RAISE

class AdminUserResponseSchema(Schema):
    """AD1 — central user representation for access control dashboard."""
    id = fields.UUID()
    email = fields.Str()
    phone = fields.Str()
    role = fields.Str(attribute="role.value")
    is_active = fields.Bool()
    is_deleted = fields.Bool()
    suspended_features = fields.List(fields.Str())
    tags = fields.List(fields.Str())
    created_at = fields.DateTime()

    # Profile fields (Student)
    roll_no = fields.Str()
    full_name = fields.Str()
    branch = fields.Str()
    batch_year = fields.Int()
    semester = fields.Int()
    cgpa = fields.Float()
    attendance_pct = fields.Float()
    fees_submitted = fields.Float()
    scholarship_details = fields.Str()
    parent_contact = fields.Str()
    home_address = fields.Str()

    # Profile fields (Professor)
    employee_id = fields.Str()
    monthly_salary = fields.Float()
    department = fields.Str()
    designation = fields.Str()


class AdminUserUpdateSchema(Schema):
    """AD2 — Admin updating basic user parameters."""
    class Meta:
        unknown = RAISE

    is_active = fields.Bool()
    email = fields.Email(allow_none=True)
    phone = fields.Str(allow_none=True)
    suspended_features = fields.List(fields.Str(), allow_none=True)
    tags = fields.List(fields.Str(), allow_none=True)

    # Profile fields (Student/Professor)
    full_name = fields.Str(allow_none=True)
    branch = fields.Str(allow_none=True)
    batch_year = fields.Int(allow_none=True)
    semester = fields.Int(allow_none=True)
    cgpa = fields.Float(allow_none=True)
    fees_submitted = fields.Float(allow_none=True)
    scholarship_details = fields.Str(allow_none=True)
    parent_contact = fields.Str(allow_none=True)
    home_address = fields.Str(allow_none=True)

    monthly_salary = fields.Float(allow_none=True)
    department = fields.Str(allow_none=True)
    designation = fields.Str(allow_none=True)


class AdminInviteCreateSchema(Schema):
    """AD4 — Admin inviting another admin, placement cell member, or faculty/professor."""
    class Meta:
        unknown = RAISE

    email = fields.Email(required=True)
    role = fields.Str(required=True, validate=validate.OneOf(["admin", "placement_cell", "professor"]))


class AdminInviteResponseSchema(Schema):
    """AD5 — Invite serialization."""
    id = fields.UUID()
    email = fields.Str()
    role = fields.Str()
    expires_at = fields.DateTime()
    is_used = fields.Bool()
    created_at = fields.DateTime()


class AuditLogResponseSchema(Schema):
    """AD9 — Audit log serialization."""
    id = fields.UUID()
    actor_id = fields.UUID()
    actor_role = fields.Str()
    action = fields.Str()
    target_type = fields.Str()
    target_id = fields.UUID()
    ip_address = fields.Str()
    user_agent = fields.Str()
    detail = fields.Dict()
    timestamp = fields.DateTime()
