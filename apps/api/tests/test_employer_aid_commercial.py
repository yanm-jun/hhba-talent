"""HHBA Modules 11/12: no automatic help, no consentless buyer introductions, no fake orders."""
from __future__ import annotations
import asyncio,os,unittest
from datetime import datetime,timezone,date
from pathlib import Path
from uuid import UUID,uuid4
from fastapi import FastAPI,HTTPException
from fastapi.testclient import TestClient
from apps.api.aid_domain import AidPolicy,verify_thresholds,stage_transition,valid_ref,private_lead
from apps.api.aid_routes import build_aid_router
from apps.api.aid_store import PostgresAidRepository,PostgresCommercialRepository
from apps.api.evidence_domain import Principal
from apps.api.evidence_store import PostgresEvidenceRepository

class Policies(unittest.TestCase):
    def test_no_auto_assistance_or_trade(self):
        with self.assertRaises(ValueError):
            AidPolicy(enabled=True)
        with self.assertRaises(HTTPException):
            verify_thresholds({"publication":"pending"},AidPolicy(enabled=True,min_trust=70,min_care=70))
        with self.assertRaises(HTTPException):
            verify_thresholds({"publication":"published","trust":{"score":95},"care":{"score":40}},
                              AidPolicy(enabled=True,min_trust=70,min_care=70))
        with self.assertRaises(HTTPException):
            stage_transition("identified","introduced")
        with self.assertRaises(HTTPException):
            stage_transition("identified","in_discussion")
        stage_transition("identified","consent_verified")
        stage_transition("consent_verified","introduced")
        with self.assertRaises(HTTPException):
            valid_ref("buyer@example.com")

class StubRepo:
    async def list_company(self,**kwargs):return []
    async def submit(self,**kwargs):raise AssertionError("DISABLED_WORKFLOW_WROTE")
    async def queue(self,**kwargs):raise AssertionError("UNAUTHORIZED_QUEUE")
    async def review(self,**kwargs):raise AssertionError("DISABLED_WORKFLOW_WROTE")
class StubCommercial:
    async def list_company(self,**kwargs):return []
    async def create(self,**kwargs):raise AssertionError("DISABLED_WORKFLOW_WROTE")

class RouterGuards(unittest.TestCase):
    def test_session_membership_and_aid_flag_fail_closed(self):
        org=str(uuid4()); user=[None]
        async def cert(_):return True
        app=FastAPI()
        app.include_router(build_aid_router(
           resolve_actor=lambda:user[0],resolve_certification=cert,
           aid=StubRepo(),commercial=StubCommercial(),workflow_enabled=False))
        payload={"service_type":"client_introduction",
           "business_summary":"This is an evidence-supported overview of the business and customers.",
           "capacity_summary":"Independent company proof confirms the team and current delivery capacity.",
           "capacity_evidence_id":str(uuid4())}
        with TestClient(app) as c:
            url=f"/api/v1/organizations/{org}/aid-applications"
            self.assertEqual(c.post(url,json=payload).status_code,401)
            user[0]=Principal(str(uuid4()),{})
            self.assertEqual(c.post(url,json=payload).status_code,404)
            user[0]=Principal(str(uuid4()),{org:"owner"})
            self.assertEqual(c.post(url,json=payload).status_code,503)
            self.assertEqual(c.get(url).status_code,503)
            self.assertEqual(c.get(f"/api/v1/organizations/{org}/client-introductions").status_code,503)
            self.assertEqual(c.get("/api/v1/admin/aid-applications").status_code,403)
            user[0]=Principal(str(uuid4()),{},aid_reviewer=True)
            self.assertEqual(c.get("/api/v1/admin/aid-applications").status_code,503)
            self.assertEqual(c.post("/api/v1/admin/client-introductions",json={
               "application_id":str(uuid4()),"organization_id":org,"buyer_reference":"BUYERSAFE1",
               "buyer_sector":"manufacturing","opportunity_type":"sales",
               "purpose":"Buyer expressed an interest in a legitimate sourcing opportunity."
            }).status_code,403)
            user[0]=Principal(str(uuid4()),{},business_matcher=True)
            self.assertEqual(c.post("/api/v1/admin/client-introductions",json={
               "application_id":str(uuid4()),"organization_id":org,"buyer_reference":"BUYERSAFE1",
               "buyer_sector":"manufacturing","opportunity_type":"sales",
               "purpose":"Buyer expressed an interest in a legitimate sourcing opportunity."
            }).status_code,503)

