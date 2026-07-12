"""
Placement Schemas — Marshmallow schemas for placement drives, applications,
shortlists, and offers.
"""

from marshmallow import Schema, fields, validate, RAISE

class PlacementDriveCreateSchema(Schema):
    """PL1 — Create placement drive."""
    class Meta:
        unknown = RAISE

    company_name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    company_id = fields.UUID(allow_none=True)
    role_title = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    drive_type = fields.Str(required=True, validate=validate.OneOf(["full_time", "internship", "contract"]))
    batch_year = fields.Int(required=True, validate=validate.Range(min=2000, max=2100))
    cgpa_cutoff = fields.Float(required=True, validate=validate.Range(min=0.0, max=10.0))
    backlog_cutoff = fields.Int(load_default=0, validate=validate.Range(min=0))
    attendance_cutoff = fields.Float(allow_none=True, validate=validate.Range(min=0.0, max=100.0))
    target_branches = fields.Str(allow_none=True)
    drive_date = fields.Date(required=True)
    registration_deadline = fields.DateTime(required=True)
    ctc_offered = fields.Str(required=True, validate=validate.Length(min=1, max=50))
    description = fields.Str(allow_none=True)
    one_offer_lock = fields.Bool(load_default=True)
    rounds = fields.Raw(allow_none=True)


class PlacementDriveResponseSchema(Schema):
    """PL2, PL3 — Drive response serialization."""
    id = fields.UUID()
    company_id = fields.UUID()
    company_name = fields.Str()
    role_title = fields.Str()
    drive_type = fields.Str(attribute="drive_type.value")
    batch_year = fields.Int()
    cgpa_cutoff = fields.Float()
    backlog_cutoff = fields.Int()
    attendance_cutoff = fields.Float()
    target_branches = fields.Str()
    drive_date = fields.Date()
    registration_deadline = fields.DateTime()
    ctc_offered = fields.Str()
    description = fields.Str()
    status = fields.Str(attribute="status.value")
    one_offer_lock = fields.Bool()
    rounds = fields.Raw()
    created_by = fields.UUID()
    created_at = fields.DateTime()



class BulkShortlistSchema(Schema):
    """PL10 — Bulk shortlist operation."""
    class Meta:
        unknown = RAISE

    student_ids = fields.List(fields.UUID(), required=True, validate=validate.Length(min=1))
    round = fields.Int(load_default=1, validate=validate.Range(min=1))
    status = fields.Str(load_default="shortlisted", validate=validate.OneOf(["shortlisted", "cleared", "rejected", "no_show"]))
    notes = fields.Str(allow_none=True)


class ShortlistStatusUpdateSchema(Schema):
    """PL11 — Individual shortlist status update."""
    class Meta:
        unknown = RAISE

    status = fields.Str(required=True, validate=validate.OneOf(["shortlisted", "cleared", "rejected", "no_show"]))
    notes = fields.Str(allow_none=True)


class OfferCreateSchema(Schema):
    """PL13 — Extend placement offer."""
    class Meta:
        unknown = RAISE

    student_id = fields.UUID(required=True)
    ctc_offered = fields.Str(required=True, validate=validate.Length(min=1, max=50))
    offer_date = fields.Date(required=True)
    acceptance_deadline = fields.Date(allow_none=True)


class OfferUpdateSchema(Schema):
    """PL14 — Update offer acceptance status."""
    class Meta:
        unknown = RAISE

    status = fields.Str(required=True, validate=validate.OneOf(["accepted", "declined", "revoked"]))
