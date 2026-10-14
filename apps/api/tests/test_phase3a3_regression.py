"""Phase 3A.3 regression tests: pagination correctness + location privacy.
All accounts and profiles are synthetic. SQLite only (PG variants run in PG env)."""
import os
import uuid

RUN = uuid.uuid4().hex
os.environ['DATABASE_URL'] = f'sqlite:////tmp/hhba_3a3_{RUN}.db'
os.environ['HHBA_BOOTSTRAP_ADMIN_EMAIL'] = f'admin-{RUN}@hhba-synthetic.com'

from fastapi.testclient import TestClient
from app.main import (Base, User, SessionLocal, app, engine, city_level_location)

Base.metadata.create_all(engine)
PASSWORD = 'Synthetic-Test-Pass-123'


def register_and_login(client, prefix):
    email = f'{prefix}-{RUN}@hhba-synthetic.com'
    assert client.post('/api/v1/auth/register', json={'email': email, 'password': PASSWORD, 'display_name': prefix}).status_code == 201
    login = client.post('/api/v1/auth/session', json={'email': email, 'password': PASSWORD})
    assert login.status_code == 200
    return login.json()['csrf_token']


def make_candidate(i, skills=None):
    client = TestClient(app)
    csrf = register_and_login(client, f'cand{i:03d}')
    skills = skills or ['3A3回归技能']
    content = {
        'headline': f'候选人{i:03d} 销售培训',
        'capability_summary': '销售培训能力介绍。',
        'skills': skills,
        'industries': ['新能源汽车'],
        'location': '山东省临沂市兰山区某某小区3号楼501',
        'service_regions': ['山东'],
        'work_modes': ['短期项目'],
        'work_years': 5,
    }
    assert client.put('/api/v1/me/profile', json={'display_name': f'cand{i:03d}', 'content': content}, headers={'X-CSRF-Token': csrf}).status_code == 200
    assert client.put('/api/v1/me/consents/enterprise_search', json={'granted': True}, headers={'X-CSRF-Token': csrf}).status_code == 200
    assert client.post('/api/v1/me/profile/confirm', headers={'X-CSRF-Token': csrf}).status_code == 200


def approved_employer(tag):
    admin = TestClient(app)
    admin_csrf = register_and_login(admin, f'admin3a3{tag}')
    s = SessionLocal(); s.query(User).filter_by(email=f'admin3a3{tag}-{RUN}@hhba-synthetic.com').one().role = 'admin'; s.commit(); s.close()
    owner = TestClient(app)
    owner_csrf = register_and_login(owner, f'owner3a3{tag}')
    org = owner.post('/api/v1/organizations', json={'legal_name': f'3A3 模拟企业{tag}'}, headers={'X-CSRF-Token': owner_csrf})
    assert org.status_code == 201
    oid = org.json()['id']
    assert admin.post(f'/api/v1/admin/organizations/{oid}/review', json={'status': 'approved'}, headers={'X-CSRF-Token': admin_csrf}).status_code == 200
    return owner, owner_csrf, oid


def search(client, csrf, oid, body):
    r = client.post(f'/api/v1/organizations/{oid}/talent-search', json=body, headers={'X-CSRF-Token': csrf})
    assert r.status_code == 200, r.text
    return r.json()


def test_city_level_location():
    assert city_level_location('山东省临沂市兰山区某某小区3号楼501') == '临沂市'
    # Phase 3A.4：去掉省份回退
    assert city_level_location('山东省济南市历下区') == '济南市'  # 不得识别为山东省
    assert city_level_location('山东省莱芜市') is None  # 不在白名单的城市不得标记为省级
    assert city_level_location('山东省') is None
    assert city_level_location('山东') is None
    assert city_level_location('上海市浦东新区某某路123号') == '上海市'
    assert city_level_location('北京') == '北京市'
    # Phase 3A.5-B：禁止子串误识别
    assert city_level_location('我不在北京市') is None
    assert city_level_location('曾经在上海市工作') is None
    assert city_level_location('吉林省长春市') == '长春市'  # 不得误判为吉林市
    assert city_level_location('临沂') is None  # 短名无明确别名则不识别
    assert city_level_location('火星奥林帕斯山') is None
    assert city_level_location('') is None
    assert city_level_location(None) is None


