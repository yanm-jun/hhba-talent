"""HHBA recruitment response responsibility policy (Phase 1, no fabricated results).

The delivery and status-transition hooks MUST be called only after the canonical
authenticated hiring service has committed the authoritative application event.
Nothing here invents jobs, applicants, HR actions, or employer read receipts.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException

SHANGHAI = ZoneInfo("Asia/Shanghai")
MEANINGFUL_RESULTS = {"interview": "continued", "hired": "continued",
                      "rejected": "declined", "cancelled": "cancelled"}
PROGRESS_ONLY = frozenset({"reviewing", "shortlisted"})
VALID_CANONICAL_STATES = frozenset({"submitted", "reviewing", "shortlisted",
                                   "interview", "hired", "rejected",
                                   "cancelled", "withdrawn"})

@dataclass(frozen=True)
class BusinessCalendar:
    """Explicit, versioned calendar; public holidays and makeup shifts are not assumed."""
    version: str
    holidays: frozenset[date]
    makeup_workdays: frozenset[date]

    def __post_init__(self):
        if not self.version.strip() or self.version == "unverified":
            raise ValueError("VERIFIED_WORKDAY_CALENDAR_REQUIRED")
        if self.holidays & self.makeup_workdays:
            raise ValueError("WORKDAY_CALENDAR_CONFLICT")

    def working(self, day: date) -> bool:
        if day in self.makeup_workdays:
            return True
        return day.weekday() < 5 and day not in self.holidays

def deadline_after_workdays(received: datetime, calendar: BusinessCalendar,
                            days: int = 7) -> datetime:
    """Seven following workdays; due end-of-day Beijing time, returned as UTC."""
    if received.tzinfo is None:
        raise ValueError("SERVER_DELIVERY_TIME_MUST_BE_TIMEZONE_AWARE")
    if not 1 <= days <= 30:
        raise ValueError("INVALID_WORKDAY_PERIOD")
    day = received.astimezone(SHANGHAI).date()
    counted = 0
    while counted < days:
        day += timedelta(days=1)
        if calendar.working(day):
            counted += 1
    return datetime.combine(day, time(23, 59, 59), SHANGHAI).astimezone(timezone.utc)

def responsibility_change(current: str, canonical_state: str) -> tuple[str, str | None]:
    """'Reviewing' and 'shortlisted' are NOT fulfillment, even after a click."""
    if canonical_state not in VALID_CANONICAL_STATES:
        raise HTTPException(status_code=422, detail="INVALID_CANONICAL_APPLICATION_STATE")
    if current in ("withdrawn", "responded") and canonical_state not in ("withdrawn",):
        raise HTTPException(status_code=409, detail="RESPONSIBILITY_ALREADY_CLOSED")
    if canonical_state == "withdrawn":
        return "withdrawn", None
    if canonical_state in MEANINGFUL_RESULTS:
        return "responded", MEANINGFUL_RESULTS[canonical_state]
    if canonical_state in PROGRESS_ONLY:
        return "reviewing", None
    return current, None

def require_response_reviewer(actor) -> None:
    if actor is None:
        raise HTTPException(status_code=401, detail="AUTH_REQUIRED")
    if getattr(actor, "recruitment_reviewer", False) is not True:
        raise HTTPException(status_code=403, detail="INDEPENDENT_RECRUITMENT_REVIEWER_REQUIRED")
    if not isinstance(getattr(actor, "organization_roles", None), dict) and not hasattr(getattr(actor, "organization_roles", None), "items"):
        raise HTTPException(status_code=503, detail="TRUSTED_MEMBERSHIP_LOOKUP_REQUIRED")
