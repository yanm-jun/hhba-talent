"""Employee feedback privacy policies. No direct identity or raw comment publication.

All identity/employment verification MUST come from an independent trusted
server-side resolver, NOT from an employer's claim or a browser header.
'Pseudonymous' != 'anonymous': operators need retention/access safeguards.
"""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException

MIN_PUBLIC_RESPONSES = 10
TICKET_TTL_HOURS = 24
DIMENSIONS = ("pay", "insurance", "rest", "respect", "development")
_PERIOD = re.compile(r"^20[2-9][0-9]-Q[1-4]$")
_TOKEN = re.compile(r"^[a-f0-9]{64}$")


@dataclass(frozen=True)
class EmployeeActor:
    """Produced by trusted verified session resolver, never by request JSON."""
    user_id: str


def org_uuid(value: str) -> UUID:
    try:
        return UUID(value)
    except (ValueError, TypeError):
        raise HTTPException(404, detail="ORGANIZATION_NOT_FOUND")


def current_period(now: datetime | None = None) -> str:
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    return f"{now.year}-Q{1 + (now.month - 1) // 3}"


def completed_period(period: str, now: datetime | None = None) -> bool:
    if not _PERIOD.fullmatch(period):
        raise HTTPException(422, detail="INVALID_PERIOD")
    year = int(period[:4])
    quarter = int(period[-1])
    return year * 4 + quarter < int(current_period(now)[:4]) * 4 + int(current_period(now)[-1])


def validate_ratings(ratings: dict) -> dict[str, int]:
    if not isinstance(ratings, dict) or set(ratings) != set(DIMENSIONS):
        raise HTTPException(422, detail="RATING_DIMENSIONS_REQUIRED")
    if any(type(ratings[k]) is not int or not 1 <= ratings[k] <= 5 for k in DIMENSIONS):
        raise HTTPException(422, detail="RATING_OUT_OF_RANGE")
    return {k: ratings[k] for k in DIMENSIONS}


def require_employee(actor: EmployeeActor | None):
    if actor is None:
        raise HTTPException(401, detail="EMPLOYEE_LOGIN_REQUIRED")
    try:
        UUID(actor.user_id)
    except (TypeError, ValueError):
        raise HTTPException(403, detail="INVALID_SESSION")
    return actor


def require_employment(verified: bool) -> None:
    if not verified:
        # Do not reveal if the enterprise exists, or why employment was rejected.
        raise HTTPException(403, detail="VERIFIED_EMPLOYMENT_REQUIRED")


def identity_hash(secret: bytes, actor_id: str, org_id: str, period: str) -> str:
    if len(secret) < 32:
        raise RuntimeError("Feedback HMAC secret must be at least 32 bytes")
    message = (str(UUID(actor_id)) + ":" + str(org_uuid(org_id)) + ":" + period).encode()
    return hmac.new(secret, b"employee-period:" + message, hashlib.sha256).hexdigest()


def token_hash(secret: bytes, token: str) -> str:
    if not _TOKEN.fullmatch(token):
        raise HTTPException(422, detail="INVALID_FEEDBACK_TICKET")
    if len(secret) < 32:
        raise RuntimeError("Feedback HMAC secret must be at least 32 bytes")
    return hmac.new(secret, b"ticket:" + bytes.fromhex(token), hashlib.sha256).hexdigest()


def new_ticket() -> str:
    return secrets.token_hex(32)


def ticket_expiry(now: datetime | None = None) -> datetime:
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    # A one-time ticket must not cross into the next quarter.
    quarter = (now.month - 1) // 3
    next_month = quarter * 3 + 4
    year = now.year + (next_month > 12)
    month = 1 if next_month > 12 else next_month
    boundary = datetime(year, month, 1, tzinfo=timezone.utc)
    return min(now + timedelta(hours=TICKET_TTL_HOURS), boundary)


def public_feedback(values: list[dict], *, period: str, now: datetime | None = None) -> dict:
    """Only publish closed-quarter aggregates with at least 10 respondents.

    No raw feedback, response timestamps, exact respondent counts, profiles,
    free text, departments, locations, or candidate identifiers.
    """
    if not completed_period(period, now):
        return {"status": "not_public", "period": period}
    if len(values) < MIN_PUBLIC_RESPONSES:
        return {"status": "not_public", "period": period}
    ratings = {key: round(sum(int(row[key]) for row in values) / len(values), 1)
               for key in DIMENSIONS}
    return {"status": "published", "period": period,
            "response_band": "at_least_10", "scores_out_of_5": ratings,
            "notice": "员工主观体验汇总，不等于已核实的违法或失信事实。" }
