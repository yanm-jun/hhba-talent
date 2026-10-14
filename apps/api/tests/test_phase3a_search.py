"""Phase 3A P0 search policy tests. All accounts and profiles are synthetic."""
import os
import time
import uuid

RUN = uuid.uuid4().hex
os.environ['DATABASE_URL'] = f'sqlite:///./phase3a-{RUN}.sqlite3'
os.environ['HHBA_BOOTSTRAP_ADMIN_EMAIL'] = f'admin-{RUN}@hhba-synthetic.com'

from fastapi.testclient import TestClient
from app.main import (Base, CandidateSearchProjection, Consent, Organization, Profile, SessionLocal,
                      TalentSearchUsage, User, app, engine, now)

Base.metadata.create_all(engine)
PASSWORD = 'SyntheticOnly123!'


def register_and_login(client, prefix):
    email = f'{prefix}-{RUN}@hhba-synthetic.com'
    assert client.post('/api/v1/auth/register', json={'email': email, 'password': PASSWORD, 'display_name': prefix}).status_code == 201
    login = client.post('/api/v1/auth/session', json={'email': email, 'password': PASSWORD})
    assert login.status_code == 200
    return email, login.json()['csrf_token']


def make_candidate(prefix, *, enterprise=True, public=False, confirmed=True):
    client = TestClient(app)
    _, csrf = register_and_login(client, prefix)
    content = {
        'headline': '新能源汽车销售培训负责人',
        'capability_summary': '已确认的新能源汽车销售培训和经销商运营能力介绍。',
        'skills': ['销售培训', '经销商运营'],
        'industries': ['新能源汽车'],
        'location': '山东',
        'service_regions': ['山东'],
        'work_modes': ['短期项目'],
        'work_years': 6,
        # This must never be projected or returned.
        'source_evidence': '私人原始履历证据',
        'phone': '13800000000',
    }
    assert client.put('/api/v1/me/profile', json={'display_name': prefix, 'content': content}, headers={'X-CSRF-Token': csrf}).status_code == 200
    if enterprise:
        assert client.put('/api/v1/me/consents/enterprise_search', json={'granted': True}, headers={'X-CSRF-Token': csrf}).status_code == 200
    if public:
        assert client.put('/api/v1/me/consents/public_share', json={'granted': True}, headers={'X-CSRF-Token': csrf}).status_code == 200
    if confirmed:
        assert client.post('/api/v1/me/profile/confirm', headers={'X-CSRF-Token': csrf}).status_code == 200
    return client, csrf


def approved_employer(prefix='search-owner'):
    admin = TestClient(app)
    admin_email, admin_csrf = register_and_login(admin, f'admin-{uuid.uuid4().hex[:8]}')
    session = SessionLocal(); session.query(User).filter_by(email=admin_email).one().role = 'admin'; session.commit(); session.close()
    owner = TestClient(app)
    _, owner_csrf = register_and_login(owner, prefix)
    org = owner.post('/api/v1/organizations', json={'legal_name': f'{prefix} 模拟企业'}, headers={'X-CSRF-Token': owner_csrf})
    assert org.status_code == 201
    oid = org.json()['id']
    assert admin.post(f'/api/v1/admin/organizations/{oid}/review', json={'status': 'approved'}, headers={'X-CSRF-Token': admin_csrf}).status_code == 200
    return owner, owner_csrf, oid


def test_search_only_returns_confirmed_enterprise_authorized_projection_and_explains_match():
    make_candidate('enterprise-only', enterprise=True, public=False, confirmed=True)
    make_candidate('public-only', enterprise=False, public=True, confirmed=True)
    make_candidate('draft-enterprise', enterprise=True, public=False, confirmed=False)
    employer, csrf, oid = approved_employer()
    result = employer.post(f'/api/v1/organizations/{oid}/talent-search', json={
        'skills': ['销售人员培训'], 'region': '山东', 'industry': '新能源汽车', 'work_mode': '短期项目', 'work_years_min': 5,
    }, headers={'X-CSRF-Token': csrf})
    assert result.status_code == 200, result.text
    items = result.json()['items']
    assert [item['display_name'] for item in items] == ['enterprise-only']
    assert any(reason['field'] == 'skill' and reason['expanded'] for reason in items[0]['match_reasons'])
    serialized = str(result.json())
    assert '13800000000' not in serialized and '私人原始履历证据' not in serialized and 'source_evidence' not in serialized


