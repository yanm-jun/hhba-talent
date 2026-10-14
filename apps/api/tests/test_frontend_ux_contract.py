"""Synthetic contract checks used by the Frontend UX V1 recovery UI."""
import os
import uuid

RUN = uuid.uuid4().hex
os.environ['DATABASE_URL'] = f'sqlite:///./frontend-ux-{RUN}.sqlite3'

from fastapi.testclient import TestClient
from app.main import Base, app, engine

Base.metadata.create_all(engine)
PASSWORD = 'SyntheticOnly123!'


def account(client: TestClient, prefix: str) -> str:
    email = f'{prefix}-{RUN}@hhba-synthetic.com'
    assert client.post('/api/v1/auth/register', json={'email': email, 'password': PASSWORD, 'display_name': '模拟用户'}).status_code == 201
    session = client.post('/api/v1/auth/session', json={'email': email, 'password': PASSWORD})
    assert session.status_code == 200
    return session.json()['csrf_token']


def test_candidate_recovery_endpoints_are_private_and_default_denied():
    owner, outsider = TestClient(app), TestClient(app)
    csrf = account(owner, 'owner')
    account(outsider, 'outsider')
    assert owner.get('/api/v1/me/consents').json() == {'enterprise_search': False, 'public_share': False, 'search_engine_index': False}
    uploaded = owner.post('/api/v1/me/resumes', files={'file': ('synthetic.pdf', b'%PDF-1.4\nsynthetic only', 'application/pdf')}, headers={'X-CSRF-Token': csrf})
    assert uploaded.status_code == 201
    listed = owner.get('/api/v1/me/resumes')
    assert listed.status_code == 200
    assert listed.json()['items'][0]['resume_id'] == uploaded.json()['resume_id']
    assert outsider.get('/api/v1/me/resumes').status_code == 200
    assert outsider.get('/api/v1/me/resumes').json()['items'] == []