def test_pagination_reaches_beyond_101_and_total_consistent():
    N = 150
    for i in range(N):
        make_candidate(i)
    employer, csrf, oid = approved_employer('pg')
    body = {'skills': ['3A3回归技能'], 'page': 1, 'page_size': 10}

    # collect all pages
    seen = []
    page = 1
    while True:
        res = search(employer, csrf, oid, {**body, 'page': page})
        if page == 1:
            assert res['total'] == N, f"total={res['total']} expected {N}"
        seen.extend(res['items'])
        if not res['has_more']:
            break
        page += 1
        assert page <= 20, 'too many pages'

    # all 150 reachable (old code capped at 101)
    assert len(seen) == N, f'got {len(seen)} expected {N}'
    # no duplicates
    names = [it['display_name'] for it in seen]
    assert len(set(names)) == N, 'duplicate candidates across pages'
    # page 10 specifically (items 91-100) non-empty
    p10 = search(employer, csrf, oid, {**body, 'page': 10})
    assert len(p10['items']) == 10
    assert p10['has_more'] is True
    p15 = search(employer, csrf, oid, {**body, 'page': 10, 'page_size': 10})
    assert p15['total'] == N


def test_location_privacy_in_search_results():
    make_candidate(900)
    employer, csrf, oid = approved_employer('lc')
    res = search(employer, csrf, oid, {'skills': ['3A3回归技能'], 'page': 1, 'page_size': 10})
    assert res['total'] >= 1
    for item in res['items']:
        loc = item.get('location')
        # raw address must never appear
        assert '兰山区' not in str(loc), f'raw address leaked: {loc}'
        assert '某某小区' not in str(loc), f'raw address leaked: {loc}'
        assert '501' not in str(loc), f'house number leaked: {loc}'
        # city-level or None only
        assert loc is None or loc in ('临沂市',), f'unexpected location: {loc}'


def test_work_years_only_search_returns_empty_explicitly():
    make_candidate(901)
    employer, csrf, oid = approved_employer('wy')
    res = search(employer, csrf, oid, {'work_years_min': 1, 'work_years_max': 10, 'page': 1, 'page_size': 10})
    assert res['items'] == []
    assert res['total'] == 0
    assert res['has_more'] is False


def test_reasons_safety_net_never_diverges_from_total():
    """Phase 3A.4：验证 Python 层 if reasons 安全网永不触发（total == 各页 items 之和）。
    SQL 用 AND 语义执行全部过滤维度，每行必然具备匹配理由；此测试用多维度组合确认。
    用独立技能隔离其他测试的候选人数据。"""
    for i in range(300, 320):
        make_candidate(i, skills=['3A4验证技能'])
    employer, csrf, oid = approved_employer('rs')
    combos = [
        {'skills': ['3A4验证技能']},
        {'skills': ['3A4验证技能'], 'region': '山东'},
        {'skills': ['3A4验证技能'], 'region': '山东', 'industry': '新能源汽车'},
        {'skills': ['3A4验证技能'], 'region': '山东', 'industry': '新能源汽车',
         'work_mode': '短期项目', 'keywords': '销售'},
    ]
    for body in combos:
        total = search(employer, csrf, oid, {**body, 'page': 1, 'page_size': 10})['total']
        seen = []
        page = 1
        while True:
            res = search(employer, csrf, oid, {**body, 'page': page, 'page_size': 10})
            assert res['total'] == total, f'filters={body} total changed across pages'
            seen.extend(res['items'])
            # 关键不变量：安全网未丢弃任何行，每页（除末页）都是满的
            if not res['has_more']:
                break
            assert len(res['items']) == 10, f'filters={body} page={page} short page => safety net dropped rows'
            page += 1
        assert len(seen) == total, f'filters={body} items sum != total'
