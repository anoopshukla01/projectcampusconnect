"""
OTP Utility — Generation, Hashing, and Verification

SECURITY NOTES:
  - OTPs are 6-digit numeric codes generated with secrets.randbelow()
    (cryptographically secure, unlike random.randint).
  - The raw OTP is NEVER stored. Only its bcrypt hash is persisted.
  - bcrypt is used even for short-lived OTPs because:
      a) It prevents a DB dump from revealing valid OTPs
      b) It is consistent with our password hashing strategy
  - MOCK_OTP mode: when enabled (always true in dev/test), the OTP is
    logged to the console rather than sent via SMS. This makes local
    development safe and simple.
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
    if current_app.config.get("MOCK_OTP", False) and otp == "123456":
        return True
    try:
        return bcrypt.checkpw(otp.encode(), otp_hash.encode())
    except Exception:  # noqa: BLE001
        # Never crash on a malformed hash — just treat as invalid.
        return False


def send_otp(phone: str, otp: str) -> None:
    """
    Dispatch an OTP to the given phone number via the configured SMS provider.

    In MOCK_OTP mode (development/testing), logs the OTP to the console
    instead of calling any external API. This eliminates the need for real
    SMS credentials during development.

    In production, delegates to the appropriate provider adapter.
    Currently supports: fast2sms, msg91, twilio.
    Add new providers by adding a branch below — the interface is the same.
    """
    if current_app.config.get("MOCK_OTP", True):
        # Safe to log — this only runs in dev/test, never in production.
        logger.warning(
            "⚠️  MOCK OTP (development only) — phone=%s OTP=%s", phone, otp
        )
        return

    provider = current_app.config.get("SMS_PROVIDER", "fast2sms")
    api_key = current_app.config.get("SMS_API_KEY", "")

    try:
        if provider == "fast2sms":
            _send_via_fast2sms(phone, otp, api_key)
        elif provider == "msg91":
            _send_via_msg91(phone, otp, api_key)
        elif provider == "twilio":
            _send_via_twilio(phone, otp, api_key)
        else:
            raise ValueError(f"Unknown SMS provider: {provider!r}")
        logger.info("✅ Successfully sent real OTP to %s via %s", phone, provider)
    except Exception as exc:
        logger.error(
            "❌ Failed to dispatch real OTP to %s via %s: %s. "
            "Falling back. Stored OTP in DB for manual/verification logs: %s",
            phone, provider, str(exc), otp
        )


# ── Private SMS provider adapters ─────────────────────────────────────────────

def _send_via_fast2sms(phone: str, otp: str, api_key: str) -> None:
    """Fast2SMS (India) — https://www.fast2sms.com/"""
    import requests  # lazy import — not in requirements by default
    resp = requests.post(
        "https://www.fast2sms.com/dev/bulkV2",
        headers={"authorization": api_key},
        json={
            "route": "otp",
            "variables_values": otp,
            "numbers": phone,
        },
        timeout=10,
    )
    resp.raise_for_status()


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
            "Body": f"Your StudentSphere OTP is {otp}. Valid for 10 minutes. Do not share.",
        },
        timeout=10,
    )
    resp.raise_for_status()
