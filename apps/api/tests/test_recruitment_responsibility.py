"""HHBA recruitment response accountability regression tests; no private records."""
import unittest
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from uuid import uuid4
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from apps.api.evidence_domain import Principal
from apps.api.recruitment_responsibility_domain import (
    BusinessCalendar, deadline_after_workdays, responsibility_change)
from apps.api.recruitment_responsibility_routes import build_recruitment_responsibility_router

class DeadlineRules(unittest.TestCase):
    def test_seven_workdays_with_holidays_and_makeup(self):
        calendar=BusinessCalendar('trial-cn-2026-v1',frozenset({date(2026,10,27)}),frozenset({date(2026,10,24)}))
        due=deadline_after_workdays(datetime(2026,10,23,4,0,tzinfo=timezone.utc),calendar)
        self.assertEqual(due.astimezone(ZoneInfo('Asia/Shanghai')).date(),date(2026,11,3))
        self.assertEqual(due.utcoffset(),timedelta(0))
    def test_calendar_must_be_authoritative(self):
        with self.assertRaises(ValueError): BusinessCalendar('unverified',frozenset(),frozenset())
        with self.assertRaises(ValueError): BusinessCalendar('v1',frozenset({date(2026,1,1)}),frozenset({date(2026,1,1)}))
        with self.assertRaises(ValueError):
            deadline_after_workdays(datetime(2026,10,26),BusinessCalendar('test-v1',frozenset(),frozenset()))
class TransitionRules(unittest.TestCase):
    def test_reviewing_and_shortlisting_do_not_complete_responsibility(self):
        self.assertEqual(responsibility_change('awaiting','reviewing'),('reviewing',None))
        self.assertEqual(responsibility_change('reviewing','shortlisted'),('reviewing',None))
        self.assertEqual(responsibility_change('awaiting','submitted'),('awaiting',None))
    def test_real_response_and_withdrawal(self):
        self.assertEqual(responsibility_change('reviewing','interview'),('responded','continued'))
        self.assertEqual(responsibility_change('reviewing','rejected'),('responded','declined'))
        self.assertEqual(responsibility_change('awaiting','cancelled'),('responded','cancelled'))
        self.assertEqual(responsibility_change('responded','withdrawn'),('withdrawn',None))
        with self.assertRaises(HTTPException) as e: responsibility_change('responded','reviewing')
        self.assertEqual(e.exception.status_code,409)
    def test_unverified_pseudo_actions_denied(self):
        with self.assertRaises(HTTPException): responsibility_change('awaiting','opened_resume')

class FakeConn:
    def __init__(self):self.writes=[]
    async def __aenter__(self):return self
    async def __aexit__(self,*_):return False
    def transaction(self):return self
    async def fetchrow(self,sql,*args):
        return {'state':'responded','response_kind':'continued'}
    async def execute(self,*args):self.writes.append(args)
class FakePool:
    def __init__(self,conn):self.conn=conn
    def acquire(self):return self.conn
class IdempotentOutboxDelivery(unittest.IsolatedAsyncioTestCase):
    async def test_repeat_of_verified_result_does_not_write_again(self):
        from apps.api.recruitment_responsibility_store import PostgresRecruitmentResponsibilityStore
        conn=FakeConn()
        service=PostgresRecruitmentResponsibilityStore(
            FakePool(conn),BusinessCalendar('trial-v1',frozenset(),frozenset()))
        result=await service.record_canonical_transition(
            application_id=str(uuid4()),organization_id=str(uuid4()),
            posting_id=str(uuid4()),canonical_state='interview',
            actor_id=str(uuid4()),occurred_at=datetime.now(timezone.utc))
        self.assertEqual(result,'responded')
        self.assertEqual(conn.writes,[])

class FakeStore:
    def __init__(self): self.calls=[]
    async def list_for_employer(self,**kw):
        self.calls.append(('employer',kw));return {'status':'connected','as_of':datetime.now(timezone.utc),'total':0,'items':[]}
    async def list_for_candidate(self,**kw):
        self.calls.append(('candidate',kw));return {'status':'connected','as_of':datetime.now(timezone.utc),'total':0,'items':[]}
    async def list_overdue_for_reviewer(self,**kw):
        self.calls.append(('review',kw));return {'status':'connected','as_of':datetime.now(timezone.utc),'total':0,'items':[]}
def make_client(actor):
    fake=FakeStore();app=FastAPI()
    app.include_router(build_recruitment_responsibility_router(resolve_actor=lambda:actor,repository=fake))
    return TestClient(app),fake

class AccessControls(unittest.TestCase):
    def setUp(self):
        self.uid,self.org,self.post,self.other=(str(uuid4()) for _ in range(4))
        self.url=f'/api/v1/organizations/{self.org}/postings/{self.post}/recruitment-responsibilities'
    def test_anonymous_has_no_access(self):
        c,f=make_client(None)
        self.assertEqual(c.get(self.url).status_code,401)
        self.assertEqual(c.get('/api/v1/me/recruitment-responsibilities').status_code,401)
        self.assertEqual(c.get('/api/v1/admin/recruitment-responsibilities').status_code,401)
        self.assertFalse(f.calls)
    def test_employer_must_belong_to_matching_organization(self):
        c,f=make_client(Principal(self.uid,{self.other:'owner'}))
        self.assertEqual(c.get(self.url).status_code,404);self.assertFalse(f.calls)
    def test_own_employer_queue_is_scoped_and_no_store(self):
        c,f=make_client(Principal(self.uid,{self.org:'hr_recruiter'}))
        res=c.get(self.url)
        self.assertEqual(res.status_code,200)
        self.assertIn('no-store',res.headers['cache-control'])
        self.assertEqual(f.calls,[('employer',{'organization_id':self.org,'posting_id':self.post})])
    def test_candidate_scoped_to_session_not_user_query(self):
        c,f=make_client(Principal(self.uid,{}))
        self.assertEqual(c.get('/api/v1/me/recruitment-responsibilities').status_code,200)
        self.assertEqual(f.calls,[('candidate',{'candidate_id':self.uid})])
        self.assertEqual(c.get('/api/v1/admin/recruitment-responsibilities').status_code,403)
    def test_independent_reviewer_cannot_review_own_org(self):
        c,f=make_client(Principal(self.uid,{self.org:'owner'},recruitment_reviewer=True))
        self.assertEqual(c.get('/api/v1/admin/recruitment-responsibilities').status_code,200)
        self.assertEqual(f.calls,[('review',{'excluded_organizations':[self.org]})])
        self.assertEqual(c.get('/api/v1/admin/recruitment-responsibilities?view=all').status_code,422)
    def test_no_browser_created_deliveries(self):
        c,_=make_client(Principal(self.uid,{self.org:'owner'}))
        self.assertEqual(c.post(self.url,json={'application_id':str(uuid4())}).status_code,405)
if __name__=='__main__':unittest.main()
