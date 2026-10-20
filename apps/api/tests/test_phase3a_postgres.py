"""PostgreSQL-only Phase 3A acceptance; requires a deliberately named test DB."""
import os
import time
import uuid

try:
    import pytest
except ImportError:  # The hardened worker image intentionally has no test runner.
    pytest = None

if 'phase3a_test' not in os.getenv('DATABASE_URL', ''):
    if pytest:
        pytest.skip('requires dedicated phase3a_test PostgreSQL database', allow_module_level=True)
    raise RuntimeError('requires dedicated phase3a_test PostgreSQL database')

from fastapi.testclient import TestClient
from app.main import (CandidateSearchProjection, Consent, Organization, Profile,
                      SessionLocal, User, OrganizationVerification, RecruiterVerification,
                      RecruiterOrganizationAuthorization, PlatformServiceGate, app)

RUN = uuid.uuid4().hex
PASSWORD = 'SyntheticOnly123!'


def register_login(client, prefix, account_type='candidate'):
    email = f'{prefix}-{RUN}@hhba-synthetic.com'
    created = client.post('/api/v1/auth/register', json={'email': email, 'password': PASSWORD, 'display_name': prefix, 'account_type': account_type})
    assert created.status_code == 201, created.text
    response = client.post('/api/v1/auth/session', json={'email': email, 'password': PASSWORD, 'account_type': account_type})
    assert response.status_code == 200
    return email, response.json()['csrf_token']


def approve_synthetic_recruiter(oid, email):
    # Set approvals in an isolated synthetic DB only. Do not weaken public
    # registration, identity separation or verification production gates.
    with SessionLocal() as s:
        owner=s.query(User).filter_by(email=email).one()
        s.get(Organization,uuid.UUID(oid)).status='approved'
        s.query(OrganizationVerification).filter_by(organization_id=uuid.UUID(oid)).one().status='approved'
        s.query(RecruiterVerification).filter_by(user_id=owner.id).one().status='approved'
        s.query(RecruiterOrganizationAuthorization).filter_by(organization_id=uuid.UUID(oid),user_id=owner.id).one().status='active'
        gate=s.get(PlatformServiceGate,'network_recruitment')
        if gate: gate.enabled=True
        else: s.add(PlatformServiceGate(gate_key='network_recruitment',enabled=True))
        s.commit()


