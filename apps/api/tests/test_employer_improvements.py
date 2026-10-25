"""Module 09 integration: only real vetted improvements become public."""
from __future__ import annotations
import asyncio,os,unittest
from datetime import date,timedelta,datetime,timezone
from pathlib import Path
from uuid import UUID,uuid4
from fastapi import FastAPI,HTTPException
from fastapi.testclient import TestClient

from apps.api.evidence_domain import Principal
from apps.api.evidence_store import PostgresEvidenceRepository
from apps.api.improvements_domain import validate_review,validate_submission,public_item
from apps.api.improvements_routes import build_improvements_router
from apps.api.improvements_store import PostgresImprovementsRepository
from apps.api.appeals_store import PostgresAppealsRepository


class DomainTests(unittest.TestCase):
    def test_no_future_claims_or_unsubstantiated_public_text(self):
        with self.assertRaises(HTTPException):
            validate_submission(title="改善加薪制度流程",description="有独立核实的员工关怀政策和明确执行资料，可供进一步检查。",
                                effective_date=date.today()+timedelta(days=1))
        with self.assertRaises(HTTPException):
            validate_review(current="submitted",decision="approved",
                reason="Independent supporting records checked before publication.",
                summary="Improvement source is independently supported with documentation.",
                privacy_checked=False)
        with self.assertRaises(HTTPException):
            validate_review(current="approved",decision="approved",
                reason="We cannot repeatedly approve an already published improvement.",
                summary="Improvement source is independently supported with documentation.",
                privacy_checked=True)
        with self.assertRaises(HTTPException):
            validate_review(current="submitted",decision="approved",
                reason="Well supported independent documentation.",summary="Too short",privacy_checked=True)

    def test_public_projection_does_not_leak_private_fields(self):
        now=datetime.now(timezone.utc)
        record=dict(id=uuid4(),category="working_hours",
          public_summary="经审核的工时安排改进政策已生效，并提供对应执行资料供独立复核，属于一项经核验的企业措施。",
          effective_date=date.today(),approved_at=now,organization_id=uuid4(),
          evidence_id=uuid4(),submitted_by=uuid4(),approved_by=uuid4(),
          private_description="This note could include confidential context.",
          private_storage_key="secret",assessment_reason="private")
        public=public_item(record)
        for key in ("evidence_id","organization_id","submitted_by","approved_by",
                    "private_storage_key","private_description","assessment_reason"):
            self.assertNotIn(key,public)
        self.assertEqual(public["score_change"],"not_claimed")


class FakeRepo:
    def __init__(self):self.calls=[]
    async def submit(self,**kwargs):
        self.calls.append(kwargs)
        return {"id":str(uuid4()),"status":"submitted"}
    async def mine(self,**kwargs):return []
    async def public_timeline(self,**kwargs):return []
    async def queue(self,**kwargs):return []
    async def review(self,**kwargs):
        self.calls.append(kwargs)
        return {"status":kwargs["decision"]}
    async def clarify(self,**kwargs):return {"status":"submitted"}
    async def revoke(self,**kwargs):return {"status":"revoked"}


class RouteTests(unittest.TestCase):
    def test_tenant_and_independent_privileges(self):
        org,other,actor=(str(uuid4()) for _ in range(3))
        user=[None]; repo=FakeRepo()
        app=FastAPI()
        app.include_router(build_improvements_router(resolve_actor=lambda:user[0],repository=repo))
        with TestClient(app) as client:
            prefix=f"/api/v1/organizations/{org}/improvements"
            body=dict(evidence_id=str(uuid4()),title="带薪休假制度调整",
                      description="按照核验记录，公司对工时制度进行了明确整改，并留下可核查的执行依据。",
                      effective_date=str(date.today()))
            self.assertEqual(client.post(prefix,json=body).status_code,401)
            user[0]=Principal(actor,{other:"admin"})
            self.assertEqual(client.post(prefix,json=body).status_code,404)
            self.assertEqual(client.get(prefix).status_code,404)
            user[0]=Principal(actor,{org:"owner"})
            self.assertEqual(client.post(prefix,json=body).status_code,201)
            self.assertEqual(client.get("/api/v1/admin/improvements").status_code,403)
            self.assertEqual(client.get(f"/api/v1/public/organizations/{org}/improvements").json()["items"],[])
            user[0]=Principal(actor,{},improvement_reviewer=True)
            self.assertEqual(client.get("/api/v1/admin/improvements").status_code,200)
            good=client.post(f"/api/v1/admin/improvements/{uuid4()}/review",json=dict(
                 decision="approved",reason="Reviewed independent evidence and approved publication after privacy screening.",
                 public_summary="经独立核验，该公司已就劳动保障执行实施了具体改进措施并形成可检查的书面记录。",
                 privacy_checked=True))
            self.assertEqual(good.status_code,200)
            self.assertEqual(repo.calls[-1]["privacy_checked"],True)
            bad=client.post(f"/api/v1/admin/improvements/{uuid4()}/review",json=dict(
                 decision="approved",reason="Review required documented reasons.",
                 public_summary="safe summary",privacy_checked="false"))
            self.assertEqual(bad.status_code,422)


class PostgresIntegrationTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("HHBA_EVIDENCE_TEST_PG_DSN"),"no isolated PG DSN")
    def test_tenant_binding_review_private_then_public_with_revocation_and_appeal_hold(self):
        asyncio.run(self.pg())

    async def pg(self):
        import asyncpg
        pool=await asyncpg.create_pool(os.environ["HHBA_EVIDENCE_TEST_PG_DSN"],min_size=1,max_size=4)
        try:
            async with pool.acquire() as conn:
                for p in ("20261025_employer_evidence.sql","20261025_employee_feedback.sql",
                          "20261025_employer_scoring.sql","20261025_employer_appeals.sql",
                          "20261025_employer_improvements.sql"):
                    await conn.execute(Path("infra/migrations",p).read_text())
            repo=PostgresImprovementsRepository(pool)
            evidence=PostgresEvidenceRepository(pool)
            appeals=PostgresAppealsRepository(pool)
            org,other,submitter,proof_reviewer,approver,another=(str(uuid4()) for _ in range(6))
            e=await evidence.submit(
                organization_id=org,category="working_hours",
                statement="Independent proof of rest and shift improvements.",
                private_storage_key=uuid4().hex,filename="proof.pdf",
                mime="application/pdf",file_size=10,sha256="a"*64,actor_id=submitter)
            body=dict(organization_id=org,evidence_id=e["id"],
                      title="工时管理制度已优化",description="企业已经建立更清晰的工时管理规定和加班审批流程，并留存执行证据供独立核验。",
                      effective_date=date.today()-timedelta(days=5),actor_id=submitter)
            with self.assertRaises(HTTPException):
                await repo.submit(**body)
            async with pool.acquire() as conn:
                await conn.execute("UPDATE hhba_employer_evidence SET security_status='clean' WHERE id=$1",UUID(e["id"]))
            await evidence.review(
                item_id=e["id"],decision="verified",
                reason="Independent reviewer confirmed a valid clean source.",reviewer_id=proof_reviewer)
            with self.assertRaises(HTTPException) as err:
                await repo.submit(**{**body,"organization_id":other})
            self.assertEqual(err.exception.status_code,404)
            improvement=await repo.submit(**body)
            self.assertEqual(improvement["status"],"submitted")
            self.assertEqual(await repo.public_timeline(organization_id=org),[])
            self.assertEqual(await repo.mine(organization_id=other),[])
            with self.assertRaises(HTTPException):
                await repo.submit(**body)
            self.assertEqual(await repo.queue(reviewer_organizations={org:"owner"}),[])
            self.assertEqual(len(await repo.queue(reviewer_organizations={})),1)
            opts=dict(improvement_id=improvement["id"],reviewer_organizations={},
              decision="approved",
              reason="Independently reviewed verified source evidence and privacy risks; approval warranted.",
              summary="企业对工时安排和休息休假制度完成一项经核实的改进，并提供经过独立检查的执行资料。",
              privacy_checked=True)
            for conflict in (submitter,proof_reviewer):
                with self.assertRaises(HTTPException):
                    await repo.review(**{**opts,"reviewer_id":conflict})
            with self.assertRaises(HTTPException):
                await repo.review(**{**opts,"reviewer_id":approver,"reviewer_organizations":{org:"owner"}})
            with self.assertRaises(HTTPException):
                await repo.review(**{**opts,"reviewer_id":approver,"privacy_checked":False})
            approved=await repo.review(**{**opts,"reviewer_id":approver})
            self.assertEqual(approved["status"],"approved")
            public=await repo.public_timeline(organization_id=org)
            self.assertEqual(len(public),1)
            self.assertEqual(public[0]["score_change"],"not_claimed")
            self.assertNotIn("evidence_id",public[0])
            self.assertEqual(await repo.public_timeline(organization_id=other),[])
            # Appeal of the source evidence suppresses timeline even though approved.
            appeal=await appeals.open_employer(
                organization_id=org,target_type="evidence",target_id=e["id"],
                issue="evidence_error",explanation="There is a documented concern about current validity of the source proof.",
                actor_id=submitter)
            self.assertEqual(await repo.public_timeline(organization_id=org),[])
            # Old approved record is not silently revoked; appeal rejection lifts hold.
            await appeals.decide(
                appeal_id=appeal["id"],reviewer_id=another,reviewer_organizations={},
                decision="rejected",reason="Independent reinspection verified the original evidence was sound.")
            self.assertEqual(len(await repo.public_timeline(organization_id=org)),1)
            with self.assertRaises(HTTPException):
                await repo.revoke(improvement_id=improvement["id"],actor_id=submitter,
                                  reviewer_organizations={},reason="Cannot revoke as original submitter of the improvement.")
            revoked=await repo.revoke(
                improvement_id=improvement["id"],actor_id=another,reviewer_organizations={},
                reason="Updated reinspection found insufficient support for a public improvement.")
            self.assertEqual(revoked["status"],"revoked")
            self.assertEqual(await repo.public_timeline(organization_id=org),[])
            async with pool.acquire() as conn:
                with self.assertRaises(asyncpg.PostgresError):
                    await conn.execute(
                        "DELETE FROM hhba_employer_improvement_events WHERE improvement_id=$1",
                        UUID(improvement["id"]))
                num=await conn.fetchval(
                    "SELECT count(*) FROM hhba_employer_improvement_events WHERE improvement_id=$1",
                    UUID(improvement["id"]))
                self.assertEqual(num,3)
        finally:
            await pool.close()


if __name__=="__main__":
    unittest.main()
