"""Optional employee feedback router; intentionally NOT mounted in apps/api/main.py.

Only integrate when a verified HHBA session and INDEPENDENT employment proof
resolver are in production. Neither org admins nor browsers issue eligibility.
"""
from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field, StrictInt, ConfigDict

from .feedback_domain import (
    DIMENSIONS, EmployeeActor, current_period, identity_hash, new_ticket,
    org_uuid, require_employee, require_employment, ticket_expiry,
    token_hash, validate_ratings,
)
from .feedback_store import PostgresFeedbackRepository


class EligibilityInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    organization_id: str


class FeedbackInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    organization_id: str
    ticket: str = Field(min_length=64, max_length=64)
    # Disallow unbounded comments, personal data and unexpected keys.
    pay: StrictInt = Field(ge=1, le=5)
    insurance: StrictInt = Field(ge=1, le=5)
    rest: StrictInt = Field(ge=1, le=5)
    respect: StrictInt = Field(ge=1, le=5)
    development: StrictInt = Field(ge=1, le=5)


def build_feedback_router(
    *,
    resolve_employee: Callable,
    verify_employment: Callable,
    repository: PostgresFeedbackRepository,
    hmac_secret: bytes,
) -> APIRouter:
    """Dependencies MUST perform actual account/CSRF + independent employment checks.

    resolve_employee -> trusted EmployeeActor authenticated from server session;
    verify_employment(actor, org_uuid) -> awaitable bool from independent proof.
    """
    if len(hmac_secret) < 32:
        raise RuntimeError("Missing secure feedback identity/ticket HMAC key")
    router = APIRouter(prefix="/api/v1", tags=["protected-employee-feedback"])

    async def check(actor: EmployeeActor | None, oid: str) -> EmployeeActor:
        actor = require_employee(actor)
        org_uuid(oid)
        verified = await verify_employment(actor, oid)
        require_employment(verified)
        return actor

    @router.post("/employee-feedback/ticket")
    async def issue_ticket(body: EligibilityInput, response: Response,
                           actor: EmployeeActor = Depends(resolve_employee)):
        actor = await check(actor, body.organization_id)
        response.headers['Cache-Control'] = 'private, no-store'
        response.headers['Referrer-Policy'] = 'no-referrer'
        period = current_period()
        token = new_ticket()
        await repository.issue_ticket(
            organization_id=body.organization_id,
            period=period,
            subject_hmac=identity_hash(hmac_secret, actor.user_id, body.organization_id, period),
            token_hmac=token_hash(hmac_secret, token),
            expires_at=ticket_expiry())
        return {
            "ticket": token, "period": period,
            "notice": "仅限本人提交本季度一次反馈。请勿转发资格凭据。"
        }

    @router.post("/employee-feedback", status_code=201)
    async def submit_feedback(body: FeedbackInput, response: Response,
                              actor: EmployeeActor = Depends(resolve_employee)):
        actor = await check(actor, body.organization_id)
        response.headers['Cache-Control'] = 'private, no-store'
        period = current_period()
        ratings = validate_ratings({key:getattr(body,key) for key in DIMENSIONS})
        await repository.redeem(
            organization_id=body.organization_id, period=period,
            subject_hmac=identity_hash(hmac_secret, actor.user_id, body.organization_id, period),
            token_hmac=token_hash(hmac_secret, body.ticket), ratings=ratings)
        return {
            "accepted": True,
            "period": period,
            "notice": "反馈已接收。仅符合公开门槛的季度汇总可供企业和公众查看；不可保证绝对匿名。"
        }

    @router.get("/public/organizations/{organization_id}/employee-feedback/{period}")
    async def public_aggregate(organization_id: str, period: str):
        org_uuid(organization_id)
        return await repository.public_aggregate(organization_id=organization_id, period=period)

    return router
