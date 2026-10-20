"""Phase 2.5: synthetic identities only; verifies organization isolation for demand drafts."""
import os
import uuid

RUN = uuid.uuid4().hex
os.environ['DATABASE_URL'] = f'sqlite:///./phase25-{RUN}.sqlite3'
from fastapi.testclient import TestClient
from app.main import Base, SessionLocal, User, app, engine

Base.metadata.create_all(engine)
PASSWORD = 'SyntheticOnly123!'


def register_and_login(client: TestClient, prefix: str):
    email = f'{prefix}-{RUN}@hhba-synthetic.com'
    assert client.post('/api/v1/auth/register', json={'email': email, 'password': PASSWORD, 'display_name': prefix}).status_code == 201
    login = client.post('/api/v1/auth/session', json={'email': email, 'password': PASSWORD})
    assert login.status_code == 200
    return email, login.json()['csrf_token']


def test_current_identity_and_requirement_drafts_are_organization_scoped():
    owner_a, owner_b = TestClient(app), TestClient(app)
    _, csrf_a = register_and_login(owner_a, 'owner-a')
    _, csrf_b = register_and_login(owner_b, 'owner-b')
    me = owner_a.get('/api/v1/auth/me')
    assert me.status_code == 200 and me.json()['email'].startswith('owner-a-')
    org_a = owner_a.post('/api/v1/organizations', json={'legal_name': '模拟企业 A'}, headers={'X-CSRF-Token': csrf_a}).json()['id']
    org_b = owner_b.post('/api/v1/organizations', json={'legal_name': '模拟企业 B'}, headers={'X-CSRF-Token': csrf_b}).json()['id']
    created = owner_a.post(f'/api/v1/organizations/{org_a}/hiring-requirements', json={'title': '培训负责人', 'description': '仅模拟的私密需求', 'status': 'draft'}, headers={'X-CSRF-Token': csrf_a})
    assert created.status_code == 201, created.text
    requirement_id = created.json()['id']
    assert owner_a.get(f'/api/v1/organizations/{org_a}/hiring-requirements').json()['items'][0]['id'] == requirement_id
    assert owner_b.get(f'/api/v1/organizations/{org_a}/hiring-requirements').status_code == 404
    assert owner_b.get(f'/api/v1/organizations/{org_b}/hiring-requirements/{requirement_id}').status_code == 404
    assert owner_b.patch(f'/api/v1/organizations/{org_a}/hiring-requirements/{requirement_id}', json={'status': 'archived'}, headers={'X-CSRF-Token': csrf_b}).status_code == 404
    assert owner_a.post(f'/api/v1/organizations/{org_a}/hiring-requirements', json={'title': 'x', 'description': 'without csrf'},).status_code == 403


def test_removed_member_loses_requirement_access():
    owner, member = TestClient(app), TestClient(app)
    owner_email, csrf_owner = register_and_login(owner, 'requirement-owner')
    member_email, csrf_member = register_and_login(member, 'requirement-member')
    session = SessionLocal(); member_id = session.query(User).filter_by(email=member_email).one().id; session.close()
    org = owner.post('/api/v1/organizations', json={'legal_name': '模拟企业成员隔离'}, headers={'X-CSRF-Token': csrf_owner}).json()['id']
    assert owner.post(f'/api/v1/organizations/{org}/members', json={'user_id': str(member_id), 'role': 'member'}, headers={'X-CSRF-Token': csrf_owner}).status_code == 201
    assert member.post(f'/api/v1/organizations/{org}/hiring-requirements', json={'title': '模拟需求', 'description': '仅测试', 'status': 'draft'}, headers={'X-CSRF-Token': csrf_member}).status_code == 201
    assert owner.delete(f'/api/v1/organizations/{org}/members/{member_id}', headers={'X-CSRF-Token': csrf_owner}).status_code == 200
    assert member.get(f'/api/v1/organizations/{org}/hiring-requirements').status_code == 404
