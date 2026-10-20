"""Phase 5 synthetic end-to-end tests: no resume/contact disclosure or cross-org leakage."""
import uuid
from app.main import SessionLocal,EmployerJobApplication,Consent,User,RecruiterOrganizationAuthorization,now
from test_phase4_employer_workspace import actor,organ,approve_synthetic_org,admin,POST

def published_job():
 employer,csrf,email=actor('phase5-employer')
 oid=organ(employer,csrf)
 resp=employer.post(f'/api/v1/organizations/{oid}/postings',
  json=POST,headers={'X-CSRF-Token':csrf})
 assert resp.status_code==201,resp.text
 pid=resp.json()['id'].removeprefix('employer-')
 approve_synthetic_org(oid,email)
 submitted=employer.post(f'/api/v1/organizations/{oid}/postings/{pid}/submit',headers={'X-CSRF-Token':csrf})
 assert submitted.status_code==200,submitted.text
 reviewer,rc,_=admin()
 reviewed=reviewer.post(f'/api/v1/admin/employer-postings/{pid}/review',
  json={'decision':'approved','reason_code':'manually_checked'},headers={'X-CSRF-Token':rc})
 assert reviewed.status_code==200,reviewed.text
 return employer,csrf,email,oid,pid

def confirmed_candidate():
 client,token,email=actor('phase5-applicant','candidate')
 profile=client.put('/api/v1/me/profile',
  json={'display_name':'测试候选人','content':{
   'headline':'渠道销售与门店运营','skills':['门店运营','销售培训'],
   'location':'山东济南','work_years':3,'private_phone':'13800138000',
   'private_email':'sensitive@example.org'}},headers={'X-CSRF-Token':token})
 assert profile.status_code==200,profile.text
 confirmed=client.post('/api/v1/me/profile/confirm',headers={'X-CSRF-Token':token})
 assert confirmed.status_code==200,confirmed.text
 return client,token,email

def test_explicit_per_vacancy_consent_and_unrelated_enterprise_search_consent():
 employer,csrf,email,oid,pid=published_job()
 candidate,token,_=confirmed_candidate()
 preview=candidate.get(f'/api/v1/me/employer-applications/preview/{pid}')
 assert preview.status_code==200,preview.text
 fields=preview.json()['shared_fields']
 assert preview.json()['eligible'] is True
 assert fields['skills'] and fields['headline'] and fields['work_years']==3
 assert 'private_phone' not in str(fields)
 assert '13800138000' not in str(fields)
 assert candidate.get('/api/v1/me/consents').json()['enterprise_search'] is False
 path=f'/api/v1/me/employer-applications/{pid}'
 assert candidate.post(path,json={'confirmed_share':True}).status_code==403
 assert candidate.post(path,json={'confirmed_share':False},headers={'X-CSRF-Token':token}).status_code==422
 assert candidate.post(path,json={'confirmed_share':True,'cover_note':'联系我13800138000'},
  headers={'X-CSRF-Token':token}).status_code==422
 created=candidate.post(path,json={'confirmed_share':True,
  'cover_note':'我有门店运营及销售培训经验，希望申请这份工作。'},
  headers={'X-CSRF-Token':token})
 assert created.status_code==201,created.text
 aid=created.json()['id']
 assert candidate.post(path,json={'confirmed_share':True},headers={'X-CSRF-Token':token}).status_code==409
 assert candidate.get('/api/v1/me/consents').json()['enterprise_search'] is False
 assert candidate.get(f'/api/v1/me/employer-applications/preview/{pid}').json()['already_applied']
 items=employer.get(f'/api/v1/organizations/{oid}/postings/{pid}/applications')
 assert items.status_code==200,items.text
 assert len(items.json()['items'])==1
 assert items.json()['items'][0]['shared_fields']['skills']
 assert 'sensitive@example.org' not in items.text
 assert '13800138000' not in items.text
 assert candidate.get('/api/v1/me/employer-applications').json()['items'][0]['status']=='submitted'
 return employer,csrf,oid,pid,candidate,token,aid

