"""Optional Modules 11+12 endpoints, disabled by default.

The trusted HHBA server must inject current sessions, CSRF, organization membership,
verified enterprise certification, explicitly approved policies and sensitive-data
logging controls. Never mount a demo user into real assistance or client referrals.
"""
from __future__ import annotations
from collections.abc import Callable
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,ConfigDict,Field,StrictBool
from .evidence_domain import Principal,require_member
from .publication_domain import uuid_or_404
from .aid_domain import description,require_review_role,require_policy
from .aid_store import PostgresAidRepository,PostgresCommercialRepository


class AidSubmit(BaseModel):
    model_config=ConfigDict(extra="forbid")
    service_type:str
    business_summary:str=Field(min_length=40,max_length=1000)
    capacity_summary:str=Field(min_length=40,max_length=1000)
    capacity_evidence_id:str

class AidDecision(BaseModel):
    model_config=ConfigDict(extra="forbid")
    decision:str
    reason:str=Field(min_length=25,max_length=1200)

class LeadSubmit(BaseModel):
    model_config=ConfigDict(extra="forbid")
    application_id:str
    organization_id:str
    buyer_reference:str
    buyer_sector:str
    opportunity_type:str
    purpose:str=Field(min_length=30,max_length=500)

class ConsentReview(BaseModel):
    model_config=ConfigDict(extra="forbid")
    buyer_consent_reference:str

class LeadStage(BaseModel):
    model_config=ConfigDict(extra="forbid")
    stage:str

class ProofSubmit(BaseModel):
    model_config=ConfigDict(extra="forbid")
    evidence_reference:str

class ProofReview(BaseModel):
    model_config=ConfigDict(extra="forbid")
    accepted:StrictBool
    reason:str=Field(min_length=25,max_length=1200)


