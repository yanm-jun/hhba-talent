"""HHBA Module 08: evidence disputes, confidential employee concerns and reviewer independence."""
from __future__ import annotations

import asyncio
import os
import unittest
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID,uuid4

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from apps.api.appeals_domain import (
    validate_employer_appeal, validate_employee_issue, validate_decision,
    require_independent, sanitized_case, public_appeals_state,
)
from apps.api.appeals_routes import build_appeals_router
from apps.api.appeals_store import PostgresAppealsRepository
from apps.api.evidence_domain import Principal
from apps.api.feedback_domain import EmployeeActor
from apps.api.evidence_store import PostgresEvidenceRepository
from apps.api.feedback_store import PostgresFeedbackRepository
from apps.api.scoring_domain import TRUST_WEIGHTS,CARE_WEIGHTS
from apps.api.scoring_store import PostgresScoringRepository


class PolicyTests(unittest.TestCase):
    def test_no_auto_scoring_and_strict_explanations(self):
        self.assertIsNone(public_appeals_state()["care"]["score"])
        self.assertEqual(public_appeals_state()["publication"],"not_enabled")
        for wrong in ("fake_category","employee_privacy"):
            with self.assertRaises(HTTPException):
                validate_employer_appeal(target_type="evidence",issue=wrong,
                                         explanation="Documented evidence from independent reviewers.")
        with self.assertRaises(HTTPException):
            validate_employer_appeal(target_type="evidence",issue="evidence_error",
                                     explanation="too short")
        with self.assertRaises(HTTPException):
            validate_employee_issue("fake_issue")
        for outcome in ("accepted","approve_score","public_now"):
            with self.assertRaises(HTTPException):
                validate_decision("submitted",outcome,"An independently documented review reason.")
        with self.assertRaises(HTTPException):
            validate_decision("correction_required","rejected",
                              "Prior result cannot be quietly reversed.")
        with self.assertRaises(HTTPException):
            require_independent(reviewer_id="x",complainant_id="y",
                                challenged_actor_id="x",reviewer_member=False)
        with self.assertRaises(HTTPException):
            require_independent(reviewer_id="x",complainant_id="y",
                                challenged_actor_id=None,reviewer_member=True)

    def test_employee_cases_project_no_personally_identifying_content(self):
        now=datetime.now(timezone.utc)
        row={"id":uuid4(),"organization_id":uuid4(),"kind":"employee_privacy",
             "issue":"identity_risk","status":"submitted","created_at":now,
             "updated_at":now,"resolution":None,
             "employer_requester":None,"challenged_actor_id":None,
             "employee_id":uuid4()}
        result=sanitized_case(row,reviewer=True)
        for sensitive in ("employee_id","employer_requester","challenged_actor_id",
                          "explanation","target_id","raw_comment"):
            self.assertNotIn(sensitive,result)


class FakeAppeals:
    def __init__(self): self.queue=[]
    async def open_employer(self, **kwargs):
        case=dict(id=str(uuid4()),organization_id=kwargs["organization_id"],
                  kind="employer",issue=kwargs["issue"],status="submitted")
        self.queue.append(case);return case
    async def list_employer(self, **kw):
        return [c for c in self.queue if c["kind"]=="employer" and
                c["organization_id"]==kw["organization_id"]]
    async def clarify_employer(self,**kw): raise HTTPException(409,detail="CLARIFICATION_NOT_REQUESTED")
    async def open_employee(self,**kw):
        case=dict(id=str(uuid4()),organization_id=kw["organization_id"],
                  kind="employee_privacy",issue=kw["issue"],status="submitted")
        self.queue.append(case);return case
    async def list_employee(self,**kw):
        return [c for c in self.queue if c["kind"]=="employee_privacy"]
    async def list_queue(self, *, reviewer_organizations):
        return [c for c in self.queue if c["organization_id"] not in reviewer_organizations]
    async def decide(self,**kw): return {"status":kw["decision"],"id":kw["appeal_id"]}