def test_employer_status_transition_and_immediate_withdrawal():
 employer,csrf,oid,pid,candidate,token,aid=test_explicit_per_vacancy_consent_and_unrelated_enterprise_search_consent()
 api=f'/api/v1/organizations/{oid}/postings/{pid}/applications/{aid}/status'
 assert employer.post(api,json={'status':'interview','expected_status':'submitted'},
  headers={'X-CSRF-Token':csrf}).status_code==409
 applied=employer.post(api,json={'status':'reviewing','expected_status':'submitted'},
  headers={'X-CSRF-Token':csrf})
 assert applied.status_code==200,applied.text
 assert employer.post(api,json={'status':'shortlisted','expected_status':'submitted'},
  headers={'X-CSRF-Token':csrf}).status_code==409
 assert candidate.get('/api/v1/me/employer-applications').json()['items'][0]['status']=='reviewing'
 withdrawn=candidate.post(f'/api/v1/me/employer-applications/{aid}/withdraw',
  headers={'X-CSRF-Token':token})
 assert withdrawn.status_code==200,withdrawn.text
 assert candidate.get('/api/v1/me/employer-applications').json()['items'][0]['status']=='withdrawn'
 assert employer.get(f'/api/v1/organizations/{oid}/postings/{pid}/applications').json()['items']==[]
 assert employer.post(api,json={'status':'shortlisted','expected_status':'reviewing'},
  headers={'X-CSRF-Token':csrf}).status_code==404
 with SessionLocal() as s:
  item=s.get(EmployerJobApplication,uuid.UUID(aid))
  assert item.snapshot_json=={} and item.cover_note==''
 assert candidate.post(f'/api/v1/me/employer-applications/{aid}/withdraw',
  headers={'X-CSRF-Token':token}).status_code==200

def test_cross_company_and_candidate_identity_cannot_read_applications():
 employer,csrf,oid,pid,candidate,token,aid=test_explicit_per_vacancy_consent_and_unrelated_enterprise_search_consent()
 outsider,oc,_=actor('outsider-recruiter')
 other_oid=organ(outsider,oc)
 assert outsider.get(f'/api/v1/organizations/{oid}/postings/{pid}/applications').status_code in (403,404)
 assert outsider.get(f'/api/v1/organizations/{other_oid}/postings/{pid}/applications').status_code in (403,404)
 assert candidate.get(f'/api/v1/organizations/{oid}/postings/{pid}/applications').status_code==403
 applicant2,t2,_=confirmed_candidate()
 assert applicant2.post(f'/api/v1/me/employer-applications/{aid}/withdraw',
  headers={'X-CSRF-Token':t2}).status_code==404

def test_revocation_and_closed_job_block_employer_access_and_new_applications():
 employer,csrf,email,oid,pid=published_job()
 candidate,token,_=confirmed_candidate()
 created=candidate.post(f'/api/v1/me/employer-applications/{pid}',
  json={'confirmed_share':True},headers={'X-CSRF-Token':token})
 assert created.status_code==201,created.text
 with SessionLocal() as s:
  user=s.query(User).filter_by(email=email).one()
  grant=s.query(RecruiterOrganizationAuthorization).filter_by(
   organization_id=uuid.UUID(oid),user_id=user.id).one()
  grant.status='revoked';grant.revoked_at=now();s.commit()
 assert employer.get(f'/api/v1/organizations/{oid}/postings/{pid}/applications').status_code==403
 assert candidate.get('/api/v1/me/employer-applications').status_code==200
 assert candidate.post(f'/api/v1/me/employer-applications/{created.json()["id"]}/withdraw',
  headers={'X-CSRF-Token':token}).status_code==200

def test_no_profile_or_external_ats_application():
 employer,csrf,email,oid,pid=published_job()
 candidate,token,_=actor('unconfirmed','candidate')
 preview=candidate.get(f'/api/v1/me/employer-applications/preview/{pid}')
 assert preview.status_code==200
 assert preview.json()['eligible'] is False
 assert candidate.post(f'/api/v1/me/employer-applications/{pid}',
  json={'confirmed_share':True},headers={'X-CSRF-Token':token}).status_code==409
 assert candidate.post('/api/v1/me/employer-applications/greenhouse-spacex-123',
  json={'confirmed_share':True},headers={'X-CSRF-Token':token}).status_code==422
