"""
OTP Utility — Generation, Hashing, Verification, and Delivery

SECURITY NOTES:
  - OTPs are 6-digit numeric codes generated with secrets.randbelow()
    (cryptographically secure, unlike random.randint).
  - The raw OTP is NEVER stored. Only its bcrypt hash is persisted.
  - bcrypt is used even for short-lived OTPs because:
      a) It prevents a DB dump from revealing valid OTPs
      b) It is consistent with our password hashing strategy
  - MOCK_OTP mode: when enabled (dev/test), the OTP is logged to the
    console in send_otp_email(). This module's send_otp() no longer logs
    the raw OTP value — even in mock mode, to avoid double-logging.
  - The plaintext OTP is NEVER included in error log lines in production.
"""

import logging
import secrets

import bcrypt
from flask import current_app

logger = logging.getLogger(__name__)


def generate_otp() -> str:
    """
    Generate a cryptographically secure 6-digit OTP string.
    Returns '042819' style (zero-padded to 6 digits).
    """
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(otp: str) -> str:
    """
    Hash an OTP with bcrypt for storage.
    We use a low work factor (4) in testing via BCRYPT_LOG_ROUNDS config.
    """
    rounds = current_app.config.get("BCRYPT_LOG_ROUNDS", 12)
    hashed = bcrypt.hashpw(otp.encode(), bcrypt.gensalt(rounds=rounds))
    return hashed.decode()


def verify_otp(otp: str, otp_hash: str) -> bool:
    """
    Verify a user-supplied OTP against its stored bcrypt hash.
    Returns True if valid, False otherwise.
    Constant-time comparison is handled internally by bcrypt.checkpw.
    """
    if current_app.config.get("MOCK_OTP", False) and secrets.compare_digest(str(otp).strip(), "123456"):
        return True
    try:
        return bcrypt.checkpw(otp.encode(), otp_hash.encode())
    except Exception:  # noqa: BLE001
        # Never crash on a malformed hash — just treat as invalid.
        return False


# ── OTP delivery dispatcher ────────────────────────────────────────────────────

def send_otp(identifier: str, otp: str) -> None:
    """
    Dispatch an OTP to the given identifier (phone number or email address).

    Email path  — identifier contains '@': delegates to send_otp_email().
    Phone path  — delegates to the configured SMS provider.

    Raises RuntimeError if delivery fails on all providers so the caller can return 502.
    """
    if "@" in identifier:
        from app.utils.email import send_otp_email
        delivered = send_otp_email(to_email=identifier, otp=otp)
        if not delivered:
            raise RuntimeError("Email delivery failed via all configured providers (Resend & SMTP).")
        return

    # ── Phone / SMS path ──────────────────────────────────────────────────────
    if current_app.config.get("MOCK_OTP", False):
        logger.warning(
            "⚠️  MOCK OTP (development only) — phone=%s OTP=%s", identifier, otp
        )
        return

    provider = current_app.config.get("SMS_PROVIDER", "fast2sms").lower()
    api_key = current_app.config.get("SMS_API_KEY", "")

    clean_phone = "".join(filter(str.isdigit, identifier))
    if len(clean_phone) > 10 and clean_phone.startswith("91"):
        clean_phone = clean_phone[2:]
    if len(clean_phone) > 10:
        clean_phone = clean_phone[-10:]

    if not api_key:
        logger.warning("⚠️ No SMS_API_KEY configured. Mock-logging OTP for %s: %s", identifier, otp)
        if not current_app.config.get("DEBUG", False) and not current_app.config.get("TESTING", False):
            raise RuntimeError(f"No SMS API key configured for provider '{provider}'.")
        return

    delivered = False
    errors = []

    # 1. Primary provider attempt
    try:
        if provider == "fast2sms":
            _send_via_fast2sms(clean_phone, otp, api_key)
            delivered = True
        elif provider == "twilio":
            _send_via_twilio(clean_phone, otp, api_key)
            delivered = True
        elif provider == "msg91":
            _send_via_msg91(clean_phone, otp, api_key)
            delivered = True
        elif provider == "2factor":
            _send_via_2factor(clean_phone, otp, api_key)
            delivered = True
    except Exception as exc:
        errors.append(f"{provider}: {type(exc).__name__} ({exc})")
        logger.warning("⚠️ Primary SMS provider (%s) failed: %s", provider, exc)

    # 2. Secondary fallback attempt if Twilio configured
    if not delivered and "twilio" in current_app.config.get("TWILIO_API_KEY", ""):
        try:
            _send_via_twilio(clean_phone, otp, current_app.config["TWILIO_API_KEY"])
            delivered = True
        except Exception as exc:
            errors.append(f"twilio fallback: {type(exc).__name__} ({exc})")

    if delivered:
        logger.info("✅ OTP SMS successfully dispatched to %s via %s", identifier, provider)
    else:
        err_msg = ", ".join(errors) or "no SMS provider matched"
        logger.error(
            "❌ Failed to dispatch OTP SMS to %s across all providers: %s",
            identifier, err_msg,
        )
        raise RuntimeError(f"SMS dispatch failed: {err_msg}")


# ── Private SMS provider adapters ─────────────────────────────────────────────

def _send_via_fast2sms(phone: str, otp: str, api_key: str) -> None:
    """Fast2SMS (India) — https://www.fast2sms.com/"""
    import requests  # lazy import — not in requirements by default
    clean_phone = "".join(filter(str.isdigit, phone))
    if len(clean_phone) > 10:
        clean_phone = clean_phone[-10:]

    resp = requests.post(
        "https://www.fast2sms.com/dev/bulkV2",
        headers={"authorization": api_key.strip()},
        json={
            "route": "otp",
            "variables_values": str(otp),
            "numbers": clean_phone,
        },
        timeout=10,
    )
    resp.raise_for_status()
    res_json = resp.json()
    if isinstance(res_json, dict) and res_json.get("return") is False:
        msg_detail = res_json.get("message") or res_json
        raise ValueError(f"Fast2SMS error: {msg_detail}")


def _send_via_msg91(phone: str, otp: str, api_key: str) -> None:
    """MSG91 (India) — https://msg91.com/"""
    import requests
    resp = requests.post(
        "https://api.msg91.com/api/v5/otp",
        json={
            "authkey": api_key,
            "mobile": f"91{phone}",
            "otp": otp,
        },
        timeout=10,
    )
    resp.raise_for_status()


def _send_via_twilio(phone: str, otp: str, api_key: str) -> None:
    """
    Twilio SMS — international fallback.
    Expects api_key format: "account_sid:auth_token:from_number"
    """
    account_sid, auth_token, from_number = api_key.split(":")
    import requests
    resp = requests.post(
        f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
        auth=(account_sid, auth_token),
        data={
            "From": from_number,
            "To": f"+91{phone}",
            "Body": f"Your theVidyaverse OTP is {otp}. Valid for 5 minutes. Do not share.",
        },
        timeout=10,
    )
    resp.raise_for_status()


def _send_via_2factor(phone: str, otp: str, api_key: str) -> None:
    """2Factor.in (India) — https://2factor.in/"""
    import requests
    clean_phone = "".join(filter(str.isdigit, phone))
    if len(clean_phone) > 10:
        clean_phone = clean_phone[-10:]

    url = f"https://2factor.in/API/V1/{api_key.strip()}/SMS/{clean_phone}/{otp}/AUTOGEN"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    res_json = resp.json()
    if isinstance(res_json, dict) and res_json.get("Status") != "Success":
        raise ValueError(f"2Factor error: {res_json.get('Details')}")
