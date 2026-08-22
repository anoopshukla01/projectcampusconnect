"""
Email Utility — Transactional email delivery for theVidyaverse / CampusConnect.

Provider strategy:
  Primary:  Resend (https://resend.com) — REST API, excellent deliverability,
            free tier sufficient for current scale. No SDK needed; uses `requests`.
  Fallback: SMTP (Gmail / any SMTP server) — used if RESEND_API_KEY is not set.

Public interface (provider-agnostic):
  send_email(to, subject, html_body, text_body) → bool
  send_otp_email(to_email, otp)                 → bool
  send_invite_email(...)                         → bool

Config keys consumed:
  RESEND_API_KEY          — Resend secret key (starts with "re_")
  RESEND_FROM_EMAIL       — Verified sender, e.g. "noreply@thevidyaverse.com"
  LOCAL_DEV_EMAIL_REDIRECT — If set, ALL emails go to this address instead of
                             the real recipient. Safe local testing, zero real sends.
  MOCK_OTP                — If True, OTP emails are NOT sent; OTP is logged to console.
  MAIL_SERVER / MAIL_PORT / MAIL_USE_TLS / MAIL_USERNAME / MAIL_PASSWORD / MAIL_DEFAULT_SENDER
                          — SMTP credentials (used as fallback when RESEND_API_KEY absent)

SECURITY NOTES:
  - Never log the raw OTP value in this module (or anywhere outside MOCK_OTP mode).
  - LOCAL_DEV_EMAIL_REDIRECT must NEVER be set in staging or production config.
  - Resend API key must be treated as a secret — stored in env vars, never hard-coded.
"""

import logging
import smtplib
from email.message import EmailMessage

from flask import current_app

logger = logging.getLogger(__name__)


# ── Provider-agnostic public interface ────────────────────────────────────────

def send_email(to: str, subject: str, html_body: str, text_body: str) -> bool:
    """
    Send a transactional email to `to` with the given subject and body.

    Respects LOCAL_DEV_EMAIL_REDIRECT: if set, the real recipient is replaced
    with the redirect address (safe for local testing).

    Tries Resend first; falls back to SMTP if RESEND_API_KEY is not configured.

    Returns True on success, False on failure (never raises).
    """
    # ── Local dev redirect ────────────────────────────────────────────────────
    redirect = current_app.config.get("LOCAL_DEV_EMAIL_REDIRECT", "").strip()
    effective_to = redirect if redirect else to

    if redirect:
        logger.info(
            "📧 LOCAL_DEV_EMAIL_REDIRECT active — redirecting email from %s to %s",
            to, effective_to,
        )

    api_key = current_app.config.get("RESEND_API_KEY", "").strip()
    if api_key:
        success = _send_via_resend(
            to=effective_to,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            api_key=api_key,
        )
        if success:
            return True
        logger.warning("⚠️ Resend delivery failed. Falling back to SMTP dispatch...")

    # SMTP fallback (Gmail / custom SMTP)
    return _send_via_smtp(
        to=effective_to,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
    )


# ── OTP email ─────────────────────────────────────────────────────────────────

