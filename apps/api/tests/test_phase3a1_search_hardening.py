"""Phase 3A.1 P0/P1 policy tests; all records below are synthetic."""
import os
import uuid

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


def test_projection_allow_list_removes_synthetic_contacts_and_address():
    client = TestClient(app); email, csrf = login(client, 'private-text')
    content = {'headline': '销售培训负责人，电话 13800000000', 'capability_summary': '联系邮箱 synthetic-contact@example.invalid', 'skills': ['培训', '微信 synthetic-vx'], 'industries': ['新能源汽车'], 'location': '山东省青岛市市南区示例路88号', 'service_regions': ['山东', '上海示例街99号'], 'work_years': 5}
    assert client.put('/api/v1/me/profile', json={'display_name': 'private-text', 'content': content}, headers={'X-CSRF-Token': csrf}).status_code == 200
    session = SessionLocal(); user = session.query(User).filter_by(email=email).one(); profile = session.query(Profile).filter_by(owner_user_id=user.id).one()
    values = projection_values(session, profile); session.close()
    wire = str(values)
    assert '13800000000' not in wire and 'synthetic-contact@example.invalid' not in wire and 'synthetic-vx' not in wire
    assert '示例路' not in wire and '示例街' not in wire
    assert values['skills'] == ['培训'] and values['location'] is None and values['service_regions'] == ['山东']


def test_work_years_only_search_reason_and_opaque_reference_are_real():
    row = CandidateSearchProjection(profile_id=uuid.uuid4(), owner_user_id=uuid.uuid4(), candidate_ref=uuid.uuid4().hex, work_years=5, skills=[], industries=[], service_regions=[], work_modes=[], project_summaries=[], skills_text='', industries_text='', regions_text='', work_modes_text='', search_text='')
    assert search_reasons(row, TalentSearchIn(work_years_min=5))[0] == {'field': 'work_years', 'value': 5, 'expanded': False}
    assert search_reasons(row, TalentSearchIn(work_years_max=5))[0]['field'] == 'work_years'
    assert search_reasons(row, TalentSearchIn(work_years_min=5, work_years_max=5))[0]['value'] == 5
    row.work_years = 0
    assert search_reasons(row, TalentSearchIn(work_years_min=0))[0]['value'] == 0
    assert len(row.candidate_ref) == 32 and '@' not in row.candidate_ref


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


def test_owner_only_preview_uses_projection_transform_and_not_raw_contact_data():
    owner = TestClient(app); _, csrf = login(owner, 'preview-owner')
    assert owner.put('/api/v1/me/profile', json={'display_name': 'preview-owner', 'content': {'headline': '能力说明 邮箱 preview@example.invalid', 'skills': ['销售培训'], 'location': '山东'}}, headers={'X-CSRF-Token': csrf}).status_code == 200
    preview = owner.get('/api/v1/me/profile/enterprise-preview')
    assert preview.status_code == 200 and 'preview@example.invalid' not in str(preview.json())
    outsider = TestClient(app); login(outsider, 'preview-outsider')
    assert outsider.get('/api/v1/me/profile/enterprise-preview').json()['fields'] is None


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
    seen = set()
    for page in (1, 2, 10):
        response = employer.post(f'/api/v1/organizations/{oid}/talent-search', json={'keywords':'合成分页能力','page':page,'page_size':10}, headers={'X-CSRF-Token':employer_csrf})
        assert response.status_code == 200, response.text
        payload = response.json(); refs = [item['candidate_ref'] for item in payload['items']]
        assert len(refs) == 10 and len(set(refs)) == 10 and not seen.intersection(refs)
        seen.update(refs); assert payload['has_more'] is True
    assert old_ref in seen
