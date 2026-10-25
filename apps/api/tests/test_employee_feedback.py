"""Module 06 privacy/security acceptance. Synthetic data only."""
from __future__ import annotations

import os
import secrets
import unittest
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from apps.api.feedback_domain import (
    MIN_PUBLIC_RESPONSES, DIMENSIONS, EmployeeActor, completed_period,
    current_period, identity_hash, token_hash, new_ticket, ticket_expiry,
    public_feedback, validate_ratings,
)
from apps.api.feedback_routes import build_feedback_router
from apps.api.feedback_store import PostgresFeedbackRepository


class FeedbackPolicyTests(unittest.TestCase):
    def setUp(self):
        self.secret = secrets.token_bytes(32)
        self.user, self.org = str(uuid4()), str(uuid4())
        self.ratings = dict.fromkeys(DIMENSIONS, 4)

    def test_verified_pseudonym_scoped_to_org_period_and_secret(self):
        first = identity_hash(self.secret,self.user,self.org,'2026-Q4')
        self.assertEqual(first,identity_hash(self.secret,self.user,self.org,'2026-Q4'))
        self.assertNotEqual(first,identity_hash(self.secret,self.user,str(uuid4()),'2026-Q4'))
        self.assertNotEqual(first,identity_hash(self.secret,self.user,self.org,'2027-Q1'))
        self.assertNotIn(self.user,first)
        self.assertEqual(len(first),64)

    def test_ticket_digest_cannot_be_derived_without_private_secret(self):
        ticket=new_ticket()
        self.assertEqual(len(ticket),64)
        self.assertEqual(len(token_hash(self.secret,ticket)),64)
        self.assertNotEqual(token_hash(self.secret,ticket), token_hash(secrets.token_bytes(32),ticket))
        with self.assertRaises(HTTPException):
            token_hash(self.secret,'user-provided-token')

    def test_ticket_is_short_lived_and_never_crosses_quarter(self):
        at=datetime(2026,12,31,23,30,tzinfo=timezone.utc)
        self.assertEqual(ticket_expiry(at),datetime(2027,1,1,tzinfo=timezone.utc))
        self.assertLess(ticket_expiry(datetime(2026,10,25,tzinfo=timezone.utc)),
                        datetime(2026,10,27,tzinfo=timezone.utc))

    def test_ratings_must_be_five_explicit_integer_dimensions(self):
        self.assertEqual(validate_ratings(self.ratings),self.ratings)
        for payload in [{**self.ratings,'note':'I work in X'}, {**self.ratings,'pay':True},
                        {**self.ratings,'pay':0}, {**self.ratings,'pay':6},
                        {key:4 for key in DIMENSIONS[:-1]}]:
            with self.assertRaises(HTTPException):
                validate_ratings(payload)

    def test_closed_quarter_min_ten_aggregate_and_no_small_group_leak(self):
        future=datetime(2030,2,1,tzinfo=timezone.utc)
        rows=[self.ratings.copy() for _ in range(MIN_PUBLIC_RESPONSES-1)]
        private=public_feedback(rows,period='2029-Q4',now=future)
        self.assertEqual(private,{"status":"not_public","period":"2029-Q4"})
        rows.append(self.ratings.copy())
        visible=public_feedback(rows,period='2029-Q4',now=future)
        self.assertEqual(visible["status"],"published")
        self.assertEqual(visible["scores_out_of_5"]["pay"],4.0)
        for key in ('exact_count','respondents','user_id','identity','comments','created_at'):
            self.assertNotIn(key,visible)
        self.assertEqual(public_feedback(rows,period='2030-Q1',now=future)["status"],"not_public")
        with self.assertRaises(HTTPException):
            public_feedback(rows,period='bad-period',now=future)


class FakeFeedbackRepo:
    def __init__(self):
        self.tickets = {}
        self.used_subjects = set()
        self.ratings=[]

    async def issue_ticket(self, *, organization_id, period, subject_hmac, token_hmac, expires_at):
        key=(organization_id,period,subject_hmac)
        if key in self.used_subjects:
            raise HTTPException(409,detail="TICKET_ALREADY_ISSUED_OR_USED")
        self.used_subjects.add(key)
        self.tickets[token_hmac]=(organization_id,period,subject_hmac,False,expires_at)

    async def redeem(self, *, organization_id, period, subject_hmac, token_hmac, ratings):
        info=self.tickets.get(token_hmac)
        if not info or info[:3]!=(organization_id,period,subject_hmac) or info[3]:
            raise HTTPException(403,detail="INVALID_OR_USED_TICKET")
        self.tickets[token_hmac]=(info[0],info[1],info[2],True,info[4])
        self.ratings.append(dict(organization_id=organization_id,period=period,**ratings))

    async def public_aggregate(self, *, organization_id,period):
        return public_feedback([r for r in self.ratings if r["organization_id"]==organization_id
                                and r["period"]==period],period=period)


