"""Modules 11-12: truthful, permissioned business assistance and client introductions.

Application does not constitute approval; approval does not constitute a sale.
Thresholds are government/policy-dependent operational decisions, so the
server must explicitly approve and enable them. They are never client input.
"""
from __future__ import annotations
import re
from dataclasses import dataclass
from fastapi import HTTPException

SERVICE_TYPES=frozenset({"client_introduction","supply_chain","visibility"})
BUYER_SECTORS=frozenset({"manufacturing","retail","services","technology","logistics","other"})
OPPORTUNITY_TYPES=frozenset({"sales","distribution","procurement","partnership"})
STAGES=("identified","consent_verified","introduced","in_discussion","not_pursued","closed")
POLICY_VERSION="hhba-business-assistance-v0.1-review-only"


@dataclass(frozen=True)
class AidPolicy:
    enabled: bool=False
    min_trust: int|None=None
    min_care: int|None=None
    version: str=POLICY_VERSION

    def __post_init__(self):
        if self.enabled and (type(self.min_trust) is not int or type(self.min_care) is not int
                             or not 0<=self.min_trust<=100 or not 0<=self.min_care<=100):
            raise ValueError("Explicit independently approved thresholds required.")


def require_review_role(actor,role):
    if actor is None:
        raise HTTPException(401,detail="AUTH_REQUIRED")
    if not getattr(actor,role,False):
        raise HTTPException(403,detail="BUSINESS_REVIEWER_REQUIRED")
    return actor


def description(text: str, min_chars: int=40,max_chars:int=1000)->str:
    value=text.strip()
    if not min_chars<=len(value)<=max_chars:
        raise HTTPException(422,detail="BUSINESS_DESCRIPTION_INVALID")
    return value


def require_policy(policy:AidPolicy):
    if not policy.enabled:
        raise HTTPException(503,detail="AID_POLICY_NOT_APPROVED")


def verify_thresholds(public_profile:dict,policy:AidPolicy)->None:
    require_policy(policy)
    if public_profile.get("publication")!="published":
        raise HTTPException(409,detail="PUBLIC_GROWTH_ASSESSMENT_REQUIRED")
    trust=public_profile.get("trust",{}).get("score")
    care=public_profile.get("care",{}).get("score")
    if type(trust) is not int or type(care) is not int:
        raise HTTPException(409,detail="PUBLIC_GROWTH_ASSESSMENT_REQUIRED")
    if trust<policy.min_trust or care<policy.min_care:
        raise HTTPException(409,detail="AID_REQUIREMENTS_NOT_MET")


def private_aid(row,*,live:bool=True)->dict:
    status=row["status"]
    return {
        "id":str(row["id"]),"organization_id":str(row["organization_id"]),
        "service_type":row["service_type"],"business_summary":row["business_summary"],
        "capacity_summary":row["capacity_summary"],
        "capacity_evidence_id":str(row["capacity_evidence_id"]),
        "status":status if live else ("suspended" if status=="approved" else status),
        "created_at":row["created_at"].isoformat(),
        "reviewed_at":row["reviewed_at"].isoformat() if row["reviewed_at"] else None,
        "notice":"申请不保证审批通过；即使获准帮扶也不保证客户对接或成交。"
    }


def private_lead(row,*,order_verified:bool=False)->dict:
    return {
       "id":str(row["id"]),"organization_id":str(row["organization_id"]),
       "application_id":str(row["application_id"]),
       "buyer_reference":row["buyer_reference"],
       "buyer_sector":row["buyer_sector"],"opportunity_type":row["opportunity_type"],
       "purpose":row["purpose"],"stage":row["stage"],
       "created_at":row["created_at"].isoformat(),
       "order_status":"independently_verified" if order_verified else "not_verified",
       "notice":"引荐、洽谈和商业意向均不等于已签订真实订单。"
    }


def valid_ref(value:str)->str:
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,60}",value or ""):
        raise HTTPException(422,detail="INVALID_OPAQUE_REFERENCE")
    return value


def stage_transition(current:str,target:str):
    allowed={
      "identified":{"consent_verified","not_pursued"},
      "consent_verified":{"introduced","not_pursued"},
      "introduced":{"in_discussion","not_pursued"},
      "in_discussion":{"closed","not_pursued"},
      "not_pursued":set(),
      "closed":set()
    }
    if target not in allowed.get(current,set()):
        raise HTTPException(409,detail="INVALID_OPPORTUNITY_TRANSITION")
