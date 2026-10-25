"""HHBA independent aid approval and consent-/proof-gated commercial introductions.

The database stores neither individual employees nor client contact details.
Anonymized buyer references are issued by trusted matchers only. No real order
is counted without a second independent evidence verification.
"""
from __future__ import annotations
from uuid import uuid4
from fastapi import HTTPException
from .publication_domain import uuid_or_404
from .aid_domain import (
  AidPolicy,SERVICE_TYPES,BUYER_SECTORS,OPPORTUNITY_TYPES,
  description,private_aid,private_lead,require_policy,verify_thresholds,
  stage_transition,valid_ref
)


class PostgresAidRepository:
    def __init__(self,pool,publication_repo,*,policy:AidPolicy):
        self.pool=pool;self.publication=publication_repo;self.policy=policy

    async def _live(self,organization_id:str,certified:bool)->dict:
        profile=await self.publication.public_profile(
            organization_id=organization_id,certified=certified,
            policy_enabled=True)
        verify_thresholds(profile,self.policy)
        return profile

    async def _capacity(self,conn,org,evidence_id)->dict:
        proof=await conn.fetchrow(
            """SELECT e.id,e.submitted_by,e.status,e.security_status,e.category,
                      (SELECT reviewer_id FROM hhba_evidence_reviews
                       WHERE evidence_id=e.id AND decision='verified'
                       ORDER BY created_at DESC,id DESC LIMIT 1) AS original_reviewer
               FROM hhba_employer_evidence e
               WHERE id=$1 AND organization_id=$2""",evidence_id,org)
        if not proof:
            raise HTTPException(404,detail="CAPACITY_EVIDENCE_NOT_FOUND")
        if (proof["category"]!="business_integrity" or
            proof["status"]!="verified" or proof["security_status"]!="clean" or
            proof["original_reviewer"] is None):
            raise HTTPException(409,detail="VERIFIED_CAPACITY_EVIDENCE_REQUIRED")
        return proof

    async def submit(self,*,organization_id:str,service_type:str,
                     business_summary:str,capacity_summary:str,
                     capacity_evidence_id:str,actor_id:str)->dict:
        if service_type not in SERVICE_TYPES:
            raise HTTPException(422,detail="AID_SERVICE_INVALID")
        org=uuid_or_404(organization_id);actor=uuid_or_404(actor_id)
        proof_id=uuid_or_404(capacity_evidence_id)
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                await self._capacity(conn,org,proof_id)
                item=await conn.fetchrow(
                    """INSERT INTO hhba_aid_applications_private
                       (id,organization_id,service_type,business_summary,
                        capacity_summary,capacity_evidence_id,submitted_by)
                       VALUES($1,$2,$3,$4,$5,$6,$7)
                       ON CONFLICT DO NOTHING RETURNING *""",
                    uuid4(),org,service_type,business_summary,capacity_summary,proof_id,actor)
                if item is None:
                    raise HTTPException(409,detail="ACTIVE_AID_APPLICATION_ALREADY_EXISTS")
                await conn.execute(
                    """INSERT INTO hhba_aid_events_private
                       (id,application_id,actor_id,action,new_status)
                       VALUES($1,$2,$3,'submitted','submitted')""",
                    uuid4(),item["id"],actor)
        return private_aid(item)

    async def list_company(self,*,organization_id:str,certified:bool)->list[dict]:
        org=uuid_or_404(organization_id)
        async with self.pool.acquire() as conn:
            rows=await conn.fetch(
                """SELECT * FROM hhba_aid_applications_private
                   WHERE organization_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100""",org)
        try:
            await self._live(organization_id,certified)
            live=True
        except HTTPException as exc:
            if exc.status_code not in (409,503):raise
            live=False
        return [private_aid(x,live=live) for x in rows]

    async def queue(self,*,reviewer_organizations:dict[str,str])->list[dict]:
        except_orgs=[uuid_or_404(x) for x in reviewer_organizations]
        async with self.pool.acquire() as conn:
            rows=await conn.fetch(
                """SELECT * FROM hhba_aid_applications_private
                   WHERE status IN ('submitted','needs_info')
                     AND organization_id != ALL($1::uuid[])
                   ORDER BY created_at,id LIMIT 100""",except_orgs)
        return [private_aid(r) for r in rows]

    async def review(self,*,application_id:str,actor_id:str,decision:str,
                     reason:str,reviewer_organizations:dict[str,str],
                     certified:bool)->dict:
        if decision not in {"approved","declined","needs_info"}:
            raise HTTPException(422,detail="AID_DECISION_INVALID")
        org_id=None
        async with self.pool.acquire() as conn:
            row=await conn.fetchrow(
                "SELECT organization_id FROM hhba_aid_applications_private WHERE id=$1",
                uuid_or_404(application_id))
            if not row:raise HTTPException(404,detail="AID_APPLICATION_NOT_FOUND")
            org_id=str(row["organization_id"])
        profile=await self._live(org_id,certified) if decision=="approved" else None
        actor=uuid_or_404(actor_id)
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row=await conn.fetchrow(
                    "SELECT * FROM hhba_aid_applications_private WHERE id=$1 FOR UPDATE",
                    uuid_or_404(application_id))
                if row is None or row["status"] not in ("submitted","needs_info"):
                    raise HTTPException(409,detail="AID_APPLICATION_NOT_REVIEWABLE")
                if (str(row["organization_id"]) in reviewer_organizations
                     or row["submitted_by"]==actor):
                    raise HTTPException(403,detail="AID_REVIEWER_CONFLICT")
                proof=await self._capacity(conn,row["organization_id"],row["capacity_evidence_id"])
                if actor in (proof["submitted_by"],proof["original_reviewer"]):
                    raise HTTPException(403,detail="AID_REVIEWER_CONFLICT")
                publication_id=None
                if decision=="approved":
                    active=await conn.fetchrow(
                        """SELECT id,publication_version FROM hhba_publication_cases_private
                           WHERE organization_id=$1 AND status='published'""",
                        row["organization_id"])
                    if not active or profile["version"]!=active["publication_version"]:
                        raise HTTPException(409,detail="AID_PUBLISHED_VERSION_NOT_CURRENT")
                    publication_id=active["id"]
                updated=await conn.fetchrow(
                    """UPDATE hhba_aid_applications_private
                       SET status=$2,reviewed_by=$3,reviewed_at=now(),
                         decision_reason=$4,updated_at=now(),
                         approval_policy_version=$5,approved_publication_id=$6
                       WHERE id=$1 RETURNING *""",
                    row["id"],decision,actor,reason,
                    self.policy.version if decision=="approved" else None,publication_id)
                await conn.execute(
                    """INSERT INTO hhba_aid_events_private
                       (id,application_id,actor_id,action,old_status,new_status,reason)
                       VALUES($1,$2,$3,'reviewed',$4,$5,$6)""",
                    uuid4(),row["id"],actor,row["status"],decision,reason)
        return private_aid(updated)

    async def ensure_approved_live(self,conn,*,application_id:str,
                                   organization_id:str,certified:bool):
        require_policy(self.policy)
        row=await conn.fetchrow(
            """SELECT * FROM hhba_aid_applications_private
               WHERE id=$1 AND organization_id=$2 FOR SHARE""",
            uuid_or_404(application_id),uuid_or_404(organization_id))
        if not row:
            raise HTTPException(404,detail="AID_APPLICATION_NOT_FOUND")
        if row["status"]!="approved" or row["approval_policy_version"]!=self.policy.version:
            raise HTTPException(409,detail="AID_APPROVAL_NOT_CURRENT")
        proof=await self._capacity(conn,row["organization_id"],row["capacity_evidence_id"])
        if not certified:
            raise HTTPException(409,detail="EMPLOYER_CERTIFICATION_REQUIRED")
        return row

    async def close(self,*,application_id:str,actor_id:str,reviewer_organizations:dict[str,str],
                    reason:str)->dict:
        actor=uuid_or_404(actor_id)
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row=await conn.fetchrow(
                    "SELECT * FROM hhba_aid_applications_private WHERE id=$1 FOR UPDATE",
                    uuid_or_404(application_id))
                if not row:raise HTTPException(404,detail="AID_APPLICATION_NOT_FOUND")
                if (str(row["organization_id"]) in reviewer_organizations
                     or row["submitted_by"]==actor):
                    raise HTTPException(403,detail="AID_REVIEWER_CONFLICT")
                if row["status"] not in ("approved","needs_info","submitted"):
                    raise HTTPException(409,detail="AID_NOT_CLOSABLE")
                updated=await conn.fetchrow(
                    """UPDATE hhba_aid_applications_private
                       SET status='closed',updated_at=now()
                       WHERE id=$1 RETURNING *""",row["id"])
                await conn.execute(
                    """INSERT INTO hhba_aid_events_private
                       (id,application_id,actor_id,action,old_status,new_status,reason)
                       VALUES ($1,$2,$3,'closed',$4,'closed',$5)""",
                    uuid4(),row["id"],actor,row["status"],reason)
        return private_aid(updated)


