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
    created_at = fields.DateTime()


class AdminUserUpdateSchema(Schema):
    """AD2 — Admin updating basic user parameters."""
    class Meta:
        unknown = RAISE

    is_active = fields.Bool()
    email = fields.Email(allow_none=True)
    phone = fields.Str(allow_none=True)


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
