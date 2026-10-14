"""Phase 3A.2 security regression tests; only synthetic identities/files."""
import os
import uuid

RUN=uuid.uuid4().hex
os.environ['DATABASE_URL']=f'sqlite:///./phase3a2-{RUN}.sqlite3'
os.environ['HHBA_VERIFICATION_ROOT']=f'./phase3a2-private-{RUN}'

from fastapi.testclient import TestClient
from app.main import Base, Organization, SessionLocal, User, app, engine

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
    review=admin.post(f'/api/v1/admin/verification/organizations/{oid}/review',json={'status':'approved','reason_code':'synthetic_approved','valid_days':30},headers={'X-CSRF-Token':admin_csrf})
    assert review.status_code==200,review.text
    assert recruiter.get(f'/api/v1/organizations/{oid}/restricted-access').status_code==403
    gate=admin.put('/api/v1/admin/platform-service-gates/network-recruitment',json={'enabled':True,'reason_code':'synthetic_test'},headers={'X-CSRF-Token':admin_csrf})
    assert gate.status_code==200
    assert recruiter.get(f'/api/v1/organizations/{oid}/restricted-access').status_code==200


def test_reviewer_cannot_approve_own_application_and_candidate_cannot_read_documents():
    recruiter=TestClient(app);recruiter_email,csrf=account(recruiter,'self-review','recruiter');oid=create_recruiter_org(recruiter,csrf)
    session=SessionLocal();session.query(User).filter_by(email=recruiter_email).one().role='admin';session.commit();session.close()
    response=recruiter.post(f'/api/v1/admin/verification/organizations/{oid}/review',json={'status':'approved','reason_code':'must_fail'})
    assert response.status_code==403
    candidate=TestClient(app);_,candidate_csrf=account(candidate,'outsider','candidate')
    assert candidate.get(f'/api/v1/recruiter/organizations/{oid}/verification').status_code==404
    assert candidate.post(f'/api/v1/organizations/{oid}/hiring-requirements',json={'title':'越权','description':'synthetic'},headers={'X-CSRF-Token':candidate_csrf}).status_code==404
