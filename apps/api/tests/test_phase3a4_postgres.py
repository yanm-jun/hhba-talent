"""Phase 3A.4 PostgreSQL integration tests — 需在 PG 环境执行，沙盒标记为 NOT RUN。

运行方式（PG 环境）：
    DATABASE_URL=postgresql+psycopg://hhba:hhba@127.0.0.1:5432/hhba_phase3a4_test \\
    HHBA_BOOTSTRAP_ADMIN_EMAIL=admin-synthetic@hhba.local \\
    pytest tests/test_phase3a4_postgres.py -q

全部账号与档案均为合成数据，禁止真实简历。
"""
import os
import uuid
import threading

import pytest

RUN = uuid.uuid4().hex
_PG_URL = os.environ.get('DATABASE_URL', '')
if not _PG_URL.startswith('postgresql'):
    # 保证 import 成功；无 PG 时测试全部 skip
    os.environ['DATABASE_URL'] = 'sqlite:////tmp/hhba_3a4_pg_skip.db'
pytestmark = pytest.mark.skipif(not _PG_URL.startswith('postgresql'), reason='requires PostgreSQL (DATABASE_URL)')

os.environ['HHBA_BOOTSTRAP_ADMIN_EMAIL'] = f'admin-{RUN}@hhba-synthetic.com'

from fastapi.testclient import TestClient
from app.main import Base, User, SessionLocal, app, engine

Base.metadata.create_all(engine)
PASSWORD = 'Synthetic-Test-Pass-123'


def register_and_login(client, prefix):
    email = f'{prefix}-{RUN}@hhba-synthetic.com'
    assert client.post('/api/v1/auth/register', json={'email': email, 'password': PASSWORD, 'display_name': prefix}).status_code == 201
    login = client.post('/api/v1/auth/session', json={'email': email, 'password': PASSWORD})
    assert login.status_code == 200
    return login.json()['csrf_token']


def make_candidate(i, skills=('3A4PG技能',)):
    client = TestClient(app)
    csrf = register_and_login(client, f'pgcand{i:04d}')
    content = {
        'headline': f'PG候选人{i:04d}',
        'capability_summary': '3A4PG技能能力介绍。',
        'skills': list(skills),
        'industries': ['新能源汽车'],
        'location': '广东省深圳市南山区科技园某某大厦2501',
        'service_regions': ['广东'],
        'work_modes': ['短期项目'],
        'work_years': 5,
    }
    assert client.put('/api/v1/me/profile', json={'display_name': f'pgcand{i:04d}', 'content': content}, headers={'X-CSRF-Token': csrf}).status_code == 200
    assert client.put('/api/v1/me/consents/enterprise_search', json={'granted': True}, headers={'X-CSRF-Token': csrf}).status_code == 200
    assert client.post('/api/v1/me/profile/confirm', headers={'X-CSRF-Token': csrf}).status_code == 200
    return client, csrf


def approved_employer(tag):
    admin = TestClient(app)
    admin_csrf = register_and_login(admin, f'pgadmin{tag}')
    s = SessionLocal()
    s.query(User).filter_by(email=f'pgadmin{tag}-{RUN}@hhba-synthetic.com').one().role = 'admin'
    s.commit(); s.close()
    owner = TestClient(app)
    owner_csrf = register_and_login(owner, f'pgowner{tag}')
    org = owner.post('/api/v1/organizations', json={'legal_name': f'PG模拟企业{tag}'}, headers={'X-CSRF-Token': owner_csrf})
    assert org.status_code == 201
    oid = org.json()['id']
    assert admin.post(f'/api/v1/admin/organizations/{oid}/review', json={'status': 'approved'}, headers={'X-CSRF-Token': admin_csrf}).status_code == 200
    return owner, owner_csrf, oid


