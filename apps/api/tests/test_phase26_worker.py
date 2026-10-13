"""Worker queue invariants with synthetic data only."""
import os
import subprocess
import sys
import time
import uuid

RUN = uuid.uuid4().hex
os.environ['DATABASE_URL'] = f'sqlite:///./phase26-{RUN}.sqlite3'
from app.main import Base, ParseJob, Resume, SessionLocal, User, engine
from app import docling_worker

Base.metadata.create_all(engine)


def make_job(session, suffix):
    user = User(email=f'{suffix}-{RUN}@synthetic.invalid', name='模拟', password_hash='x')
    session.add(user); session.flush()
    resume = Resume(owner_user_id=user.id, storage_key=f'{suffix}.pdf', original_filename='synthetic.pdf', mime_type='application/pdf', size_bytes=12, sha256='0'*64, status='queued')
    session.add(resume); session.flush()
    job = ParseJob(resume_id=resume.id, state='queued')
    session.add(job); session.commit(); return job.id


def test_claim_is_single_consumer_and_leases_jobs():
    session = SessionLocal(); first = make_job(session, 'first'); second = make_job(session, 'second'); session.close()
    a = docling_worker.claim_one(); b = docling_worker.claim_one()
    assert a and b and a[0] != b[0]
    session = SessionLocal(); rows = [session.get(ParseJob, first), session.get(ParseJob, second)]; session.close()
    assert all(row.state == 'processing' and row.worker_id and row.lease_expires_at for row in rows)


def test_process_tree_termination_stops_a_real_child():
    child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(30)'], start_new_session=(os.name == 'posix'))
    docling_worker.kill_process_tree(child)
    child.wait(timeout=10)
    assert child.returncode is not None


def test_session_recovery_returns_the_csrf_token_needed_for_future_writes():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app); email = f'csrf-{RUN}@synthetic.example.com'; password = 'SyntheticOnly123!'
    assert client.post('/api/v1/auth/register', json={'email': email, 'password': password, 'display_name': '模拟'}).status_code == 201
    assert client.post('/api/v1/auth/session', json={'email': email, 'password': password}).status_code == 200
    restored = client.get('/api/v1/auth/me')
    assert restored.status_code == 200 and restored.json()['csrf_token']
    assert client.put('/api/v1/me/consents/public_share', json={'granted': False}, headers={'X-CSRF-Token': restored.json()['csrf_token']}).status_code == 200
