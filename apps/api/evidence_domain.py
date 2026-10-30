"""HHBA employer evidence policy. No auth tokens, scores or employee feedback here.

All Principal objects MUST come from a trusted, server-side, freshly verified
HHBA session and organization-membership lookup. Never construct one from client
headers or unverified JWT claims.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping
from uuid import UUID

from fastapi import HTTPException

CATEGORIES = frozenset({
    "pay_and_contracts", "social_insurance", "working_hours",
    "employee_development", "recruitment_integrity", "business_integrity",
})
REVIEW_DECISIONS = frozenset({"verified", "needs_more_info", "rejected"})
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_STATEMENT_LENGTH = 1200
EMPLOYER_ROLES = frozenset({"owner", "admin", "hr_lead", "hr_recruiter", "authorized_agent"})


@dataclass(frozen=True)
class Principal:
    """Server-produced identity. Memberships must be checked afresh each request."""
    user_id: str
    organization_roles: Mapping[str, str]
    evidence_reviewer: bool = False
    scoring_reviewer: bool = False
    appeals_reviewer: bool = False
    improvement_reviewer: bool = False
    publication_preparer: bool = False
    publication_reviewer: bool = False
    aid_reviewer: bool = False
    business_matcher: bool = False
    buyer_consent_reviewer: bool = False
    commercial_evidence_reviewer: bool = False
    recruitment_reviewer: bool = False  # independent recruitment SLA reviewer, not employer/owner


def require_member(principal: Principal | None, organization_id: str) -> None:
    """Return 404 instead of disclosing whether another organization exists."""
    if principal is None:
        raise HTTPException(status_code=401, detail="AUTH_REQUIRED")
    try:
        UUID(organization_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="ORGANIZATION_NOT_FOUND")
    if principal.organization_roles.get(organization_id) not in EMPLOYER_ROLES:
        raise HTTPException(status_code=404, detail="ORGANIZATION_NOT_FOUND")


def require_reviewer(principal: Principal | None) -> None:
    if principal is None:
        raise HTTPException(status_code=401, detail="AUTH_REQUIRED")
    if not principal.evidence_reviewer:
        raise HTTPException(status_code=403, detail="REVIEWER_REQUIRED")


def validate_submission(category: str, statement: str) -> tuple[str, str]:
    if category not in CATEGORIES:
        raise HTTPException(status_code=422, detail="INVALID_CATEGORY")
    statement = statement.strip()
    if len(statement) < 12 or len(statement) > MAX_STATEMENT_LENGTH:
        raise HTTPException(status_code=422, detail="INVALID_STATEMENT")
    return category, statement


def validate_file(filename: str | None, payload: bytes) -> str:
    """Strict magic bytes; do not trust filename suffix or browser-supplied MIME."""
    if not payload or len(payload) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="FILE_SIZE_INVALID")
    name = (filename or "").lower()
    if name.endswith(".pdf") and payload.startswith(b"%PDF-"):
        return "application/pdf"
    if name.endswith((".jpg", ".jpeg")) and payload.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if name.endswith(".png") and payload.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    raise HTTPException(status_code=415, detail="UNSUPPORTED_FILE_TYPE")


def require_review_transition(current: str, decision: str) -> None:
    if decision not in REVIEW_DECISIONS:
        raise HTTPException(status_code=422, detail="INVALID_REVIEW_DECISION")
    if current not in {"pending_review", "needs_more_info"}:
        raise HTTPException(status_code=409, detail="EVIDENCE_NOT_REVIEWABLE")


def require_independent_review(submitter_id: str, reviewer_id: str) -> None:
    if submitter_id == reviewer_id:
        raise HTTPException(status_code=403, detail="SELF_REVIEW_FORBIDDEN")


def public_category(category: str) -> str:
    """Category is safe in an internal owner view; never include the uploaded file."""
    return category if category in CATEGORIES else "unknown"