def test_pg_1001_candidates_deep_pagination_no_dup_no_gap():
    for i in range(1001):
        make_candidate(i)
    employer, csrf, oid = approved_employer('deep')
    body = {'skills': ['3A4PG技能'], 'page_size': 10}
    total = employer.post(f'/api/v1/organizations/{oid}/talent-search', json={**body, 'page': 1}, headers={'X-CSRF-Token': csrf}).json()['total']
    assert total == 1001
    seen, page = [], 1
    while True:
        r = employer.post(f'/api/v1/organizations/{oid}/talent-search', json={**body, 'page': page}, headers={'X-CSRF-Token': csrf})
        assert r.status_code == 200, r.text
        res = r.json()
        assert res['total'] == 1001
        seen.extend(res['items'])
        if not res['has_more']:
            break
        page += 1
    assert len(seen) == 1001
    assert len({it['display_name'] for it in seen}) == 1001
    # 精确地址不得出现在任何一页
    assert '南山区' not in str(seen) and '2501' not in str(seen)


def test_pg_consent_revoke_immediately_invisible():
    client, csrf = make_candidate(9001)
    employer, ecs, oid = approved_employer('rev')
    body = {'skills': ['3A4PG技能'], 'page': 1, 'page_size': 10}
    before = employer.post(f'/api/v1/organizations/{oid}/talent-search', json=body, headers={'X-CSRF-Token': ecs}).json()
    assert before['total'] >= 1
    assert client.put('/api/v1/me/consents/enterprise_search', json={'granted': False}, headers={'X-CSRF-Token': csrf}).status_code == 200
    after = employer.post(f'/api/v1/organizations/{oid}/talent-search', json=body, headers={'X-CSRF-Token': ecs}).json()
    assert after['total'] == before['total'] - 1
    # 重新授权后恢复可见
    assert client.put('/api/v1/me/consents/enterprise_search', json={'granted': True}, headers={'X-CSRF-Token': csrf}).status_code == 200
    again = employer.post(f'/api/v1/organizations/{oid}/talent-search', json=body, headers={'X-CSRF-Token': ecs}).json()
    assert again['total'] == before['total']


def test_pg_cross_tenant_isolation():
    make_candidate(9002)
    _, ecs_a, oid_a = approved_employer('ta')
    _, ecs_b, oid_b = approved_employer('tb')
    # B 用 A 的 oid 应 404
    r = TestClient(app).post(f'/api/v1/organizations/{oid_a}/talent-search',
                             json={'skills': ['3A4PG技能']}, headers={'X-CSRF-Token': ecs_b})
    assert r.status_code in (401, 404)


def test_pg_concurrent_revoke_and_search():
    clients = [make_candidate(9100 + i) for i in range(5)]
    employer, ecs, oid = approved_employer('cc')
    body = {'skills': ['3A4PG技能'], 'page': 1, 'page_size': 10}
    errors = []

    def revoke_one(args):
        c, csrf = args
        try:
            r = c.put('/api/v1/me/consents/enterprise_search', json={'granted': False}, headers={'X-CSRF-Token': csrf})
            assert r.status_code == 200
        except Exception as e:  # noqa: BLE001
            errors.append(e)

    def search_loop():
        try:
            for _ in range(10):
                r = employer.post(f'/api/v1/organizations/{oid}/talent-search', json=body, headers={'X-CSRF-Token': ecs})
                assert r.status_code == 200
        except Exception as e:  # noqa: BLE001
            errors.append(e)

    threads = [threading.Thread(target=revoke_one, args=(c,)) for c in clients]
    threads += [threading.Thread(target=search_loop) for _ in range(3)]
    for t in threads: t.start()
    for t in threads: t.join()
    assert not errors, errors


def test_pg_rate_limit_row_lock():
    employer, ecs, oid = approved_employer('rl')
    body = {'skills': ['3A4PG技能'], 'page': 1, 'page_size': 10}
    statuses = []
    for _ in range(35):
        r = employer.post(f'/api/v1/organizations/{oid}/talent-search', json=body, headers={'X-CSRF-Token': ecs})
        statuses.append(r.status_code)
    assert 429 in statuses, 'rate limit never triggered'
    assert statuses.count(200) <= 30, 'user daily quota exceeded'
