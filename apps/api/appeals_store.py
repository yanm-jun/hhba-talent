"""PostgreSQL private appeals repository; audited actions and no score mutations.

All authorization is checked in trusted routes. Here the query itself ALSO
checks organization, case type and employee reporter ownership to prevent IDOR.
"""
from __future__ import annotations

from uuid import UUID, uuid4
from fastapi import HTTPException

from .appeals_domain import (uuid, validate_decision, require_independent, sanitized_case)
from .feedback_domain import current_period


class PostgresAppealsRepository:
    def __init__(self, pool):
        self.pool = pool

    async def open_employer(self, *, organization_id: str, target_type: str,
                            target_id: str, issue: str, explanation: str,
                            actor_id: str) -> dict:
        org, target, actor = uuid(organization_id), uuid(target_id), uuid(actor_id)
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                # Cannot appeal another company's evidence or internal score run.
                if target_type == "evidence":
                    row = await conn.fetchrow(
                        """SELECT e.id, e.submitted_by, r.reviewer_id AS challenged
                           FROM hhba_employer_evidence e
                           LEFT JOIN LATERAL (
                              SELECT reviewer_id FROM hhba_evidence_reviews
                              WHERE evidence_id=e.id ORDER BY created_at DESC,id DESC LIMIT 1
                           ) r ON TRUE
                           WHERE e.id=$1 AND e.organization_id=$2""", target, org)
                    challenged = row["challenged"] if row else None
                else:
                    row = await conn.fetchrow(
                        """SELECT id, calculated_by AS challenged
                           FROM hhba_scoring_runs_private
                           WHERE id=$1 AND organization_id=$2""",target,org)
                    challenged = row["challenged"] if row else None
                if row is None:
                    raise HTTPException(404, detail="APPEAL_TARGET_NOT_FOUND")
                new_id=uuid4()
                saved=await conn.fetchrow(
                    """INSERT INTO hhba_appeal_cases_private
                      (id,organization_id,kind,issue,target_type,target_id,
                       explanation,employer_requester,challenged_actor_id)
                      VALUES ($1,$2,'employer',$3,$4,$5,$6,$7,$8) RETURNING *""",
                    new_id,org,issue,target_type,target,explanation,actor,challenged)
                await conn.execute(
                    """INSERT INTO hhba_appeal_events_private
                       (id,appeal_id,actor_id,action,to_status)
                       VALUES ($1,$2,$3,'submitted','submitted')""",
                    uuid4(),new_id,actor)
        return sanitized_case(saved)

    async def list_employer(self, *, organization_id: str) -> list[dict]:
        async with self.pool.acquire() as conn:
            rows=await conn.fetch(
                """SELECT * FROM hhba_appeal_cases_private
                   WHERE organization_id=$1 AND kind='employer'
                   ORDER BY created_at DESC,id DESC LIMIT 100""",uuid(organization_id))
        return [sanitized_case(row) for row in rows]

    async def open_employee(self, *, organization_id: str, issue: str,
                            actor_id: str) -> dict:
        """Reporter UUID only in separate, access-restricted owner mapping table."""
        org,actor=uuid(organization_id),uuid(actor_id)
        period=current_period()
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                new_id=uuid4()
                case=await conn.fetchrow(
                    """INSERT INTO hhba_appeal_cases_private
                      (id,organization_id,kind,issue)
                      VALUES ($1,$2,'employee_privacy',$3) RETURNING *""",
                    new_id,org,issue)
                try:
                    await conn.execute(
                        """INSERT INTO hhba_appeal_employee_owners_private
                          (appeal_id,employee_id,organization_id,issue,period)
                          VALUES ($1,$2,$3,$4,$5)""",new_id,actor,org,issue,period)
                except Exception as exc:
                    # Avoid leaking the prior report or the reporter identity.
                    if getattr(exc, "sqlstate", None) == "23505":
                        raise HTTPException(409, detail="ISSUE_ALREADY_SUBMITTED_THIS_QUARTER")
                    raise
                await conn.execute(
                    """INSERT INTO hhba_appeal_events_private
                      (id,appeal_id,actor_id,action,to_status)
                      VALUES ($1,$2,$3,'submitted','submitted')""",uuid4(),new_id,actor)
        return sanitized_case(case)

    async def list_employee(self, *, actor_id: str) -> list[dict]:
        async with self.pool.acquire() as conn:
            rows=await conn.fetch(
                """SELECT c.* FROM hhba_appeal_cases_private c
                   JOIN hhba_appeal_employee_owners_private o ON o.appeal_id=c.id
                   WHERE o.employee_id=$1 AND c.kind='employee_privacy'
                   ORDER BY c.created_at DESC,c.id DESC LIMIT 50""",uuid(actor_id))
        return [sanitized_case(row) for row in rows]

    async def list_queue(self, *, reviewer_organizations: dict[str,str]) -> list[dict]:
        """Never show a reviewer employee allegations about their own company."""
        excluded=[uuid(org_id) for org_id in reviewer_organizations]
        async with self.pool.acquire() as conn:
            rows=await conn.fetch(
                """SELECT * FROM hhba_appeal_cases_private
                   WHERE status IN ('submitted','under_review','needs_more_info')
                     AND organization_id != ALL($1::uuid[])
                   ORDER BY created_at ASC,id ASC LIMIT 100""",excluded)
        return [sanitized_case(row,reviewer=True) for row in rows]

    async def decide(self, *, appeal_id: str, reviewer_id: str,
                     reviewer_organizations: dict[str,str], decision: str,
                     reason: str) -> dict:
        actor = uuid(reviewer_id)
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row=await conn.fetchrow(
                    "SELECT * FROM hhba_appeal_cases_private WHERE id=$1 FOR UPDATE",
                    uuid(appeal_id))
                if row is None:
                    raise HTTPException(404,detail="APPEAL_NOT_FOUND")
                reason=validate_decision(row["status"],decision,reason)
                # If a public-facing company record was contested, the original
                # verification/scoring actor must never decide their own appeal.
                require_independent(
                    reviewer_id=str(actor),
                    complainant_id=(str(row["employer_requester"])
                                    if row["kind"]=="employer" else None),
                    challenged_actor_id=(str(row["challenged_actor_id"])
                                         if row["challenged_actor_id"] else None),
                    reviewer_member=str(row["organization_id"]) in reviewer_organizations)
                # An original scorer must not adjudicate their own disputed rubric.
                if row["kind"] == "employer" and row["target_type"] == "evidence":
                    scoring_conflict=await conn.fetchval(
                        """SELECT EXISTS(SELECT 1 FROM hhba_scoring_findings_private
                           WHERE evidence_id=$1 AND assessor_id=$2)""",
                        row["target_id"],actor)
                    if scoring_conflict:
                        raise HTTPException(403,detail="APPEALS_REVIEWER_CONFLICT")
                if row["kind"] == "employer" and row["target_type"] == "scoring_run":
                    run_conflict=await conn.fetchval(
                        """SELECT EXISTS(
                             SELECT 1 FROM hhba_scoring_runs_private
                             WHERE id=$1 AND calculated_by=$2)""",row["target_id"],actor)
                    if run_conflict:
                        raise HTTPException(403,detail="APPEALS_REVIEWER_CONFLICT")
                # Compare the reporter privately, never reveal identity to the reviewer.
                if row["kind"] == "employee_privacy":
                    same_person=await conn.fetchval(
                        """SELECT EXISTS(SELECT 1
                           FROM hhba_appeal_employee_owners_private
                           WHERE appeal_id=$1 AND employee_id=$2)""",row["id"],actor)
                    if same_person:
                        raise HTTPException(403,detail="APPEALS_REVIEWER_CONFLICT")
                status = decision
                updated=await conn.fetchrow(
                    """UPDATE hhba_appeal_cases_private
                       SET status=$2,resolution=$3,updated_at=now()
                       WHERE id=$1 RETURNING *""",row["id"],status,reason)
                await conn.execute(
                    """INSERT INTO hhba_appeal_events_private
                      (id,appeal_id,actor_id,action,from_status,to_status,reason)
                      VALUES ($1,$2,$3,'decision',$4,$5,$6)""",
                    uuid4(),row["id"],actor,row["status"],status,reason)
        return sanitized_case(updated,reviewer=True)

    async def clarify_employer(self, *, organization_id: str, appeal_id: str,
                               actor_id: str, explanation: str) -> dict:
        org, actor = uuid(organization_id), uuid(actor_id)
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row=await conn.fetchrow(
                    """SELECT * FROM hhba_appeal_cases_private
                       WHERE id=$1 AND organization_id=$2 AND kind='employer'
                       FOR UPDATE""",uuid(appeal_id),org)
                if row is None:
                    raise HTTPException(404,detail="APPEAL_NOT_FOUND")
                if row["status"] != "needs_more_info":
                    raise HTTPException(409,detail="CLARIFICATION_NOT_REQUESTED")
                # Preserve original explanation in the case. Supplemental
                # information exists only as an append-only event.
                updated=await conn.fetchrow(
                    """UPDATE hhba_appeal_cases_private
                       SET status='submitted',updated_at=now()
                       WHERE id=$1 RETURNING *""",row["id"])
                await conn.execute(
                    """INSERT INTO hhba_appeal_events_private
                      (id,appeal_id,actor_id,action,from_status,to_status,reason)
                      VALUES ($1,$2,$3,'clarification','needs_more_info','submitted',$4)""",
                    uuid4(),row["id"],actor,explanation)
        return sanitized_case(updated)

    async def has_active_score_appeal(self, *, organization_id: str) -> bool:
        async with self.pool.acquire() as conn:
            exists=await conn.fetchval(
                """SELECT EXISTS(
                     SELECT 1 FROM hhba_appeal_cases_private
                     WHERE organization_id=$1 AND kind='employer'
                     AND status IN ('submitted','under_review',
                                    'needs_more_info','correction_required'))""",
                uuid(organization_id))
        return bool(exists)

    async def state_snapshot(self, *, organization_id: str) -> list[dict]:
        """Appeal state changes only; no identity, employee feedback or text."""
        async with self.pool.acquire() as conn:
            rows=await conn.fetch(
                """SELECT id,kind,status,updated_at
                   FROM hhba_appeal_cases_private
                   WHERE organization_id=$1 ORDER BY created_at,id LIMIT 200""",
                uuid(organization_id))
        return [{"id":str(r["id"]),"kind":r["kind"],
                 "status":r["status"],"updated_at":r["updated_at"].isoformat()}
                for r in rows]
