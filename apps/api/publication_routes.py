"""Optional publication endpoints. Not installed until HHBA production identity, CSRF and approved policy.

Feature is OFF by default. Only backend can enable via explicit construction,
and approved scoring rules must be configured, never supplied by client input.
"""
from __future__ import annotations
from collections.abc import Callable
from fastapi import APIRouter,Depends,HTTPException,Response
from pydantic import BaseModel,ConfigDict,Field
from .evidence_domain import Principal
from .publication_domain import uuid_or_404
from .publication_store import PostgresPublicationRepository


class PrepareBody(BaseModel):
    model_config=ConfigDict(extra="forbid")
    organization_id:str
    scoring_run_id:str


class DecideBody(BaseModel):
    model_config=ConfigDict(extra="forbid")
    decision:str
    reason:str=Field(min_length=25,max_length=1200)


class RevokeBody(BaseModel):
    model_config=ConfigDict(extra="forbid")
    reason:str=Field(min_length=25,max_length=1200)


def trusted_role(actor:Principal|None,which:str)->Principal:
    if actor is None:
        raise HTTPException(401,detail="AUTH_REQUIRED")
    if not getattr(actor,which,False):
        raise HTTPException(403,detail="PUBLICATION_ROLE_REQUIRED")
    return actor


def build_publication_router(*,resolve_actor:Callable,resolve_certification:Callable,
                             repository:PostgresPublicationRepository,
                             policy_enabled:bool=False)->APIRouter:
    router=APIRouter(prefix="/api/v1",tags=["employer-publication-governance"])

    @router.get("/public/organizations/{organization_id}/growth-profile")
    async def profile(organization_id:str,response:Response):
        uuid_or_404(organization_id)
        # Do not cache revoked, disputed or out-of-date public scores.
        response.headers["Cache-Control"]="no-store"
        certified=bool(await resolve_certification(organization_id)) if policy_enabled else False
        return await repository.public_profile(
            organization_id=organization_id,certified=certified,policy_enabled=policy_enabled)

    @router.get("/public/organizations/{organization_id}/growth-profile/versions")
    async def public_versions(organization_id:str,response:Response):
        uuid_or_404(organization_id)
        response.headers["Cache-Control"]="no-store"
        return {"items":await repository.public_history(
            organization_id=organization_id,policy_enabled=policy_enabled)}

    def require_enabled():
        if not policy_enabled:
            raise HTTPException(503,detail="PUBLICATION_POLICY_NOT_APPROVED")

    @router.post("/admin/publication/prepare",status_code=201)
    async def prepare(body:PrepareBody,actor:Principal=Depends(resolve_actor)):
        trusted_role(actor,"publication_preparer")
        require_enabled()
        certified=bool(await resolve_certification(body.organization_id))
        return await repository.prepare(
            organization_id=body.organization_id,run_id=body.scoring_run_id,
            actor_id=actor.user_id,reviewer_organizations=dict(actor.organization_roles),
            certified=certified)

    @router.get("/admin/publication/queue")
    async def queue(actor:Principal=Depends(resolve_actor)):
        trusted_role(actor,"publication_reviewer")
        require_enabled()
        return {"items":await repository.queue(reviewer_organizations=dict(actor.organization_roles))}

    @router.post("/admin/publication/{publication_id}/decision")
    async def decide(publication_id:str,body:DecideBody,
                     actor:Principal=Depends(resolve_actor)):
        trusted_role(actor,"publication_reviewer")
        require_enabled()
        # Resolve org from database, not input. Certification verification is
        # based on the actual case's organization (never a supplied org ID).
        async with repository.pool.acquire() as conn:
            org=await conn.fetchval(
                "SELECT organization_id FROM hhba_publication_cases_private WHERE id=$1",
                uuid_or_404(publication_id))
        if org is None:
            raise HTTPException(404,detail="PUBLICATION_CASE_NOT_FOUND")
        certified=bool(await resolve_certification(str(org)))
        return await repository.decide(
            publication_id=publication_id,actor_id=actor.user_id,
            decision=body.decision,reason=body.reason,
            reviewer_organizations=dict(actor.organization_roles),
            certified=certified)

    @router.post("/admin/publication/{publication_id}/revoke")
    async def revoke(publication_id:str,body:RevokeBody,
                     actor:Principal=Depends(resolve_actor)):
        trusted_role(actor,"publication_reviewer")
        require_enabled()
        return await repository.revoke(
            publication_id=publication_id,actor_id=actor.user_id,
            reason=body.reason,reviewer_organizations=dict(actor.organization_roles))

    return router
