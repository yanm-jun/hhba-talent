"""Optional HHBA evidence API router. NOT mounted until canonical auth is wired.

The caller injects an existing, trusted session/membership dependency. There is
intentionally no password, API key, client-header or demo-auth fallback.
"""
from __future__ import annotations

from collections.abc import Callable

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .evidence_domain import (
    MAX_FILE_BYTES, Principal, require_member, require_reviewer,
    validate_file, validate_submission,
)
from .evidence_store import PrivateEvidenceVault, PostgresEvidenceRepository


class ReviewInput(BaseModel):
    decision: str = Field(min_length=4, max_length=30)
    reason: str = Field(min_length=12, max_length=1200)


def build_evidence_router(
    *,
    resolve_actor: Callable,
    repository: PostgresEvidenceRepository,
    vault: PrivateEvidenceVault,
) -> APIRouter:
    """Mount only after supplying real session + fresh org-role / reviewer checks."""
    router = APIRouter(prefix="/api/v1", tags=["employer-evidence"])

    @router.get("/organizations/{organization_id}/evidence")
    async def list_evidence(organization_id: str, actor: Principal = Depends(resolve_actor)):
        require_member(actor, organization_id)
        return {"items": await repository.list_by_organization(organization_id)}

    @router.post("/organizations/{organization_id}/evidence", status_code=201)
    async def submit_evidence(
        organization_id: str,
        category: str = Form(...),
        statement: str = Form(...),
        file: UploadFile = File(...),
        actor: Principal = Depends(resolve_actor),
    ):
        require_member(actor, organization_id)
        category, statement = validate_submission(category, statement)
        try:
            payload = await file.read(MAX_FILE_BYTES + 1)
        finally:
            await file.close()
        mime = validate_file(file.filename, payload)
        private_key, checksum = vault.put(payload)
        try:
            item = await repository.submit(
                organization_id=organization_id,
                category=category, statement=statement,
                private_storage_key=private_key,
                filename=file.filename or "evidence",
                mime=mime, file_size=len(payload),
                sha256=checksum, actor_id=actor.user_id,
            )
        except BaseException:
            vault.discard(private_key)
            raise
        return item

    @router.get("/organizations/{organization_id}/evidence/{item_id}/file")
    async def download_own_evidence(
        organization_id: str, item_id: str,
        actor: Principal = Depends(resolve_actor),
    ):
        require_member(actor, organization_id)
        row = await repository.get_private_item(item_id)
        if str(row["organization_id"]) != organization_id:
            raise HTTPException(404, detail="EVIDENCE_NOT_FOUND")
        return private_download(row, vault)

    @router.get("/admin/evidence")
    async def pending_evidence(actor: Principal = Depends(resolve_actor)):
        require_reviewer(actor)
        return {"items": await repository.list_pending_review()}

    @router.get("/admin/evidence/{item_id}/file")
    async def reviewer_download(
        item_id: str, actor: Principal = Depends(resolve_actor),
    ):
        require_reviewer(actor)
        row = await repository.get_private_item(item_id)
        return private_download(row, vault)

    @router.post("/admin/evidence/{item_id}/reviews")
    async def review_evidence(
        item_id: str, body: ReviewInput,
        actor: Principal = Depends(resolve_actor),
    ):
        require_reviewer(actor)
        return await repository.review(
            item_id=item_id, decision=body.decision,
            reason=body.reason, reviewer_id=actor.user_id)

    return router


def private_download(row, vault: PrivateEvidenceVault) -> Response:
    """Download is authenticated every time, never exposed as a public URL."""
    if row["security_status"] != "clean":
        raise HTTPException(409, detail="FILE_SECURITY_CHECK_REQUIRED")
    body = vault.get(row["private_storage_key"])
    return Response(
        content=body,
        media_type=row["file_mime"],
        headers={
            "Cache-Control": "private, no-store, max-age=0",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": 'attachment; filename="hhba-evidence"',
            "Referrer-Policy": "no-referrer",
        },
    )
