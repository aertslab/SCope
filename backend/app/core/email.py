"""Lightweight email delivery abstraction.

If SMTP_HOST is unset (typical in development) we log emails to the application
logger instead of attempting delivery. This lets the password-reset and
email-verification flows work end-to-end without a real mail server: the URL
appears in the backend logs.

For production, set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD via env. We
keep this intentionally minimal — only plain-text and a tiny HTML wrapper.
"""
from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def _from_address() -> str:
    return settings.SMTP_FROM or settings.SMTP_USER or "no-reply@scope.local"


async def send_email(
    *,
    to: str,
    subject: str,
    text: str,
    html: Optional[str] = None,
) -> None:
    """Send an email or — if SMTP isn't configured — log it.

    Errors are swallowed and logged so that user-triggered flows
    (forgot-password, signup) never leak provider failures to the response.
    """
    if not settings.SMTP_HOST:
        logger.info(
            "[email:dev] to=%s subject=%s\n%s", to, subject, text,
        )
        return

    msg = EmailMessage()
    msg["From"] = _from_address()
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    try:
        # smtplib is sync; the calls here are short, and we don't expect heavy
        # mail volume from interactive flows. Wrap in a thread if that changes.
        if settings.SMTP_TLS:
            context = ssl.create_default_context()
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.starttls(context=context)
                if settings.SMTP_USER:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_USER:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
                server.send_message(msg)
    except Exception:  # pragma: no cover — depends on real SMTP
        logger.exception("Failed to send email to %s (subject=%s)", to, subject)
