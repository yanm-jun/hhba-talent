"""Phase 3A.1 P0/P1 policy tests; all records below are synthetic."""
import os
import uuid
import hashlib

RUN = uuid.uuid4().hex
os.environ['DATABASE_URL'] = f'sqlite:///./phase3a1-{RUN}.sqlite3'
os.environ['HHBA_BOOTSTRAP_ADMIN_EMAIL'] = f'admin-{RUN}@hhba-synthetic.com'

from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from app.main import (Base, CandidateSearchProjection, Consent, Profile, SessionLocal,
                      User, app, engine, projection_values, search_reasons, TalentSearchIn)

Base.metadata.create_all(engine)
PASSWORD = 'SyntheticOnly123!'


def login(client, name):
    email = f'{name}-{RUN}@hhba-synthetic.com'
    assert client.post('/api/v1/auth/register', json={'email': email, 'password': PASSWORD, 'display_name': name}).status_code == 201
    response = client.post('/api/v1/auth/session', json={'email': email, 'password': PASSWORD})
    assert response.status_code == 200
    return email, response.json()['csrf_token']


def test_projection_allow_list_rejects_synthetic_contacts_and_precise_address_fields():
    client = TestClient(app); email, csrf = login(client, 'private-text')
    content = {'headline': '销售培训负责人，电话 138 0000 0000', 'capability_summary': '联系邮箱 synthetic-contact @ example.invalid', 'skills': ['培训', '微信 synthetic-vx'], 'industries': ['新能源汽车'], 'location': '山东省青岛市市南区示例路88号', 'service_regions': ['山东', '上海示例街99号'], 'services': ['浦东新区世纪大道100号上门辅导', '培训咨询'], 'work_years': 5}
    assert client.put('/api/v1/me/profile', json={'display_name': 'private-text', 'content': content}, headers={'X-CSRF-Token': csrf}).status_code == 200
    session = SessionLocal(); user = session.query(User).filter_by(email=email).one(); profile = session.query(Profile).filter_by(owner_user_id=user.id).one()
    values = projection_values(session, profile); session.close()
    wire = str(values)
    assert '138' not in wire and 'synthetic-contact' not in wire and 'synthetic-vx' not in wire
    assert '示例路' not in wire and '示例街' not in wire
    assert values['skills'] == ['培训'] and values['location'] is None and values['service_regions'] == ['山东']


def test_public_card_uses_the_same_disclosure_rejection_rules():
    client = TestClient(app); _, csrf = login(client, 'public-private-text')
    content = {'headline': '邮箱 public-contact@example.invalid', 'skills': ['培训', '138 0000 0000'], 'services': ['上海市示例路88号咨询', '培训咨询']}
    assert client.put('/api/v1/me/profile', json={'display_name': '公开合成用户', 'content': content}, headers={'X-CSRF-Token': csrf}).status_code == 200
    assert client.post('/api/v1/me/profile/confirm', headers={'X-CSRF-Token': csrf}).status_code == 200
    assert client.put('/api/v1/me/consents/public_share', json={'granted': True}, headers={'X-CSRF-Token': csrf}).status_code == 200
    published = client.post('/api/v1/me/profile/publish', headers={'X-CSRF-Token': csrf}); assert published.status_code == 200
    card = client.get(f"/api/v1/public/profiles/{published.json()['slug']}")
    assert card.status_code == 200
    assert 'public-contact' not in str(card.json()) and '138' not in str(card.json()) and '示例路' not in str(card.json())
    assert card.json()['skills'] == ['培训'] and card.json()['services'] == ['培训咨询']


def test_work_years_only_search_reason_and_opaque_reference_are_real():
    profile_id = uuid.uuid4(); row = CandidateSearchProjection(profile_id=profile_id, owner_user_id=uuid.uuid4(), candidate_ref=uuid.uuid4().hex, work_years=5, skills=[], industries=[], service_regions=[], work_modes=[], project_summaries=[], skills_text='', industries_text='', regions_text='', work_modes_text='', search_text='')
    assert search_reasons(row, TalentSearchIn(work_years_min=5))[0] == {'field': 'work_years', 'value': 5, 'expanded': False}
    assert search_reasons(row, TalentSearchIn(work_years_max=5))[0]['field'] == 'work_years'
    assert search_reasons(row, TalentSearchIn(work_years_min=5, work_years_max=5))[0]['value'] == 5
    row.work_years = 0
    assert search_reasons(row, TalentSearchIn(work_years_min=0))[0]['value'] == 0
    assert len(row.candidate_ref) == 32 and '@' not in row.candidate_ref and row.candidate_ref != hashlib.md5(str(profile_id).encode()).hexdigest()


