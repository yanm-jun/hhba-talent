"""Postgres-backed improvement review; no public unverified claims or score edits."""
from __future__ import annotations
from datetime import date,datetime,timezone
from uuid import UUID,uuid4
from fastapi import HTTPException
from .improvements_domain import valid_uuid,validate_review,private_item,public_item


class PostgresImprovementsRepository:
    def __init__(self,pool):
        self.pool=pool

    async def submit(self,*,organization_id:str,evidence_id:str,title:str,
                     description:str,effective_date:date,actor_id:str)->dict:
        org=valid_uuid(organization_id,"ORGANIZATION_NOT_FOUND")
        evidence=valid_uuid(evidence_id,"EVIDENCE_NOT_FOUND")
        actor=valid_uuid(actor_id,"AUTH_REQUIRED")
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                proof=await conn.fetchrow(
                    """SELECT id,organization_id,category,status,security_status
                       FROM hhba_employer_evidence
                       WHERE id=$1 AND organization_id=$2 FOR SHARE""",evidence,org)
                if not proof:
                    raise HTTPException(404,detail="EVIDENCE_NOT_FOUND")
                if proof["status"]!="verified" or proof["security_status"]!="clean":
                    raise HTTPException(409,detail="VERIFIED_CLEAN_EVIDENCE_REQUIRED")
                saved=await conn.fetchrow(
                    """INSERT INTO hhba_employer_improvements_private
                       (id,organization_id,evidence_id,category,private_title,
                        private_description,effective_date,submitted_by)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                       ON CONFLICT(evidence_id) DO NOTHING RETURNING *""",
                    uuid4(),org,evidence,proof["category"],title,description,effective_date,actor)
                if not saved:
                    raise HTTPException(409,detail="EVIDENCE_ALREADY_LINKED_TO_IMPROVEMENT")
                await conn.execute(
                    """INSERT INTO hhba_employer_improvement_events
                       (id,improvement_id,actor_id,event_type,next_status)
                       VALUES ($1,$2,$3,'submitted','submitted')""",
                    uuid4(),saved["id"],actor)
        return private_item(saved)

    async def mine(self,*,organization_id:str)->list[dict]:
        async with self.pool.acquire() as conn:
            rows=await conn.fetch(
                """SELECT * FROM hhba_employer_improvements_private
                   WHERE organization_id=$1
                   ORDER BY created_at DESC,id DESC LIMIT 100""",
                valid_uuid(organization_id,"ORGANIZATION_NOT_FOUND"))
        return [private_item(r) for r in rows]

    async def queue(self,*,reviewer_organizations:dict[str,str])->list[dict]:
        excluded=[valid_uuid(x,"ORGANIZATION_NOT_FOUND") for x in reviewer_organizations]
        async with self.pool.acquire() as conn:
            rows=await conn.fetch(
                """SELECT * FROM hhba_employer_improvements_private
                   WHERE status IN ('submitted','needs_more_info')
                     AND organization_id != ALL($1::uuid[])
                   ORDER BY created_at,id LIMIT 100""",excluded)
        return [private_item(r) for r in rows]

    async def review(self,*,improvement_id:str,reviewer_id:str,
                     reviewer_organizations:dict[str,str],decision:str,
                     reason:str,summary:str|None,privacy_checked:bool)->dict:
        actor=valid_uuid(reviewer_id,"AUTH_REQUIRED")
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row=await conn.fetchrow(
                    """SELECT * FROM hhba_employer_improvements_private
                       WHERE id=$1 FOR UPDATE""",valid_uuid(improvement_id))
                if not row:
                    raise HTTPException(404,detail="IMPROVEMENT_NOT_FOUND")
                if str(row["organization_id"]) in reviewer_organizations or row["submitted_by"]==actor:
                    raise HTTPException(403,detail="IMPROVEMENT_REVIEWER_CONFLICT")
                proof=await conn.fetchrow(
                    """SELECT status,security_status,submitted_by FROM hhba_employer_evidence
                       WHERE id=$1 AND organization_id=$2 FOR SHARE""",
                    row["evidence_id"],row["organization_id"])
                if not proof or proof["status"]!="verified" or proof["security_status"]!="clean":
                    raise HTTPException(409,detail="VERIFIED_CLEAN_EVIDENCE_REQUIRED")
                proof_reviewer=await conn.fetchrow(
                    """SELECT reviewer_id FROM hhba_evidence_reviews
                       WHERE evidence_id=$1 AND decision='verified'
                       ORDER BY created_at DESC,id DESC LIMIT 1""",row["evidence_id"])
                if not proof_reviewer or proof_reviewer["reviewer_id"]==actor:
                    raise HTTPException(403,detail="INDEPENDENT_IMPROVEMENT_REVIEWER_REQUIRED")
                # Publication is suspended while source evidence is disputed.
                disputed=await conn.fetchval(
                    """SELECT EXISTS(SELECT 1 FROM hhba_appeal_cases_private a
                       WHERE a.organization_id=$1 AND a.kind='employer'
                         AND a.target_type='evidence' AND a.target_id=$2
                         AND a.status IN ('submitted','under_review',
                                          'needs_more_info','correction_required'))""",
                    row["organization_id"],row["evidence_id"])
                if disputed and decision=="approved":
                    raise HTTPException(409,detail="ACTIVE_EVIDENCE_APPEAL")
                public_summary=validate_review(
                    current=row["status"],decision=decision,reason=reason,
                    summary=summary,privacy_checked=privacy_checked)
                previous=row["status"]
                updated=await conn.fetchrow(
                    """UPDATE hhba_employer_improvements_private SET
                       status=$2,public_summary=$3,
                       approved_by=CASE WHEN $2='approved' THEN $4::uuid ELSE NULL END,
                       approved_at=CASE WHEN $2='approved' THEN now() ELSE NULL END,
                       status_updated_at=now()
                       WHERE id=$1 RETURNING *""",
                    row["id"],decision,public_summary,actor)
                await conn.execute(
                    """INSERT INTO hhba_employer_improvement_events
                       (id,improvement_id,actor_id,event_type,previous_status,
                        next_status,rationale)
                       VALUES ($1,$2,$3,'reviewed',$4,$5,$6)""",
                    uuid4(),row["id"],actor,previous,decision,reason.strip())
        return private_item(updated)

    async def clarify(self,*,organization_id:str,improvement_id:str,
                      actor_id:str,reason:str)->dict:
        org=valid_uuid(organization_id,"ORGANIZATION_NOT_FOUND")
        actor=valid_uuid(actor_id,"AUTH_REQUIRED")
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row=await conn.fetchrow(
                    """SELECT * FROM hhba_employer_improvements_private
                       WHERE id=$1 AND organization_id=$2 FOR UPDATE""",
                    valid_uuid(improvement_id),org)
                if not row:
                    raise HTTPException(404,detail="IMPROVEMENT_NOT_FOUND")
                if row["status"]!="needs_more_info":
                    raise HTTPException(409,detail="CLARIFICATION_NOT_REQUESTED")
                updated=await conn.fetchrow(
                    """UPDATE hhba_employer_improvements_private
                       SET status='submitted',status_updated_at=now()
                       WHERE id=$1 RETURNING *""",row["id"])
                await conn.execute(
                    """INSERT INTO hhba_employer_improvement_events
                       (id,improvement_id,actor_id,event_type,previous_status,
                        next_status,rationale)
                       VALUES ($1,$2,$3,'clarified','needs_more_info','submitted',$4)""",
                    uuid4(),row["id"],actor,reason)
        return private_item(updated)

    async def revoke(self,*,improvement_id:str,actor_id:str,
                     reviewer_organizations:dict[str,str],reason:str)->dict:
        actor=valid_uuid(actor_id,"AUTH_REQUIRED")
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row=await conn.fetchrow(
                    "SELECT * FROM hhba_employer_improvements_private WHERE id=$1 FOR UPDATE",
                    valid_uuid(improvement_id))
                if not row:
                    raise HTTPException(404,detail="IMPROVEMENT_NOT_FOUND")
                if str(row["organization_id"]) in reviewer_organizations or row["submitted_by"]==actor:
                    raise HTTPException(403,detail="IMPROVEMENT_REVIEWER_CONFLICT")
                if row["status"]!="approved":
                    raise HTTPException(409,detail="IMPROVEMENT_NOT_APPROVED")
                updated=await conn.fetchrow(
                    """UPDATE hhba_employer_improvements_private SET
                       status='revoked',public_summary=NULL,
                       status_updated_at=now() WHERE id=$1 RETURNING *""",row["id"])
                await conn.execute(
                    """INSERT INTO hhba_employer_improvement_events
                       (id,improvement_id,actor_id,event_type,previous_status,
                        next_status,rationale)
                       VALUES ($1,$2,$3,'revoked','approved','revoked',$4)""",
                    uuid4(),row["id"],actor,reason.strip())
        return private_item(updated)

    async def public_timeline(self,*,organization_id:str)->list[dict]:
        org=valid_uuid(organization_id,"ORGANIZATION_NOT_FOUND")
        async with self.pool.acquire() as conn:
            rows=await conn.fetch(
                """SELECT i.id,i.category,i.public_summary,i.effective_date,i.approved_at
                   FROM hhba_employer_improvements_private i
                   JOIN hhba_employer_evidence e ON e.id=i.evidence_id
                   WHERE i.organization_id=$1 AND e.organization_id=$1
                     AND i.status='approved' AND e.status='verified'
                     AND e.security_status='clean'
                     AND NOT EXISTS(
                       SELECT 1 FROM hhba_appeal_cases_private a
                       WHERE a.organization_id=i.organization_id
                         AND a.kind='employer' AND a.target_type='evidence'
                         AND a.target_id=i.evidence_id
                         AND a.status IN ('submitted','under_review',
                                          'needs_more_info','correction_required'))
                   ORDER BY i.effective_date DESC,i.approved_at DESC,i.id DESC
                   LIMIT 60""",org)
        return [public_item(row) for row in rows]