def test_postgres_search_policy_and_bounded_1000_synthetic_candidates():
    candidate = TestClient(app); candidate_email, candidate_csrf = register_login(candidate, 'pg-candidate')
    unique_marker = f'phase3a-{RUN}'
    content = {'headline': '新能源汽车销售培训', 'capability_summary': f'{unique_marker} 确认的经销商运营和销售培训能力', 'skills': ['销售培训', '经销商运营'], 'industries': ['新能源汽车'], 'location': '山东', 'work_modes': ['短期项目'], 'work_years': 5, 'phone': '13800000000'}
    assert candidate.put('/api/v1/me/profile', json={'display_name': 'PG 合成候选人', 'content': content}, headers={'X-CSRF-Token': candidate_csrf}).status_code == 200
    assert candidate.put('/api/v1/me/consents/enterprise_search', json={'granted': True}, headers={'X-CSRF-Token': candidate_csrf}).status_code == 200
    assert candidate.post('/api/v1/me/profile/confirm', headers={'X-CSRF-Token': candidate_csrf}).status_code == 200
    employer = TestClient(app); employer_email, employer_csrf = register_login(employer, 'pg-employer', 'recruiter')
    org = employer.post('/api/v1/organizations', json={'legal_name': 'PG 合成验收企业'}, headers={'X-CSRF-Token': employer_csrf}); assert org.status_code == 201
    oid = org.json()['id']
    approve_synthetic_recruiter(oid,employer_email)
    query = {'keywords': unique_marker, 'skills': ['销售人员培训'], 'region': '山东', 'industry': '新能源汽车', 'work_mode': '短期项目', 'page_size': 10}
    found = employer.post(f'/api/v1/organizations/{oid}/talent-search', json=query, headers={'X-CSRF-Token': employer_csrf})
    assert found.status_code == 200 and [x['display_name'] for x in found.json()['items']] == ['PG 合成候选人'], found.text
    assert '13800000000' not in str(found.json())
    # This creates only synthetic rows in the verified dedicated test database.
    page_marker = f'phase3a-page-{RUN}'
    session = SessionLocal()
    for i in range(1000):
        user = User(email=f'pg-perf-{i}-{RUN}@hhba-synthetic.com', name='合成', password_hash='x'); session.add(user); session.flush()
        profile = Profile(owner_user_id=user.id, status='confirmed', display_name=f'性能{i}', content_json={}); session.add(profile); session.flush()
        session.add(Consent(user_id=user.id, consent_type='enterprise_search', granted=True))
        session.add(CandidateSearchProjection(profile_id=profile.id, owner_user_id=user.id, display_name=f'性能{i}', headline='新能源汽车销售培训', capability_summary='合成性能数据', skills=['销售培训'], industries=['新能源汽车'], location='山东', service_regions=['山东'], work_modes=['短期项目'], work_years=5, project_summaries=[], skills_text='|销售培训|', industries_text='|新能源汽车|', regions_text='|山东|', work_modes_text='|短期项目|', search_text=f'{page_marker} 新能源汽车销售培训 合成性能数据', profile_version=1))
    session.commit(); session.close()
    started = time.perf_counter(); bounded = employer.post(f'/api/v1/organizations/{oid}/talent-search', json={'keywords': '新能源汽车销售培训'}, headers={'X-CSRF-Token': employer_csrf}); elapsed = time.perf_counter() - started
    assert bounded.status_code == 200 and len(bounded.json()['items']) == 10 and bounded.json()['has_more'] is True
    print(f'phase3a postgres synthetic_candidates=1001 bounded_search_seconds={elapsed:.4f}')
    # Traverse every page of this run's 1,000-row synthetic corpus.  The marker
    # prevents historical test rows in the reusable dedicated database from
    # influencing count, ordering, or revocation assertions.
    # The product intentionally caps an individual member at 30 searches/day.
    # Four independently approved synthetic organizations let this test traverse
    # all 100 pages without weakening that anti-enumeration control.
    page_oids = []
    for chunk in range(4):
        page_org = employer.post('/api/v1/organizations', json={'legal_name': f'PG 分页验收企业 {RUN}-{chunk}'}, headers={'X-CSRF-Token': employer_csrf})
        assert page_org.status_code == 201, page_org.text
        page_oid = page_org.json()['id']
        approve_synthetic_recruiter(page_oid,employer_email)
        page_oids.append(page_oid)
    pages = []
    for page in range(1, 101):
        page_oid = page_oids[(page - 1) // 25]
        response = employer.post(f'/api/v1/organizations/{page_oid}/talent-search', json={'keywords': page_marker, 'page': page, 'page_size': 10}, headers={'X-CSRF-Token': employer_csrf})
        assert response.status_code == 200, response.text
        payload = response.json()
        assert len(payload['items']) == 10
        assert payload['has_more'] is (page < 100)
        pages.extend(item['candidate_ref'] for item in payload['items'])
    assert len(pages) == 1000 and len(set(pages)) == 1000
    repeat = employer.post(f'/api/v1/organizations/{page_oids[0]}/talent-search', json={'keywords': page_marker, 'page': 1, 'page_size': 10}, headers={'X-CSRF-Token': employer_csrf})
    assert [item['candidate_ref'] for item in repeat.json()['items']] == pages[:10]
    # Direct consent revocation leaves a stale projection on purpose; policy join must hide it.
    session = SessionLocal(); owner = session.query(User).filter_by(email=candidate_email).one(); session.query(Consent).filter_by(user_id=owner.id, consent_type='enterprise_search').one().granted = False; session.commit(); session.close()
    withdrawn = employer.post(f'/api/v1/organizations/{oid}/talent-search', json={'keywords': unique_marker, 'skills': ['销售人员培训'], 'page_size': 10}, headers={'X-CSRF-Token': employer_csrf})
    assert withdrawn.status_code == 200 and not withdrawn.json()['items'], withdrawn.text


if __name__ == '__main__':
    test_postgres_search_policy_and_bounded_1000_synthetic_candidates()
    print('phase3a PostgreSQL acceptance passed')
