"""Phase 3A.2 security regression tests; only synthetic identities/files."""
import os
import uuid

RUN=uuid.uuid4().hex
os.environ['DATABASE_URL']=f'sqlite:///./phase3a2-{RUN}.sqlite3'
os.environ['HHBA_VERIFICATION_ROOT']=f'./phase3a2-private-{RUN}'

from fastapi.testclient import TestClient
from app.main import Base, Organization, SessionLocal, User, VerificationEvidenceSnapshot, app, engine

PASSWORD='SyntheticOnly123!'


def account(client,label,account_type):
    email=f'{label}-{RUN}@hhba-synthetic.example.com'
    response=client.post('/api/v1/auth/register',json={'email':email,'password':PASSWORD,'display_name':label,'account_type':account_type})
    assert response.status_code==201,response.text
    login=client.post('/api/v1/auth/session',json={'email':email,'password':PASSWORD})
    assert login.status_code==200
    return email,login.json()['csrf_token']


def make_admin(email):
    session=SessionLocal();session.query(User).filter_by(email=email).one().role='admin';session.commit();session.close()


def create_recruiter_org(client,csrf):
    response=client.post('/api/v1/organizations',json={'legal_name':f'合成认证企业{RUN}'},headers={'X-CSRF-Token':csrf})
    assert response.status_code==201,response.text
    return response.json()['id']


Base.metadata.create_all(engine)


def test_candidate_cannot_create_organization_and_registration_never_bootstraps_admin():
    candidate=TestClient(app);email,csrf=account(candidate,'candidate','candidate')
    assert candidate.post('/api/v1/organizations',json={'legal_name':'不能创建'},headers={'X-CSRF-Token':csrf}).status_code==403
    assert candidate.get('/api/v1/auth/me').json()['role']=='user'
    assert candidate.get('/api/v1/auth/me').json()['account_types']==['candidate']
    wrong_entry=TestClient(app)
    denied=wrong_entry.post('/api/v1/auth/session',json={'email':email,'password':PASSWORD,'account_type':'recruiter'})
    assert denied.status_code==403
    assert wrong_entry.get('/api/v1/auth/me').status_code==401


def test_recruiter_verification_then_platform_gate_controls_search_access():
    recruiter=TestClient(app);recruiter_email,csrf=account(recruiter,'recruiter','recruiter');oid=create_recruiter_org(recruiter,csrf)
    payload={'legal_name':f'合成认证企业{RUN}','credit_code':'91370000TEST123456','registered_location':'山东省青岛市','recruitment_subject_type':'employer','real_name':'合成经办人','job_title':'招聘负责人'}
    assert recruiter.put(f'/api/v1/recruiter/organizations/{oid}/verification',json=payload,headers={'X-CSRF-Token':csrf}).status_code==200
    files={'file':('license.pdf',b'%PDF-1.4\nsynthetic license','application/pdf')}
    assert recruiter.post(f'/api/v1/recruiter/organizations/{oid}/verification/documents?document_type=business_license',files=files,headers={'X-CSRF-Token':csrf}).status_code==201
    files={'file':('authorization.pdf',b'%PDF-1.4\nsynthetic authorization','application/pdf')}
    assert recruiter.post(f'/api/v1/recruiter/organizations/{oid}/verification/documents?document_type=authorization_letter',files=files,headers={'X-CSRF-Token':csrf}).status_code==201
    assert recruiter.post(f'/api/v1/recruiter/organizations/{oid}/verification/submit',headers={'X-CSRF-Token':csrf}).status_code==200
    assert recruiter.get(f'/api/v1/organizations/{oid}/restricted-access').status_code==403
    admin=TestClient(app);admin_email,admin_csrf=account(admin,'reviewer','candidate');make_admin(admin_email)
    session=SessionLocal();snapshot=session.query(VerificationEvidenceSnapshot).filter_by(organization_id=uuid.UUID(oid)).one();snapshot_id=str(snapshot.id);session.close()
    review=admin.post(f'/api/v1/admin/verification/organizations/{oid}/review',json={'status':'approved','reason_code':'synthetic_approved','valid_days':30,'expected_revision':1,'evidence_snapshot_id':snapshot_id},headers={'X-CSRF-Token':admin_csrf})
    assert review.status_code==422 and 'clean files' in review.text
    # A platform gate cannot compensate for absent file-security and legal
    # verification conclusions.
    gate=admin.put('/api/v1/admin/platform-service-gates/network-recruitment',json={'enabled':True,'reason_code':'synthetic_test'},headers={'X-CSRF-Token':admin_csrf})
    assert gate.status_code==200
    assert recruiter.get(f'/api/v1/organizations/{oid}/restricted-access').status_code==403


