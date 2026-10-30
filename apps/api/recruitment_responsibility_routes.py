"""Opt-in HHBA response responsibility routes. Never mount without real session/RBAC.

All mutations happen inside the canonical hiring application service, not here.
Production must verify applicant ownership, fresh organization membership and
reviewer separation on every request, and use its CSRF / durable outbox layer.
"""
from __future__ import annotations

from collections.abc import Callable
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from .evidence_domain import Principal, require_member
from .recruitment_responsibility_domain import require_response_reviewer
from .recruitment_responsibility_store import PostgresRecruitmentResponsibilityStore

def build_recruitment_responsibility_router(*, resolve_actor: Callable,
                                              repository: PostgresRecruitmentResponsibilityStore) -> APIRouter:
    if resolve_actor is None or repository is None:
        raise ValueError("TRUSTED_SESSION_AND_REPOSITORY_REQUIRED")
    router=APIRouter(prefix="/api/v1",tags=["recruitment-responsibility"])
    async def fetch_private(call):
        try:
            result=await call
            return JSONResponse(content=jsonable_encoder(result), headers={
                "Cache-Control":"private, no-store, max-age=0",
                "Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","Vary":"Cookie",
            })
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=503,detail="RESPONSIBILITY_BACKEND_UNAVAILABLE")

    @router.get("/organizations/{organization_id}/postings/{posting_id}/recruitment-responsibilities")
    async def employer_queue(organization_id: str, posting_id: str,
                             actor: Principal=Depends(resolve_actor)):
        require_member(actor,organization_id)
        try:
            UUID(posting_id)
        except (ValueError,TypeError):
            raise HTTPException(404,detail="POSTING_NOT_FOUND")
        return await fetch_private(repository.list_for_employer(
            organization_id=organization_id,posting_id=posting_id))

    @router.get("/me/recruitment-responsibilities")
    async def my_queue(actor: Principal=Depends(resolve_actor)):
        if actor is None:
            raise HTTPException(401,detail="AUTH_REQUIRED")
        try:
            UUID(actor.user_id)
        except (ValueError,TypeError,AttributeError):
            raise HTTPException(503,detail="TRUSTED_CANDIDATE_IDENTITY_REQUIRED")
        return await fetch_private(repository.list_for_candidate(candidate_id=actor.user_id))

    @router.get("/admin/recruitment-responsibilities")
    async def independent_reviewer_queue(view: str="overdue",
                                         actor: Principal=Depends(resolve_actor)):
        require_response_reviewer(actor)
        if view!="overdue":
            raise HTTPException(422,detail="UNSUPPORTED_REVIEW_SCOPE")
        try:
            excluded=list(actor.organization_roles)
            for org in excluded:
                UUID(org)
        except (ValueError,TypeError):
            raise HTTPException(503,detail="TRUSTED_MEMBERSHIPS_REQUIRED")
        return await fetch_private(repository.list_overdue_for_reviewer(
            excluded_organizations=excluded))
    return router
