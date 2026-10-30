"""Appeal endpoints are optional until trusted HHBA identity & privacy service.

No user/role may be supplied from a client header or request JSON.
The organization and employee eligibility must be server-verified afresh.
"""
from __future__ import annotations
from collections.abc import Callable
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field

from .evidence_domain import Principal, require_member
from .feedback_domain import EmployeeActor, require_employee, require_employment
from .appeals_domain import (uuid, validate_employer_appeal, validate_employee_issue)
from .appeals_store import PostgresAppealsRepository


class EmployerAppealInput(BaseModel):
    model_config=ConfigDict(extra="forbid")
    organization_id: str
    target_type: str
    target_id: str
    issue: str
    explanation: str=Field(min_length=30,max_length=1200)


class EmployeeConcernInput(BaseModel):
    model_config=ConfigDict(extra="forbid")
    organization_id: str
    issue: str
    # No free text, document or employee identity is accepted in this intake.


class AppealReviewInput(BaseModel):
    model_config=ConfigDict(extra="forbid")
    decision: str
    reason: str=Field(min_length=25,max_length=1200)


class ClarificationInput(BaseModel):
    model_config=ConfigDict(extra="forbid")
    explanation: str=Field(min_length=30,max_length=1200)


def require_appeals_reviewer(actor: Principal | None) -> Principal:
    if actor is None:
        raise HTTPException(401,detail="AUTH_REQUIRED")
    if not actor.appeals_reviewer:
        raise HTTPException(403,detail="APPEALS_REVIEWER_REQUIRED")
    return actor


def build_appeals_router(
    *,
    resolve_actor: Callable,
    resolve_employee: Callable,
    verify_employment: Callable,
    repository: PostgresAppealsRepository,
) -> APIRouter:
    router=APIRouter(prefix="/api/v1", tags=["private-employer-appeals"])

    @router.post("/employer/appeals",status_code=201)
    async def employer_submit(body:EmployerAppealInput,response:Response,
                              actor:Principal=Depends(resolve_actor)):
        require_member(actor,body.organization_id)
        explanation=validate_employer_appeal(
            target_type=body.target_type,issue=body.issue,
            explanation=body.explanation)
        response.headers["Cache-Control"]="private, no-store"
        return await repository.open_employer(
            organization_id=body.organization_id,
            target_type=body.target_type,target_id=body.target_id,
            issue=body.issue,explanation=explanation,actor_id=actor.user_id)

    @router.get("/organizations/{organization_id}/appeals")
    async def employer_list(organization_id:str,actor:Principal=Depends(resolve_actor)):
        require_member(actor,organization_id)
        return {"items":await repository.list_employer(organization_id=organization_id)}

    @router.post("/organizations/{organization_id}/appeals/{appeal_id}/clarify")
    async def clarify(organization_id:str,appeal_id:str,body:ClarificationInput,
                      actor:Principal=Depends(resolve_actor)):
        require_member(actor,organization_id)
        explanation=validate_employer_appeal(
            target_type="evidence",issue="missing_proof",explanation=body.explanation)
        return await repository.clarify_employer(
            organization_id=organization_id,appeal_id=appeal_id,
            actor_id=actor.user_id,explanation=explanation)

    @router.post("/employee/privacy-concerns",status_code=201)
    async def employee_submit(body:EmployeeConcernInput,response:Response,
                              actor:EmployeeActor=Depends(resolve_employee)):
        actor=require_employee(actor)
        uuid(body.organization_id,code="ORGANIZATION_NOT_FOUND")
        # Independently validate actual/current employment, not company claims.
        verified=await verify_employment(actor,body.organization_id)
        require_employment(verified)
        validate_employee_issue(body.issue)
        response.headers["Cache-Control"]="private, no-store"
        return await repository.open_employee(
            organization_id=body.organization_id,
            issue=body.issue,actor_id=actor.user_id)

    @router.get("/employee/my-privacy-concerns")
    async def employee_list(actor:EmployeeActor=Depends(resolve_employee)):
        actor=require_employee(actor)
        return {"items":await repository.list_employee(actor_id=actor.user_id)}

    @router.get("/admin/appeals")
    async def pending(actor:Principal=Depends(resolve_actor)):
        require_appeals_reviewer(actor)
        return {"items":await repository.list_queue(reviewer_organizations=dict(actor.organization_roles))}

    @router.post("/admin/appeals/{appeal_id}/decisions")
    async def review(appeal_id:str,body:AppealReviewInput,
                     actor:Principal=Depends(resolve_actor)):
        actor=require_appeals_reviewer(actor)
        return await repository.decide(
            appeal_id=appeal_id,reviewer_id=actor.user_id,
            reviewer_organizations=dict(actor.organization_roles),
            decision=body.decision,reason=body.reason)

    return router