def test_reviewer_cannot_approve_own_application_and_candidate_cannot_read_documents():
    recruiter=TestClient(app);recruiter_email,csrf=account(recruiter,'self-review','recruiter');oid=create_recruiter_org(recruiter,csrf)
    session=SessionLocal();session.query(User).filter_by(email=recruiter_email).one().role='admin';session.commit();session.close()
    response=recruiter.post(f'/api/v1/admin/verification/organizations/{oid}/review',json={'status':'approved','reason_code':'must_fail','expected_revision':1,'evidence_snapshot_id':str(uuid.uuid4())})
    assert response.status_code==403
    candidate=TestClient(app);_,candidate_csrf=account(candidate,'outsider','candidate')
    assert candidate.get(f'/api/v1/recruiter/organizations/{oid}/verification').status_code==404
    assert candidate.post(f'/api/v1/organizations/{oid}/hiring-requirements',json={'title':'越权','description':'synthetic'},headers={'X-CSRF-Token':candidate_csrf}).status_code==404


def test_submitted_evidence_is_locked_and_approval_requires_snapshot():
    recruiter=TestClient(app);_,csrf=account(recruiter,'locked-evidence','recruiter');oid=create_recruiter_org(recruiter,csrf)
    payload={'legal_name':f'合成锁定企业{RUN}','credit_code':'91370000LOCK123456','registered_location':'山东省青岛市','recruitment_subject_type':'employer','real_name':'合成经办人','job_title':'招聘负责人'}
    assert recruiter.put(f'/api/v1/recruiter/organizations/{oid}/verification',json=payload,headers={'X-CSRF-Token':csrf}).status_code==200
    for kind in ('business_license','authorization_letter'):
        result=recruiter.post(f'/api/v1/recruiter/organizations/{oid}/verification/documents?document_type={kind}',files={'file':(f'{kind}.pdf',b'%PDF-1.4\nsynthetic','application/pdf')},headers={'X-CSRF-Token':csrf})
        assert result.status_code==201
    assert recruiter.post(f'/api/v1/recruiter/organizations/{oid}/verification/submit',headers={'X-CSRF-Token':csrf}).status_code==200
    # The same frozen evidence version cannot receive a second snapshot.
    assert recruiter.post(f'/api/v1/recruiter/organizations/{oid}/verification/submit',headers={'X-CSRF-Token':csrf}).status_code==409
    locked=recruiter.post(f'/api/v1/recruiter/organizations/{oid}/verification/documents?document_type=business_license',files={'file':('changed.pdf',b'%PDF-1.4\nchanged','application/pdf')},headers={'X-CSRF-Token':csrf})
    assert locked.status_code==409


def test_staged_onboarding_persists_only_for_recruiter_owner():
    recruiter=TestClient(app);_,csrf=account(recruiter,'staged-owner','recruiter');oid=create_recruiter_org(recruiter,csrf)
    company=recruiter.put(f'/api/v1/recruiter/organizations/{oid}/verification/company',json={'legal_name':f'合成分步企业{RUN}','credit_code':'91370000STEP123456','registered_location':'山东省青岛市','recruitment_subject_type':'employer'},headers={'X-CSRF-Token':csrf})
    assert company.status_code==200,company.text
    representative=recruiter.put(f'/api/v1/recruiter/organizations/{oid}/verification/representative',json={'real_name':'合成招聘人','job_title':'招聘负责人','relationship_type':'hr_lead'},headers={'X-CSRF-Token':csrf})
    assert representative.status_code==200,representative.text
    current=recruiter.get(f'/api/v1/recruiter/organizations/{oid}/verification')
    assert current.status_code==200
    assert current.json()['representative']=={'real_name':'合成招聘人','job_title':'招聘负责人','relationship_type':'hr_lead'}
    assert any(item['organization_id']==oid for item in recruiter.get('/api/v1/recruiter/onboarding').json()['applications'])
    candidate=TestClient(app);_,candidate_csrf=account(candidate,'staged-outsider','candidate')
    denied=candidate.put(f'/api/v1/recruiter/organizations/{oid}/verification/company',json={'legal_name':'越权','credit_code':'91370000DENY123456','registered_location':'山东','recruitment_subject_type':'employer'},headers={'X-CSRF-Token':candidate_csrf})
    assert denied.status_code==404
