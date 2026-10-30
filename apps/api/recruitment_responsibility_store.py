"""PostgreSQL-only response responsibilities; not mounted without trusted HHBA auth.

Canonical application service MUST invoke record_delivered AFTER a verified,
successfully committed application delivery; and record_canonical_transition only
AFTER its own status transaction commits. If either side cannot guarantee reliable
event delivery, use a durable outbox before enabling SLA enforcement in production.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4
from .recruitment_responsibility_domain import BusinessCalendar, MEANINGFUL_RESULTS, deadline_after_workdays, responsibility_change

def uid(value: str) -> UUID:
    return UUID(value)

class PostgresRecruitmentResponsibilityStore:
    def __init__(self, pool, calendar: BusinessCalendar):
        self.pool = pool
        self.calendar = calendar

    async def record_delivered(self, *, application_id: str, organization_id: str,
                               posting_id: str, candidate_id: str,
                               delivered_at: datetime) -> bool:
        """Idempotent; no HTTP endpoint can create deliveries or self-report read status."""
        deadline = deadline_after_workdays(delivered_at, self.calendar)
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow("""
                    INSERT INTO hhba_recruitment_responsibilities_private
                      (application_id, organization_id, posting_id, candidate_id,
                       delivered_at, response_due_at, calendar_version)
                    VALUES ($1,$2,$3,$4,$5,$6,$7)
                    ON CONFLICT (application_id) DO NOTHING
                    RETURNING application_id
                """, uid(application_id), uid(organization_id), uid(posting_id),
                     uid(candidate_id), delivered_at, deadline, self.calendar.version)
                if row:
                    await conn.execute("""
                        INSERT INTO hhba_recruitment_responsibility_events
                          (id,application_id,event_name,occurred_at)
                        VALUES ($1,$2,'delivered',$3)
                    """, uuid4(), uid(application_id), delivered_at)
                    return True
                existing = await conn.fetchrow("""
                    SELECT organization_id,posting_id,candidate_id
                      FROM hhba_recruitment_responsibilities_private
                     WHERE application_id=$1
                """, uid(application_id))
                if not existing or (str(existing["organization_id"]),str(existing["posting_id"]),
                    str(existing["candidate_id"])) != (organization_id,posting_id,candidate_id):
                    raise ValueError("APPLICATION_DELIVERY_IDENTITY_CONFLICT")
                return False

    async def record_canonical_transition(self, *, application_id: str,
                organization_id: str, posting_id: str, canonical_state: str,
                actor_id: str, occurred_at: datetime) -> str:
        """Called only by canonical application status transaction/outbox, never directly by UI."""
        if occurred_at.tzinfo is None:
            raise ValueError("AUTHORITATIVE_EVENT_TIME_REQUIRED")
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row=await conn.fetchrow("""
                    SELECT state,response_kind FROM hhba_recruitment_responsibilities_private
                     WHERE application_id=$1 AND organization_id=$2 AND posting_id=$3 FOR UPDATE
                """,uid(application_id),uid(organization_id),uid(posting_id))
                if row is None:
                    raise KeyError("DELIVERY_NOT_RECORDED")
                # A canonical outbox event may be replayed after a successful commit.
                if (row["state"] == "responded" and
                    MEANINGFUL_RESULTS.get(canonical_state) == row["response_kind"]):
                    return "responded"
                state,kind=responsibility_change(row["state"],canonical_state)
                if state==row["state"] and kind==row["response_kind"]:
                    return state
                await conn.execute("""
                    UPDATE hhba_recruitment_responsibilities_private
                       SET state=$2,response_kind=$3,
                           first_meaningful_response_at=CASE WHEN $2='responded'
                            THEN COALESCE(first_meaningful_response_at,$4) WHEN $2='withdrawn' THEN NULL ELSE first_meaningful_response_at END,
                           responsible_user_id=COALESCE(responsible_user_id,$5),
                           updated_at=$4
                     WHERE application_id=$1
                """,uid(application_id),state,kind,occurred_at,uid(actor_id))
                await conn.execute("""
                    INSERT INTO hhba_recruitment_responsibility_events
                     (id,application_id,event_name,actor_id,occurred_at)
                    VALUES($1,$2,$3,$4,$5)
                """,uuid4(),uid(application_id),"canonical_"+canonical_state,uid(actor_id),occurred_at)
                return state

    async def list_for_employer(self, *, organization_id: str, posting_id: str):
        return await self._list("""
            organization_id=$1 AND posting_id=$2
        """,uid(organization_id),uid(posting_id))

    async def list_for_candidate(self, *, candidate_id: str):
        return await self._list("candidate_id=$1",uid(candidate_id), redact_handler=True)

    async def list_overdue_for_reviewer(self, *, excluded_organizations: list[str]):
        # Reviewer must not audit organizations for which they are a member.
        exclusions=[uid(v) for v in excluded_organizations]
        return await self._list("""
            NOT (organization_id=ANY($1::uuid[])) AND
            state IN ('awaiting','reviewing') AND response_due_at < now()
        """,exclusions)

    async def _list(self, where: str, *values, redact_handler: bool=False):
        # WHERE only from three constant, internal SQL fragments above.
        select=f"""
          SELECT application_id,organization_id,posting_id,
                 CASE WHEN state IN ('awaiting','reviewing') AND response_due_at<now()
                      THEN 'overdue' ELSE state END AS state,
                 delivered_at,response_due_at,first_meaningful_response_at,
                 responsible_user_id,response_kind,calendar_version
            FROM hhba_recruitment_responsibilities_private
           WHERE {where}
           ORDER BY response_due_at ASC,application_id ASC
           LIMIT 100
        """
        count=f"SELECT COUNT(*) FROM hhba_recruitment_responsibilities_private WHERE {where}"
        async with self.pool.acquire() as conn:
            # Do not expose candidate_id to enterprise/admin read paths.
            rows=await conn.fetch(select,*values)
            total=await conn.fetchval(count,*values)
        public_rows=[dict(row) for row in rows]
        if redact_handler:
            for item in public_rows:
                item["responsible_user_id"]=None  # No internal HR identity to candidates.
        return {"status":"connected","as_of":datetime.now(timezone.utc),
                "total":int(total),"items":public_rows}

    async def note_reminder_delivered(self, *, application_id: str,
                                      delivery_reference: str, sent_at: datetime) -> None:
        """Only the actual notification sender calls this AFTER successful delivery."""
        if not delivery_reference.strip() or len(delivery_reference)>160 or sent_at.tzinfo is None:
            raise ValueError("VERIFIED_NOTIFICATION_DELIVERY_REQUIRED")
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                updated=await conn.fetchrow("""
                    UPDATE hhba_recruitment_responsibilities_private
                       SET reminder_sent_at=$2 WHERE application_id=$1
                       AND state IN ('awaiting','reviewing')
                     RETURNING application_id
                """,uid(application_id),sent_at)
                if not updated:
                    raise KeyError("OPEN_RESPONSIBILITY_REQUIRED")
                await conn.execute("""
                    INSERT INTO hhba_recruitment_responsibility_events
                     (id,application_id,event_name,delivery_reference,occurred_at)
                    VALUES ($1,$2,'notification_delivered',$3,$4)
                """,uuid4(),uid(application_id),delivery_reference,sent_at)
