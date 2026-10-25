"""Optional, RBAC-only review queue aggregates for HHBA modules 05-12.

No old /management password or spoofable HTTP role header can grant access.
Not mounted in apps/api/main.py until canonical session, CSRF, audit logging,
dedicated least-privilege PG pool and fresh reviewer memberships exist.
All replies are counts only: never return cases, employee identities or buyers.
"""
from __future__ import annotations

from collections.abc import Callable
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from .evidence_domain import Principal

# Static SQL only. Never interpolate a client-supplied table, status or column.
# The actor's employer memberships are excluded before aggregation.
QUEUES: dict[str, tuple[str, str]] = {
    "evidence": ("evidence_reviewer", """
        SELECT COUNT(*) FROM hhba_employer_evidence
        WHERE security_status='clean'
          AND status IN ('pending_review','needs_more_info')
          AND NOT (organization_id=ANY($1::uuid[]))
          AND submitted_by<>$2::uuid
    """),
    "appeals": ("appeals_reviewer", """
        SELECT COUNT(*) FROM hhba_appeal_cases_private
        WHERE status IN ('submitted','under_review','needs_more_info',
                         'correction_required')
          AND NOT (organization_id=ANY($1::uuid[]))
          AND employer_requester IS DISTINCT FROM $2::uuid
          AND challenged_actor_id IS DISTINCT FROM $2::uuid
    """),
    "improvements": ("improvement_reviewer", """
        SELECT COUNT(*) FROM hhba_employer_improvements_private
        WHERE status IN ('submitted','needs_more_info')
          AND NOT (organization_id=ANY($1::uuid[]))
          AND submitted_by<>$2::uuid
    """),
    "publication": ("publication_reviewer", """
        SELECT COUNT(*) FROM hhba_publication_cases_private
        WHERE status IN ('prepared','first_approved')
          AND NOT (organization_id=ANY($1::uuid[]))
          AND prepared_by<>$2::uuid
          AND first_reviewer IS DISTINCT FROM $2::uuid
    """),
    "aid": ("aid_reviewer", """
        SELECT COUNT(*) FROM hhba_aid_applications_private
        WHERE status IN ('submitted','needs_info')
          AND NOT (organization_id=ANY($1::uuid[]))
          AND submitted_by<>$2::uuid
    """),
    "buyer_consent": ("buyer_consent_reviewer", """
        SELECT COUNT(*) FROM hhba_commercial_introductions_private
        WHERE stage='identified' AND buyer_consent_verified_by IS NULL
          AND NOT (organization_id=ANY($1::uuid[]))
          AND introduced_by<>$2::uuid
    """),
    "order_proof": ("commercial_evidence_reviewer", """
        SELECT COUNT(*) FROM hhba_commercial_order_proofs_private p
        JOIN hhba_commercial_introductions_private i ON i.id=p.introduction_id
        WHERE p.status='pending'
          AND NOT (i.organization_id=ANY($1::uuid[]))
          AND p.submitted_by<>$2::uuid
    """),
}
REVIEWER_FLAGS = tuple(dict.fromkeys(role for role, _ in QUEUES.values()))
WORKSPACES = ("evidence", "care", "scoring", "appeals", "improvements",
              "publication", "aid", "commercial")


def reviewer_identity(actor: Principal | None) -> tuple[UUID, list[UUID]]:
    """Reject any identity without freshly verified reviewer privileges."""
    if actor is None:
        raise HTTPException(401, detail="AUTH_REQUIRED")
    if not isinstance(actor, Principal):
        raise HTTPException(503, detail="TRUSTED_REVIEWER_IDENTITY_REQUIRED")
    if not any(getattr(actor, flag, False) is True for flag in REVIEWER_FLAGS):
        raise HTTPException(403, detail="INDEPENDENT_REVIEWER_REQUIRED")
    try:
        uid = UUID(actor.user_id)
        excluded_orgs = [UUID(org) for org in actor.organization_roles]
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(503, detail="REVIEWER_IDENTITY_INVALID")
    return uid, excluded_orgs


class PostgresReviewerQueueReader:
    """Use a separately granted, SELECT-only PostgreSQL pool; never the DB owner."""

    def __init__(self, pool):
        self.pool = pool

    async def snapshot(self, actor: Principal) -> dict:
        uid, excluded = reviewer_identity(actor)
        results = {k: None for k in QUEUES}
        # Fail the entire snapshot closed if the read role lacks any granted
        # required table or a migration has not been deployed. No fake zeros.
        async with self.pool.acquire() as conn:
            for key, (role, sql) in QUEUES.items():
                if getattr(actor, role, False) is True:
                    number = await conn.fetchval(sql, excluded, uid)
                    if number is None or int(number) < 0:
                        raise RuntimeError("INVALID_QUEUE_AGGREGATE")
                    results[key] = int(number)

        modules = []
        for key in WORKSPACES:
            if key == "commercial":
                numbers = [results["buyer_consent"], results["order_proof"]]
                pending = sum(x for x in numbers if x is not None) if any(
                    x is not None for x in numbers) else None
            else:
                pending = results.get(key)
            modules.append({
                "key": key,
                "state": "connected" if pending is not None else "role_not_granted",
                "pending": pending,
                "total": None,
                "reviewAllowed": False,  # This endpoint never grants write actions.
            })
        return {
            "kind": "HHBA_REVIEWER_QUEUE_V1",
            "scope": "INDEPENDENT_REVIEWER_ONLY",
            "modules": modules,
            "notice": "仅统计当前独立审核员可见的待办候选；实际审批时仍须逐条复验资格和回避规则。",
        }


def build_reviewer_queue_router(*, resolve_actor: Callable,
                                reader: PostgresReviewerQueueReader) -> APIRouter:
    """Integrate only after trusted reviewer auth and dedicated PG reader exist.

    resolve_actor MUST consult canonical server-side session and current roles
    every request, never a browser role header, old admin cookie, or demo login.
    """
    if resolve_actor is None or reader is None:
        raise ValueError("TRUSTED_REVIEWER_DEPENDENCIES_REQUIRED")
    router = APIRouter(prefix="/api/v1", tags=["private-reviewer-queues"])

    @router.get("/admin/workspace/queues")
    async def reviewer_queues(actor: Principal = Depends(resolve_actor)):
        reviewer_identity(actor)
        try:
            data = await reader.snapshot(actor)
        except HTTPException:
            raise
        except Exception:
            # Database/schema errors are unavailable, never a zero queue.
            raise HTTPException(503, detail="REVIEWER_QUEUE_UNAVAILABLE")
        return JSONResponse(data, headers={
            "Cache-Control": "private, no-store, max-age=0",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
            "Vary": "Cookie",
        })

    return router
