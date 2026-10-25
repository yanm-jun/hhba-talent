"""Module 10: real PostgreSQL double-signoff, freshness, appeals and privacy."""
from __future__ import annotations
import asyncio,os,unittest
from datetime import datetime,timezone
from pathlib import Path
from uuid import UUID,uuid4
from fastapi import FastAPI,HTTPException
from fastapi.testclient import TestClient

from apps.api.publication_domain import ensure_candidate,pending_profile,verify_reason
from apps.api.publication_routes import build_publication_router
from apps.api.publication_store import PostgresPublicationRepository
from apps.api.evidence_domain import Principal
from apps.api.evidence_store import PostgresEvidenceRepository
from apps.api.scoring_store import PostgresScoringRepository,last_completed_quarter
from apps.api.scoring_domain import TRUST_WEIGHTS,CARE_WEIGHTS,RULE_VERSION
from apps.api.feedback_store import PostgresFeedbackRepository
from apps.api.improvements_store import PostgresImprovementsRepository
from apps.api.appeals_store import PostgresAppealsRepository


class PublicPolicyTests(unittest.TestCase):
    def test_pending_means_no_numeric_score(self):
        profile=pending_profile()
        self.assertIsNone(profile["care"]["score"])
        self.assertIsNone(profile["trust"]["score"])
        self.assertIsNone(profile["version"])
        self.assertEqual(profile["aid_eligibility"],"not_assessed")

    def test_unapproved_or_partial_private_candidate_rejected(self):
        result={"visibility":"internal_only","help_eligibility":"not_assessed",
                "inputs":{"certified":True,"feedback_status":"published"},
                "trust":{"status":"calculated_private","score":83,"missing":[]},
                "care":{"status":"calculated_private","score":72,"missing":[]}}
        with self.assertRaises(HTTPException):
            ensure_candidate(result,RULE_VERSION,frozenset())
        ensure_candidate(result,RULE_VERSION,frozenset({RULE_VERSION}))
        result["care"]["score"]=None
        with self.assertRaises(HTTPException):
            ensure_candidate(result,RULE_VERSION,frozenset({RULE_VERSION}))
        with self.assertRaises(HTTPException):
            verify_reason("too short")


class ProtectedRoutesTests(unittest.TestCase):
    def test_default_off_and_untrusted_reviewers_cannot_use_publish_api(self):
        org=str(uuid4())
        actor=[None]
        class FakeRepo:
            def __init__(self): self.called=False
            async def public_profile(self,**kw):
                self.called=True
                return pending_profile()
            async def public_history(self,**kw):return []
            async def prepare(self,**kw):raise AssertionError("UNAUTH_ACCESS")
            async def decide(self,**kw):raise AssertionError("UNAUTH_ACCESS")
            async def queue(self,**kw):raise AssertionError("UNAUTH_ACCESS")
        repo=FakeRepo()
        async def cert(_):return True
        app=FastAPI()
        app.include_router(build_publication_router(
            resolve_actor=lambda:actor[0],resolve_certification=cert,
            repository=repo,policy_enabled=False))
        with TestClient(app) as c:
            self.assertEqual(c.get(f"/api/v1/public/organizations/{org}/growth-profile").status_code,200)
            self.assertEqual(c.get(f"/api/v1/public/organizations/{org}/growth-profile").json()["publication"],"pending")
            self.assertEqual(c.get(f"/api/v1/public/organizations/{org}/growth-profile").headers["cache-control"],"no-store")
            self.assertEqual(c.post("/api/v1/admin/publication/prepare",json=dict(
                organization_id=org,scoring_run_id=str(uuid4()))).status_code,401)
            actor[0]=Principal(str(uuid4()),{},publication_preparer=True)
            self.assertEqual(c.post("/api/v1/admin/publication/prepare",json=dict(
                organization_id=org,scoring_run_id=str(uuid4()))).status_code,503)
            self.assertEqual(c.get("/api/v1/admin/publication/queue").status_code,403)
            actor[0]=Principal(str(uuid4()),{},publication_reviewer=True)
            self.assertEqual(c.get("/api/v1/admin/publication/queue").status_code,503)


class LivePostgresTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("HHBA_EVIDENCE_TEST_PG_DSN"),"isolated PG DSN required")
    def test_approved_rules_double_review_revoke_privacy_and_revalidation(self):
        asyncio.run(self.pg())

    async def pg(self):
        import asyncpg
        pool=await asyncpg.create_pool(os.environ["HHBA_EVIDENCE_TEST_PG_DSN"],min_size=1,max_size=5)
        try:
            async with pool.acquire() as conn:
                for file in (
                  "20261025_employer_evidence.sql","20261025_employee_feedback.sql",
                  "20261025_employer_scoring.sql","20261025_employer_appeals.sql",
                  "20261025_employer_improvements.sql","20261025_employer_publication.sql"
                ):
                    await conn.execute(Path("infra/migrations",file).read_text())
            evidence=PostgresEvidenceRepository(pool)
            feedback=PostgresFeedbackRepository(pool)
            appeal_repo=PostgresAppealsRepository(pool)
            improvement_repo=PostgresImprovementsRepository(pool)
            scoring=PostgresScoringRepository(pool,feedback,appeals_repository=appeal_repo)
            repo=PostgresPublicationRepository(pool,improvement_repo,
                     approved_rules=frozenset({RULE_VERSION}))
            actors=[str(uuid4()) for _ in range(8)]
            org,other=str(uuid4()),str(uuid4())
            submitter,first_evidence,scorer,calculater,preparer,first_signer,second_signer,revoker=actors
            ids=[]
            for category in (*TRUST_WEIGHTS,*CARE_WEIGHTS):
                p=await evidence.submit(
                    organization_id=org,category=category,
                    statement="Workplace conditions verified with documented independent records.",
                    private_storage_key=uuid4().hex,filename="verified.pdf",
                    mime="application/pdf",file_size=10,sha256="a"*64,
                    actor_id=submitter)
                ids.append(p["id"])
                async with pool.acquire() as conn:
                    await conn.execute("UPDATE hhba_employer_evidence SET security_status='clean' WHERE id=$1",UUID(p["id"]))
                await evidence.review(
                    item_id=p["id"],decision="verified",
                    reason="Independent inspector evaluated the verified file.",reviewer_id=first_evidence)
                await scoring.assess_evidence(
                    organization_id=org,evidence_id=p["id"],score=80,
                    reason="Independent rubric assessor verified the underlying evidence quality.",
                    assessor_id=scorer)
            period=last_completed_quarter()
            async with pool.acquire() as conn:
                for _ in range(10):
                    await conn.execute(
                        """INSERT INTO hhba_employee_feedback_private
                           (id,organization_id,period,pay,insurance,rest,respect,development)
                           VALUES($1,$2,$3,4,4,4,4,4)""",uuid4(),UUID(org),period)
            run=await scoring.calculate_private(
                organization_id=org,calculated_by=calculater,certified=True)
            self.assertEqual(run["candidate"]["trust"]["score"],80)
            self.assertEqual(run["candidate"]["care"]["score"],79)
            base=dict(organization_id=org,run_id=run["run_id"],
                      reviewer_organizations={},certified=True)
            with self.assertRaises(HTTPException) as err:
                await repo.prepare(**{**base,"actor_id":scorer})
            self.assertEqual(err.exception.status_code,403)
            with self.assertRaises(HTTPException):
                await repo.prepare(**{**base,"actor_id":preparer,"reviewer_organizations":{org:"owner"}})
            request=await repo.prepare(**{**base,"actor_id":preparer})
            self.assertEqual(request["status"],"prepared")
            self.assertIsNone(request["version"])
            with self.assertRaises(HTTPException):
                await repo.prepare(**{**base,"actor_id":preparer})
            self.assertEqual((await repo.public_profile(
                organization_id=org,certified=True,policy_enabled=True))["publication"],"pending")
            with self.assertRaises(HTTPException):
                await repo.decide(
                    publication_id=request["id"],actor_id=first_evidence,decision="approve",
                    reason="This reviewer already assessed the underlying evidence.",
                    reviewer_organizations={},certified=True)
            first=await repo.decide(
                publication_id=request["id"],actor_id=first_signer,decision="approve",
                reason="First independent review confirms complete and current evidence.",
                reviewer_organizations={},certified=True)
            self.assertEqual(first["status"],"first_approved")
            with self.assertRaises(HTTPException):
                await repo.decide(
                    publication_id=request["id"],actor_id=first_signer,decision="approve",
                    reason="The same reviewer must not be allowed a second signoff.",
                    reviewer_organizations={},certified=True)
            with self.assertRaises(HTTPException):
                await repo.decide(
                    publication_id=request["id"],actor_id=preparer,decision="approve",
                    reason="Preparer cannot be an independent final approver.",
                    reviewer_organizations={},certified=True)
            final=await repo.decide(
                publication_id=request["id"],actor_id=second_signer,decision="approve",
                reason="Second independent reviewer confirms source and privacy policy.",
                reviewer_organizations={},certified=True)
            self.assertEqual(final["status"],"published")
            self.assertEqual(final["version"],1)
            public=await repo.public_profile(organization_id=org,certified=True,policy_enabled=True)
            self.assertEqual(public["publication"],"published")
            self.assertEqual(public["trust"]["score"],80)
            self.assertEqual(public["care"]["score"],79)
            self.assertEqual(public["improvements"],[])
            for field in ("employee_id","feedback_raw","evidence_id","scoring_run_id","prepared_by"):
                self.assertNotIn(field,public)
            # Certification and disabled global policy must fail closed.
            self.assertEqual((await repo.public_profile(
                organization_id=org,certified=False,policy_enabled=True))["publication"],"pending")
            self.assertEqual((await repo.public_profile(
                organization_id=org,certified=True,policy_enabled=False))["publication"],"pending")
            # Employee privacy case suppresses public score until independent closure.
            privacy=await appeal_repo.open_employee(
                organization_id=org,issue="identity_risk",actor_id=str(uuid4()))
            self.assertEqual((await repo.public_profile(
                organization_id=org,certified=True,policy_enabled=True))["publication"],"pending")
            await appeal_repo.decide(
                appeal_id=privacy["id"],reviewer_id=revoker,reviewer_organizations={},
                decision="rejected",reason="Independent privacy review found no evidence of identity disclosure.")
            self.assertEqual((await repo.public_profile(
                organization_id=org,certified=True,policy_enabled=True))["publication"],"published")
            # Evidence state invalidation overrides both prior signed approvals.
            async with pool.acquire() as conn:
                await conn.execute(
                    "UPDATE hhba_employer_evidence SET status='disputed',status_updated_at=now() WHERE id=$1",
                    UUID(ids[0]))
            self.assertEqual((await repo.public_profile(
                organization_id=org,certified=True,policy_enabled=True))["publication"],"pending")
            with self.assertRaises(HTTPException) as err:
                await repo.revoke(publication_id=request["id"],actor_id=first_signer,
                                  reviewer_organizations={},reason="Cannot revoke own approved release without independent reviewer.")
            self.assertEqual(err.exception.status_code,403)
            revoked=await repo.revoke(
                publication_id=request["id"],actor_id=revoker,
                reviewer_organizations={},reason="Source proof changed and the previously published score is no longer reliable.")
            self.assertEqual(revoked["status"],"revoked")
            self.assertEqual(len(await repo.public_history(organization_id=org,policy_enabled=True)),1)
            self.assertEqual((await repo.public_history(organization_id=org,policy_enabled=True))[0]["status"],"withdrawn")
            self.assertEqual((await repo.public_profile(
                organization_id=org,certified=True,policy_enabled=True))["publication"],"pending")
            async with pool.acquire() as conn:
                self.assertEqual(await conn.fetchval(
                    "SELECT COUNT(*) FROM hhba_publication_events_private WHERE publication_id=$1",
                    UUID(request["id"])),4)
                with self.assertRaises(asyncpg.PostgresError):
                    await conn.execute(
                        "DELETE FROM hhba_publication_events_private WHERE publication_id=$1",UUID(request["id"]))
            self.assertEqual(await repo.queue(reviewer_organizations={org:"owner"}),[])
        finally:
            await pool.close()
