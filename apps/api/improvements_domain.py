"""HHBA Module 09: independently evidenced workplace improvement records.

No fabricated progress chart or score change. Public publication is allowed
only after reviewed clean source evidence and explicit human privacy approval.
"""
from __future__ import annotations
from datetime import date,datetime,timezone,timedelta
from uuid import UUID
from fastapi import HTTPException

CATEGORIES=frozenset({
  "pay_and_contracts","social_insurance","working_hours",
  "employee_development","recruitment_integrity","business_integrity"})
DECISIONS=frozenset({"approved","needs_more_info","rejected"})
MIN_PUBLIC_SUMMARY=40
MAX_PUBLIC_SUMMARY=240
RULE_VERSION="hhba-improvement-v0.1-reviewed"


def valid_uuid(value: str, code: str="RECORD_NOT_FOUND")->UUID:
    try:
        return UUID(value)
    except (ValueError,TypeError):
        raise HTTPException(404,detail=code)


def validate_submission(*,title:str,description:str,effective_date:date)->tuple[str,str]:
    title=title.strip()
    description=description.strip()
    if not 8<=len(title)<=100 or not 30<=len(description)<=1200:
        raise HTTPException(422,detail="IMPROVEMENT_FIELDS_INVALID")
    # Reject future/implausibly old implementation dates. Do not project intent as fact.
    if effective_date>datetime.now(timezone.utc).date() or effective_date < date(2000,1,1):
        raise HTTPException(422,detail="EFFECTIVE_DATE_INVALID")
    return title,description


def validate_review(*,current:str,decision:str,reason:str,
                    summary:str|None,privacy_checked:bool)->str|None:
    if current not in {"submitted","needs_more_info"}:
        raise HTTPException(409,detail="IMPROVEMENT_NOT_REVIEWABLE")
    if decision not in DECISIONS:
        raise HTTPException(422,detail="REVIEW_DECISION_INVALID")
    if not 25<=len(reason.strip())<=1200:
        raise HTTPException(422,detail="REVIEW_REASON_REQUIRED")
    if decision=="approved":
        if not privacy_checked:
            raise HTTPException(409,detail="PRIVACY_ASSESSMENT_REQUIRED")
        if not summary or not MIN_PUBLIC_SUMMARY<=len(summary.strip())<=MAX_PUBLIC_SUMMARY:
            raise HTTPException(422,detail="PUBLIC_SUMMARY_INVALID")
        return summary.strip()
    return None


def public_item(row)->dict:
    """Fixed projection; never allow arbitrary file, reviewer or account fields."""
    return {
        "id":str(row["id"]),
        "category":row["category"],
        "summary":row["public_summary"],
        "effective_date":row["effective_date"].isoformat(),
        "reviewed_date":row["approved_at"].date().isoformat(),
        "evidence_kind":"hhba_independently_verified_document",
        "rule_version":RULE_VERSION,
        "score_change":"not_claimed",
        "notice":"记录仅说明已独立核验的改善事项，不构成法律合规认证或评分变动承诺。"
    }


def private_item(row)->dict:
    return {
        "id":str(row["id"]), "organization_id":str(row["organization_id"]),
        "evidence_id":str(row["evidence_id"]), "category":row["category"],
        "title":row["private_title"],"description":row["private_description"],
        "effective_date":row["effective_date"].isoformat(),
        "status":row["status"],
        "created_at":row["created_at"].isoformat(),
        "updated_at":row["status_updated_at"].isoformat(),
        # Do not reveal independent reviewer account or storage key.
        "public_summary":row["public_summary"] if row["status"]=="approved" else None,
    }
