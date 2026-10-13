"""Phase 1 only: synthetic identities, isolated database, no external services."""
import os, uuid
RUN_ID=uuid.uuid4().hex
os.environ['DATABASE_URL']=f'sqlite:///./phase12-p0-{RUN_ID}.sqlite3'
os.environ['HHBA_BOOTSTRAP_ADMIN_EMAIL']=f'admin-{RUN_ID}@hhba-synthetic.com'
from fastapi.testclient import TestClient
from app.main import app, Base, engine, User, SessionLocal
Base.metadata.create_all(engine)

def test_phase1_identity_organization_and_session():
 c=TestClient(app); suffix=RUN_ID; admin=f'admin-{suffix}@hhba-synthetic.com'; member=f'member-{suffix}@hhba-synthetic.com'
 for email,name in [(admin,'模拟管理员'),(member,'模拟成员')]:
  r=c.post('/api/v1/auth/register',json={'email':email,'password':'SyntheticOnly123!','display_name':name}); assert r.status_code==201, r.text
 s=SessionLocal(); s.query(User).filter_by(email=admin).one().role='admin'; s.commit(); s.close()
 assert c.post('/api/v1/auth/register',json={'email':admin,'password':'SyntheticOnly123!','display_name':'重复'}).status_code==409
 assert c.post('/api/v1/auth/session',json={'email':admin,'password':'bad'}).status_code==401
 r=c.post('/api/v1/auth/session',json={'email':admin,'password':'SyntheticOnly123!'}); assert r.status_code==200; csrf=r.json()['csrf_token']; assert 'httponly' in r.headers['set-cookie'].lower()
 o=c.post('/api/v1/organizations',json={'legal_name':'模拟企业'},headers={'X-CSRF-Token':csrf}); assert o.status_code==201; oid=o.json()['id']
 assert c.get(f'/api/v1/organizations/{oid}/restricted-access').status_code==403
 assert c.post(f'/api/v1/admin/organizations/{oid}/review',json={'status':'approved'},headers={'X-CSRF-Token':csrf}).status_code==200
 assert c.get(f'/api/v1/organizations/{oid}/restricted-access').status_code==200
 s=SessionLocal(); u=s.query(User).filter_by(email=member).one(); s.close()
 assert c.post(f'/api/v1/organizations/{oid}/members',json={'user_id':str(u.id),'role':'member'},headers={'X-CSRF-Token':csrf}).status_code==201
 member_client=TestClient(app)
 member_login=member_client.post('/api/v1/auth/session',json={'email':member,'password':'SyntheticOnly123!'}); assert member_login.status_code==200
 member_csrf=member_login.json()['csrf_token']
 assert member_client.post(f'/api/v1/admin/organizations/{oid}/review',json={'status':'suspended'},headers={'X-CSRF-Token':member_csrf}).status_code==403
 assert member_client.get(f'/api/v1/organizations/{oid}/restricted-access').status_code==200
 assert c.delete(f'/api/v1/organizations/{oid}/members/{u.id}',headers={'X-CSRF-Token':csrf}).status_code==200
 assert member_client.get(f'/api/v1/organizations/{oid}/restricted-access').status_code==403
 assert c.post(f'/api/v1/admin/organizations/{oid}/review',json={'status':'suspended'},headers={'X-CSRF-Token':csrf}).status_code==200
 assert c.get(f'/api/v1/organizations/{oid}/restricted-access').status_code==403
 assert c.put('/api/v1/me/consents/search_engine_index',json={'granted':True}).status_code==403
 assert c.put('/api/v1/me/consents/enterprise_search',json={'granted':True},headers={'X-CSRF-Token':csrf}).status_code==200
 assert c.put('/api/v1/me/consents/public_share',json={'granted':False},headers={'X-CSRF-Token':csrf}).json()['granted'] is False
 # A user outside the organization cannot enumerate its members by changing the path id.
 outsider_client=TestClient(app); outsider=f'outsider-{suffix}@hhba-synthetic.com'
 assert outsider_client.post('/api/v1/auth/register',json={'email':outsider,'password':'SyntheticOnly123!','display_name':'模拟外部用户'}).status_code==201
 assert outsider_client.post('/api/v1/auth/session',json={'email':outsider,'password':'SyntheticOnly123!'}).status_code==200
 assert outsider_client.get(f'/api/v1/organizations/{oid}/members').status_code==404
 # Audit payloads contain action metadata only, never plaintext passwords or session cookies.
 s=SessionLocal(); serialized=' '.join(str(x.metadata_redacted) for x in s.query(__import__('app.main',fromlist=['Audit']).Audit).all()); s.close()
 assert 'SyntheticOnly123!' not in serialized and 'hhba_session' not in serialized
 assert c.delete('/api/v1/auth/session',headers={'X-CSRF-Token':csrf}).status_code==200
 assert c.get(f'/api/v1/organizations/{oid}/restricted-access').status_code==401