def test_revocation_is_enforced_even_when_a_stale_projection_exists():
    candidate, candidate_csrf = make_candidate('revoke-now')
    session = SessionLocal(); user = session.query(User).filter_by(email=f'revoke-now-{RUN}@hhba-synthetic.com').one(); profile = session.query(Profile).filter_by(owner_user_id=user.id).one(); profile.content_json = {**profile.content_json, 'capability_summary': '撤销验证独有关键词'}; session.commit(); session.close()
    # Reconfirm updates the projection with the unique synthetic keyword.
    assert candidate.post('/api/v1/me/profile/confirm', headers={'X-CSRF-Token': candidate_csrf}).status_code == 200
    employer, csrf, oid = approved_employer('revoke-employer')
    query = {'keywords': '撤销验证独有关键词'}
    assert employer.post(f'/api/v1/organizations/{oid}/talent-search', json=query, headers={'X-CSRF-Token': csrf}).json()['items']
    # Simulate an asynchronous projection cleanup delay: query policy must still reject it.
    session = SessionLocal(); user = session.query(User).filter_by(email=f'revoke-now-{RUN}@hhba-synthetic.com').one(); session.query(Consent).filter_by(user_id=user.id, consent_type='enterprise_search').one().granted = False; session.commit(); assert session.query(CandidateSearchProjection).filter_by(owner_user_id=user.id).count() == 1; session.close()
    denied = employer.post(f'/api/v1/organizations/{oid}/talent-search', json=query, headers={'X-CSRF-Token': csrf})
    assert denied.status_code == 200 and denied.json()['items'] == []
    # The user-facing endpoint also removes the projection on a normal revoke.
    assert candidate.put('/api/v1/me/consents/enterprise_search', json={'granted': False}, headers={'X-CSRF-Token': candidate_csrf}).status_code == 200


def test_unapproved_removed_or_unrelated_members_cannot_search_and_quota_is_persistent():
    make_candidate('policy-candidate')
    pending, pending_csrf = TestClient(app), None
    _, pending_csrf = register_and_login(pending, 'pending')
    oid = pending.post('/api/v1/organizations', json={'legal_name': '待审核模拟企业'}, headers={'X-CSRF-Token': pending_csrf}).json()['id']
    assert pending.post(f'/api/v1/organizations/{oid}/talent-search', json={'keywords': '销售培训'}, headers={'X-CSRF-Token': pending_csrf}).status_code == 403
    employer, csrf, approved_oid = approved_employer('quota-employer')
    outsider = TestClient(app); _, outsider_csrf = register_and_login(outsider, 'outsider')
    assert outsider.post(f'/api/v1/organizations/{approved_oid}/talent-search', json={'keywords': '销售培训'}, headers={'X-CSRF-Token': outsider_csrf}).status_code == 404
    member = TestClient(app); member_email, member_csrf = register_and_login(member, 'search-member')
    session = SessionLocal(); member_id = session.query(User).filter_by(email=member_email).one().id; session.close()
    assert employer.post(f'/api/v1/organizations/{approved_oid}/members', json={'user_id': str(member_id), 'role': 'member'}, headers={'X-CSRF-Token': csrf}).status_code == 201
    assert member.post(f'/api/v1/organizations/{approved_oid}/talent-search', json={'keywords': '销售培训'}, headers={'X-CSRF-Token': member_csrf}).status_code == 200
    assert employer.delete(f'/api/v1/organizations/{approved_oid}/members/{member_id}', headers={'X-CSRF-Token': csrf}).status_code == 200
    assert member.post(f'/api/v1/organizations/{approved_oid}/talent-search', json={'keywords': '销售培训'}, headers={'X-CSRF-Token': member_csrf}).status_code == 404
    session = SessionLocal(); actor = session.query(User).filter_by(email=f'quota-employer-{RUN}@hhba-synthetic.com').one(); session.add(TalentSearchUsage(organization_id=uuid.UUID(approved_oid), user_id=actor.id, usage_date=now().date(), request_count=30)); session.commit(); session.close()
    assert employer.post(f'/api/v1/organizations/{approved_oid}/talent-search', json={'keywords': '销售培训'}, headers={'X-CSRF-Token': csrf}).status_code == 429
    session = SessionLocal(); session.get(Organization, uuid.UUID(approved_oid)).status = 'suspended'; session.commit(); session.close()
    assert employer.post(f'/api/v1/organizations/{approved_oid}/talent-search', json={'keywords': '销售培训'}, headers={'X-CSRF-Token': csrf}).status_code == 403


def test_synthetic_100_and_1000_candidate_search_is_bounded():
    employer, csrf, oid = approved_employer('performance-employer')
    session = SessionLocal()
    for size in (100, 1000):
        for i in range(size):
            user = User(email=f'perf-{size}-{i}-{RUN}@synthetic.invalid', name='合成', password_hash='x')
            session.add(user); session.flush()
            profile = Profile(owner_user_id=user.id, status='confirmed', display_name=f'性能{i}', content_json={})
            session.add(profile); session.flush(); session.add(Consent(user_id=user.id, consent_type='enterprise_search', granted=True))
            session.add(CandidateSearchProjection(profile_id=profile.id, owner_user_id=user.id, display_name=f'性能{i}', headline='新能源汽车销售培训', capability_summary='合成数据', skills=['销售培训'], industries=['新能源汽车'], location='山东', service_regions=['山东'], work_modes=['短期项目'], work_years=5, project_summaries=[], skills_text='|销售培训|', industries_text='|新能源汽车|', regions_text='|山东|', work_modes_text='|短期项目|', search_text='新能源汽车销售培训 合成数据', profile_version=1))
        session.commit()
        started = time.perf_counter(); response = employer.post(f'/api/v1/organizations/{oid}/talent-search', json={'keywords': '新能源汽车销售培训'}, headers={'X-CSRF-Token': csrf}); elapsed = time.perf_counter() - started
        assert response.status_code == 200 and len(response.json()['items']) == 10
        print(f'phase3a synthetic_candidates={size} search_seconds={elapsed:.4f}')
    session.close()