def test_live_candidate_reference_is_random_stable_then_removed_on_revocation():
    client = TestClient(app); email, csrf = login(client, 'candidate-reference')
    content = {'headline': '合成能力', 'skills': ['培训'], 'industries': ['新能源汽车'], 'location': '山东', 'work_years': 5}
    assert client.put('/api/v1/me/profile', json={'display_name': '候选人引用', 'content': content}, headers={'X-CSRF-Token': csrf}).status_code == 200
    assert client.put('/api/v1/me/consents/enterprise_search', json={'granted': True}, headers={'X-CSRF-Token': csrf}).status_code == 200
    assert client.post('/api/v1/me/profile/confirm', headers={'X-CSRF-Token': csrf}).status_code == 200
    session = SessionLocal(); user = session.query(User).filter_by(email=email).one(); first = session.query(CandidateSearchProjection).filter_by(owner_user_id=user.id).one(); first_ref = first.candidate_ref; profile_id = first.profile_id; session.close()
    assert first_ref != hashlib.md5(str(profile_id).encode()).hexdigest()
    assert client.post('/api/v1/me/profile/confirm', headers={'X-CSRF-Token': csrf}).status_code == 200
    session = SessionLocal(); assert session.query(CandidateSearchProjection).filter_by(owner_user_id=user.id).one().candidate_ref == first_ref; session.close()
    assert client.put('/api/v1/me/consents/enterprise_search', json={'granted': False}, headers={'X-CSRF-Token': csrf}).status_code == 200
    session = SessionLocal(); assert session.query(CandidateSearchProjection).filter_by(owner_user_id=user.id).count() == 0; session.close()


def test_consent_metadata_enforces_one_row_per_user_and_type():
    session = SessionLocal(); user = User(email=f'unique-{RUN}@hhba-synthetic.com', name='unique', password_hash='x'); session.add(user); session.flush()
    session.add(Consent(user_id=user.id, consent_type='enterprise_search', granted=True)); session.commit()
    session.add(Consent(user_id=user.id, consent_type='enterprise_search', granted=False))
    try:
        session.commit(); assert False, 'unique consent constraint must reject duplicates'
    except IntegrityError:
        session.rollback()
    finally:
        session.close()


def test_search_engine_consent_is_independent_and_can_be_revoked_when_public_share_is_off():
    client = TestClient(app); _, csrf = login(client, 'consent-independence')
    assert client.put('/api/v1/me/consents/search_engine_index', json={'granted': True}, headers={'X-CSRF-Token': csrf}).status_code == 200
    assert client.get('/api/v1/me/consents').json()['search_engine_index'] is True
    assert client.put('/api/v1/me/consents/public_share', json={'granted': True}, headers={'X-CSRF-Token': csrf}).status_code == 200
    assert client.put('/api/v1/me/consents/public_share', json={'granted': False}, headers={'X-CSRF-Token': csrf}).status_code == 200
    assert client.get('/api/v1/me/consents').json()['search_engine_index'] is True
    assert client.put('/api/v1/me/consents/search_engine_index', json={'granted': False}, headers={'X-CSRF-Token': csrf}).status_code == 200
    assert client.get('/api/v1/me/consents').json()['search_engine_index'] is False


def test_owner_only_preview_uses_projection_transform_and_not_raw_contact_data():
    owner = TestClient(app); _, csrf = login(owner, 'preview-owner')
    assert owner.put('/api/v1/me/profile', json={'display_name': 'preview-owner', 'content': {'headline': '能力说明 邮箱 preview@example.invalid', 'skills': ['销售培训'], 'location': '山东'}}, headers={'X-CSRF-Token': csrf}).status_code == 200
    preview = owner.get('/api/v1/me/profile/enterprise-preview')
    assert preview.status_code == 200 and 'preview@example.invalid' not in str(preview.json())
    outsider = TestClient(app); login(outsider, 'preview-outsider')
    assert outsider.get('/api/v1/me/profile/enterprise-preview').json()['fields'] is None


