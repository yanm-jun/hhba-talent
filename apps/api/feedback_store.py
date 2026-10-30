"""Module 06: one-time eligibility storage and separated quarterly ratings.

No issuer/session/subject/ticket keys are ever stored on a rating record.
Neither enterprise staff nor public users may read these raw tables.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4
from fastapi import HTTPException
from .feedback_domain import current_period, public_feedback, ticket_expiry, DIMENSIONS


class PostgresFeedbackRepository:
    def __init__(self, pool):
        self.pool = pool

    async def issue_ticket(self, *, organization_id: str, period: str,
                           subject_hmac: str, token_hmac: str,
                           expires_at: datetime) -> None:
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                item = await conn.fetchrow(
                    """INSERT INTO hhba_feedback_tickets_private
                         (id, organization_id, period, subject_hmac, token_hmac, expires_at)
                       VALUES ($1,$2,$3,$4,$5,$6)
                       ON CONFLICT (organization_id,period,subject_hmac)
                       DO UPDATE SET token_hmac=EXCLUDED.token_hmac,
                                     expires_at=EXCLUDED.expires_at, issued_at=now()
                       WHERE hhba_feedback_tickets_private.redeemed=FALSE
                         AND hhba_feedback_tickets_private.expires_at<=now()
                       RETURNING id""",
                    uuid4(), UUID(organization_id), period, subject_hmac, token_hmac, expires_at)
                if not item:
                    raise HTTPException(409, detail="TICKET_ALREADY_ISSUED_OR_USED")

    async def redeem(self, *, organization_id: str, period: str,
                     subject_hmac: str, token_hmac: str, ratings: dict) -> None:
        # Same transaction and FOR UPDATE prevents concurrent ticket replay.
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    """SELECT id, organization_id, period, subject_hmac, redeemed, expires_at
                       FROM hhba_feedback_tickets_private
                       WHERE token_hmac=$1 FOR UPDATE""", token_hmac)
                now = datetime.now(timezone.utc)
                if (not row or row["redeemed"] or row["expires_at"] <= now
                    or row["organization_id"] != UUID(organization_id)
                    or row["period"] != period
                    or row["period"] != current_period(now)
                    or row["subject_hmac"] != subject_hmac):
                    raise HTTPException(403, detail="INVALID_OR_USED_TICKET")
                updated = await conn.execute(
                    """UPDATE hhba_feedback_tickets_private SET redeemed=TRUE
                       WHERE id=$1 AND redeemed=FALSE""", row["id"])
                if updated != "UPDATE 1":
                    raise HTTPException(409, detail="TICKET_ALREADY_USED")
                # Never persist ticket ID or subject HMAC on this record.
                await conn.execute(
                    """INSERT INTO hhba_employee_feedback_private
                       (id, organization_id, period, pay, insurance, rest, respect, development)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)""",
                    uuid4(), UUID(organization_id), period,
                    *(ratings[dimension] for dimension in DIMENSIONS))

    async def public_aggregate(self, *, organization_id: str, period: str) -> dict:
        from .feedback_domain import completed_period
        if not completed_period(period):
            return {"status": "not_public", "period": period}
        # Access controlled via public aggregate endpoint only, never raw ratings.
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT pay, insurance, rest, respect, development
                   FROM hhba_employee_feedback_private
                   WHERE organization_id=$1 AND period=$2""", UUID(organization_id), period)
        return public_feedback(rows, period=period)
