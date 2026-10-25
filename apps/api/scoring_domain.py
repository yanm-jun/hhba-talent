"""HHBA Module 07: deterministic candidate scoring, not automatic public judgment.

The scores are INTERNAL DRAFTS until independent appeals (module 08), human
publication and policy governance are implemented. A 'verified' uploaded file
alone cannot create a numeric finding; a separate assessor must inspect it.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID
from fastapi import HTTPException

RULE_VERSION = "hhba-employer-v0.1-draft"
MAX_AGE_DAYS = 365
# Evidence-grounded assessment weights; require ALL categories, not an average of
# whichever documents a company happens to provide.
TRUST_WEIGHTS = {"recruitment_integrity": 50, "business_integrity": 50}
CARE_WEIGHTS = {
    "pay_and_contracts": 20,
    "social_insurance": 20,
    "working_hours": 15,
    "employee_development": 15,
}
FEEDBACK_WEIGHT = 30
FEEDBACK_DIMENSIONS = ("pay", "insurance", "rest", "respect", "development")
ALL_CATEGORIES = frozenset(TRUST_WEIGHTS | CARE_WEIGHTS)
assert sum(TRUST_WEIGHTS.values()) == 100
assert sum(CARE_WEIGHTS.values()) + FEEDBACK_WEIGHT == 100


def require_org_id(value: str) -> UUID:
    try:
        return UUID(value)
    except (TypeError, ValueError):
        raise HTTPException(404, detail="ORGANIZATION_NOT_FOUND")


def validate_assessment(score: int, reason: str) -> tuple[int, str]:
    if type(score) is not int or not 0 <= score <= 100:
        raise HTTPException(422, detail="INVALID_ASSESSMENT_SCORE")
    reason = reason.strip()
    if len(reason) < 25 or len(reason) > 1200:
        raise HTTPException(422, detail="ASSESSMENT_REASON_REQUIRED")
    return score, reason


def is_fresh(value: datetime, now: datetime) -> bool:
    if value.tzinfo is None:
        return False
    value = value.astimezone(timezone.utc)
    return now - timedelta(days=MAX_AGE_DAYS) <= value <= now


def _round(x: Decimal) -> int:
    return int(x.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def evaluate_candidate(*, findings: list[dict], feedback: dict | None,
                       certified: bool, now: datetime | None = None) -> dict:
    """No scores when missing proof, old proof, overlapping duplicates or feedback.

    'findings' must be sourced from independently reviewed, currently VERIFIED,
    clean evidence; reject all derived-from-client or untrusted values upstream.
    Newest valid finding for each category must be selected in the repository
    using the immutable assessment sequence, not caller-controlled ordering.
    """
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    by_category: dict[str, dict] = {}
    seen_categories: set[str] = set()
    for f in findings:
        cat = f.get("category")
        if cat not in ALL_CATEGORIES or cat in seen_categories:
            continue
        seen_categories.add(cat)  # Never resurrect an older score if the latest proof was disputed.
        if (f.get("evidence_status") != "verified"
            or f.get("security_status") != "clean"
            or type(f.get("score")) is not int
            or not 0 <= f["score"] <= 100
            or not isinstance(f.get("reviewed_at"), datetime)
            or not is_fresh(f["reviewed_at"], now)):
            continue
        by_category[cat] = f

    missing_trust = sorted(set(TRUST_WEIGHTS) - set(by_category))
    missing_care = sorted(set(CARE_WEIGHTS) - set(by_category))
    base = {
        "rule_version": RULE_VERSION,
        "visibility": "internal_only",
        "publication": "blocked_pending_appeals_and_policy_approval",
        "help_eligibility": "not_assessed",
        "trust": {"status": "pending", "score": None, "missing": missing_trust},
        "care": {"status": "pending", "score": None, "missing": missing_care},
        "inputs": {"certified": bool(certified),
                   "evidence_categories": sorted(by_category),
                   "feedback_status": feedback.get("status") if feedback else "not_available"},
    }
    if certified and not missing_trust:
        score = _round(sum(Decimal(by_category[k]["score"]) * Decimal(v)
                           for k, v in TRUST_WEIGHTS.items()) / Decimal(100))
        base["trust"] = {"status": "calculated_private", "score": score,
                         "missing": []}
    if feedback and feedback.get("status") == "published":
        ratings = feedback.get("scores_out_of_5")
        if not isinstance(ratings, dict) or set(ratings) != set(FEEDBACK_DIMENSIONS):
            ratings = None
        elif any(isinstance(ratings[k], bool) or not isinstance(ratings[k], (float, int, Decimal))
                 or not 1 <= Decimal(str(ratings[k])) <= 5
                 for k in FEEDBACK_DIMENSIONS):
            ratings = None
    else:
        ratings = None
    if certified and not missing_care and ratings is not None:
        # 1..5 subjective employee feedback -> 0..100, with capped 30% weight.
        employee = sum(Decimal(str(ratings[k])) for k in FEEDBACK_DIMENSIONS) / Decimal(5)
        employee_score = (employee - Decimal(1)) * Decimal(25)
        official = sum(Decimal(by_category[k]["score"]) * Decimal(weight)
                       for k, weight in CARE_WEIGHTS.items())
        total = (official + employee_score * Decimal(FEEDBACK_WEIGHT)) / Decimal(100)
        base["care"] = {"status": "calculated_private", "score": _round(total),
                        "missing": []}
    if not certified:
        base["trust"]["status"] = "pending"
        base["trust"]["score"] = None
        base["care"]["status"] = "pending"
        base["care"]["score"] = None
    return base


def public_score_guard() -> dict:
    """Fail closed. Module 08/09 must implement independent appeal/publication."""
    return {
        "trust": {"status": "pending", "score": None},
        "care": {"status": "pending", "score": None},
        "rule_version": RULE_VERSION,
        "publication": "not_enabled",
        "notice": "评分体系尚处于审核试点。未建立申诉与公示审批机制前，不发布任何企业分数。",
    }
