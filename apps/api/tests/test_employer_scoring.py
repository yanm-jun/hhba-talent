"""Module 07 deterministic scoring, independence, privacy and PostgreSQL trails."""
from __future__ import annotations
import asyncio
import os
import unittest
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from apps.api.scoring_domain import (
    RULE_VERSION, TRUST_WEIGHTS, CARE_WEIGHTS, evaluate_candidate,
    public_score_guard, validate_assessment, FEEDBACK_DIMENSIONS,
)
from apps.api.scoring_store import PostgresScoringRepository, last_completed_quarter
from apps.api.scoring_routes import build_scoring_router
from apps.api.evidence_domain import Principal
from apps.api.evidence_store import PostgresEvidenceRepository
from apps.api.feedback_store import PostgresFeedbackRepository


def finding(category, score=80, status="verified", days=1):
    return {"category":category, "score":score, "evidence_status":status,
            "security_status":"clean",
            "reviewed_at":datetime.now(timezone.utc)-timedelta(days=days)}


def employee(period=None):
    return {"status":"published","period":period or last_completed_quarter(),
            "response_band":"at_least_10",
            "scores_out_of_5":dict.fromkeys(FEEDBACK_DIMENSIONS,4.0)}


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.findings = [finding(category) for category in (*TRUST_WEIGHTS,*CARE_WEIGHTS)]

    def test_no_evidence_or_certification_is_never_zero(self):
        v=evaluate_candidate(findings=[],feedback=None,certified=False)
        self.assertIsNone(v["trust"]["score"])
        self.assertIsNone(v["care"]["score"])
        self.assertEqual(v["help_eligibility"],"not_assessed")
        self.assertEqual(v["publication"],"blocked_pending_appeals_and_policy_approval")

    def test_full_coverage_privacy_matured_feedback_calculates_candidate_only(self):
        v=evaluate_candidate(
            findings=[finding("recruitment_integrity",90),finding("business_integrity",80)]
                     +[finding(c,80) for c in CARE_WEIGHTS],
            feedback=employee(),certified=True)
        self.assertEqual(v["trust"]["score"],85)
        self.assertEqual(v["care"]["score"],79)  # 0.7*80 + 0.3*75 = 78.5, half-up
        self.assertEqual(v["trust"]["status"],"calculated_private")
        self.assertEqual(v["care"]["status"],"calculated_private")
        self.assertEqual(v["visibility"],"internal_only")

    def test_employee_feedback_alone_cannot_create_a_care_score(self):
        v=evaluate_candidate(findings=self.findings,feedback={"status":"not_public"},
                             certified=True)
        self.assertEqual(v["trust"]["score"],80)
        self.assertIsNone(v["care"]["score"])
        self.assertEqual(v["care"]["status"],"pending")
        self.assertIsNone(evaluate_candidate(
            findings=self.findings,feedback=employee(),certified=False)["trust"]["score"])

    def test_disputed_latest_cannot_reactivate_previous_good_rating(self):
        recent=finding("pay_and_contracts",20,"disputed")
        prior=finding("pay_and_contracts",100)
        others=[f for f in self.findings if f["category"]!="pay_and_contracts"]
        v=evaluate_candidate(findings=[recent,prior,*others],feedback=employee(),certified=True)
        self.assertIsNone(v["care"]["score"])
        self.assertIn("pay_and_contracts",v["care"]["missing"])

    def test_old_invalid_and_unreviewed_rubrics_never_contribute(self):
        f=[finding("recruitment_integrity",days=400)]
        f +=[finding("business_integrity",status="pending_review")]
        v=evaluate_candidate(findings=f,feedback=employee(),certified=True)
        self.assertIsNone(v["trust"]["score"])

    def test_assessment_validation_and_public_gate(self):
        for value in [True,-1,101,"80"]:
            with self.assertRaises(HTTPException):
                validate_assessment(value,"Verified independently against audited records.")
        with self.assertRaises(HTTPException):
            validate_assessment(80,"too short")
        self.assertEqual(validate_assessment(0,"Auditor found multiple supported deficiencies." )[0],0)
        output=public_score_guard()
        self.assertIsNone(output["trust"]["score"])
        self.assertEqual(output["publication"],"not_enabled")


class RouterTests(unittest.TestCase):
    def test_untrusted_users_cannot_calculate_or_assess(self):
        org=str(uuid4())
        actor=[None]
        class Repo:
            async def assess_evidence(self,**kwargs):
                raise AssertionError("UNAUTH_REACHED_DB")
            async def calculate_private(self,**kwargs):
                raise AssertionError("UNAUTH_REACHED_DB")
            async def latest_private(self,**kwargs):
                raise AssertionError("UNAUTH_REACHED_DB")
        async def certified(_):
            return True
        def principal():
            return actor[0]
        app=FastAPI()
        app.include_router(build_scoring_router(
            resolve_actor=principal,resolve_certification=certified,repository=Repo()))
        with TestClient(app) as c:
            route=f"/api/v1/admin/scoring/organizations/{org}/calculate"
            self.assertEqual(c.post(route).status_code,401)
            actor[0]=Principal(user_id=str(uuid4()),organization_roles={},
                               evidence_reviewer=True)
            self.assertEqual(c.post(route).status_code,403)
            actor[0]=None
            public=c.get(f"/api/v1/public/organizations/{org}/scores")
            self.assertEqual(public.status_code,200)
            self.assertIsNone(public.json()["care"]["score"])
            self.assertNotIn("feedback_raw",public.text)


class PostgreSQLScoringTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("HHBA_EVIDENCE_TEST_PG_DSN"),"isolated PG unavailable")
    def test_postgres_assess_independently_recalculate_and_preserve_audit(self):
        asyncio.run(self.exercise_pg())

    async def exercise_pg(self):
        import asyncpg
        from pathlib import Path
        pool=await asyncpg.create_pool(
            os.environ["HHBA_EVIDENCE_TEST_PG_DSN"], min_size=1,max_size=3)
        try:
            async with pool.acquire() as conn:
                for migration in (
                    "20261025_employer_evidence.sql",
                    "20261025_employee_feedback.sql",
                    "20261025_employer_scoring.sql"):
                    await conn.execute(Path("infra/migrations",migration).read_text())
            feedback=PostgresFeedbackRepository(pool)
            repo=PostgresScoringRepository(pool,feedback)
            evidences=PostgresEvidenceRepository(pool)
            org,submitter,reviewer,assessor=(str(uuid4()) for _ in range(4))
            for category in (*TRUST_WEIGHTS,*CARE_WEIGHTS):
                e=await evidences.submit(
                    organization_id=org,category=category,
                    statement="Audited and independently documented company evidence.",
                    private_storage_key=uuid4().hex,filename="evidence.pdf",
                    mime="application/pdf",file_size=10,sha256="a"*64,actor_id=submitter)
                async with pool.acquire() as conn:
                    await conn.execute(
                        "UPDATE hhba_employer_evidence SET security_status='clean' WHERE id=$1",
                        UUID(e["id"]))
                await evidences.review(
                    item_id=e["id"],decision="verified",
                    reason="Separate reviewer validated clean source material.",reviewer_id=reviewer)
                with self.assertRaises(HTTPException) as err:
                    await repo.assess_evidence(
                        organization_id=org,evidence_id=e["id"],score=80,
                        reason="Assessor cannot be original uploader, validated.",assessor_id=submitter)
                self.assertEqual(err.exception.status_code,403)
                with self.assertRaises(HTTPException):
                    await repo.assess_evidence(
                        organization_id=org,evidence_id=e["id"],score=80,
                        reason="Assessor cannot be the evidence reviewer either.",assessor_id=reviewer)
                result=await repo.assess_evidence(
                    organization_id=org,evidence_id=e["id"],score=80,
                    reason="Independent assessor checked evidence and gave a reasoned rubric grade.",
                    assessor_id=assessor)
                self.assertEqual(result["assessed_score"],80)
                with self.assertRaises(HTTPException):
                    await repo.assess_evidence(
                        organization_id=org,evidence_id=e["id"],score=100,
                        reason="Cannot silently revise an immutable assessment.",assessor_id=assessor)
            latest=await repo.latest_findings(organization_id=org)
            self.assertEqual(len(latest),6)
            self.assertEqual(await repo.latest_findings(organization_id=str(uuid4())),[])
            first=await repo.calculate_private(
                organization_id=org,calculated_by=assessor,certified=True)
            self.assertEqual(first["candidate"]["trust"]["score"],80)
            self.assertIsNone(first["candidate"]["care"]["score"])
            self.assertEqual(first["candidate"]["publication"],
                             "blocked_pending_appeals_and_policy_approval")
            again=await repo.calculate_private(
                organization_id=org,calculated_by=assessor,certified=True)
            self.assertEqual(again["run_id"],first["run_id"])
            period=last_completed_quarter()
            # Only closed quarter's aggregate is eligible. Seed 10 fictitious
            # ratings directly, not real employee or sensitive identity data.
            async with pool.acquire() as conn:
                for _ in range(10):
                    await conn.execute(
                        """INSERT INTO hhba_employee_feedback_private
                           (id,organization_id,period,pay,insurance,rest,respect,development)
                           VALUES ($1,$2,$3,4,4,4,4,4)""",
                        uuid4(),UUID(org),period)
            second=await repo.calculate_private(
                organization_id=org,calculated_by=assessor,certified=True)
            self.assertNotEqual(first["run_id"],second["run_id"])
            self.assertEqual(second["candidate"]["care"]["score"],79)
            self.assertEqual(second["candidate"]["trust"]["score"],80)
            # An adverse evidence status change must remove the score;
            # immutable prior calculations are kept for traceability.
            async with pool.acquire() as conn:
                item=await conn.fetchval(
                    """SELECT evidence_id FROM hhba_scoring_findings_private
                       WHERE organization_id=$1 AND category='working_hours'""",UUID(org))
                await conn.execute("UPDATE hhba_employer_evidence SET status='disputed' WHERE id=$1",item)
            third=await repo.calculate_private(
                organization_id=org,calculated_by=assessor,certified=True)
            self.assertIsNone(third["candidate"]["care"]["score"])
            self.assertEqual(third["candidate"]["trust"]["score"],80)
            self.assertEqual((await repo.latest_private(organization_id=org))["run_id"],
                             third["run_id"])
            async with pool.acquire() as conn:
                self.assertEqual(await conn.fetchval(
                    "SELECT count(*) FROM hhba_scoring_runs_private WHERE organization_id=$1",
                    UUID(org)),3)
                with self.assertRaises(asyncpg.PostgresError):
                    await conn.execute(
                        "DELETE FROM hhba_scoring_runs_private WHERE id=$1",UUID(first["run_id"]))
                with self.assertRaises(asyncpg.PostgresError):
                    await conn.execute(
                        "UPDATE hhba_scoring_findings_private SET assessed_score=100 WHERE organization_id=$1",
                        UUID(org))
        finally:
            await pool.close()


if __name__ == "__main__":
    unittest.main()
