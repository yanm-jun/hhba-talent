"""Module 09 optional routes: attach only to trusted HHBA account & reviewer API.

Never mount inside current healthz-only apps/api/main.py until secure session,
CSRF, independent organization membership and reviewer permissions exist.
"""
from __future__ import annotations
from collections.abc import Callable
from datetime import date
from fastapi import APIRouter,Depends,HTTPException,Response
from pydantic import BaseModel,Field,ConfigDict,StrictBool
from .evidence_domain import Principal,require_member
from .improvements_domain import valid_uuid,validate_submission
from .improvements_store import PostgresImprovementsRepository


class ImprovementInput(BaseModel):
    model_config=ConfigDict(extra="forbid")
    evidence_id:str
    title:str=Field(min_length=8,max_length=100)
    description:str=Field(min_length=30,max_length=1200)
    effective_date:date

class ReviewInput(BaseModel):
    model_config=ConfigDict(extra="forbid")
    decision:str
    reason:str=Field(min_length=25,max_length=1200)
    public_summary:str|None=None
    privacy_checked:StrictBool=False

class ClarifyInput(BaseModel):
    model_config=ConfigDict(extra="forbid")
    clarification:str=Field(min_length=30,max_length=1200)

class RevokeInput(BaseModel):
    model_config=ConfigDict(extra="forbid")
    reason:str=Field(min_length=25,max_length=1200)


def require_improvement_reviewer(actor:Principal|None)->Principal:
    if actor is None:
        raise HTTPException(401,detail="AUTH_REQUIRED")
    if not actor.improvement_reviewer:
        raise HTTPException(403,detail="INDEPENDENT_IMPROVEMENT_REVIEWER_REQUIRED")
    return actor


def build_improvements_router(*,resolve_actor:Callable,
                              repository:PostgresImprovementsRepository)->APIRouter:
    router=APIRouter(prefix="/api/v1",tags=["private-employer-improvements"])

    @router.get("/public/organizations/{organization_id}/improvements")
    async def public(organization_id:str,response:Response):
        valid_uuid(organization_id,"ORGANIZATION_NOT_FOUND")
        response.headers["Cache-Control"]="no-store"  # Revocation or a disputed source must take effect immediately.
        return {"items":await repository.public_timeline(organization_id=organization_id),
                "notice":"仅展示经独立审核的改善事实，不代表企业已获整体信用评级或商业帮扶。"}

    @router.post("/organizations/{organization_id}/improvements",status_code=201)
    async def submit(organization_id:str,body:ImprovementInput,
                     actor:Principal=Depends(resolve_actor)):
        require_member(actor,organization_id)
        title,description=validate_submission(
            title=body.title,description=body.description,effective_date=body.effective_date)
        return await repository.submit(
            organization_id=organization_id,evidence_id=body.evidence_id,
            title=title,description=description,
            effective_date=body.effective_date,actor_id=actor.user_id)

    @router.get("/organizations/{organization_id}/improvements")
    async def mine(organization_id:str,actor:Principal=Depends(resolve_actor)):
        require_member(actor,organization_id)
        return {"items":await repository.mine(organization_id=organization_id)}

    @router.post("/organizations/{organization_id}/improvements/{improvement_id}/clarify")
    async def clarify(organization_id:str,improvement_id:str,body:ClarifyInput,
                      actor:Principal=Depends(resolve_actor)):
        require_member(actor,organization_id)
        return await repository.clarify(
            organization_id=organization_id,improvement_id=improvement_id,
            actor_id=actor.user_id,reason=body.clarification.strip())

    @router.get("/admin/improvements")
    async def queue(actor:Principal=Depends(resolve_actor)):
        actor=require_improvement_reviewer(actor)
        return {"items":await repository.queue(reviewer_organizations=dict(actor.organization_roles))}

    @router.post("/admin/improvements/{improvement_id}/review")
    async def review(improvement_id:str,body:ReviewInput,
                     actor:Principal=Depends(resolve_actor)):
        actor=require_improvement_reviewer(actor)
        return await repository.review(
            improvement_id=improvement_id,reviewer_id=actor.user_id,
            reviewer_organizations=dict(actor.organization_roles),
            decision=body.decision,reason=body.reason,
            summary=body.public_summary,privacy_checked=body.privacy_checked)

    @router.post("/admin/improvements/{improvement_id}/revoke")
    async def revoke(improvement_id:str,body:RevokeInput,
                     actor:Principal=Depends(resolve_actor)):
        actor=require_improvement_reviewer(actor)
        return await repository.revoke(
            improvement_id=improvement_id,actor_id=actor.user_id,
            reviewer_organizations=dict(actor.organization_roles),
            reason=body.reason)

    return router
