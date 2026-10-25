"""Private, append-only rubric findings and reproducible internal scoring runs.

No public score is emitted here. Upload verification is NOT a rubric assessment.
The assessor must be a separate trusted reviewer and explain a 0-100 judgement.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException

from .feedback_domain import current_period
from .scoring_domain import (
    ALL_CATEGORIES, RULE_VERSION, evaluate_candidate, is_fresh,
    require_org_id, validate_assessment,
)


def last_completed_quarter(now: datetime | None = None) -> str:
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    quarter = 1 + (now.month - 1) // 3
    return f"{now.year - 1}-Q4" if quarter == 1 else f"{now.year}-Q{quarter - 1}"


def public_finding(row) -> dict:
    """Internal reviewer view: no filenames, docs, employee IDs or account identities."""
    return {
        "id": str(row["id"]), "category": row["category"],
        "assessed_score": row["assessed_score"],
        "evidence_id": str(row["evidence_id"]),
        "assessed_at": row["assessed_at"].isoformat(),
    }


class PostgresScoringRepository:
    def __init__(self, pool, feedback_repository, appeals_repository=None):
        self.pool = pool
        self.feedback_repository = feedback_repository
        # Mandatory before production mounting: module 08 appeal holds.
        self.appeals_repository = appeals_repository

    async def assess_evidence(self, *, organization_id: str, evidence_id: str,
                              score: int, reason: str, assessor_id: str) -> dict:
        score, reason = validate_assessment(score, reason)
        org_id = require_org_id(organization_id)
        try:
            proof_id, assessor = UUID(evidence_id), UUID(assessor_id)
        except (ValueError, TypeError):
            raise HTTPException(404, detail="EVIDENCE_NOT_FOUND")
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                proof = await conn.fetchrow(
                    """SELECT id, organization_id, category, submitted_by,
                              status, security_status, status_updated_at
                       FROM hhba_employer_evidence WHERE id=$1 FOR SHARE""",
                    proof_id)
                if not proof or proof["organization_id"] != org_id:
                    raise HTTPException(404, detail="EVIDENCE_NOT_FOUND")
                if proof["category"] not in ALL_CATEGORIES or proof["status"] != "verified" or proof["security_status"] != "clean":
                    raise HTTPException(409, detail="VERIFIED_CLEAN_EVIDENCE_REQUIRED")
                if not is_fresh(proof["status_updated_at"], datetime.now(timezone.utc)):
                    raise HTTPException(409, detail="EVIDENCE_TOO_OLD")
                if proof["submitted_by"] == assessor:
                    raise HTTPException(403, detail="SELF_ASSESSMENT_FORBIDDEN")
                reviewer = await conn.fetchrow(
                    """SELECT reviewer_id FROM hhba_evidence_reviews
                       WHERE evidence_id=$1 AND decision='verified'
                       ORDER BY created_at DESC, id DESC LIMIT 1""", proof_id)
                if not reviewer or reviewer["reviewer_id"] == assessor:
                    raise HTTPException(403, detail="INDEPENDENT_ASSESSOR_REQUIRED")
                item = await conn.fetchrow(
                    """INSERT INTO hhba_scoring_findings_private
                        (id, organization_id, evidence_id, category,
                         assessed_score, assessment_reason, assessor_id)
                       VALUES ($1,$2,$3,$4,$5,$6,$7)
                       ON CONFLICT(evidence_id) DO NOTHING RETURNING *""",
                    uuid4(), org_id, proof_id, proof["category"],
                    score, reason, assessor)
                if not item:
                    raise HTTPException(409, detail="EVIDENCE_ALREADY_ASSESSED")
        return public_finding(item)

    async def latest_findings(self, *, organization_id: str, conn=None) -> list[dict]:
        async def get_rows(connection):
            return await connection.fetch(
                """SELECT DISTINCT ON (f.category)
                      f.id, f.category, f.assessed_score AS score,
                      f.assessed_at AS reviewed_at, f.evidence_id,
                      e.status AS evidence_status, e.security_status,
                      e.status_updated_at
                   FROM hhba_scoring_findings_private AS f
                   JOIN hhba_employer_evidence AS e ON e.id=f.evidence_id
                   WHERE f.organization_id=$1 AND e.organization_id=$1
                   ORDER BY f.category, f.sequence DESC""",
                require_org_id(organization_id))
        if conn is not None:
            rows = await get_rows(conn)
        else:
            async with self.pool.acquire() as connection:
                rows = await get_rows(connection)
        return [
            {"id":str(row["id"]), "category":row["category"], "score":row["score"],
             "reviewed_at":row["reviewed_at"],
             "evidence_status":row["evidence_status"],
             "security_status":row["security_status"],
             "status_updated_at":row["status_updated_at"],
             "evidence_id":str(row["evidence_id"])}
            for row in rows
        ]

    async def calculate_private(self, *, organization_id: str,
                                calculated_by: str, certified: bool) -> dict:
        org_id = require_org_id(organization_id)
        actor = UUID(calculated_by)
        quarter = last_completed_quarter()
        # Closed quarter public aggregate has no employee IDs or raw rows.
        feedback = await self.feedback_repository.public_aggregate(
            organization_id=organization_id, period=quarter)
        appeal_snapshot = (await self.appeals_repository.state_snapshot(organization_id=organization_id)
                           if self.appeals_repository else [])
        appeal_hold = any(a['kind']=='employer' and a['status'] in (
            'submitted','under_review','needs_more_info','correction_required') for a in appeal_snapshot)
        async with self.pool.acquire() as conn:
            async with conn.transaction(isolation="repeatable_read"):
                findings = await self.latest_findings(organization_id=organization_id, conn=conn)
                now = datetime.now(timezone.utc)
                candidate = evaluate_candidate(
                    findings=findings, feedback=feedback, certified=certified, now=now)
                if appeal_hold:
                    for side in ('trust','care'):
                        candidate[side]['status']='pending_appeal'
                        candidate[side]['score']=None
                    candidate['publication']='blocked_by_active_appeal'
                # Persist only metadata and pre-approved aggregate, never raw employee data.
                provenance = {
                    "rule": RULE_VERSION, "certified": bool(certified),
                    "finding_refs": [
                        {"id":x["id"],"evidence_id":x["evidence_id"],"score":x["score"],
                         "category":x["category"],"status":x["evidence_status"],
                         "security":x["security_status"],"reviewed_at":x["reviewed_at"].isoformat(),
                         "evidence_status_updated_at":x["status_updated_at"].isoformat()}
                        for x in findings
                    ],
                    "feedback_period":quarter, "feedback":feedback,
                    "appeal_state":appeal_snapshot,
                }
                digest = hashlib.sha256(json.dumps(
                    provenance, ensure_ascii=False, sort_keys=True,
                    separators=(",",":")).encode("utf-8")).hexdigest()
                row = await conn.fetchrow(
                    """INSERT INTO hhba_scoring_runs_private
                        (id, organization_id, rule_version, input_fingerprint, result, calculated_by)
                       VALUES ($1,$2,$3,$4,$5::jsonb,$6)
                       ON CONFLICT(organization_id,rule_version,input_fingerprint)
                       DO NOTHING RETURNING *""",
                    uuid4(), org_id, RULE_VERSION, digest,
                    json.dumps(candidate,ensure_ascii=False),actor)
                if row is None:
                    row = await conn.fetchrow(
                        """SELECT * FROM hhba_scoring_runs_private
                           WHERE organization_id=$1 AND rule_version=$2 AND input_fingerprint=$3""",
                        org_id,RULE_VERSION,digest)
        return {
            "run_id":str(row["id"]),
            "created_at":row["created_at"].isoformat(),
            "rule_version":row["rule_version"],
            "status":"internal_only",
            "candidate":row["result"] if isinstance(row["result"],dict) else json.loads(row["result"]),
        }

    async def latest_private(self, *, organization_id: str) -> dict:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT id, created_at, rule_version, result
                   FROM hhba_scoring_runs_private WHERE organization_id=$1
                   ORDER BY run_sequence DESC LIMIT 1""",require_org_id(organization_id))
        if not row:
            return {"status":"not_calculated"}
        # Never return an old private score as current after an appeal is opened.
        active=(self.appeals_repository is not None and
                await self.appeals_repository.has_active_score_appeal(organization_id=organization_id))
        result=row["result"] if isinstance(row["result"],dict) else json.loads(row["result"])
        if active:
            result=json.loads(json.dumps(result))
            for side in ('trust','care'):
                result[side]['status']='pending_appeal'
                result[side]['score']=None
            result['publication']='blocked_by_active_appeal'
        return {
            "status":"internal_only","run_id":str(row["id"]),
            "created_at":row["created_at"].isoformat(),
            "rule_version":row["rule_version"],
            "candidate":result,
        }
