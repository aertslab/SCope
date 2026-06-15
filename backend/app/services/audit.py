"""Audit logging helper.

Endpoints call ``record_audit`` after a successful state change. The helper
flushes (not commits) so it participates in the caller's transaction — if
the caller rolls back, the audit row goes with it. Failures inside this
helper are *swallowed and logged* so that a logging bug never blocks a
real user action.
"""

from __future__ import annotations

import logging
from typing import Any, Mapping, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)


async def record_audit(
    db: AsyncSession,
    *,
    actor: Optional[User],
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str | UUID] = None,
    extra: Optional[Mapping[str, Any]] = None,
) -> None:
    try:
        entry = AuditLog(
            actor_id=actor.id if actor else None,
            actor_email=actor.email if actor else None,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            extra=dict(extra) if extra else None,
        )
        db.add(entry)
        await db.flush()
    except Exception:
        logger.exception("Failed to record audit entry action=%s", action)
