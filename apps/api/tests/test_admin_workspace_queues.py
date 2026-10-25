"""No production credentials or private records are required to test queue RBAC."""
import unittest
from uuid import uuid4
from fastapi import FastAPI
from fastapi.testclient import TestClient
from apps.api.evidence_domain import Principal
from apps.api.admin_workspace_routes import (
    QUEUES, PostgresReviewerQueueReader, build_reviewer_queue_router
)


class FakeConn:
    def __init__(self, *, fail=False):
        self.calls = []
        self.fail = fail

    async def fetchval(self, sql, exclusions, user_id):
        self.calls.append((sql, exclusions, user_id))
        if self.fail:
            raise RuntimeError("missing schema or permission")
        return 2


class FakeAcquire:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, *_):
        return False


class FakePool:
    def __init__(self, conn):
        self.conn = conn

    def acquire(self):
        return FakeAcquire(self.conn)


def app_for(actor, *, fail=False):
    conn = FakeConn(fail=fail)
    app = FastAPI()
    app.include_router(build_reviewer_queue_router(
        resolve_actor=lambda: actor,
        reader=PostgresReviewerQueueReader(FakePool(conn)),
    ))
    return TestClient(app), conn


class ReviewerQueueSecurityTests(unittest.TestCase):
    def setUp(self):
        self.uid, self.org = str(uuid4()), str(uuid4())
        self.url = "/api/v1/admin/workspace/queues"

    def test_anonymous_password_only_and_employer_roles_are_denied(self):
        for actor, expected in (
            (None, 401),
            (Principal(self.uid, {}), 403),
            (Principal(self.uid, {self.org: "owner"}), 403),
        ):
            client, conn = app_for(actor)
            result = client.get(self.url)
            self.assertEqual(result.status_code, expected)
            self.assertEqual(conn.calls, [])

    def test_per_role_count_only_and_employer_exclusion(self):
        actor = Principal(self.uid, {self.org: "owner"}, evidence_reviewer=True)
        client, conn = app_for(actor)
        resp = client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        self.assertIn("no-store", resp.headers["cache-control"])
        self.assertEqual(resp.json()["kind"], "HHBA_REVIEWER_QUEUE_V1")
        rows = {x["key"]: x for x in resp.json()["modules"]}
        self.assertEqual(rows["evidence"]["pending"], 2)
        self.assertEqual(rows["evidence"]["state"], "connected")
        for key in ("care", "scoring", "appeals", "improvements", "publication",
                    "aid", "commercial"):
            self.assertIsNone(rows[key]["pending"], key)
        self.assertTrue(all(x["reviewAllowed"] is False for x in rows.values()))
        self.assertEqual(len(conn.calls), 1)
        self.assertEqual([str(x) for x in conn.calls[0][1]], [self.org])
        self.assertEqual(str(conn.calls[0][2]), self.uid)
        self.assertNotIn("items", resp.json())
        self.assertNotIn("employee_id", str(resp.json()))
        self.assertNotIn("buyer_reference", str(resp.json()))

    def test_commercial_count_requires_separate_buyer_or_proof_role(self):
        actor = Principal(self.uid, {}, buyer_consent_reviewer=True,
                          commercial_evidence_reviewer=True)
        client, conn = app_for(actor)
        rows = {x["key"]: x for x in client.get(self.url).json()["modules"]}
        self.assertEqual(rows["commercial"]["pending"], 4)
        self.assertEqual(len(conn.calls), 2)
        self.assertTrue(any("buyer_consent_verified_by" in sql for sql, *_ in conn.calls))
        self.assertTrue(any("hhba_commercial_order_proofs_private" in sql for sql, *_ in conn.calls))

    def test_database_failure_is_503_not_misleading_zero(self):
        actor = Principal(self.uid, {}, appeals_reviewer=True)
        client, _ = app_for(actor, fail=True)
        self.assertEqual(client.get(self.url).status_code, 503)

    def test_role_actor_with_invalid_uuid_is_unavailable(self):
        actor = Principal("not-an-id", {}, evidence_reviewer=True)
        client, conn = app_for(actor)
        result = client.get(self.url)
        self.assertEqual(result.status_code, 503)
        self.assertEqual(conn.calls, [])

    def test_route_never_exposes_writes(self):
        actor = Principal(self.uid, {}, evidence_reviewer=True)
        client, _ = app_for(actor)
        for method in ("post", "put", "patch", "delete"):
            self.assertEqual(getattr(client, method)(self.url).status_code, 405)
        self.assertEqual(len(QUEUES), 7)


if __name__ == "__main__":
    unittest.main()
