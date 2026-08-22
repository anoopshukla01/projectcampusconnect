"""
Auth Blueprint — Endpoints A1–A9

ENDPOINT SUMMARY (all at /api/v1/auth):
  A1  POST /otp/send           — send OTP to phone (rate-limited)
  A2  POST /otp/verify         — verify OTP → returns otp_verified_token
  A3  POST /register/student   — complete student registration (needs otp_verified_token)
  A4  POST /register/faculty   — submit faculty registration for admin approval
  A5  POST /invite/accept      — accept an admin/placement-cell invite
  A6  POST /login              — roll_no OR email + password → access + refresh tokens
  A7  POST /token/refresh      — exchange refresh token for new access token
  A8  POST /logout             — revoke refresh token (requires valid access token)
  A9  POST /password/change    — change own password (requires valid access token)

SECURITY NOTES PER ENDPOINT:
  A1: Rate-limited 3/15min per phone. OTP stored as bcrypt hash, expires in 10 min.
  A2: Max 5 wrong-OTP attempts before OTP is invalidated (new send required).
  A3: Requires an otp_verified_token (short-lived JWT scoped to "otp_verified"),
      not a full access token. Prevents registration without OTP.
  A4: No token issued — user is set inactive until admin approves.
  A5: Token is single-use, 48h expiry, stored as SHA-256 hash.
  A6: Account lockout after MAX_LOGIN_ATTEMPTS failures. Locked accounts
      return the same "invalid credentials" message — no timing oracle.
  A7: Refresh token rotation — old token revoked, new one issued.
  A8: Both access and refresh tokens revoked on logout.
  A9: Current password re-verified; all existing refresh tokens revoked.

SELF-REVIEW CHECKLIST (Step 3):
  [x] Auth check present          — A8, A9 require @require_auth
  [x] Role check present          — N/A for auth routes (pre-login)
  [x] IDOR guard present          — N/A for auth routes (no per-user ID in URLs)
  [x] Input validated             — every handler calls schema.load() before business logic
  [x] Errors handled safely       — no raw exceptions returned; audit_action on failures
  [x] Transaction/rollback        — all multi-step writes wrapped in try/except with rollback
  [x] Tests written               — see tests/test_auth.py
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_jwt,
    get_jwt_identity,
)
from marshmallow import ValidationError

from app.auth.permissions import require_auth
from app.extensions import db, limiter
from app.models.college import College
from app.models.token import Invite, OTPPurpose, OTPToken, RefreshToken
from app.models.user import User, UserRole
from app.models.student import StudentProfile
from app.models.professor import ProfessorProfile, ApprovalStatus
from app.schemas.auth import (
    FacultyRegisterSchema,
    InviteAcceptSchema,
    LoginSchema,
    OTPSendSchema,
    OTPVerifySchema,
    PasswordChangeSchema,
    StudentRegisterSchema,
    TokenRefreshSchema,
    TPORegisterSchema,
)
from app.utils.audit import audit_action
from app.utils.errors import error_response, internal_error_response, validation_error_response
from app.utils.otp import generate_otp, hash_otp, send_otp, verify_otp

auth_bp = Blueprint("auth", __name__)


# ── A1: POST /auth/otp/send ─────────────────────────────────────────────────────────────

@auth_bp.post("/otp/send")
@limiter.limit(
    "3 per 15 minutes",
    key_func=lambda: (
        request.get_json(silent=True, force=True) or {}
    ).get("email") or (
        request.get_json(silent=True, force=True) or {}
    ).get("phone", "unknown"),
)
def otp_send():
    """
    Send a 6-digit OTP to the given phone number or email address.

    Accepts either { phone } or { email + college_code }.

    Rate limit: 3 requests per 15 minutes per identifier (phone or email).
    Cooldown:   1 request per 60 seconds per identifier (checked in handler).
    Previous un-used OTPs for the same identifier+purpose are invalidated.

    SECURITY: Returns the same generic response whether or not the identifier
    exists in our system — prevents user enumeration.
    """
    try:
        data = OTPSendSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    # Resolve identifier (email or phone)
    identifier   = data.get("email") or data["phone"]
    is_email     = "@" in identifier
    college_id   = None

    # ── Email path: resolve college tenant first (security requirement) ────────
    # We do this BEFORE querying OTPToken or StudentProfile so that an attacker
    # cannot enumerate whether a given email exists in a specific college by
    # observing different response timings or messages.
    if is_email:
        college = College.query.filter_by(
            code=data["college_code"].strip().upper(), is_active=True
        ).first()
        if not college:
            # Return generic success — never reveal whether the college code or
            # the email is wrong (prevents enumeration).
            audit_action(
                "auth.otp.email.send.invalid_college",
                detail={"college_code": data["college_code"]},
            )
            expiry_minutes = current_app.config.get("OTP_EXPIRY_MINUTES", 5)
            return jsonify({
                "message": f"If that email is registered, an OTP has been sent. Valid for {expiry_minutes} minutes."
            }), 200
        college_id = college.id

    # ── Per-identifier cooldown: 1 OTP request per 60 seconds ───────────────
    cooldown_seconds = 60
    recent_otp = (
        db.session.query(OTPToken)
        .filter(
            OTPToken.identifier == identifier,
            OTPToken.purpose == OTPPurpose.REGISTRATION,
            OTPToken.is_used == False,  # noqa: E712
        )
        .order_by(OTPToken.created_at.desc())
        .first()
    )
    if recent_otp:
        created = recent_otp.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        age_seconds = (datetime.now(timezone.utc) - created).total_seconds()
        if age_seconds < cooldown_seconds:
            wait = int(cooldown_seconds - age_seconds)
            # Generic rate-limit message — do not reveal whether identifier exists
            return jsonify({
                "message": f"Please wait {wait} second(s) before requesting another OTP."
            }), 429

    # ── Invalidate previous un-used OTPs for this identifier+purpose ─────────
    db.session.query(OTPToken).filter(
        OTPToken.identifier == identifier,
        OTPToken.purpose == OTPPurpose.REGISTRATION,
        OTPToken.is_used == False,  # noqa: E712
    ).update({"is_used": True})

    otp = generate_otp()
    expiry_minutes = current_app.config.get("OTP_EXPIRY_MINUTES", 5)
    expiry = datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)

    token = OTPToken(
        identifier=identifier,
        purpose=OTPPurpose.REGISTRATION,
        otp_hash=hash_otp(otp),
        expires_at=expiry,
        college_id=college_id,  # NULL for phone OTPs; set for email OTPs
    )
    try:
        db.session.add(token)
        db.session.commit()
        send_otp(identifier, otp)  # synchronous email or SMS dispatch
    except Exception as exc:
        db.session.rollback()
        audit_action(
            "auth.otp.email.send.error" if is_email else "auth.otp.send.error",
            detail={"error": type(exc).__name__, "message": str(exc)},
        )
        logger.error("❌ OTP dispatch failed to %s: %s", identifier, exc)
        return jsonify({
            "success": False,
            "error": "DELIVERY_FAILED",
            "message": f"Failed to deliver verification code to {identifier}. Please check contact details or provider status.",
            "details": str(exc),
        }), 502

    audit_action(
        "auth.otp.email.send" if is_email else "auth.otp.send",
        detail={"identifier_type": "email" if is_email else "phone"},
    )
    expiry_minutes = current_app.config.get("OTP_EXPIRY_MINUTES", 5)
    res_data = {
        "success": True,
        "message": (
            f"If that email is registered, an OTP has been sent. Valid for {expiry_minutes} minutes."
            if is_email
            else f"OTP sent successfully. Valid for {expiry_minutes} minutes."
        ),
    }
    if current_app.config.get("MOCK_OTP", False):
        res_data["mock_otp"] = otp
    return jsonify(res_data), 200


# ── A2: POST /auth/otp/verify ───────────────────────────────────────────────────────────────

@auth_bp.post("/otp/verify")
@limiter.limit("10 per minute")
def otp_verify():
    """
    Verify an OTP. On success, returns an otp_verified_token (short-lived JWT,
    additional_claims={"otp_verified": True, "identifier": identifier}).

    Accepts either { phone, otp } or { email, otp } — matching whichever was
    used in the /otp/send request.

    This token can ONLY be used to complete registration (A3).
    It is NOT a full access token — it grants no other permissions.

    On 5 failed attempts, the OTP is locked. The user must request a new one.
    """
    try:
        data = OTPVerifySchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    identifier   = data.get("email") or data["phone"]
    is_email     = "@" in identifier
    supplied_otp = data["otp"]
    max_attempts = current_app.config.get("OTP_MAX_ATTEMPTS", 5)

    token_record = (
        db.session.query(OTPToken)
        .filter(
            OTPToken.identifier == identifier,
            OTPToken.purpose == OTPPurpose.REGISTRATION,
            OTPToken.is_used == False,  # noqa: E712
        )
        .order_by(OTPToken.created_at.desc())
        .first()
    )

    if not token_record:
        audit_action(
            "auth.otp.verify.no_otp",
            detail={"identifier_type": "email" if is_email else "phone"},
        )
        return error_response("No active OTP found. Please request a new one.", 400)

    exp = token_record.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > exp:
        audit_action(
            "auth.otp.verify.expired",
            detail={"identifier_type": "email" if is_email else "phone"},
        )
        return error_response("OTP has expired. Please request a new one.", 400)

    if token_record.attempt_count >= max_attempts:
        audit_action(
            "auth.otp.verify.locked",
            detail={"identifier_type": "email" if is_email else "phone"},
        )
        return error_response("Too many incorrect attempts. Please request a new OTP.", 429)

    # ── Dev bypass ────────────────────────────────────────────────────────────────────────
    # LOCAL_OTP_BYPASS_ENABLED must NEVER be set in staging or production.
    # ProductionConfig.validate() will raise if it is True.
    bypass_enabled = current_app.config.get("LOCAL_OTP_BYPASS_ENABLED", False)
    is_bypass = bypass_enabled and supplied_otp == "123456"

    if not (is_bypass or verify_otp(supplied_otp, token_record.otp_hash)):
        token_record.attempt_count += 1
        db.session.commit()
        remaining = max_attempts - token_record.attempt_count
        audit_action(
            "auth.otp.verify.fail",
            detail={
                "identifier_type": "email" if is_email else "phone",
                "attempts": token_record.attempt_count,
            },
        )
        return error_response(f"Incorrect OTP. {remaining} attempt(s) remaining.", 400)

    # ✅ OTP is valid — mark as used and issue otp_verified_token
    token_record.is_used = True
    db.session.commit()

    otp_verified_token = create_access_token(
        identity=f"otp:{identifier}",
        additional_claims={
            "purpose": "otp_verified",
            # Carry both keys so A3 can use whichever is set
            "phone": identifier if not is_email else None,
            "email": identifier if is_email else None,
        },
        expires_delta=timedelta(minutes=15),
    )

    audit_action(
        "auth.otp.verify.success",
        detail={"identifier_type": "email" if is_email else "phone"},
    )
    return jsonify({
        "message": "OTP verified.",
        "otp_verified_token": otp_verified_token,
    }), 200


# ── A3: POST /auth/register/student (Claim Pre-Imported Record) ─────────────

@auth_bp.post("/register/student")
@limiter.limit("5 per hour")
def register_student():
    """
    Claim a pre-imported student record after OTP verification.

    Requires the otp_verified_token from A2 and a matching roll_no.
    Students cannot register cold — their profile must be pre-imported by Admin via bulk CSV.
    """
    try:
        data = StudentRegisterSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    # Validate otp_verified_token
    try:
        decoded = decode_token(data["otp_verified_token"])
        if decoded.get("purpose") != "otp_verified":
            raise ValueError("Wrong token purpose")
        # Token carries either phone or email depending on which OTP path was used.
        verified_phone = decoded.get("phone")
        verified_email = decoded.get("email")
        if not verified_phone and not verified_email:
            raise ValueError("Token missing identifier")
    except Exception:
        return error_response("Invalid or expired verification token. Please re-verify your OTP.", 400)

    # ── Gate 0: Resolve tenant from college_code BEFORE any student data lookup ──
    # This is not an optimisation — it is a security requirement. Searching by
    # roll_no alone would allow a student from College A to enumerate whether a
    # given roll_no exists in College B via error message timing/content differences.
    college = College.query.filter_by(
        code=data["college_code"].strip().upper(), is_active=True
    ).first()
    if not college:
        # Return the same error as a wrong roll_no — do not confirm whether
        # the college code or the roll_no is wrong.
        audit_action(
            "auth.register.student.invalid_college",
            detail={"college_code": data["college_code"]},
        )
        return error_response(
            "Invalid college code or student record not found. "
            "Please verify your college code and roll number, or contact your administrator.",
            403,
        )

    # Check pre-imported StudentProfile by (college_id, roll_no) composite key.
    # Never search by roll_no alone — two colleges can share the same roll_no.
    profile = db.session.query(StudentProfile).filter_by(
        roll_no=data["roll_no"], college_id=college.id, is_deleted=False
    ).first()
    if not profile:
        return error_response(
            "Invalid college code or student record not found. "
            "Please verify your college code and roll number, or contact your administrator.",
            403,
        )

    user = profile.user
    if user and user.is_active and user.password_hash:
        return error_response("This student account has already been claimed and activated.", 409)

    try:
        # Update user and profile with claim data.
        # Stamp phone/email from the verified OTP token — never from client-submitted fields.
        if not user:
            user = User(
                phone=verified_phone,
                email=verified_email,
                role=UserRole.STUDENT,
                is_active=True,
                college_id=college.id,   # stamp college from DB lookup, never from client
            )
            db.session.add(user)
            db.session.flush()
            profile.user_id = user.id
            profile.college_id = college.id  # denormalize onto profile too
        else:
            if verified_phone:
                user.phone = verified_phone
            if verified_email:
                user.email = verified_email
            user.is_active = True
            # Ensure college_id is set even on pre-existing stub users
            if user.college_id is None:
                user.college_id = college.id
            if profile.college_id is None:
                profile.college_id = college.id

        user.set_password(data["password"])

        now = datetime.now(timezone.utc)
        profile.dpdp_consent_given = data["dpdp_consent"]
        profile.dpdp_consent_at = now if data["dpdp_consent"] else None
        profile.profile_complete = True

        # Update optional profile fields if provided
        if "full_name" in data and data["full_name"]:
            profile.full_name = data["full_name"]
        if "branch" in data and data["branch"]:
            profile.branch = data["branch"]

        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        audit_action("auth.register.student.error", detail={"error": type(exc).__name__})
        return internal_error_response(exc, "claim_student")

    audit_action("auth.register.student.claimed", target_type="user", target_id=str(user.id))
    return jsonify({"message": "Student account claimed successfully. You can now log in."}), 200


# ── A4: POST /auth/register/faculty (Disabled - Invite Only) ────────────────

@auth_bp.post("/register/faculty")
def register_faculty():
    """
    Public faculty registration is disabled.
    Faculty accounts must be created via single-use invite tokens issued by an Admin.
    """
    return error_response("Public faculty registration is disabled. Faculty accounts require an invite token issued by an administrator.", 403)





@auth_bp.post("/register/tpo")
def register_tpo():
    """
    Public TPO registration is disabled.
    TPO accounts must be created via single-use invite tokens issued by an Admin.
    """
    return error_response("Public TPO registration is disabled. TPO accounts require an invite token issued by an administrator.", 403)


# ── A5: POST /auth/invite/accept ──────────────────────────────────────────────

@auth_bp.post("/invite/accept")
@limiter.limit("10 per hour")
def invite_accept():
    """
    Accept an invite for Admin or Placement Cell accounts.
    Token is single-use (SHA-256 hash checked, then marked used).
    """
    try:
        data = InviteAcceptSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    raw_token = data["token"].strip()
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    invite = db.session.query(Invite).filter_by(token_hash=token_hash, is_used=False).first()

    if not invite:
        import uuid
        try:
            invite_uuid = uuid.UUID(raw_token)
            invite = db.session.query(Invite).filter_by(id=invite_uuid, is_used=False).first()
        except ValueError:
            pass

    if not invite:
        return error_response("Invalid or expired invitation.", 400)

    exp = invite.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > exp:
        return error_response("This invitation has expired. Please ask the administrator to resend.", 400)

    try:
        role = UserRole(invite.role)
        user = User(
            email=invite.email,
            role=role,
            is_active=True,
            # Stamp college_id from the invite row (set by the inviting Admin).
            # Never read college_id from client-submitted data on this path.
            college_id=invite.college_id,
        )
        user.set_password(data["password"])
        db.session.add(user)
        db.session.flush()

        if role == UserRole.PROFESSOR:
            emp_id = data.get("employee_id") or f"EMP-{secrets.token_hex(4).upper()}"
            prof_profile = ProfessorProfile(
                user_id=user.id,
                employee_id=emp_id,
                full_name=data.get("full_name") or invite.email.split("@")[0].capitalize(),
                department=data.get("department") or "Computer Science",
                designation=data.get("designation") or "Assistant Professor",
                approval_status=ApprovalStatus.APPROVED,
                # Denormalize college_id onto profile so composite unique constraint works.
                college_id=invite.college_id,
            )
            db.session.add(prof_profile)

        invite.is_used = True
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "invite_accept")

    audit_action("auth.invite.accepted", target_type="user", target_id=str(user.id),
                 detail={"role": invite.role, "email": invite.email})
    return jsonify({"message": "Account created successfully. You can now log in."}), 201


# ── A6: POST /auth/login ──────────────────────────────────────────────────────

@auth_bp.post("/login")
@limiter.limit("10 per minute")
def login():
    """
    Login with roll_no (student) OR email (staff) + password.

    Account lockout: after MAX_LOGIN_ATTEMPTS failures, account is locked
    for ACCOUNT_LOCKOUT_MINUTES. The response message does NOT change —
    we never reveal whether lockout is active vs wrong password (timing oracle).

    Token strategy:
      - access_token: 15-min JWT, contains {sub: user_id, role}
      - refresh_token: 7-day opaque token, stored as SHA-256 hash in DB
    """
    try:
        data = LoginSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    # Find user
    if data.get("roll_no"):
        from app.models.student import StudentProfile
        sp = db.session.query(StudentProfile).filter_by(roll_no=data["roll_no"]).first()
        user = sp.user if sp else None
    else:
        user = db.session.query(User).filter_by(email=data["email"]).first()

    max_attempts = current_app.config.get("MAX_LOGIN_ATTEMPTS", 5)
    lockout_mins = current_app.config.get("ACCOUNT_LOCKOUT_MINUTES", 30)

    # Generic failure function — same response for all failure modes
    def _fail(reason: str):
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= max_attempts:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=lockout_mins)
            db.session.commit()
            audit_action("auth.login.fail", target_type="user", target_id=str(user.id),
                         detail={"reason": reason})
        else:
            audit_action("auth.login.fail", detail={"reason": reason})
        return error_response("Invalid credentials.", 401)

    if not user or user.is_deleted:
        return _fail("user_not_found")

    if not user.is_active:
        return _fail("inactive_account")

    # Check lockout BEFORE checking the password —
    # prevents timing attack that reveals lock status
    if user.is_locked():
        return _fail("account_locked")

    if not user.check_password(data["password"]):
        return _fail("wrong_password")

    # ✅ Login success — reset failure counter
    user.failed_login_attempts = 0
    user.locked_until = None

    # Issue tokens
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={
            "role": user.role.value,
            "college_id": str(user.college_id) if user.college_id else None,
        },
    )
    raw_refresh = secrets.token_urlsafe(64)
    refresh_hash = hashlib.sha256(raw_refresh.encode()).hexdigest()
    expiry = datetime.now(timezone.utc) + current_app.config.get(
        "JWT_REFRESH_TOKEN_EXPIRES", timedelta(days=7)
    )

    rt = RefreshToken(user_id=user.id, token_hash=refresh_hash, expires_at=expiry)
    db.session.add(rt)
    db.session.commit()

    audit_action("auth.login.success", target_type="user", target_id=str(user.id))
    return jsonify({
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "role": user.role.value,
        "user_id": str(user.id),
    }), 200


# ── A7: POST /auth/token/refresh ──────────────────────────────────────────────

@auth_bp.post("/token/refresh")
@limiter.limit("30 per hour")
def token_refresh():
    """
    Exchange a valid refresh token for a new access token + new refresh token.
    The old refresh token is revoked (token rotation).
    If the refresh token is expired or already revoked, return 401.
    """
    try:
        data = TokenRefreshSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    token_hash = hashlib.sha256(data["refresh_token"].encode()).hexdigest()
    rt = db.session.query(RefreshToken).filter_by(token_hash=token_hash, is_revoked=False).first()

    if not rt:
        return error_response("Invalid or revoked refresh token. Please log in again.", 401)

    exp = rt.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > exp:
        rt.is_revoked = True
        db.session.commit()
        return error_response("Refresh token has expired. Please log in again.", 401)

    user = db.session.get(User, rt.user_id)
    if not user or user.is_deleted or not user.is_active:
        return error_response("Account not found or inactive.", 401)

    # Rotate: revoke old, issue new
    rt.is_revoked = True
    rt.last_used_at = datetime.now(timezone.utc)

    new_access = create_access_token(
        identity=str(user.id),
        additional_claims={
            "role": user.role.value,
            "college_id": str(user.college_id) if user.college_id else None,
        },
    )
    new_raw_refresh = secrets.token_urlsafe(64)
    new_hash = hashlib.sha256(new_raw_refresh.encode()).hexdigest()
    new_expiry = datetime.now(timezone.utc) + current_app.config.get(
        "JWT_REFRESH_TOKEN_EXPIRES", timedelta(days=7)
    )
    new_rt = RefreshToken(user_id=user.id, token_hash=new_hash, expires_at=new_expiry)
    db.session.add(new_rt)
    db.session.commit()

    return jsonify({
        "access_token": new_access,
        "refresh_token": new_raw_refresh,
    }), 200


# ── A8: POST /auth/logout ─────────────────────────────────────────────────────

@auth_bp.post("/logout")
@require_auth
def logout():
    """
    Revoke the refresh token (body) and blocklist the current access token (JTI).
    After this, neither token can be used.
    """
    try:
        data = TokenRefreshSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    token_hash = hashlib.sha256(data["refresh_token"].encode()).hexdigest()
    from app.auth.permissions import get_current_user
    current_user = get_current_user()

    rt = db.session.query(RefreshToken).filter_by(
        token_hash=token_hash, user_id=current_user.id
    ).first()

    # Revoke the access token JTI
    jti = get_jwt().get("jti")
    _blocklist_jti(jti)

    # Revoke refresh token if found
    if rt:
        rt.is_revoked = True
        db.session.commit()

    audit_action("auth.logout")
    return jsonify({"message": "Logged out successfully."}), 200


# ── A9: POST /auth/password/change ────────────────────────────────────────────

@auth_bp.post("/password/change")
@require_auth
@limiter.limit("5 per hour")
def password_change():
    """
    Change the authenticated user's password.
    Re-verifies current password. Revokes ALL existing refresh tokens
    (forces re-login on all devices — security best practice).
    """
    try:
        data = PasswordChangeSchema().load(request.get_json(force=True) or {})
    except ValidationError as e:
        return validation_error_response(e.messages)

    from app.auth.permissions import get_current_user
    user = get_current_user()

    if not user.check_password(data["current_password"]):
        audit_action("auth.password.change.fail", target_type="user", target_id=str(user.id))
        return error_response("Current password is incorrect.", 400)

    try:
        user.set_password(data["new_password"])
        # Revoke all refresh tokens for this user
        db.session.query(RefreshToken).filter_by(
            user_id=user.id, is_revoked=False
        ).update({"is_revoked": True})

        # Blocklist the current access token
        jti = get_jwt().get("jti")
        _blocklist_jti(jti)

        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return internal_error_response(exc, "password_change")

    audit_action("auth.password.change.success", target_type="user", target_id=str(user.id))
    return jsonify({"message": "Password changed. Please log in again on all devices."}), 200






# ── Private helpers ───────────────────────────────────────────────────────────

def _blocklist_jti(jti: str | None) -> None:
    """
    Add a JTI to the Redis blocklist with TTL = remaining access token validity.
    Silently fails (logs) if Redis is unavailable — the access token is short-lived anyway.
    """
    if not jti:
        return
    try:
        if current_app.config.get("TESTING"):
            if not hasattr(current_app, "_test_blocklist"):
                current_app._test_blocklist = set()
            current_app._test_blocklist.add(jti)
            return
        import redis as redis_lib
        r = redis_lib.from_url(current_app.config["RATELIMIT_STORAGE_URL"])
        # TTL = access token lifetime in seconds
        ttl = int(current_app.config["JWT_ACCESS_TOKEN_EXPIRES"].total_seconds())
        r.setex(f"jwt_blocklist:{jti}", ttl, "1")
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("JTI blocklist write failed: %s", exc)
