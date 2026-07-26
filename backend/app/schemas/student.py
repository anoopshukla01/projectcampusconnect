"""
Student Schemas — Marshmallow schemas for student profiles

SECURITY NOTES:
  - Whitelists fields explicitly based on role views.
  - StudentUpdateSchema disables updates to: roll_no, cgpa, backlogs, dpdp_consent.
    These can only be overridden by admin via AdminStudentUpdateSchema.
  - StudentResponseSchema serialises the profile including User fields (email, phone, role).
  - StudentDetailSchema is the role-aware view for the Student Detail Page.
    It reuses filter_sensitive_fields from StudentResponseSchema as its base
    and adds admission-detail masking on top — no parallel masking system.
"""

from datetime import datetime, timezone
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
    github_url = fields.Str()
    social_links_visibility = fields.Dict()
    resume_url = fields.Str()
    profile_photo_url = fields.Str()
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


class StudentDetailSchema(StudentResponseSchema):
    """
    S9 — Role-aware Student Detail Page schema.

    Extends StudentResponseSchema (reusing its filter_sensitive_fields base),
    adds admission detail fields, admin-only fields, and section metadata.
    The @post_dump here runs AFTER the parent's @post_dump, so base masking
    is already applied before admission-detail masking is layered on.

    Role field visibility matrix:
      admin         → all fields
      placement_cell → identity + cgpa/backlogs + career/placement;
                       no fees/scholarship/home_address/parent_contact/quota_category
      professor     → identity + academic snapshot (their course scope);
                       no admission/admin/career/activity
      student (own) → all own fields; quota_category included
    """

    # Admission details (new fields)
    entrance_exam_type = fields.Str(allow_none=True)
    entrance_rank      = fields.Int(allow_none=True)
    quota_category     = fields.Str(allow_none=True)   # masked for TPO

    # Administrative details (already on model, surfaced here explicitly)
    home_address    = fields.Str(allow_none=True)
    parent_contact  = fields.Str(allow_none=True)
    fees_submitted  = fields.Float(allow_none=True)
    scholarship_details = fields.Str(allow_none=True)

    # Section-level edit metadata (admin writes, all roles can read if permitted)
    admin_edits_meta = fields.Dict(allow_none=True)

    # College name for display
    college_name = fields.Method("get_college_name")

    def get_college_name(self, obj):
        return obj.college.name if obj.college else None

    @post_dump
    def filter_detail_fields(self, data: dict, **kwargs) -> dict:
        """
        Layer 2 masking on top of the parent filter_sensitive_fields.
        Applies admission-detail and administrative-detail field masking
        based on viewer role.
        """
        context = self.context or {}
        role = context.get("role")
        is_owner = context.get("is_owner", False)

        # ── TPO (placement_cell) ──────────────────────────────────────────────
        if role == "placement_cell" and not is_owner:
            # Quota/category: hidden for TPO
            data.pop("quota_category", None)
            # Full administrative details: hidden
            data.pop("home_address", None)
            data.pop("parent_contact", None)
            data.pop("fees_submitted", None)
            data.pop("scholarship_details", None)
            data.pop("hostel_address", None)
            data.pop("admin_edits_meta", None)

        # ── Professor ────────────────────────────────────────────────────────
        elif role == "professor" and not is_owner:
            # Admission details: hidden (no request path for professor)
            data.pop("entrance_exam_type", None)
            data.pop("entrance_rank", None)
            data.pop("quota_category", None)
            # Administrative details: hidden (request-gated via existing flow;
            # caller sets admin_access_granted in context if approved)
            if not context.get("admin_access_granted", False):
                data["home_address"]     = None
                data["parent_contact"]   = None
                data["hostel_address"]   = "***"
            data.pop("fees_submitted", None)
            data.pop("scholarship_details", None)
            data.pop("admin_edits_meta", None)
            # Career/Placement fields: hidden for professor
            data.pop("linkedin_url", None)
            data.pop("github_url", None)
            data.pop("resume_url", None)

        # ── Student (own record) ─────────────────────────────────────────────
        elif role == "student" and is_owner:
            # Students see all own fields including quota_category
            # Fees/scholarship: visible but read-only (enforced at PATCH level)
            data.pop("admin_edits_meta", None)  # internal metadata not shown to student

        # ── Admin ─────────────────────────────────────────────────────────────
        elif role == "admin":
            pass  # admin sees everything

        # ── Unknown / unmatched role ──────────────────────────────────────────
        else:
            # Strip everything sensitive — fail safe
            for sensitive_key in [
                "home_address", "parent_contact", "hostel_address",
                "fees_submitted", "scholarship_details", "quota_category",
                "admin_edits_meta", "phone", "email",
            ]:
                data.pop(sensitive_key, None)

        return data


class StudentUpdateSchema(Schema):
    """S2 — PATCH /students/me (student updating their own profile)"""
    class Meta:
        unknown = RAISE

    full_name = fields.Str(validate=validate.Length(min=2, max=255))
    branch = fields.Str(validate=validate.Length(min=2, max=50))
    semester = fields.Int(validate=validate.Range(min=1, max=10))
    hostel_address = fields.Str(allow_none=True)
    home_address = fields.Str(allow_none=True)
    parent_contact = fields.Str(validate=validate.Length(max=50), allow_none=True)
    linkedin_url = fields.Str(validate=validate.Length(max=500), allow_none=True)
    github_url = fields.Str(validate=validate.Length(max=500), allow_none=True)
    social_links_visibility = fields.Dict(allow_none=True)
    resume_url = fields.Str(validate=validate.Length(max=1000), allow_none=True)
    profile_photo_url = fields.Str(validate=validate.Length(max=1000), allow_none=True)


class AdminStudentUpdateSchema(Schema):
    """S5 — PATCH /students/:id (admin override) — extended with admission detail fields"""
    class Meta:
        unknown = RAISE

    full_name = fields.Str(validate=validate.Length(min=2, max=255))
    branch = fields.Str(validate=validate.Length(min=2, max=50))
    semester = fields.Int(validate=validate.Range(min=1, max=10))
    cgpa = fields.Float(validate=validate.Range(min=0.0, max=10.0))
    attendance_pct = fields.Float(validate=validate.Range(min=0.0, max=100.0), allow_none=True)
    active_backlogs = fields.Int(validate=validate.Range(min=0))
    hostel_address = fields.Str(allow_none=True)
    home_address = fields.Str(allow_none=True)
    parent_contact = fields.Str(validate=validate.Length(max=50), allow_none=True)
    fees_submitted = fields.Float(validate=validate.Range(min=0), allow_none=True)
    scholarship_details = fields.Str(validate=validate.Length(max=255), allow_none=True)
    email = fields.Email(allow_none=True)
    phone = fields.Str(validate=validate.Length(max=50), allow_none=True)
    github_url = fields.Str(validate=validate.Length(max=500), allow_none=True)
    linkedin_url = fields.Str(validate=validate.Length(max=500), allow_none=True)
    resume_url = fields.Str(validate=validate.Length(max=1000), allow_none=True)
    profile_photo_url = fields.Str(validate=validate.Length(max=1000), allow_none=True)
    is_active = fields.Bool()
    # Admission detail fields (admin-only editable)
    entrance_exam_type = fields.Str(validate=validate.Length(max=50), allow_none=True)
    entrance_rank      = fields.Int(validate=validate.Range(min=0), allow_none=True)
    quota_category     = fields.Str(validate=validate.Length(max=50), allow_none=True)
    # Section tag for edit metadata tracking
    edited_section     = fields.Str(validate=validate.Length(max=50), load_default=None)

