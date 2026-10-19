"""Only synthetic organizations. Public jobs and talent must fail closed."""
import os,uuid
RUN=uuid.uuid4().hex
os.environ["DATABASE_URL"]=f"sqlite:///./phase4-{RUN}.sqlite3"
from fastapi.testclient import TestClient
from app.main import (app,Base,engine,SessionLocal,User,Organization,
 OrganizationVerification,RecruiterVerification,RecruiterOrganizationAuthorization,
 PlatformServiceGate,EmployerPosting,Consent,Profile,now)
Base.metadata.create_all(engine)
PWD='SyntheticOnly123!'
def actor(name,kind='recruiter'):
 client=TestClient(app)
 email=f'{name}-{uuid.uuid4().hex[:8]}@synthetic.invalid'
 response=client.post('/api/v1/auth/register',json={'email':email,'password':PWD,'display_name':name,'account_type':kind})
 assert response.status_code==201,response.text
 login=client.post('/api/v1/auth/session',json={'email':email,'password':PWD,'account_type':kind})
 assert login.status_code==200,login.text
 return client,login.json()['csrf_token'],email
def organ(client,csrf):
 r=client.post('/api/v1/organizations',json={'legal_name':'合成企业 '+uuid.uuid4().hex[:6]},headers={'X-CSRF-Token':csrf})
 assert r.status_code==201,r.text
 return r.json()['id']
POST={'title':'区域渠道销售经理','description':'负责本区域终端门店运营，销售线索转化和培训协同，以及每周复盘与业务流程优化。',
      'requirements':'要求有销售培训、区域运营的工作经历，能够进行日常数据分析和沟通。',
      'location':'山东济南','work_mode':'onsite','recruitment_type':'SOCIAL',
      'apply_url':'https://recruit.example.org/careers/job/100'}
def approve_synthetic_org(oid,email):
 with SessionLocal() as s:
  admin_owner=s.query(User).filter_by(email=email).one()
  org=s.get(Organization,uuid.UUID(oid));org.status='approved'
  verification=s.query(OrganizationVerification).filter_by(organization_id=org.id).one()
  verification.status='approved'
  recruiter=s.query(RecruiterVerification).filter_by(user_id=admin_owner.id).one()
  recruiter.status='approved'
  authorization=s.query(RecruiterOrganizationAuthorization).filter_by(organization_id=org.id,user_id=admin_owner.id).one()
  authorization.status='active'
  gate=s.get(PlatformServiceGate,'network_recruitment')
  if not gate:gate=PlatformServiceGate(gate_key='network_recruitment',enabled=True);s.add(gate)
  else:gate.enabled=True
  s.commit()
def admin():
 client,csrf,email=actor('admin')
 with SessionLocal() as s:s.query(User).filter_by(email=email).one().role='admin';s.commit()
 return client,csrf,email
def test_posting_requires_recruiter_identity_and_csrf():
 c,csrf,email=actor('owner');oid=organ(c,csrf)
 payload=c.post(f'/api/v1/organizations/{oid}/postings',json=POST,headers={'X-CSRF-Token':csrf})
 assert payload.status_code==201,payload.text
 pid=payload.json()['id'].removeprefix('employer-')
 assert payload.json()['status']=='draft'
 assert c.post(f'/api/v1/organizations/{oid}/postings',json=POST).status_code==403
 assert c.post(f'/api/v1/organizations/{oid}/postings/{pid}/submit',headers={'X-CSRF-Token':csrf}).status_code==403
 assert c.get('/api/v1/public/employer-postings').json()['items']==[]
 candidate,token,_=actor('candidate','candidate')
 assert candidate.post(f'/api/v1/organizations/{oid}/postings',json=POST,headers={'X-CSRF-Token':token}).status_code==404
 other,t2,_=actor('outsider');oid2=organ(other,t2)
 assert other.get(f'/api/v1/organizations/{oid}/postings').status_code==404
 assert other.put(f'/api/v1/organizations/{oid}/postings/{pid}',json=POST,headers={'X-CSRF-Token':t2}).status_code==404
 assert other.get(f'/api/v1/organizations/{oid2}/postings').json()['items']==[]
