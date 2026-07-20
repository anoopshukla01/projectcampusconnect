"""
Auth Schemas — Marshmallow request validation and response shaping for auth endpoints.

RULES ENFORCED HERE (not in route handlers):
  - All required fields are declared and validated here.
  - unknown=RAISE means any extra field sent by the client is rejected with 400.
    This prevents mass-assignment attacks.
  - Response schemas use only() or Meta.fields to whitelist what goes back to
    the client. We never serialize a full SQLAlchemy model object directly.
  - No passwords, OTPs, or token hashes ever appear in a response schema.
"""

import re

from marshmallow import Schema, ValidationError, fields, validate, validates, validates_schema, RAISE
from flask import current_app


# ── Shared validators ─────────────────────────────────────────────────────────

def validate_phone(value: str) -> None:
    """10-digit Indian mobile number (digits only, starts with 6-9)."""
    if not re.fullmatch(r"[6-9]\d{9}", value):
        raise ValidationError("Enter a valid 10-digit Indian mobile number.")

def validate_roll_no(value: str) -> None:
    """Alphanumeric roll number, 4-20 characters."""
    if not re.fullmatch(r"[A-Za-z0-9]{4,20}", value):
        raise ValidationError("Roll number must be 4-20 alphanumeric characters.")

def validate_otp(value: str) -> None:
    """Exactly 6 numeric digits."""
    if not re.fullmatch(r"\d{6}", value):
        raise ValidationError("OTP must be exactly 6 digits.")


# ── OTP endpoints ─────────────────────────────────────────────────────────────

class OTPSendSchema(Schema):
    """A1 — POST /auth/otp/send"""
    class Meta:
        unknown = RAISE  # reject any extra fields

    phone = fields.Str(required=True, validate=validate_phone)


class OTPVerifySchema(Schema):
    """A2 — POST /auth/otp/verify"""
    class Meta:
        unknown = RAISE

    phone = fields.Str(required=True, validate=validate_phone)
    otp   = fields.Str(required=True, validate=validate_otp)


# ── Student registration (Claim Pre-Imported Record) ───────────────────────

class StudentRegisterSchema(Schema):
    """
    A3 — POST /auth/register/student
    Requires a valid otp_verified_token (short-lived JWT issued by /otp/verify).
    Claims a pre-imported record matching roll_no.
    """
    class Meta:
        unknown = RAISE

    otp_verified_token = fields.Str(required=True)
    # college_code identifies the tenant BEFORE any StudentProfile lookup.
    # Students receive this code out-of-band from their Admin.
    # Must be resolved first to prevent roll_no enumeration across colleges.
    college_code       = fields.Str(load_default="CC2024", validate=validate.Length(min=2, max=20))
    roll_no            = fields.Str(required=True, validate=validate_roll_no)
    full_name          = fields.Str(load_default=None, validate=validate.Length(min=2, max=255))
    branch             = fields.Str(load_default=None, validate=validate.Length(min=2, max=50))
    batch_year         = fields.Int(load_default=None, validate=validate.Range(min=2000, max=2100))
    semester           = fields.Int(load_default=None, validate=validate.Range(min=1, max=10))
    cgpa               = fields.Float(load_default=None, validate=validate.Range(min=0.0, max=10.0))
    password           = fields.Str(required=True, validate=validate.Length(min=8, max=128))
    dpdp_consent       = fields.Bool(required=True)

    @validates("password")
    def validate_password_strength(self, value: str) -> None:
        if not any(c.isdigit() for c in value):
            raise ValidationError("Password must contain at least one number.")
        if not any(c.isupper() for c in value):
            raise ValidationError("Password must contain at least one uppercase letter.")

    @validates("dpdp_consent")
    def validate_consent(self, value: bool) -> None:
        if not value:
            raise ValidationError(
                "You must provide consent to process your data under India's DPDP Act to proceed."
            )


# ── Faculty registration (Disabled - Schema kept for reference) ───────────────