class PostgresCommercialRepository:
    def __init__(self,pool,aid_repo:PostgresAidRepository):
        self.pool=pool;self.aid=aid_repo

    async def create(self,*,application_id:str,organization_id:str,buyer_reference:str,
                     buyer_sector:str,opportunity_type:str,purpose:str,
                     actor_id:str,certified:bool)->dict:
        if buyer_sector not in BUYER_SECTORS or opportunity_type not in OPPORTUNITY_TYPES:
            raise HTTPException(422,detail="OPPORTUNITY_CATEGORY_INVALID")
        valid_ref(buyer_reference)
        # Check live public profile outside the DB transaction to avoid nested connection locks.
        await self.aid._live(organization_id,certified)
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                await self.aid.ensure_approved_live(
                    conn,application_id=application_id,organization_id=organization_id,
                    certified=certified)
                item=await conn.fetchrow(
                    """INSERT INTO hhba_commercial_introductions_private
                       (id,application_id,organization_id,buyer_reference,buyer_sector,
                        opportunity_type,purpose,introduced_by)
                       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *""",
                    uuid4(),uuid_or_404(application_id),uuid_or_404(organization_id),
                    buyer_reference,buyer_sector,opportunity_type,purpose,
                    uuid_or_404(actor_id))
                await conn.execute(
                    """INSERT INTO hhba_commercial_events_private
                       (id,introduction_id,actor_id,action,next_stage)
                       VALUES($1,$2,$3,'identified','identified')""",
                    uuid4(),item["id"],uuid_or_404(actor_id))
        return private_lead(item)

    async def list_company(self,*,organization_id:str)->list[dict]:
        async with self.pool.acquire() as conn:
            rows=await conn.fetch(
                """SELECT i.*,(p.status='verified') AS order_verified
                   FROM hhba_commercial_introductions_private i
                   LEFT JOIN hhba_commercial_order_proofs_private p ON p.introduction_id=i.id
                   WHERE i.organization_id=$1
                     AND i.buyer_consent_verified_by IS NOT NULL
                     AND i.buyer_consent_reference IS NOT NULL
                   ORDER BY i.created_at DESC,i.id DESC LIMIT 100""",
                uuid_or_404(organization_id))
        return [private_lead(x,order_verified=bool(x["order_verified"])) for x in rows]

    async def verify_consent(self,*,introduction_id:str,actor_id:str,consent_ref:str,
                             reviewer_organizations:dict[str,str],certified:bool)->dict:
        valid_ref(consent_ref)
        async with self.pool.acquire() as conn:
            row=await conn.fetchrow(
                "SELECT organization_id FROM hhba_commercial_introductions_private WHERE id=$1",
                uuid_or_404(introduction_id))
            if not row:raise HTTPException(404,detail="INTRODUCTION_NOT_FOUND")
        org=str(row["organization_id"])
        await self.aid._live(org,certified)
        actor=uuid_or_404(actor_id)
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row=await conn.fetchrow(
                    "SELECT * FROM hhba_commercial_introductions_private WHERE id=$1 FOR UPDATE",
                    uuid_or_404(introduction_id))
                if (str(row["organization_id"]) in reviewer_organizations
                    or row["introduced_by"]==actor):
                    raise HTTPException(403,detail="CONSENT_REVIEWER_CONFLICT")
                await self.aid.ensure_approved_live(conn,application_id=str(row["application_id"]),
                                                    organization_id=org,certified=certified)
                stage_transition(row["stage"],"consent_verified")
                updated=await conn.fetchrow(
                    """UPDATE hhba_commercial_introductions_private SET
                       stage='consent_verified',buyer_consent_verified_by=$2,
                       buyer_consent_reference=$3,updated_at=now()
                       WHERE id=$1 RETURNING *""",row["id"],actor,consent_ref)
                await conn.execute(
                    """INSERT INTO hhba_commercial_events_private
                       (id,introduction_id,actor_id,action,prior_stage,next_stage)
                       VALUES($1,$2,$3,'consent_verified','identified','consent_verified')""",
                    uuid4(),row["id"],actor)
        return private_lead(updated)

    async def advance(self,*,introduction_id:str,actor_id:str,
                      stage:str,certified:bool)->dict:
        actor=uuid_or_404(actor_id)
        async with self.pool.acquire() as conn:
            row=await conn.fetchrow(
                "SELECT organization_id FROM hhba_commercial_introductions_private WHERE id=$1",
                uuid_or_404(introduction_id))
            if not row:raise HTTPException(404,detail="INTRODUCTION_NOT_FOUND")
        org=str(row["organization_id"])
        await self.aid._live(org,certified)
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row=await conn.fetchrow(
                    "SELECT * FROM hhba_commercial_introductions_private WHERE id=$1 FOR UPDATE",
                    uuid_or_404(introduction_id))
                await self.aid.ensure_approved_live(conn,application_id=str(row["application_id"]),
                                                    organization_id=org,certified=certified)
                stage_transition(row["stage"],stage)
                if stage=="consent_verified":
                    raise HTTPException(403,detail="INDEPENDENT_CONSENT_REVIEW_REQUIRED")
                prior=row["stage"]
                updated=await conn.fetchrow(
                    """UPDATE hhba_commercial_introductions_private
                       SET stage=$2,updated_at=now() WHERE id=$1 RETURNING *""",
                    row["id"],stage)
                await conn.execute(
                    """INSERT INTO hhba_commercial_events_private
                       (id,introduction_id,actor_id,action,prior_stage,next_stage)
                       VALUES($1,$2,$3,'stage_changed',$4,$5)""",
                    uuid4(),row["id"],actor,prior,stage)
        return private_lead(updated)

    async def submit_order_proof(self,*,introduction_id:str,actor_id:str,
                                 evidence_reference:str,certified:bool)->dict:
        valid_ref(evidence_reference)
        actor=uuid_or_404(actor_id)
        async with self.pool.acquire() as conn:
            org=await conn.fetchval(
                "SELECT organization_id FROM hhba_commercial_introductions_private WHERE id=$1",
                uuid_or_404(introduction_id))
        if not org:
            raise HTTPException(404,detail="INTRODUCTION_NOT_FOUND")
        await self.aid._live(str(org),certified)
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row=await conn.fetchrow(
                    "SELECT * FROM hhba_commercial_introductions_private WHERE id=$1 FOR SHARE",
                    uuid_or_404(introduction_id))
                if not row:raise HTTPException(404,detail="INTRODUCTION_NOT_FOUND")
                await self.aid.ensure_approved_live(
                    conn,application_id=str(row["application_id"]),
                    organization_id=str(org),certified=certified)
                if row["stage"] not in ("in_discussion","closed"):
                    raise HTTPException(409,detail="ORDER_PROOF_STAGE_INVALID")
                proof=await conn.fetchrow(
                    """INSERT INTO hhba_commercial_order_proofs_private
                       (id,introduction_id,evidence_reference,submitted_by)
                       VALUES($1,$2,$3,$4) ON CONFLICT (introduction_id)
                       DO NOTHING RETURNING *""",
                    uuid4(),row["id"],evidence_reference,actor)
                if proof is None:
                    raise HTTPException(409,detail="ORDER_PROOF_ALREADY_SUBMITTED")
                await conn.execute(
                    """INSERT INTO hhba_commercial_events_private
                       (id,introduction_id,actor_id,action,prior_stage,next_stage)
                       VALUES($1,$2,$3,'proof_submitted',$4,$4)""",
                    uuid4(),row["id"],actor,row["stage"])
        return {"id":str(proof["id"]),"status":"pending","notice":"只有独立复核真实凭证后才可标为已确认订单。"}

    async def verify_order(self,*,proof_id:str,actor_id:str,accepted:bool,
                           reason:str,reviewer_organizations:dict[str,str])->dict:
        actor=uuid_or_404(actor_id)
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                proof=await conn.fetchrow(
                    """SELECT p.*,i.organization_id,i.introduced_by,i.stage,i.buyer_consent_verified_by
                       FROM hhba_commercial_order_proofs_private p
                       JOIN hhba_commercial_introductions_private i ON i.id=p.introduction_id
                       WHERE p.id=$1 FOR UPDATE OF p""",uuid_or_404(proof_id))
                if not proof:raise HTTPException(404,detail="ORDER_PROOF_NOT_FOUND")
                if proof["status"]!="pending":
                    raise HTTPException(409,detail="ORDER_PROOF_ALREADY_REVIEWED")
                if (str(proof["organization_id"]) in reviewer_organizations or actor in
                    (proof["submitted_by"],proof["introduced_by"],proof["buyer_consent_verified_by"])):
                    raise HTTPException(403,detail="ORDER_PROOF_REVIEWER_CONFLICT")
                status="verified" if accepted else "rejected"
                updated=await conn.fetchrow(
                    """UPDATE hhba_commercial_order_proofs_private SET
                       status=$2,verified_by=$3,verified_at=now(),
                       verification_reason=$4 WHERE id=$1 RETURNING *""",
                    proof["id"],status,actor,reason)
                await conn.execute(
                    """INSERT INTO hhba_commercial_events_private
                       (id,introduction_id,actor_id,action,prior_stage,next_stage,explanation)
                       VALUES($1,$2,$3,'proof_reviewed',$4,$4,$5)""",
                    uuid4(),proof["introduction_id"],actor,proof["stage"],
                    "Independent order verification: "+status)
        return {"id":str(updated["id"]),"status":status,
                "notice":"订单须由独立人工审核与凭证核实，不能仅凭合作意向确认。"}
