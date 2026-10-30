"""HHBA evidence security and DB contract tests; no real private documents."""
from __future__ import annotations

import asyncio
import os
import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from apps.api.evidence_domain import (
    Principal, MAX_FILE_BYTES, require_member, require_reviewer,
    require_independent_review, require_review_transition,
    validate_file, validate_submission,
)
from apps.api.evidence_routes import build_evidence_router
from apps.api.evidence_store import PostgresEvidenceRepository, PrivateEvidenceVault


class DomainPolicyTests(unittest.TestCase):
    def setUp(self):
        self.org, self.other, self.user = (str(uuid4()) for _ in range(3))
        self.member = Principal(self.user, {self.org: "owner"})

    def test_denies_unauthenticated_or_other_organization(self):
        with self.assertRaises(HTTPException) as e:
            require_member(None, self.org)
        self.assertEqual(e.exception.status_code, 401)
        with self.assertRaises(HTTPException) as e:
            require_member(self.member, self.other)
        self.assertEqual(e.exception.status_code, 404)

    def test_reviewer_role_and_self_review(self):
        with self.assertRaises(HTTPException) as e:
            require_reviewer(self.member)
        self.assertEqual(e.exception.status_code, 403)
        with self.assertRaises(HTTPException) as e:
            require_independent_review(self.user, self.user)
        self.assertEqual(e.exception.status_code, 403)
        require_reviewer(Principal(str(uuid4()), {}, True))

    def test_upload_rejects_disguised_and_oversize_file(self):
        self.assertEqual(validate_file("x.pdf", b"%PDF-1.4\nhello"), "application/pdf")
        self.assertEqual(validate_file("x.png", b"\x89PNG\r\n\x1a\nbody"), "image/png")
        with self.assertRaises(HTTPException) as e:
            validate_file("x.pdf", b"<script>alert(1)</script>")
        self.assertEqual(e.exception.status_code, 415)
        with self.assertRaises(HTTPException) as e:
            validate_file("x.pdf", b"%PDF-" + b"x" * MAX_FILE_BYTES)
        self.assertEqual(e.exception.status_code, 413)
        with self.assertRaises(HTTPException):
            validate_submission("fake_category", "valid explanation of work")

    def test_immutable_review_state(self):
        require_review_transition("pending_review", "verified")
        require_review_transition("needs_more_info", "rejected")
        for old, target in (("verified", "verified"), ("rejected", "verified"), ("expired", "verified")):
            with self.assertRaises(HTTPException) as e:
                require_review_transition(old, target)
            self.assertEqual(e.exception.status_code, 409)


class FakeRepo:
    def __init__(self):
        self.rows = {}

    async def submit(self, **kw):
        uid = str(uuid4())
        row = {
            "id": uid, "organization_id": kw["organization_id"],
            "private_storage_key": kw["private_storage_key"],
            "submitted_by": kw["actor_id"], "status": "pending_review",
            "security_status": "pending_scan", "file_mime": kw["mime"],
        }
        self.rows[uid] = row
        return {"id": uid, "organization_id": row["organization_id"],
                "category": kw["category"], "statement": kw["statement"],
                "status": "pending_review", "file_mime": row["file_mime"]}

    async def list_by_organization(self, organization_id):
        return [{"id": uid, "organization_id": row["organization_id"],
                 "status": row["status"]}
                for uid, row in self.rows.items()
                if row["organization_id"] == organization_id]

    async def list_pending_review(self):
        return [{"id":uid,"status":row["status"]} for uid,row in self.rows.items()
                if row["status"] in {"pending_review","needs_more_info"}]

    async def get_private_item(self, item_id):
        if item_id not in self.rows:
            raise HTTPException(404, detail="EVIDENCE_NOT_FOUND")
        return self.rows[item_id]

    async def review(self, *, item_id, decision, reason, reviewer_id):
        row = await self.get_private_item(item_id)
        require_independent_review(row["submitted_by"], reviewer_id)
        require_review_transition(row["status"], decision)
        if decision == "verified" and row["security_status"] != "clean":
            raise HTTPException(409, detail="FILE_SECURITY_CHECK_REQUIRED")
        if len(reason.strip()) < 12:
            raise HTTPException(422, detail="INVALID_REVIEW_REASON")
        row["status"] = decision
        return {"id": item_id, "status": decision}


class EvidenceApiTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.vault = PrivateEvidenceVault(self.dir.name)
        self.repo = FakeRepo()
        self.org, self.other = str(uuid4()), str(uuid4())
        self.author = str(uuid4())
        self.reviewer = str(uuid4())
        self.actor = [Principal(self.author, {self.org: "owner"})]
        def resolve_actor():
            return self.actor[0]
        app = FastAPI()
        app.include_router(build_evidence_router(
            resolve_actor=resolve_actor, repository=self.repo, vault=self.vault))
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def add_file(self, org=None, content=b"%PDF-1.6\nFAKE UNIT TEST DOCUMENT"):
        return self.client.post(
            f"/api/v1/organizations/{org or self.org}/evidence",
            data={"category":"pay_and_contracts",
                  "statement":"Company has a documented wage-payment process."},
            files={"file":("wages.pdf", content, "application/pdf")},
        )

    def test_identity_gates_tenant_isolation_and_download(self):
        result = self.add_file()
        self.assertEqual(result.status_code, 201, result.text)
        obj = result.json()
        self.assertNotIn("private_storage_key", obj)
        uid = obj["id"]
        files = self.client.get(f"/api/v1/organizations/{self.org}/evidence")
        self.assertEqual(len(files.json()["items"]), 1)
        self.assertNotIn("private_storage_key", files.text)
        permitted = self.client.get(
            f"/api/v1/organizations/{self.org}/evidence/{uid}/file")
        self.assertEqual(permitted.status_code, 409)
        self.repo.rows[uid]["security_status"] = "clean"  # scanner integration simulated in isolated test
        permitted = self.client.get(f"/api/v1/organizations/{self.org}/evidence/{uid}/file")
        self.assertEqual(permitted.status_code, 200)
        self.assertIn("no-store", permitted.headers["cache-control"])
        self.assertEqual(permitted.content, b"%PDF-1.6\nFAKE UNIT TEST DOCUMENT")
        self.assertEqual(
            self.client.get(f"/api/v1/organizations/{self.other}/evidence/{uid}/file").status_code,
            404)
        self.actor[0] = Principal(self.author, {})
        self.assertEqual(self.client.get(
            f"/api/v1/organizations/{self.org}/evidence").status_code, 404)
        self.assertEqual(self.add_file().status_code, 404)
        self.actor[0] = None
        self.assertEqual(self.add_file().status_code, 401)

    def test_admin_only_review_and_self_review_forbidden(self):
        uid = self.add_file().json()["id"]
        endpoint=f"/api/v1/admin/evidence/{uid}/reviews"
        result=self.client.post(endpoint,json={
            "decision":"verified","reason":"Documents validated in two independent checks."})
        self.assertEqual(result.status_code,403)
        self.actor[0]=Principal(self.author,{},True)
        self.assertEqual(self.client.post(endpoint,json={
            "decision":"verified","reason":"Documents validated in two independent checks."}).status_code,403)
        self.actor[0]=Principal(self.reviewer,{},True)
        self.assertEqual(len(self.client.get('/api/v1/admin/evidence').json()['items']),1)
        self.assertEqual(self.client.post(endpoint,json={
            "decision":"verified","reason":"File not independently scanned by scanner service."}).status_code,409)
        self.repo.rows[uid]["security_status"]="clean"  # not exposed by any public API
        result=self.client.post(endpoint,json={
            "decision":"verified","reason":"Documents validated in two independent checks."})
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()["status"],"verified")
        self.assertEqual(self.client.post(endpoint,json={
            "decision":"verified","reason":"Cannot approve this document again after final review."}).status_code,409)
        self.assertEqual(self.client.get(
            f"/api/v1/admin/evidence/{uid}/file").status_code,200)

    def test_disguised_file_never_writes_storage(self):
        before=list(Path(self.dir.name).iterdir())
        result=self.add_file(content=b"<script>not a real PDF</script>")
        self.assertEqual(result.status_code,415)
        self.assertEqual(list(Path(self.dir.name).iterdir()),before)


class PostgresContractTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("HHBA_EVIDENCE_TEST_PG_DSN"), "no test PG DSN")
    def test_transaction_audit_is_immutable_and_tenant_scoped(self):
        asyncio.run(self._exercise())

    async def _exercise(self):
        import asyncpg
        dsn=os.environ["HHBA_EVIDENCE_TEST_PG_DSN"]
        pool=await asyncpg.create_pool(dsn, min_size=1,max_size=2)
        try:
            async with pool.acquire() as conn:
                sql=Path("infra/migrations/20261025_employer_evidence.sql").read_text()
                await conn.execute(sql)
            repo=PostgresEvidenceRepository(pool)
            org, actor, reviewer=(str(uuid4()) for _ in range(3))
            key=uuid4().hex
            row=await repo.submit(
                organization_id=org, category="social_insurance",
                statement="A documented test social insurance coverage statement.",
                private_storage_key=key,filename="document.pdf",
                mime="application/pdf",file_size=9,sha256="a"*64,actor_id=actor)
            self.assertEqual(row["status"],"pending_review")
            self.assertEqual(len(await repo.list_by_organization(org)),1)
            self.assertEqual(await repo.list_by_organization(str(uuid4())),[])
            with self.assertRaises(HTTPException):
                await repo.review(item_id=row["id"],decision="verified",
                                  reason="Self-review is not allowed at HHBA.",reviewer_id=actor)
            with self.assertRaises(HTTPException) as scan_error:
                await repo.review(
                    item_id=row["id"], decision="verified",
                    reason="Missing malware check must fail verification.", reviewer_id=reviewer)
            self.assertEqual(scan_error.exception.status_code, 409)
            async with pool.acquire() as conn:
                await conn.execute("UPDATE hhba_employer_evidence SET security_status='clean' WHERE id=$1",uuid4_from(row["id"]))
            approved=await repo.review(
                item_id=row["id"],decision="verified",
                reason="Auditor checked supporting evidence and provenance.",reviewer_id=reviewer)
            self.assertEqual(approved["status"],"verified")
            with self.assertRaises(HTTPException):
                await repo.review(
                    item_id=row["id"], decision="verified",
                    reason="Second approval not permitted after final review.",reviewer_id=reviewer)
            async with pool.acquire() as conn:
                records=await conn.fetch(
                    "SELECT event_name FROM hhba_evidence_audit WHERE evidence_id=$1",uuid4_from(row["id"]))
                self.assertEqual([x["event_name"] for x in records],["submitted","reviewed"])
                with self.assertRaises(asyncpg.PostgresError):
                    await conn.execute("DELETE FROM hhba_evidence_audit WHERE evidence_id=$1",uuid4_from(row["id"]))
        finally:
            await pool.close()


def uuid4_from(s):
    from uuid import UUID
    return UUID(s)


if __name__ == "__main__":
    unittest.main()