class FacultyRegisterSchema(Schema):
    """A4 — POST /auth/register/faculty — disabled."""
    class Meta:
        unknown = RAISE

    email       = fields.Email(required=True)
    employee_id = fields.Str(required=True, validate=validate.Length(min=3, max=30))
    full_name   = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    department  = fields.Str(required=True, validate=validate.Length(min=2, max=50))
    designation = fields.Str(required=True, validate=validate.Length(min=2, max=100))
    password    = fields.Str(required=True, validate=validate.Length(min=8, max=128))


class TPORegisterSchema(Schema):
    class Meta:
        unknown = RAISE

    email     = fields.Email(required=True)
    full_name = fields.Str(required=True, validate=validate.Length(min=2, max=255))
    phone     = fields.Str(allow_none=True)
    password  = fields.Str(required=True, validate=validate.Length(min=8, max=128))



# ── Invite accept ─────────────────────────────────────────────────────────────

class InviteAcceptSchema(Schema):
    """A5 — POST /auth/invite/accept"""
    class Meta:
        unknown = RAISE

    token       = fields.Str(required=True)
    password    = fields.Str(required=True, validate=validate.Length(min=8, max=128))
    full_name   = fields.Str(load_default=None, validate=validate.Length(min=2, max=255))
    employee_id = fields.Str(load_default=None, validate=validate.Length(min=3, max=30))
    department  = fields.Str(load_default=None, validate=validate.Length(min=2, max=50))
    designation = fields.Str(load_default=None, validate=validate.Length(min=2, max=100))

    @validates("password")
    def validate_password_strength(self, value: str) -> None:
        if not any(c.isdigit() for c in value):
            raise ValidationError("Password must contain at least one number.")
        if not any(c.isupper() for c in value):
            raise ValidationError("Password must contain at least one uppercase letter.")


# ── Login ─────────────────────────────────────────────────────────────────────

class LoginSchema(Schema):
    """
    A6 — POST /auth/login
    Accepts either roll_no (student) or email (staff).
    Exactly one of roll_no or email must be present.
    """
    class Meta:
        unknown = RAISE

    roll_no  = fields.Str(load_default=None)
    email    = fields.Email(load_default=None)
    password = fields.Str(required=True, validate=validate.Length(min=1, max=128))

    @validates_schema
    def validate_identifier(self, data: dict, **kwargs) -> None:
        has_roll = bool(data.get("roll_no"))
        has_email = bool(data.get("email"))
        if not has_roll and not has_email:
            raise ValidationError("Provide either 'roll_no' or 'email' to log in.")
        if has_roll and has_email:
            raise ValidationError("Provide either 'roll_no' or 'email', not both.")


# ── Token refresh ─────────────────────────────────────────────────────────────

class TokenRefreshSchema(Schema):
    """A7 — POST /auth/token/refresh"""
    class Meta:
        unknown = RAISE

    refresh_token = fields.Str(required=True)


# ── Password change ───────────────────────────────────────────────────────────

class PasswordChangeSchema(Schema):
    """A9 — POST /auth/password/change"""
    class Meta:
        unknown = RAISE

    current_password = fields.Str(required=True)
    new_password     = fields.Str(required=True, validate=validate.Length(min=8, max=128))

    @validates("new_password")
    def validate_new_password_strength(self, value: str) -> None:
        if not any(c.isdigit() for c in value):
            raise ValidationError("Password must contain at least one number.")
        if not any(c.isupper() for c in value):
            raise ValidationError("Password must contain at least one uppercase letter.")

    @validates_schema
    def validate_not_same(self, data: dict, **kwargs) -> None:
        if data.get("current_password") == data.get("new_password"):
            raise ValidationError("New password must differ from the current password.")


# ── Response schemas (what goes back to the client) ───────────────────────────
# These whitelist exactly the fields the client is allowed to see.
# No password_hash, no OTP hash, no refresh token values, no internal flags.

class TokenResponseSchema(Schema):
    """Returned by login and token refresh."""
    access_token  = fields.Str()
    refresh_token = fields.Str()
    role          = fields.Str()
    user_id       = fields.Str()

class MessageResponseSchema(Schema):
    """Generic success message."""
    message = fields.Str()
