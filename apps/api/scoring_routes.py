"""Optional score candidate routes.

DO NOT mount until independent certified-org and reviewer resolvers verified.
Public scores remain fail-closed until Module 08 appeals + publication governance.
"""
from __future__ import annotations
from collections.abc import Callable
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictInt
from .evidence_domain import Principal
from .scoring_domain import public_score_guard, require_org_id
from .scoring_store import PostgresScoringRepository


class AssessmentInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    organization_id: str
    evidence_id: str
    score: StrictInt = Field(ge=0, le=100)
    reason: str = Field(min_length=25, max_length=1200)


def require_assessor(actor: Principal | None) -> Principal:
    if actor is None:
        raise HTTPException(401, detail="AUTH_REQUIRED")
    if not actor.scoring_reviewer:
        raise HTTPException(403, detail="INDEPENDENT_SCORE_REVIEWER_REQUIRED")
    return actor


def build_scoring_router(
    *,
    resolve_actor: Callable,
    resolve_certification: Callable,
    repository: PostgresScoringRepository,
) -> APIRouter:
    """Certification provider must be backend-verified, not a request boolean.

    Caller must enforce trusted session & CSRF on POST, access logs, and rate limit.
    """
    router = APIRouter(prefix="/api/v1", tags=["private-employer-scoring"])

    @router.get("/public/organizations/{organization_id}/scores")
    async def public_score(organization_id: str):
        require_org_id(organization_id)
        return public_score_guard()

    @router.post("/admin/scoring/assessments")
    async def assess(body: AssessmentInput, actor: Principal = Depends(resolve_actor)):
        require_assessor(actor)
        return await repository.assess_evidence(
            organization_id=body.organization_id, evidence_id=body.evidence_id,
            score=body.score, reason=body.reason, assessor_id=actor.user_id)

    @router.post("/admin/scoring/organizations/{organization_id}/calculate")
    async def calculate(organization_id: str, actor: Principal = Depends(resolve_actor)):
        require_assessor(actor)
        require_org_id(organization_id)
        certified = bool(await resolve_certification(organization_id))
        return await repository.calculate_private(
            organization_id=organization_id, calculated_by=actor.user_id,
            certified=certified)

    @router.get("/admin/scoring/organizations/{organization_id}/latest")
    async def latest(organization_id: str, actor: Principal = Depends(resolve_actor)):
        require_assessor(actor)
        return await repository.latest_private(organization_id=organization_id)

    return router