def test_bad_link_and_missing_review_block_public():
 c,csrf,email=actor('invalid-link');oid=organ(c,csrf)
 for link in ['http://recruit.example.org/job/1','https://localhost/job/1','https://bit.ly/abc',
              'https://127.0.0.1/job/1','https://recruit.example.org:8888/job/1']:
  result=c.post(f'/api/v1/organizations/{oid}/postings',json={**POST,'apply_url':link},headers={'X-CSRF-Token':csrf})
  assert result.status_code==422,(link,result.text)
 response=c.post(f'/api/v1/organizations/{oid}/postings',json=POST,headers={'X-CSRF-Token':csrf})
 pid=response.json()['id'].removeprefix('employer-')
 with SessionLocal() as s:s.get(EmployerPosting,uuid.UUID(pid)).status='pending_review';s.commit()
 administrator,admin_csrf,_=admin()
 review=administrator.post(f'/api/v1/admin/employer-postings/{pid}/review',
  json={'decision':'approved','reason_code':'checked'},headers={'X-CSRF-Token':admin_csrf})
 assert review.status_code==403,review.text
 assert c.get('/api/v1/public/employer-postings').json()['items']==[]
def test_independent_review_and_immediate_revocation():
 c,csrf,email=actor('approved-poster');oid=organ(c,csrf)
 p=c.post(f'/api/v1/organizations/{oid}/postings',json=POST,headers={'X-CSRF-Token':csrf}).json()
 pid=p['id'].removeprefix('employer-')
 approve_synthetic_org(oid,email)
 submitted=c.post(f'/api/v1/organizations/{oid}/postings/{pid}/submit',headers={'X-CSRF-Token':csrf})
 assert submitted.status_code==200,submitted.text
 assert c.get('/api/v1/public/employer-postings').json()['items']==[]
 adm,ac,_=admin()
 approved=adm.post(f'/api/v1/admin/employer-postings/{pid}/review',json={'decision':'approved','reason_code':'checked'},headers={'X-CSRF-Token':ac})
 assert approved.status_code==200,approved.text
 visible=c.get('/api/v1/public/employer-postings')
 assert any(p['id']=='employer-'+pid for p in visible.json()['items'])
 detail=c.get(f'/api/v1/public/employer-postings/{pid}')
 assert detail.status_code==200 and detail.json()['source_type']=='HHBA_VERIFIED_EMPLOYER'
 assert c.post(f'/api/v1/organizations/{oid}/postings/{pid}/close',headers={'X-CSRF-Token':csrf}).status_code==200
 assert c.get(f'/api/v1/public/employer-postings/{pid}').status_code==404
 assert not any(p['id']=='employer-'+pid for p in c.get('/api/v1/public/employer-postings').json()['items'])
def test_revoked_recruiter_prevents_public_access_even_if_posting_published():
 c,csrf,email=actor('revoke-poster');oid=organ(c,csrf)
 p=c.post(f'/api/v1/organizations/{oid}/postings',json=POST,headers={'X-CSRF-Token':csrf}).json()
 pid=p['id'].removeprefix('employer-')
 approve_synthetic_org(oid,email)
 assert c.post(f'/api/v1/organizations/{oid}/postings/{pid}/submit',headers={'X-CSRF-Token':csrf}).status_code==200
 ad,token,_=admin()
 assert ad.post(f'/api/v1/admin/employer-postings/{pid}/review',json={'decision':'approved','reason_code':'checked'},headers={'X-CSRF-Token':token}).status_code==200
 with SessionLocal() as s:
  actor=s.query(User).filter_by(email=email).one()
  grant=s.query(RecruiterOrganizationAuthorization).filter_by(organization_id=uuid.UUID(oid),user_id=actor.id).one()
  grant.status='revoked';grant.revoked_at=now();s.commit()
 assert c.get(f'/api/v1/public/employer-postings/{pid}').status_code==404
 assert all(x['id']!='employer-'+pid for x in c.get('/api/v1/public/employer-postings').json()['items'])
