"""Two independent, versioned, continuously revalidated HHBA score releases.

No score reaches the public without policy_enablement AND an approved rubric.
Public reads revalidate evidence, appeals, employment feedback period and
certification. We don't invent a company rating from an old historical run.
"""
from __future__ import annotations
import json
from datetime import datetime,timezone,timedelta
from uuid import UUID,uuid4
from fastapi import HTTPException
from .scoring_domain import ALL_CATEGORIES,MAX_AGE_DAYS
from .scoring_store import last_completed_quarter
from .publication_domain import (
    ensure_candidate,reject_review_conflicts,private_case,pending_profile,
    published_profile,uuid_or_404,verify_reason
)


class PostgresPublicationRepository:
    def __init__(self,pool,improvement_repository,*,approved_rules:frozenset[str]):
        self.pool=pool
        self.improvements=improvement_repository
        self.approved_rules=approved_rules

    async def _lock_org(self,conn,org:UUID):
        # Serializes all preparations/release transitions for a given employer.
        await conn.execute("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",str(org))

    async def _live(self,conn,org:UUID,run_id:UUID|None,*,certified:bool)->dict:
        """Throws 409 on any stale / unsupported publication condition."""
        if not certified:
            raise HTTPException(409,detail="EMPLOYER_CERTIFICATION_REQUIRED")
        run=await conn.fetchrow(
            """SELECT * FROM hhba_scoring_runs_private
               WHERE organization_id=$1 ORDER BY run_sequence DESC LIMIT 1""",org)
        if not run or (run_id is not None and run["id"]!=run_id):
            raise HTTPException(409,detail="LATEST_SCORING_RUN_REQUIRED")
        candidate=run["result"] if isinstance(run["result"],dict) else json.loads(run["result"])
        ensure_candidate(candidate,run["rule_version"],self.approved_rules)
        period=last_completed_quarter()
        # Suppress release if the last employee quarter lacks the minimum cohort.
        # Query only the aggregate count; never return individual identities.
        count=await conn.fetchval(
            """SELECT COUNT(*) FROM hhba_employee_feedback_private
               WHERE organization_id=$1 AND period=$2""",org,period)
        if count<10:
            raise HTTPException(409,detail="PRIVACY_AGGREGATE_NOT_READY")
        appeal=await conn.fetchval(
            """SELECT EXISTS(SELECT 1 FROM hhba_appeal_cases_private
               WHERE organization_id=$1
                 AND status IN ('submitted','under_review','needs_more_info','correction_required')
                 AND kind IN ('employer','employee_privacy'))""",org)
        if appeal:
            raise HTTPException(409,detail="ACTIVE_APPEAL_OR_PRIVACY_HOLD")
        records=await conn.fetch(
            """SELECT DISTINCT ON (f.category)
                  f.category,f.assessor_id,f.assessed_at,f.evidence_id,
                  e.status,e.security_status,e.status_updated_at,e.submitted_by,
                  (SELECT reviewer_id FROM hhba_evidence_reviews
                   WHERE evidence_id=e.id AND decision='verified'
                   ORDER BY created_at DESC,id DESC LIMIT 1) AS first_reviewer
               FROM hhba_scoring_findings_private f
               JOIN hhba_employer_evidence e ON e.id=f.evidence_id
               WHERE f.organization_id=$1 AND e.organization_id=$1
               ORDER BY f.category,f.sequence DESC""",org)
        if set(x["category"] for x in records)!=set(ALL_CATEGORIES):
            raise HTTPException(409,detail="REQUIRED_PROOFS_MISSING")
        now=datetime.now(timezone.utc)
        for proof in records:
            if (proof["status"]!="verified" or proof["security_status"]!="clean"
                or proof["first_reviewer"] is None
                or proof["assessed_at"]>run["created_at"]
                or proof["status_updated_at"]>run["created_at"]
                or not run["created_at"]-timedelta(days=MAX_AGE_DAYS) <= proof["assessed_at"]<=now
                or not now-timedelta(days=MAX_AGE_DAYS)<=proof["status_updated_at"]<=now):
                raise HTTPException(409,detail="SCORING_SOURCE_EXPIRED_OR_CHANGED")
        sources={str(run["calculated_by"])}
        for item in records:
            sources.update((str(item["submitted_by"]),str(item["first_reviewer"]),str(item["assessor_id"])))
        return {"run":run,"candidate":candidate,"period":period,"participants":sources}

    async def prepare(self,*,organization_id:str,run_id:str,actor_id:str,
                      reviewer_organizations:dict[str,str],certified:bool)->dict:
        org,actor,rid=(uuid_or_404(organization_id),uuid_or_404(actor_id),uuid_or_404(run_id))
        async with self.pool.acquire() as conn:
            async with conn.transaction(isolation="repeatable_read"):
                await self._lock_org(conn,org)
                live=await self._live(conn,org,rid,certified=certified)
                if str(org) in reviewer_organizations or str(actor) in live["participants"]:
                    raise HTTPException(403,detail="PUBLICATION_PREPARER_CONFLICT")
                candidate=live["candidate"]
                snap={"trust":candidate["trust"]["score"],"care":candidate["care"]["score"]}
                item=await conn.fetchrow(
                    """INSERT INTO hhba_publication_cases_private
                       (id,organization_id,scoring_run_id,rule_version,
                        feedback_period,input_fingerprint,score_snapshot,prepared_by)
                       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
                       ON CONFLICT(organization_id,scoring_run_id)
                       DO NOTHING RETURNING *""",
                    uuid4(),org,rid,live["run"]["rule_version"],live["period"],
                    live["run"]["input_fingerprint"],json.dumps(snap),actor)
                if item is None:
                    raise HTTPException(409,detail="RUN_ALREADY_PREPARED")
                await conn.execute(
                    """INSERT INTO hhba_publication_events_private
                       (id,publication_id,actor_id,action,next_status)
                       VALUES($1,$2,$3,'prepared','prepared')""",uuid4(),item["id"],actor)
        return private_case(item)

    async def decide(self,*,publication_id:str,actor_id:str,decision:str,reason:str,
                     reviewer_organizations:dict[str,str],certified:bool)->dict:
        actor=uuid_or_404(actor_id)
        reason=verify_reason(reason)
        if decision not in {"approve","reject"}:
            raise HTTPException(422,detail="INVALID_PUBLICATION_DECISION")
        async with self.pool.acquire() as conn:
            async with conn.transaction(isolation="repeatable_read"):
                row=await conn.fetchrow(
                    "SELECT * FROM hhba_publication_cases_private WHERE id=$1 FOR UPDATE",
                    uuid_or_404(publication_id))
                if row is None:
                    raise HTTPException(404,detail="PUBLICATION_CASE_NOT_FOUND")
                await self._lock_org(conn,row["organization_id"])
                if row["status"] not in ("prepared","first_approved"):
                    raise HTTPException(409,detail="PUBLICATION_CASE_NOT_REVIEWABLE")
                if decision=="reject":
                    # A stale or non-certified employer must STILL be able to have
                    # a pending publication explicitly rejected and audit-closed.
                    # Restrict reviewer conflicts against every source participant.
                    staff=await conn.fetch(
                        """SELECT actor_id FROM (
                             SELECT submitted_by AS actor_id FROM hhba_employer_evidence
                               WHERE organization_id=$1
                             UNION SELECT r.reviewer_id FROM hhba_evidence_reviews r
                               JOIN hhba_employer_evidence e ON e.id=r.evidence_id
                               WHERE e.organization_id=$1
                             UNION SELECT assessor_id FROM hhba_scoring_findings_private
                               WHERE organization_id=$1
                           ) participating""",row["organization_id"])
                    run_calculator=await conn.fetchval(
                        "SELECT calculated_by FROM hhba_scoring_runs_private WHERE id=$1",
                        row["scoring_run_id"])
                    participants={str(x["actor_id"]) for x in staff}
                    participants.add(str(run_calculator))
                    reject_review_conflicts(
                        actor_id=str(actor),prepared_by=str(row["prepared_by"]),
                        first_reviewer=str(row["first_reviewer"]) if row["first_reviewer"] else None,
                        calculated_by=str(run_calculator),
                        company_member=str(row["organization_id"]) in reviewer_organizations,
                        source_participants=participants)
                else:
                    live=await self._live(conn,row["organization_id"],row["scoring_run_id"],
                                          certified=certified)
                    if (live["period"]!=row["feedback_period"] or
                        live["run"]["input_fingerprint"]!=row["input_fingerprint"]):
                        raise HTTPException(409,detail="PUBLICATION_SNAPSHOT_STALE")
                    reject_review_conflicts(
                        actor_id=str(actor),prepared_by=str(row["prepared_by"]),
                        first_reviewer=str(row["first_reviewer"]) if row["first_reviewer"] else None,
                        calculated_by=str(live["run"]["calculated_by"]),
                        company_member=str(row["organization_id"]) in reviewer_organizations,
                        source_participants=live["participants"])
                before=row["status"]
                if decision=="reject":
                    next_status="rejected"
                    updated=await conn.fetchrow(
                        """UPDATE hhba_publication_cases_private SET status='rejected'
                           WHERE id=$1 RETURNING *""",row["id"])
                elif before=="prepared":
                    next_status="first_approved"
                    updated=await conn.fetchrow(
                        """UPDATE hhba_publication_cases_private SET
                           status='first_approved',first_reviewer=$2,
                           first_reason=$3,first_approved_at=now()
                           WHERE id=$1 RETURNING *""",row["id"],actor,reason)
                else:
                    if await conn.fetchval(
                        """SELECT EXISTS(SELECT 1 FROM hhba_publication_cases_private
                           WHERE organization_id=$1 AND status='published')""",
                        row["organization_id"]):
                        raise HTTPException(409,detail="PRIOR_PUBLICATION_MUST_BE_REVOKED")
                    next_status="published"
                    version=(await conn.fetchval(
                        """SELECT COALESCE(MAX(publication_version),0)+1
                           FROM hhba_publication_cases_private WHERE organization_id=$1""",
                        row["organization_id"]))
                    updated=await conn.fetchrow(
                        """UPDATE hhba_publication_cases_private SET
                           status='published',second_reviewer=$2,
                           second_reason=$3,publication_version=$4,published_at=now()
                           WHERE id=$1 RETURNING *""",row["id"],actor,reason,version)
                await conn.execute(
                    """INSERT INTO hhba_publication_events_private
                       (id,publication_id,actor_id,action,previous_status,next_status,reason)
                       VALUES ($1,$2,$3,$4,$5,$6,$7)""",
                    uuid4(),row["id"],actor,next_status,before,next_status,reason)
        return private_case(updated)

    async def revoke(self,*,publication_id:str,actor_id:str,reason:str,
                     reviewer_organizations:dict[str,str])->dict:
        actor=uuid_or_404(actor_id)
        reason=verify_reason(reason)
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row=await conn.fetchrow(
                    "SELECT * FROM hhba_publication_cases_private WHERE id=$1 FOR UPDATE",
                    uuid_or_404(publication_id))
                if row is None:
                    raise HTTPException(404,detail="PUBLICATION_CASE_NOT_FOUND")
                if row["status"]!="published":
                    raise HTTPException(409,detail="PUBLICATION_NOT_ACTIVE")
                if (str(row["organization_id"]) in reviewer_organizations or actor in
                    (row["prepared_by"],row["first_reviewer"],row["second_reviewer"])):
                    raise HTTPException(403,detail="REVOCATION_REVIEWER_CONFLICT")
                updated=await conn.fetchrow(
                    """UPDATE hhba_publication_cases_private
                       SET status='revoked',revoked_at=now()
                       WHERE id=$1 RETURNING *""",row["id"])
                await conn.execute(
                    """INSERT INTO hhba_publication_events_private
                       (id,publication_id,actor_id,action,previous_status,next_status,reason)
                       VALUES ($1,$2,$3,'revoked','published','revoked',$4)""",
                    uuid4(),row["id"],actor,reason)
        return private_case(updated)

    async def queue(self,*,reviewer_organizations:dict[str,str])->list[dict]:
        excluded=[uuid_or_404(x) for x in reviewer_organizations]
        async with self.pool.acquire() as conn:
            rows=await conn.fetch(
                """SELECT * FROM hhba_publication_cases_private
                   WHERE status IN ('prepared','first_approved')
                     AND organization_id != ALL($1::uuid[])
                   ORDER BY prepared_at,id LIMIT 50""",excluded)
        return [private_case(r) for r in rows]

    async def public_profile(self,*,organization_id:str,certified:bool,policy_enabled:bool)->dict:
        org=uuid_or_404(organization_id,"ORGANIZATION_NOT_FOUND")
        improvements=(await self.improvements.public_timeline(organization_id=organization_id)
                      if policy_enabled else [])
        if not policy_enabled:
            return pending_profile(improvements=improvements)
        async with self.pool.acquire() as conn:
            async with conn.transaction(isolation="repeatable_read",readonly=True):
                row=await conn.fetchrow(
                    """SELECT * FROM hhba_publication_cases_private
                       WHERE organization_id=$1 AND status='published'
                       ORDER BY publication_version DESC LIMIT 1""",org)
                if row is None:
                    return pending_profile(improvements=improvements)
                try:
                    live=await self._live(conn,org,row["scoring_run_id"],certified=certified)
                    stored=row["score_snapshot"]
                    if isinstance(stored,str):
                        stored=json.loads(stored)
                    current=live["candidate"]
                    if (row["feedback_period"]!=live["period"] or
                        row["input_fingerprint"]!=live["run"]["input_fingerprint"] or
                        row["rule_version"]!=live["run"]["rule_version"] or
                        stored!={"trust":current["trust"]["score"],"care":current["care"]["score"]}):
                        return pending_profile(improvements=improvements)
                except HTTPException as exc:
                    if exc.status_code==409:
                        return pending_profile(improvements=improvements)
                    raise
        return published_profile(case=row,improvements=improvements)

    async def public_history(self,*,organization_id:str,policy_enabled:bool)->list[dict]:
        if not policy_enabled:
            return []
        async with self.pool.acquire() as conn:
            rows=await conn.fetch(
                """SELECT publication_version,published_at,status
                   FROM hhba_publication_cases_private
                   WHERE organization_id=$1 AND publication_version IS NOT NULL
                   ORDER BY publication_version DESC LIMIT 30""",
                uuid_or_404(organization_id))
        return [{"version":r["publication_version"],"released_on":r["published_at"].date().isoformat(),
                 "status":"withdrawn" if r["status"]=="revoked" else "historical_version"}
                for r in rows]