class PGIntegration(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("HHBA_EVIDENCE_TEST_PG_DSN"),"isolated PG DSN required")
    def test_live_approval_consent_real_proof_separation_and_audit(self):
        asyncio.run(self.pg())

    async def pg(self):
        import asyncpg
        pool=await asyncpg.create_pool(os.environ["HHBA_EVIDENCE_TEST_PG_DSN"],min_size=1,max_size=5)
        try:
            async with pool.acquire() as conn:
                for filename in ("20261025_employer_evidence.sql","20261025_employee_feedback.sql",
                                 "20261025_employer_scoring.sql","20261025_employer_appeals.sql",
                                 "20261025_employer_improvements.sql","20261025_employer_publication.sql",
                                 "20261025_employer_aid_commercial.sql"):
                    await conn.execute(Path("infra/migrations",filename).read_text())
            org,other=(str(uuid4()) for _ in range(2))
            applicant,proof_reviewer,aid_reviewer,matcher,consent_reviewer,order_reviewer=[str(uuid4()) for _ in range(6)]
            evidence=PostgresEvidenceRepository(pool)
            proof=await evidence.submit(
                 organization_id=org,category="business_integrity",
                 statement="Audited enterprise operating qualifications and capability.",
                 private_storage_key=uuid4().hex,filename="capacity.pdf",
                 mime="application/pdf",file_size=10,sha256="a"*64,actor_id=applicant)
            async with pool.acquire() as conn:
                await conn.execute("UPDATE hhba_employer_evidence SET security_status='clean' WHERE id=$1",
                                   UUID(proof["id"]))
            await evidence.review(
                item_id=proof["id"],decision="verified",
                reason="Independent capacity assessment confirmed valid clean company documents.",
                reviewer_id=proof_reviewer)
            scoring_run,publication=(uuid4(),uuid4())
            async with pool.acquire() as conn:
                await conn.execute(
                  """INSERT INTO hhba_scoring_runs_private
                     (id,organization_id,rule_version,input_fingerprint,result,calculated_by)
                     VALUES ($1,$2,'test-rule',$3,'{}'::jsonb,$4)""",
                     scoring_run,UUID(org),"b"*64,uuid4())
                await conn.execute(
                  """INSERT INTO hhba_publication_cases_private
                     (id,organization_id,scoring_run_id,rule_version,feedback_period,
                      input_fingerprint,score_snapshot,prepared_by,
                      first_reviewer,second_reviewer,status,publication_version,published_at)
                     VALUES ($1,$2,$3,'test-rule','2026-Q3',$4,
                             '{"trust":84,"care":82}'::jsonb,$5,$6,$7,'published',1,now())""",
                    publication,UUID(org),scoring_run,"b"*64,uuid4(),uuid4(),uuid4())
            class FakePublication:
                certified=True
                score_care=82
                async def public_profile(self,*,organization_id,certified,policy_enabled):
                    if not certified or not self.certified:return {"publication":"pending"}
                    return {"publication":"published","version":1,
                            "trust":{"score":84},"care":{"score":self.score_care}}
            pub=FakePublication()
            disabled=PostgresAidRepository(pool,pub,policy=AidPolicy())
            active=PostgresAidRepository(pool,pub,policy=AidPolicy(
                enabled=True,min_trust=70,min_care=70,version="test-approved-rule"))
            commercial=PostgresCommercialRepository(pool,active)
            body=dict(organization_id=org,service_type="client_introduction",
                business_summary="We deliver verified specialist supplies to business customers across different regions.",
                capacity_summary="Independent operating evidence documents currently available capacity and logistics.",
                capacity_evidence_id=proof["id"],actor_id=applicant)
            application=await active.submit(**body)
            self.assertEqual(application["status"],"submitted")
            with self.assertRaises(HTTPException) as err:
                await active.submit(**body)
            self.assertEqual(err.exception.status_code,409)
            self.assertEqual(await active.list_company(organization_id=other,certified=True),[])
            self.assertEqual(len(await active.queue(reviewer_organizations={})),1)
            self.assertEqual(await active.queue(reviewer_organizations={org:"owner"}),[])
            base=dict(application_id=application["id"],actor_id=aid_reviewer,
                      decision="approved",reason="Verified current company scores and delivery capacity independently.",
                      reviewer_organizations={},certified=True)
            with self.assertRaises(HTTPException):
                await disabled.review(**base)
            with self.assertRaises(HTTPException):
                await active.review(**{**base,"actor_id":applicant})
            with self.assertRaises(HTTPException):
                await active.review(**{**base,"actor_id":proof_reviewer})
            with self.assertRaises(HTTPException):
                await active.review(**{**base,"reviewer_organizations":{org:"owner"}})
            approved=await active.review(**base)
            self.assertEqual(approved["status"],"approved")
            with self.assertRaises(HTTPException):
                await active.review(**base)
            kwargs=dict(application_id=application["id"],organization_id=org,
                        buyer_reference="BUYERABC123",buyer_sector="manufacturing",
                        opportunity_type="sales",
                        purpose="Legitimate procurement demand discussed with a consenting business client.",
                        actor_id=matcher,certified=True)
            with self.assertRaises(HTTPException):
                await commercial.create(**{**kwargs,"organization_id":other})
            lead=await commercial.create(**kwargs)
            self.assertEqual(lead["stage"],"identified")
            self.assertEqual(lead["order_status"],"not_verified")
            self.assertEqual(await commercial.list_company(organization_id=other),[])
            # Potential buyer identity/reference remains invisible to employer until consent verified.
            self.assertEqual(await commercial.list_company(organization_id=org),[])
            with self.assertRaises(HTTPException):
                await commercial.advance(introduction_id=lead["id"],actor_id=matcher,
                                         stage="introduced",certified=True)
            with self.assertRaises(HTTPException):
                await commercial.verify_consent(introduction_id=lead["id"],actor_id=matcher,
                    consent_ref="CONSENTABC123",reviewer_organizations={},certified=True)
            consented=await commercial.verify_consent(
                introduction_id=lead["id"],actor_id=consent_reviewer,
                consent_ref="CONSENTABC123",reviewer_organizations={},certified=True)
            self.assertEqual(consented["stage"],"consent_verified")
            introduced=await commercial.advance(introduction_id=lead["id"],
                            actor_id=matcher,stage="introduced",certified=True)
            self.assertEqual(introduced["stage"],"introduced")
            talking=await commercial.advance(introduction_id=lead["id"],
                            actor_id=matcher,stage="in_discussion",certified=True)
            self.assertEqual(talking["stage"],"in_discussion")
            claim=await commercial.submit_order_proof(
                introduction_id=lead["id"],actor_id=matcher,
                evidence_reference="ORDERDOC123456",certified=True)
            self.assertEqual(claim["status"],"pending")
            self.assertEqual((await commercial.list_company(organization_id=org))[0]["order_status"],"not_verified")
            for bad in (matcher,consent_reviewer):
                with self.assertRaises(HTTPException):
                    await commercial.verify_order(
                        proof_id=claim["id"],actor_id=bad,accepted=True,
                        reason="Independent check of signed delivery and order evidence.",
                        reviewer_organizations={})
            with self.assertRaises(HTTPException):
                await commercial.verify_order(
                    proof_id=claim["id"],actor_id=order_reviewer,accepted=True,
                    reason="Independently checked the signed order evidence.",
                    reviewer_organizations={org:"owner"})
            verified=await commercial.verify_order(
                proof_id=claim["id"],actor_id=order_reviewer,accepted=True,
                reason="Independent reviewer examined confirmed signed buyer order documents.",
                reviewer_organizations={})
            self.assertEqual(verified["status"],"verified")
            self.assertEqual((await commercial.list_company(organization_id=org))[0]["order_status"],"independently_verified")
            with self.assertRaises(HTTPException):
                await commercial.verify_order(
                    proof_id=claim["id"],actor_id=order_reviewer,accepted=False,
                    reason="Cannot overwrite verified order without a formal new review.",
                    reviewer_organizations={})
            # Published score changed: active qualification suspended dynamically.
            pub.score_care=55
            self.assertEqual((await active.list_company(organization_id=org,certified=True))[0]["status"],"suspended")
            with self.assertRaises(HTTPException):
                await commercial.create(**{**kwargs,"buyer_reference":"BUYERNEW9999"})
            with self.assertRaises(HTTPException):
                await commercial.submit_order_proof(introduction_id=lead["id"],
                    actor_id=matcher,evidence_reference="NEWORDER999",certified=True)
            async with pool.acquire() as conn:
                with self.assertRaises(asyncpg.PostgresError):
                    await conn.execute(
                        "DELETE FROM hhba_commercial_events_private WHERE introduction_id=$1",
                        UUID(lead["id"]))
                with self.assertRaises(asyncpg.PostgresError):
                    await conn.execute(
                        "DELETE FROM hhba_aid_events_private WHERE application_id=$1",
                        UUID(application["id"]))
                assert await conn.fetchval(
                    "SELECT count(*) FROM hhba_commercial_events_private WHERE introduction_id=$1",
                    UUID(lead["id"]))>=5
        finally:
            await pool.close()
if __name__=="__main__":unittest.main()
