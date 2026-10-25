"""Module 10: public-facing employer score release policy.

This system is not a certification of labor-law compliance and never promises
business opportunities. All numbers require explicitly approved scoring rules,
double independent sign-off and continuously valid supporting evidence.
"""
from __future__ import annotations
import json

from datetime import datetime,timezone
from uuid import UUID
from fastapi import HTTPException

PUBLICATION_RULE = "hhba-publication-v0.1-draft"
PENDING_NOTICE = "企业公开评价尚处于核验或复核阶段。未经正式批准不展示信誉值与善待值。"
DECISIONS = frozenset({"first_approved","published","rejected"})


def uuid_or_404(value: str,code: str="RECORD_NOT_FOUND")->UUID:
    try:
        return UUID(value)
    except (ValueError,TypeError):
        raise HTTPException(404,detail=code)


def verify_reason(value: str)->str:
    value=value.strip()
    if len(value)<25 or len(value)>1200:
        raise HTTPException(422,detail="PUBLICATION_REVIEW_REASON_REQUIRED")
    return value


def ensure_candidate(candidate:dict,rule_version:str,approved_rules:frozenset[str])->None:
    if rule_version not in approved_rules:
        raise HTTPException(409,detail="RUBRIC_VERSION_NOT_APPROVED")
    if candidate.get("visibility")!="internal_only":
        raise HTTPException(409,detail="SCORING_RUN_NOT_PRIVATE")
    if candidate.get("help_eligibility")!="not_assessed":
        raise HTTPException(409,detail="AID_STATUS_UNEXPECTED")
    if not candidate.get("inputs",{}).get("certified"):
        raise HTTPException(409,detail="EMPLOYER_NOT_CERTIFIED")
    if candidate.get("inputs",{}).get("feedback_status")!="published":
        raise HTTPException(409,detail="PRIVATE_FEEDBACK_THRESHOLD_NOT_MET")
    for side in ("trust","care"):
        item=candidate.get(side)
        if not isinstance(item,dict):
            raise HTTPException(409,detail="SCORE_NOT_READY")
        score=item.get("score")
        if (item.get("status")!="calculated_private"
            or type(score) is not int or not 0<=score<=100
            or item.get("missing")!=[]):
            raise HTTPException(409,detail="SCORE_NOT_READY")


def reject_review_conflicts(*,actor_id:str,prepared_by:str,
                            first_reviewer:str|None,
                            calculated_by:str,
                            company_member:bool,
                            source_participants:set[str])->None:
    if (company_member or actor_id in source_participants or
        actor_id in {prepared_by,first_reviewer,calculated_by}):
        raise HTTPException(403,detail="PUBLICATION_REVIEWER_CONFLICT")


def pending_profile(*,improvements:list[dict]|None=None)->dict:
    return {
      "publication":"pending",
      "trust":{"status":"pending","score":None},
      "care":{"status":"pending","score":None},
      "version":None,
      "rule_version":None,
      "updated_at":None,
      "improvements":improvements or [],
      "notice":PENDING_NOTICE,
      "aid_eligibility":"not_assessed"
    }


def published_profile(*,case,improvements:list[dict])->dict:
    snapshot=case["score_snapshot"]
    if isinstance(snapshot,str):
        snapshot=json.loads(snapshot)
    return {
      "publication":"published",
      "trust":{"status":"verified_release","score":snapshot["trust"]},
      "care":{"status":"verified_release","score":snapshot["care"]},
      "version":case["publication_version"],
      "rule_version":case["rule_version"],
      "updated_at":case["published_at"].isoformat(),
      "improvements":improvements,
      "notice":"经独立复核批准的版本化评价，仅反映规定时间内的现有证据；不等于劳动合规或商业履约保证。",
      "aid_eligibility":"not_assessed"
    }


def private_case(row)->dict:
    return {
      "id":str(row["id"]),
      "organization_id":str(row["organization_id"]),
      "run_id":str(row["scoring_run_id"]),
      "status":row["status"],
      "rule_version":row["rule_version"],
      "feedback_period":row["feedback_period"],
      "version":row["publication_version"],
      "prepared_at":row["prepared_at"].isoformat(),
      "published_at":row["published_at"].isoformat() if row["published_at"] else None,
      "candidate":json.loads(row["score_snapshot"]) if isinstance(row["score_snapshot"],str) else row["score_snapshot"],
    }