def send_otp_email(to_email: str, otp: str) -> bool:
    """
    Send a 6-digit OTP verification email for the student claim flow.

    In MOCK_OTP mode (development/testing), logs to console and returns True
    WITHOUT sending any real email. The raw OTP is ONLY logged in mock mode.

    Never logs the raw OTP in non-mock mode.
    """
    # Mock mode — no real send; safe to log OTP value here only
    if current_app.config.get("MOCK_OTP", False):
        logger.warning(
            "⚠️  MOCK OTP (development only) — email=%s  OTP=%s  "
            "(This message never appears in non-mock mode)",
            to_email, otp,
        )
        return True

    expiry_minutes = current_app.config.get("OTP_EXPIRY_MINUTES", 5)

    subject = "Your theVidyaverse verification code"

    text_body = (
        f"Hi,\n\n"
        f"Your verification code is: {otp}\n\n"
        f"This code expires in {expiry_minutes} minutes. "
        f"If you didn't request this, you can ignore this email.\n\n"
        f"— theVidyaverse"
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {{
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #0f172a;
      color: #f8fafc;
      margin: 0;
      padding: 24px;
    }}
    .card {{
      max-width: 480px;
      margin: 0 auto;
      background-color: #1e293b;
      border-radius: 16px;
      padding: 32px;
      border: 1px solid #334155;
    }}
    .brand {{
      font-size: 13px;
      color: #6366f1;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 24px;
    }}
    .headline {{
      font-size: 18px;
      font-weight: 600;
      color: #f1f5f9;
      margin: 0 0 8px 0;
    }}
    .sub {{
      font-size: 14px;
      color: #94a3b8;
      margin: 0 0 28px 0;
    }}
    .otp-box {{
      font-size: 36px;
      font-weight: 700;
      letter-spacing: 10px;
      color: #818cf8;
      background: #0f172a;
      padding: 16px 24px;
      border-radius: 10px;
      text-align: center;
      margin: 0 0 24px 0;
      border: 1px solid #334155;
    }}
    .expiry {{
      font-size: 13px;
      color: #64748b;
      text-align: center;
      margin-bottom: 28px;
    }}
    .footer {{
      font-size: 12px;
      color: #475569;
      border-top: 1px solid #334155;
      padding-top: 20px;
      margin-top: 8px;
    }}
  </style>
</head>
<body>
  <div class="card">
    <p class="brand">theVidyaverse</p>
    <h2 class="headline">Your verification code</h2>
    <p class="sub">Enter this code to verify your identity and activate your account.</p>
    <div class="otp-box">{otp}</div>
    <p class="expiry">⏱ Expires in {expiry_minutes} minutes &nbsp;·&nbsp; Do not share this code</p>
    <div class="footer">
      <p>If you didn't request this code, you can safely ignore this email.<br>
      — theVidyaverse Team</p>
    </div>
  </div>
</body>
</html>"""

    success = send_email(
        to=to_email,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
    )

    if success:
        # Log delivery confirmation — DO NOT include the OTP value here
        logger.info("✅ OTP email dispatched to %s", to_email)
    else:
        logger.error("❌ OTP email delivery failed for %s", to_email)

    return success


# ── Invite email ──────────────────────────────────────────────────────────────

def send_invite_email(
    to_email: str,
    invite_link: str,
    invited_by_name: str,
    role_name: str,
    college_name: str,
    expiry_hours: int = 48,
) -> bool:
    """
    Send a role invitation email.
    Prefers Resend if RESEND_API_KEY is configured; falls back to SMTP.
    Returns True if sent successfully, False otherwise.
    """
    subject = f"Invitation to join {college_name} as {role_name}"

    text_body = (
        f"Hello,\n\n"
        f"You have been invited by {invited_by_name} to join {college_name} "
        f"on theVidyaverse as a {role_name}.\n\n"
        f"To accept your invitation and activate your account, open the link below:\n"
        f"{invite_link}\n\n"
        f"Note: This link is valid for {expiry_hours} hours.\n\n"
        f"If you did not expect this invitation, you can safely ignore this email.\n\n"
        f"Best regards,\n{college_name} Team"
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }}
    .card {{ max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; padding: 32px; border: 1px solid #334155; }}
    .title {{ font-size: 20px; font-weight: 700; color: #6366f1; margin-top: 0; }}
    .btn {{ display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
    .footer {{ font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="card">
    <h2 class="title">theVidyaverse Invitation</h2>
    <p>Hello,</p>
    <p><strong>{invited_by_name}</strong> has invited you to join <strong>{college_name}</strong> as a <strong>{role_name}</strong>.</p>
    <p style="text-align: center;">
      <a href="{invite_link}" class="btn">Accept Invitation &amp; Activate Account</a>
    </p>
    <p style="font-size: 13px; color: #cbd5e1;">Or paste this link into your browser:<br>
      <a href="{invite_link}" style="color: #818cf8; word-break: break-all;">{invite_link}</a>
    </p>
    <p style="font-size: 13px; color: #94a3b8;">This link will expire in {expiry_hours} hours.</p>
    <div class="footer">
      <p>{college_name} &bull; theVidyaverse</p>
    </div>
  </div>
</body>
</html>"""

    return send_email(
        to=to_email,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
    )


# ── Private provider implementations ─────────────────────────────────────────

def _send_via_resend(
    to: str, subject: str, html_body: str, text_body: str, api_key: str
) -> bool:
    """
    Send email via Resend REST API (https://resend.com/docs/api-reference/emails/send).
    Uses `requests` which is already in requirements.txt — no new dependency.
    """
    import requests

    from_email = (
        current_app.config.get("RESEND_FROM_EMAIL", "").strip()
        or current_app.config.get("EMAIL_FROM", "").strip()
        or "Campus Connect <onboarding@resend.dev>"
    )

    payload = {
        "from": from_email,
        "to": [to],
        "subject": subject,
        "html": html_body,
        "text": text_body,
    }

    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15,
        )
        if resp.status_code >= 400:
            logger.error("❌ Resend API error (%s): %s", resp.status_code, resp.text)
            return False

        res_json = resp.json()
        if res_json and "id" in res_json:
            logger.info("✅ Resend delivery confirmed — id=%s to=%s", res_json.get("id"), to)
            return True
        logger.warning("⚠️ Resend unexpected response payload: %s", res_json)
        return False
    except Exception as exc:
        logger.error("❌ Resend API exception: %s: %s", type(exc).__name__, exc)
        return False


def _send_via_smtp(
    to: str, subject: str, html_body: str, text_body: str
) -> bool:
    """
    Send email via SMTP (Gmail or any SMTP server).
    Used as a fallback when RESEND_API_KEY is not set or fails.
    """
    server_host = current_app.config.get("MAIL_SERVER", "smtp.gmail.com")
    server_port = int(current_app.config.get("MAIL_PORT", 587))
    use_tls     = current_app.config.get("MAIL_USE_TLS", True)
    username    = str(current_app.config.get("MAIL_USERNAME", "")).strip()
    password    = str(current_app.config.get("MAIL_PASSWORD", "")).strip()
    sender      = str(current_app.config.get("MAIL_DEFAULT_SENDER", "")).strip() or username or "Campus Connect <noreply@campusconnect.edu>"

    if isinstance(use_tls, str):
        use_tls = use_tls.lower() == "true"

    if not username or not password:
        logger.warning(
            "⚠️ Neither valid RESEND_API_KEY nor SMTP credentials (MAIL_USERNAME/MAIL_PASSWORD) "
            "are configured. Email to %s was NOT sent.", to
        )
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"]    = sender
    msg["To"]      = to
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    try:
        if server_port == 465 or not use_tls:
            server = smtplib.SMTP_SSL(server_host, server_port, timeout=15)
            server.ehlo()
        else:
            server = smtplib.SMTP(server_host, server_port, timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()

        server.login(username, password)
        server.send_message(msg)
        server.quit()
        logger.info("✅ Email successfully sent via SMTP to %s", to)
        return True
    except Exception as exc:
        logger.error("❌ SMTP delivery failed to %s: %s: %s", to, type(exc).__name__, exc)
        return False