def build_aid_router(*,resolve_actor:Callable,resolve_certification:Callable,
                     aid:PostgresAidRepository,commercial:PostgresCommercialRepository,
                     workflow_enabled:bool=False)->APIRouter:
    router=APIRouter(prefix="/api/v1",tags=["private-hhba-employer-aid"])

    def enabled():
        if not workflow_enabled:
            raise HTTPException(503,detail="AID_WORKFLOW_NOT_DEPLOYED")

    async def org_for(table:str,item_id:str)->str:
        columns={
            "aid":"hhba_aid_applications_private",
            "lead":"hhba_commercial_introductions_private"
        }
        if table not in columns:
            raise HTTPException(404,detail="RECORD_NOT_FOUND")
        async with aid.pool.acquire() as conn:
            org=await conn.fetchval(
                f"SELECT organization_id FROM {columns[table]} WHERE id=$1",
                uuid_or_404(item_id))
        if org is None:
            raise HTTPException(404,detail="RECORD_NOT_FOUND")
        return str(org)

    @router.post("/organizations/{org_id}/aid-applications",status_code=201)
    async def submit(org_id:str,body:AidSubmit,actor:Principal=Depends(resolve_actor)):
        require_member(actor,org_id)
        enabled()
        return await aid.submit(
            organization_id=org_id,service_type=body.service_type,
            business_summary=description(body.business_summary),
            capacity_summary=description(body.capacity_summary),
            capacity_evidence_id=body.capacity_evidence_id,actor_id=actor.user_id)

    @router.get("/organizations/{org_id}/aid-applications")
    async def mine(org_id:str,actor:Principal=Depends(resolve_actor)):
        require_member(actor,org_id)
        enabled()
        return {"items":await aid.list_company(
            organization_id=org_id,certified=bool(await resolve_certification(org_id)))}

    @router.get("/admin/aid-applications")
    async def queue(actor:Principal=Depends(resolve_actor)):
        actor=require_review_role(actor,"aid_reviewer")
        enabled()
        return {"items":await aid.queue(reviewer_organizations=dict(actor.organization_roles))}

    @router.post("/admin/aid-applications/{application_id}/review")
    async def review(application_id:str,body:AidDecision,actor:Principal=Depends(resolve_actor)):
        actor=require_review_role(actor,"aid_reviewer")
        enabled()
        org=await org_for("aid",application_id)
        return await aid.review(
            application_id=application_id,actor_id=actor.user_id,
            decision=body.decision,reason=description(body.reason,25,1200),
            reviewer_organizations=dict(actor.organization_roles),
            certified=bool(await resolve_certification(org)))

    @router.post("/admin/aid-applications/{application_id}/close")
    async def close(application_id:str,body:AidDecision,actor:Principal=Depends(resolve_actor)):
        actor=require_review_role(actor,"aid_reviewer")
        enabled()
        return await aid.close(
            application_id=application_id,actor_id=actor.user_id,
            reviewer_organizations=dict(actor.organization_roles),
            reason=description(body.reason,25,1200))

    @router.get("/organizations/{org_id}/client-introductions")
    async def leads(org_id:str,actor:Principal=Depends(resolve_actor)):
        require_member(actor,org_id)
        enabled()
        return {"items":await commercial.list_company(organization_id=org_id)}

    @router.post("/admin/client-introductions",status_code=201)
    async def create_lead(body:LeadSubmit,actor:Principal=Depends(resolve_actor)):
        actor=require_review_role(actor,"business_matcher")
        enabled()
        if body.organization_id in actor.organization_roles:
            raise HTTPException(403,detail="MATCHER_ORGANIZATION_CONFLICT")
        return await commercial.create(
            application_id=body.application_id,organization_id=body.organization_id,
            buyer_reference=body.buyer_reference,buyer_sector=body.buyer_sector,
            opportunity_type=body.opportunity_type,purpose=description(body.purpose,30,500),
            actor_id=actor.user_id,
            certified=bool(await resolve_certification(body.organization_id)))

    @router.post("/admin/client-introductions/{introduction_id}/verify-consent")
    async def verify_consent(introduction_id:str,body:ConsentReview,
                             actor:Principal=Depends(resolve_actor)):
        actor=require_review_role(actor,"buyer_consent_reviewer")
        enabled()
        org=await org_for("lead",introduction_id)
        return await commercial.verify_consent(
            introduction_id=introduction_id,actor_id=actor.user_id,
            consent_ref=body.buyer_consent_reference,
            reviewer_organizations=dict(actor.organization_roles),
            certified=bool(await resolve_certification(org)))

    @router.post("/admin/client-introductions/{introduction_id}/stage")
    async def advance(introduction_id:str,body:LeadStage,actor:Principal=Depends(resolve_actor)):
        actor=require_review_role(actor,"business_matcher")
        enabled()
        org=await org_for("lead",introduction_id)
        if org in actor.organization_roles:
            raise HTTPException(403,detail="MATCHER_ORGANIZATION_CONFLICT")
        return await commercial.advance(
            introduction_id=introduction_id,actor_id=actor.user_id,stage=body.stage,
            certified=bool(await resolve_certification(org)))

    @router.post("/admin/client-introductions/{introduction_id}/order-proof",status_code=201)
    async def claim_order(introduction_id:str,body:ProofSubmit,
                          actor:Principal=Depends(resolve_actor)):
        actor=require_review_role(actor,"business_matcher")
        enabled()
        org=await org_for("lead",introduction_id)
        if org in actor.organization_roles:
            raise HTTPException(403,detail="MATCHER_ORGANIZATION_CONFLICT")
        return await commercial.submit_order_proof(
            introduction_id=introduction_id,actor_id=actor.user_id,
            evidence_reference=body.evidence_reference,
            certified=bool(await resolve_certification(org)))

    @router.post("/admin/order-proofs/{proof_id}/verify")
    async def verify_order(proof_id:str,body:ProofReview,
                           actor:Principal=Depends(resolve_actor)):
        actor=require_review_role(actor,"commercial_evidence_reviewer")
        enabled()
        return await commercial.verify_order(
            proof_id=proof_id,actor_id=actor.user_id,accepted=body.accepted,
            reason=description(body.reason,25,1200),
            reviewer_organizations=dict(actor.organization_roles))
    return router