class RouterTests(unittest.TestCase):
    def setUp(self):
        self.org,self.other,self.userid=(str(uuid4()) for _ in range(3))
        self.user=[Principal(self.userid,{self.org:"owner"})]
        self.emp=[EmployeeActor(self.userid)]
        self.verified=[True]
        self.repo=FakeAppeals()
        async def verifier(actor,oid):
            return self.verified[0] and oid==self.org and actor.user_id==self.userid
        app=FastAPI()
        app.include_router(build_appeals_router(
            resolve_actor=lambda:self.user[0],
            resolve_employee=lambda:self.emp[0],
            verify_employment=verifier,repository=self.repo))
        self.client=TestClient(app)
        self.addCleanup(self.client.close)

    def test_cross_company_appeals_denied_and_status_private(self):
        payload={"organization_id":self.org,"target_type":"evidence",
                 "target_id":str(uuid4()),"issue":"evidence_error",
                 "explanation":"We believe evidence was reviewed using an incorrect category."}
        self.assertEqual(self.client.post("/api/v1/employer/appeals",json=payload).status_code,201)
        self.assertEqual(self.client.get(f"/api/v1/organizations/{self.other}/appeals").status_code,404)
        payload["organization_id"]=self.other
        self.assertEqual(self.client.post("/api/v1/employer/appeals",json=payload).status_code,404)
        self.assertEqual(len(self.client.get(f"/api/v1/organizations/{self.org}/appeals").json()["items"]),1)
        self.user[0]=None
        self.assertEqual(self.client.get(f"/api/v1/organizations/{self.org}/appeals").status_code,401)

    def test_employee_privacy_no_free_text_and_no_admin_preview(self):
        url="/api/v1/employee/privacy-concerns"
        p={"organization_id":self.org,"issue":"identity_risk"}
        self.verified[0]=False
        self.assertEqual(self.client.post(url,json=p).status_code,403)
        self.verified[0]=True
        self.assertEqual(self.client.post(url,json={**p,"explanation":"identifying details"}).status_code,422)
        accepted=self.client.post(url,json=p)
        self.assertEqual(accepted.status_code,201,accepted.text)
        self.assertNotIn("employee_id",accepted.text)
        self.assertEqual(len(self.client.get("/api/v1/employee/my-privacy-concerns").json()["items"]),1)
        self.assertEqual(self.client.get(f"/api/v1/organizations/{self.org}/appeals").json()["items"],[])
        self.assertEqual(self.client.get("/api/v1/admin/appeals").status_code,403)
        self.user[0]=Principal(str(uuid4()),{},appeals_reviewer=True)
        self.assertEqual(len(self.client.get("/api/v1/admin/appeals").json()["items"]),1)
        self.assertNotIn("employee_id",self.client.get("/api/v1/admin/appeals").text)


class PostgresAppealTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("HHBA_EVIDENCE_TEST_PG_DSN"),"PG test DB not set")
    def test_pg_identity_isolation_reviews_and_score_hold(self):
        asyncio.run(self.exercise())

    async def exercise(self):
        import asyncpg
        pool=await asyncpg.create_pool(os.environ["HHBA_EVIDENCE_TEST_PG_DSN"],min_size=1,max_size=4)
        try:
            async with pool.acquire() as conn:
                for f in ("20261025_employer_evidence.sql",
                          "20261025_employee_feedback.sql",
                          "20261025_employer_scoring.sql",
                          "20261025_employer_appeals.sql"):
                    await conn.execute(Path("infra/migrations",f).read_text())
            repo=PostgresAppealsRepository(pool)
            feedback=PostgresFeedbackRepository(pool)
            scorer=PostgresScoringRepository(pool,feedback,appeals_repository=repo)
            evidence=PostgresEvidenceRepository(pool)
            org,other,submitter,verifier,assessor,appeals_reviewer,employee=(
                str(uuid4()) for _ in range(7))
            # Build all six independently reviewed proof categories.
            proof_ids=[]
            for category in (*TRUST_WEIGHTS,*CARE_WEIGHTS):
                e=await evidence.submit(
                    organization_id=org,category=category,
                    statement="Verified independent workplace and operating policies.",
                    private_storage_key=uuid4().hex,filename="policy.pdf",
                    mime="application/pdf",file_size=10,sha256="a"*64,actor_id=submitter)
                proof_ids.append(e["id"])
                async with pool.acquire() as conn:
                    await conn.execute("UPDATE hhba_employer_evidence SET security_status='clean' WHERE id=$1",UUID(e["id"]))
                await evidence.review(
                    item_id=e["id"],decision="verified",
                    reason="Original reviewer independently checked original evidence.",reviewer_id=verifier)
                await scorer.assess_evidence(
                    organization_id=org,evidence_id=e["id"],score=80,
                    reason="Independent assessment with source records and documented verification.",
                    assessor_id=assessor)
            first=await scorer.calculate_private(
                organization_id=org,calculated_by=assessor,certified=True)
            self.assertEqual(first["candidate"]["trust"]["score"],80)
            with self.assertRaises(HTTPException) as err:
                await repo.open_employer(
                    organization_id=other,target_type="evidence",
                    target_id=proof_ids[0],issue="evidence_error",
                    explanation="Our auditor has documented an error in this file assessment.",
                    actor_id=submitter)
            self.assertEqual(err.exception.status_code,404)
            appeal=await repo.open_employer(
                organization_id=org,target_type="evidence",
                target_id=proof_ids[0],issue="evidence_error",
                explanation="Our auditor has documented an error in this file assessment.",
                actor_id=submitter)
            self.assertEqual(len(await repo.list_employer(organization_id=org)),1)
            self.assertEqual(await repo.list_employer(organization_id=other),[])
            self.assertEqual(await repo.list_queue(reviewer_organizations={org:"owner"}),[])
            self.assertEqual(len(await repo.list_queue(reviewer_organizations={})),1)
            self.assertTrue(await repo.has_active_score_appeal(organization_id=org))
            self.assertIsNone((await scorer.latest_private(organization_id=org))["candidate"]["trust"]["score"])
            held=await scorer.calculate_private(organization_id=org,calculated_by=assessor,certified=True)
            self.assertIsNone(held["candidate"]["trust"]["score"])
            self.assertEqual(held["candidate"]["publication"],"blocked_by_active_appeal")
            for conflicted in (submitter,verifier):
                with self.assertRaises(HTTPException):
                    await repo.decide(
                        appeal_id=appeal["id"],reviewer_id=conflicted,
                        reviewer_organizations={},decision="rejected",
                        reason="Independent appeal reviewer determined records match evidence.")
            with self.assertRaises(HTTPException):
                await repo.decide(
                    appeal_id=appeal["id"],reviewer_id=appeals_reviewer,
                    reviewer_organizations={org:"hr_lead"},decision="rejected",
                    reason="Reviewer is employed by this organization, so conflicts.")
            more=await repo.decide(
                appeal_id=appeal["id"],reviewer_id=appeals_reviewer,
                reviewer_organizations={},decision="needs_more_info",
                reason="Please supply an independently documented clarification record.")
            self.assertEqual(more["status"],"needs_more_info")
            with self.assertRaises(HTTPException):
                await repo.clarify_employer(
                    organization_id=other,appeal_id=appeal["id"],actor_id=submitter,
                    explanation="The supplemental document has been registered.")
            again=await repo.clarify_employer(
                organization_id=org,appeal_id=appeal["id"],actor_id=submitter,
                explanation="We have independently documented the disputed verification procedure.")
            self.assertEqual(again["status"],"submitted")
            resolved=await repo.decide(
                appeal_id=appeal["id"],reviewer_id=appeals_reviewer,
                reviewer_organizations={},decision="rejected",
                reason="Independent records showed the original review was correctly supported.")
            self.assertEqual(resolved["status"],"rejected")
            self.assertFalse(await repo.has_active_score_appeal(organization_id=org))
            recovered=await scorer.calculate_private(organization_id=org,calculated_by=assessor,certified=True)
            self.assertEqual(recovered["candidate"]["trust"]["score"],80)
            self.assertNotEqual(recovered["run_id"],first["run_id"])
            emp=await repo.open_employee(
                organization_id=org,issue="identity_risk",actor_id=employee)
            self.assertNotIn("employee_id",emp)
            self.assertEqual(len(await repo.list_employee(actor_id=employee)),1)
            self.assertEqual(await repo.list_employee(actor_id=str(uuid4())),[])
            self.assertEqual(len(await repo.list_employer(organization_id=org)),1)
            with self.assertRaises(HTTPException) as err:
                await repo.open_employee(organization_id=org,issue="identity_risk",actor_id=employee)
            self.assertEqual(err.exception.status_code,409)
            with self.assertRaises(HTTPException):
                await repo.decide(
                    appeal_id=emp["id"],reviewer_id=employee,
                    reviewer_organizations={},decision="rejected",
                    reason="Reviewer cannot approve their own private report case.")
            private=await repo.decide(
                appeal_id=emp["id"],reviewer_id=appeals_reviewer,
                reviewer_organizations={},decision="correction_required",
                reason="Privacy risk requires independent security review and remediation.")
            self.assertEqual(private["status"],"correction_required")
            with self.assertRaises(HTTPException):
                await repo.decide(
                    appeal_id=emp["id"],reviewer_id=appeals_reviewer,
                    reviewer_organizations={},decision="rejected",
                    reason="A closed decision cannot be silently overwritten.")
            async with pool.acquire() as conn:
                with self.assertRaises(asyncpg.PostgresError):
                    await conn.execute(
                        "DELETE FROM hhba_appeal_events_private WHERE appeal_id=$1",
                        UUID(appeal["id"]))
                identity=await conn.fetchval(
                    "SELECT employee_id FROM hhba_appeal_employee_owners_private WHERE appeal_id=$1",
                    UUID(emp["id"]))
                self.assertEqual(identity,UUID(employee))
                case=await conn.fetchrow("SELECT * FROM hhba_appeal_cases_private WHERE id=$1",UUID(emp["id"]))
                self.assertIsNone(case["employer_requester"])
                self.assertIsNone(case["explanation"])
                self.assertIsNone(case["target_id"])
        finally:
            await pool.close()
