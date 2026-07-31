"""
Email Utility — Send transactional & invitation emails via SMTP.

Configured via environment variables / app config:
  - MAIL_SERVER         (default: smtp.gmail.com)
  - MAIL_PORT           (default: 587)
  - MAIL_USE_TLS        (default: true)
  - MAIL_USERNAME       (SMTP login email)
  - MAIL_PASSWORD       (SMTP app password / API key)
  - MAIL_DEFAULT_SENDER (sender email)
"""

import logging
import smtplib
from email.message import EmailMessage
from flask import current_app

logger = logging.getLogger(__name__)


def send_invite_email(
    to_email: str,
    invite_link: str,
    invited_by_name: str,
    role_name: str,
    college_name: str,
    expiry_hours: int = 48,
) -> bool:
    """
    Send a role invitation email via SMTP.
    Returns True if sent successfully, False otherwise.
    """
    server_host = current_app.config.get("MAIL_SERVER", "smtp.gmail.com")
    server_port = int(current_app.config.get("MAIL_PORT", 587))
    use_tls     = current_app.config.get("MAIL_USE_TLS", True)
    username    = current_app.config.get("MAIL_USERNAME", "")
    password    = current_app.config.get("MAIL_PASSWORD", "")
    sender      = current_app.config.get("MAIL_DEFAULT_SENDER", "") or username

    if isinstance(use_tls, str):
        use_tls = use_tls.lower() == "true"
    username = str(current_app.config.get("MAIL_USERNAME", "")).strip()
    password = str(current_app.config.get("MAIL_PASSWORD", "")).strip()
    sender   = str(current_app.config.get("MAIL_DEFAULT_SENDER", "")).strip() or username

    if not username or not password:
        logger.warning(
            "⚠️ MAIL_USERNAME / MAIL_PASSWORD not configured. Invite email to %s not sent via SMTP.\nLink: %s",
            to_email, invite_link
        )
        return False

    msg = EmailMessage()
    msg["Subject"] = f"Invitation to join {college_name} as {role_name}"
    msg["From"]    = sender
    msg["To"]      = to_email

    body_text = f"""Hello,

You have been invited by {invited_by_name} to join {college_name} on CampusConnect as a {role_name}.

To accept your invitation and activate your account, open the link below:
{invite_link}

Note: This link is valid for {expiry_hours} hours.

If you did not expect this invitation, you can safely ignore this email.

Best regards,
{college_name} Team
"""

    html_content = f"""<!DOCTYPE html>
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
    <h2 class="title">CampusConnect Invitation</h2>
    <p>Hello,</p>
    <p><strong>{invited_by_name}</strong> has invited you to join <strong>{college_name}</strong> as a <strong>{role_name}</strong>.</p>
    <p style="text-align: center;">
      <a href="{invite_link}" class="btn">Accept Invitation & Activate Account</a>
    </p>
    <p style="font-size: 13px; color: #cbd5e1;">Or paste this link into your browser:<br>
      <a href="{invite_link}" style="color: #818cf8; word-break: break-all;">{invite_link}</a>
    </p>
    <p style="font-size: 13px; color: #94a3b8;">This link will expire in {expiry_hours} hours.</p>
    <div class="footer">
      <p>{college_name} &bull; CampusConnect System</p>
    </div>
  </div>
</body>
</html>
"""

    msg.set_content(body_text)
    msg.add_alternative(html_content, subtype="html")

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
        logger.info("✅ Invitation email successfully sent to %s via SMTP", to_email)
        return True
    except Exception as exc:
        logger.error("❌ Failed to send invite email to %s via SMTP: %s", to_email, exc)
        return False