class FeedbackRouterTests(unittest.TestCase):
    def setUp(self):
        self.user,self.org,self.other=str(uuid4()),str(uuid4()),str(uuid4())
        self.actor=[EmployeeActor(self.user)]
        self.verified=[True]
        self.repo=FakeFeedbackRepo()
        async def verify_employment(actor,organization_id):
            return self.verified[0] and actor.user_id==self.user and organization_id==self.org
        def resolve_employee():
            return self.actor[0]
        app=FastAPI()
        app.include_router(build_feedback_router(
            resolve_employee=resolve_employee, verify_employment=verify_employment,
            repository=self.repo, hmac_secret=secrets.token_bytes(32)))
        self.client=TestClient(app)
        self.addCleanup(self.client.close)
        self.ratings=dict.fromkeys(DIMENSIONS,4)

    def ticket(self,org=None):
        return self.client.post('/api/v1/employee-feedback/ticket',
                                json={"organization_id":org or self.org})

    def feedback(self,token,org=None,ratings=None):
        return self.client.post('/api/v1/employee-feedback',
              json={"organization_id":org or self.org,"ticket":token,
                    **(ratings or self.ratings)})

    def test_no_employee_verification_no_ticket(self):
        self.actor[0]=None
        self.assertEqual(self.ticket().status_code,401)
        self.actor[0]=EmployeeActor(self.user)
        self.verified[0]=False
        self.assertEqual(self.ticket().status_code,403)
        self.verified[0]=True
        self.assertEqual(self.ticket(self.other).status_code,403)
        self.assertFalse(self.repo.tickets)

    def test_one_eligible_employee_one_quarter_one_submission(self):
        response=self.ticket()
        self.assertEqual(response.status_code,200,response.text)
        token=response.json()["ticket"]
        self.assertEqual(self.ticket().status_code,409)
        wrong=self.feedback(token,org=self.other)
        self.assertEqual(wrong.status_code,403)
        valid=self.feedback(token)
        self.assertEqual(valid.status_code,201,valid.text)
        self.assertEqual(valid.json()["accepted"],True)
        self.assertNotIn("user_id",valid.text)
        self.assertEqual(self.feedback(token).status_code,403)
        self.assertEqual(len(self.repo.ratings),1)
        self.assertNotIn("subject_hmac",self.repo.ratings[0])
        self.assertNotIn("ticket",self.repo.ratings[0])
        self.assertNotIn("user_id",self.repo.ratings[0])

    def test_out_of_range_rejected_without_consuming_token(self):
        token=self.ticket().json()["ticket"]
        self.assertEqual(self.feedback(token,ratings={**self.ratings,'pay':7}).status_code,422)
        self.assertEqual(self.feedback(token).status_code,201)

    def test_public_aggregate_does_not_leak_small_cohort(self):
        url=f"/api/v1/public/organizations/{self.org}/employee-feedback/{current_period()}"
        result=self.client.get(url)
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json(),{"status":"not_public","period":current_period()})
        self.assertNotIn('user_id',result.text)


class PgFeedbackTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("HHBA_EVIDENCE_TEST_PG_DSN"),"no isolated Postgres test DSN")
    def test_atomic_ticket_redemption_and_no_raw_user_key(self):
        import asyncio
        asyncio.run(self.pg())

    async def pg(self):
        import asyncpg
        from pathlib import Path
        dsn=os.environ["HHBA_EVIDENCE_TEST_PG_DSN"]
        pool=await asyncpg.create_pool(dsn,min_size=1,max_size=2)
        try:
            sql=Path("infra/migrations/20261025_employee_feedback.sql").read_text()
            async with pool.acquire() as conn: await conn.execute(sql)
            repo=PostgresFeedbackRepository(pool)
            org,user=str(uuid4()),str(uuid4())
            secret=secrets.token_bytes(32)
            period=current_period()
            subject=identity_hash(secret,user,org,period)
            token=new_ticket()
            await repo.issue_ticket(
                organization_id=org,period=period,subject_hmac=subject,
                token_hmac=token_hash(secret,token),expires_at=ticket_expiry())
            with self.assertRaises(HTTPException) as err:
                await repo.issue_ticket(
                    organization_id=org,period=period,subject_hmac=subject,
                    token_hmac=token_hash(secret,new_ticket()),expires_at=ticket_expiry())
            self.assertEqual(err.exception.status_code,409)
            ratings=dict.fromkeys(DIMENSIONS,4)
            wrong_actor=identity_hash(secret,str(uuid4()),org,period)
            with self.assertRaises(HTTPException):
                await repo.redeem(
                    organization_id=org,period=period,subject_hmac=wrong_actor,
                    token_hmac=token_hash(secret,token),ratings=ratings)
            await repo.redeem(
                organization_id=org,period=period,subject_hmac=subject,
                token_hmac=token_hash(secret,token),ratings=ratings)
            with self.assertRaises(HTTPException):
                await repo.redeem(
                    organization_id=org,period=period,subject_hmac=subject,
                    token_hmac=token_hash(secret,token),ratings=ratings)
            async with pool.acquire() as conn:
                row=await conn.fetchrow(
                    "SELECT * FROM hhba_employee_feedback_private WHERE organization_id=$1",UUID(org))
            self.assertEqual(row["pay"],4)
            self.assertNotIn("user_id",row.keys())
            self.assertNotIn("token_hmac",row.keys())
            self.assertNotIn("subject_hmac",row.keys())
            self.assertNotIn("created_at",row.keys())
            result=await repo.public_aggregate(organization_id=org,period=period)
            self.assertEqual(result["status"],"not_public")
        finally:
            await pool.close()


if __name__=="__main__":
    unittest.main()