def test_sql_filtered_search_keeps_year_synonym_and_mixed_match_explanations_aligned():
    admin = TestClient(app); admin_email, admin_csrf = login(admin, 'criteria-admin')
    session = SessionLocal(); session.query(User).filter_by(email=admin_email).one().role = 'admin'; session.commit(); session.close()
    employer = TestClient(app); _, employer_csrf = login(employer, 'criteria-employer')
    org = employer.post('/api/v1/organizations', json={'legal_name': f'检索条件合成企业 {RUN}'}, headers={'X-CSRF-Token': employer_csrf}); assert org.status_code == 201
    oid = org.json()['id']; assert admin.post(f'/api/v1/admin/organizations/{oid}/review', json={'status': 'approved'}, headers={'X-CSRF-Token': admin_csrf}).status_code == 200
    marker = f'criteria-{RUN}'
    session = SessionLocal()
    for index, years in enumerate((3, 6, 9)):
        user = User(email=f'criteria-{index}-{RUN}@hhba-synthetic.com', name='检索合成', password_hash='x'); session.add(user); session.flush()
        profile = Profile(owner_user_id=user.id, status='confirmed', display_name=f'条件候选人{index}', content_json={}); session.add(profile); session.flush()
        session.add(Consent(user_id=user.id, consent_type='enterprise_search', granted=True))
        session.add(CandidateSearchProjection(profile_id=profile.id, owner_user_id=user.id, display_name=f'条件候选人{index}', headline='销售培训', capability_summary=marker, skills=['销售培训'], industries=['新能源汽车'], location='山东', service_regions=['山东'], work_modes=['项目合作'], work_years=years, project_summaries=[], skills_text='|销售培训|', industries_text='|新能源汽车|', regions_text='|山东|', work_modes_text='|项目合作|', search_text=f'{marker} 销售培训'))
    session.commit(); session.close()
    years_only = employer.post(f'/api/v1/organizations/{oid}/talent-search', json={'work_years_min': 5, 'work_years_max': 7}, headers={'X-CSRF-Token': employer_csrf})
    assert years_only.status_code == 200
    assert [item['work_years'] for item in years_only.json()['items']] == [6]
    assert years_only.json()['items'][0]['match_reasons'] == [{'field': 'work_years', 'value': 6, 'expanded': False}]
    synonym = employer.post(f'/api/v1/organizations/{oid}/talent-search', json={'skills': ['销售人员培训'], 'work_years_min': 6, 'work_years_max': 6}, headers={'X-CSRF-Token': employer_csrf})
    assert synonym.status_code == 200 and len(synonym.json()['items']) == 1
    assert {reason['field'] for reason in synonym.json()['items'][0]['match_reasons']} == {'skill', 'work_years'}
    assert synonym.json()['items'][0]['match_reasons'][0]['expanded'] is True
    mixed = employer.post(f'/api/v1/organizations/{oid}/talent-search', json={'keywords': marker, 'skills': ['销售人员培训'], 'industry': '新能源汽车', 'region': '山东', 'work_mode': '项目合作', 'work_years_min': 6, 'work_years_max': 6}, headers={'X-CSRF-Token': employer_csrf})
    assert mixed.status_code == 200 and len(mixed.json()['items']) == 1
    assert {reason['field'] for reason in mixed.json()['items'][0]['match_reasons']} == {'skill', 'industry', 'region', 'work_mode', 'work_years', 'capability'}


def test_305_authorized_candidates_are_paginated_without_101_row_truncation():
    admin = TestClient(app); admin_email, admin_csrf = login(admin, 'page-admin')
    session = SessionLocal(); session.query(User).filter_by(email=admin_email).one().role = 'admin'; session.commit(); session.close()
    employer = TestClient(app); _, employer_csrf = login(employer, 'page-employer')
    organization = employer.post('/api/v1/organizations', json={'legal_name': f'分页合成企业 {RUN}'}, headers={'X-CSRF-Token': employer_csrf})
    assert organization.status_code == 201
    oid = organization.json()['id']
    assert admin.post(f'/api/v1/admin/organizations/{oid}/review', json={'status':'approved'}, headers={'X-CSRF-Token':admin_csrf}).status_code == 200
    session = SessionLocal(); old_ref = None
    for index in range(305):
        user = User(email=f'page-{index}-{RUN}@hhba-synthetic.com', name='分页合成', password_hash='x'); session.add(user); session.flush()
        profile = Profile(owner_user_id=user.id, status='confirmed', display_name=f'候选人{index}', content_json={}); session.add(profile); session.flush()
        session.add(Consent(user_id=user.id, consent_type='enterprise_search', granted=True))
        projection = CandidateSearchProjection(profile_id=profile.id, owner_user_id=user.id, display_name=f'候选人{index}', headline='合成分页能力', capability_summary='合成分页能力', skills=['分页技能'], industries=['合成行业'], location='山东', service_regions=['山东'], work_modes=['项目合作'], work_years=5, project_summaries=[], skills_text='|分页技能|', industries_text='|合成行业|', regions_text='|山东|', work_modes_text='|项目合作|', search_text='合成分页能力')
        session.add(projection); session.flush()
        if index == 0: old_ref = projection.candidate_ref
    session.commit(); session.close()
    second = employer.post('/api/v1/organizations', json={'legal_name': f'分页合成企业二号 {RUN}'}, headers={'X-CSRF-Token': employer_csrf})
    assert second.status_code == 201
    second_oid = second.json()['id']
    assert admin.post(f'/api/v1/admin/organizations/{second_oid}/review', json={'status':'approved'}, headers={'X-CSRF-Token':admin_csrf}).status_code == 200
    seen = set()
    for page in range(1, 32):
        page_oid = oid if page <= 30 else second_oid
        response = employer.post(f'/api/v1/organizations/{page_oid}/talent-search', json={'keywords':'合成分页能力','page':page,'page_size':10}, headers={'X-CSRF-Token':employer_csrf})
        assert response.status_code == 200, response.text
        payload = response.json(); refs = [item['candidate_ref'] for item in payload['items']]
        expected = 10 if page < 31 else 5
        assert len(refs) == expected and len(set(refs)) == expected and not seen.intersection(refs)
        seen.update(refs); assert payload['has_more'] is (page < 31)
    assert len(seen) == 305 and old_ref in seen
