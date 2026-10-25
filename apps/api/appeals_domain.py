"""HHBA Module 08: evidence/score appeals and confidential employee process concerns.

An appeal never changes an evidence verdict or a score by itself.
Only server-verified identities, independent appeal reviewers and append-only
events may advance a case. Employee report text/identity is NOT public.
"""
from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID
from fastapi import HTTPException

EMPLOYER_ISSUES = frozenset({"evidence_error", "score_method", "missing_proof", "outdated_fact"})
EMPLOYEE_ISSUES = frozenset({"identity_risk", "retaliation_risk", "eligibility_error", "consent_problem"})
OPEN_STATES = frozenset({"submitted", "needs_more_info", "under_review", "correction_required"})
CLOSED_STATES = frozenset({"rejected", "resolved_after_correction"})
DECISIONS = frozenset({"needs_more_info", "rejected", "correction_required"})
TARGETS = frozenset({"evidence", "scoring_run"})


def uuid(value: str, *, code: str = "ITEM_NOT_FOUND") -> UUID:
    try:
        return UUID(value)
    except (ValueError, TypeError):
        raise HTTPException(404, detail=code)


def validate_employer_appeal(*, target_type: str, issue: str,
                             explanation: str) -> str:
    if target_type not in TARGETS or issue not in EMPLOYER_ISSUES:
        raise HTTPException(422, detail="APPEAL_CATEGORY_INVALID")
    cleaned = explanation.strip()
    if len(cleaned) < 30 or len(cleaned) > 1200:
        raise HTTPException(422, detail="APPEAL_EXPLANATION_REQUIRED")
    return cleaned


def validate_employee_issue(issue: str) -> None:
    if issue not in EMPLOYEE_ISSUES:
        raise HTTPException(422, detail="EMPLOYEE_ISSUE_INVALID")


def validate_decision(status: str, decision: str, reason: str) -> str:
    if status not in {"submitted", "under_review", "needs_more_info"}:
        raise HTTPException(409, detail="APPEAL_NOT_REVIEWABLE")
    if decision not in DECISIONS:
        raise HTTPException(422, detail="REVIEW_DECISION_INVALID")
    text = reason.strip()
    if len(text) < 25 or len(text) > 1200:
        raise HTTPException(422, detail="REVIEW_REASON_REQUIRED")
    return text


def require_independent(*, reviewer_id: str, complainant_id: str | None,
                        challenged_actor_id: str | None, reviewer_member: bool) -> None:
    if reviewer_member or (complainant_id and reviewer_id == complainant_id) or (
        challenged_actor_id and reviewer_id == challenged_actor_id
    ):
        raise HTTPException(403, detail="APPEALS_REVIEWER_CONFLICT")


def sanitized_case(row: dict, *, reviewer: bool = False) -> dict:
    """Exclude reporters, identity mapping, audit actor IDs, raw employee detail."""
    data = {
        "id": str(row["id"]), "organization_id": str(row["organization_id"]),
        "kind": row["kind"], "issue": row["issue"], "status": row["status"],
        "created_at": row["created_at"].isoformat(),
        "updated_at": row["updated_at"].isoformat(),
    }
    if row["kind"] == "employer":
        data.update(target_type=row["target_type"],
                    target_id=str(row["target_id"]),
                    explanation=row["explanation"])
    # Employee case has *only fixed reason codes*; no free text.
    if reviewer:
        data["resolution"] = row["resolution"]
    return data


def public_appeals_state() -> dict:
    return {"publication": "not_enabled", "appeals": "confidential",
            "trust": {"status": "pending", "score": None},
            "care": {"status": "pending", "score": None}}
