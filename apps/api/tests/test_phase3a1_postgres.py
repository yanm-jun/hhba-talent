"""Real PostgreSQL concurrency checks for Phase 3A.1 (synthetic data only).

Run directly inside the isolated test database container; no pytest dependency is
required so this remains an explicit database acceptance test.
"""
import os
import uuid
from concurrent.futures import ThreadPoolExecutor

if 'phase3a1_test' not in os.environ.get('DATABASE_URL', ''):
    raise SystemExit('Refusing to run stateful PostgreSQL test outside hhba_phase3a1_test')

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.main import Consent, Organization, SessionLocal, TalentSearchUsage, User, consume_search_quota, now

RUN = uuid.uuid4().hex[:12]


def make_user(session, name):
    user = User(email=f'{name}-{RUN}@synthetic.invalid', name=name, password_hash='x')
    session.add(user); session.flush()
    return user


session = SessionLocal()
owner = make_user(session, 'quota-owner')
organization = Organization(legal_name=f'Phase3A1 synthetic {RUN}', status='approved', created_by=owner.id)
session.add(organization); session.flush()
members = [make_user(session, f'quota-member-{i}') for i in range(6)]
consent_owner_id = owner.id
org_id = organization.id
member_ids = [member.id for member in members]
session.commit(); session.close()


def consent_write(granted):
    s = SessionLocal()
    try:
        s.execute(pg_insert(Consent).values(user_id=consent_owner_id, consent_type='enterprise_search', granted=granted, changed_at=now()).on_conflict_do_update(index_elements=['user_id', 'consent_type'], set_={'granted': granted, 'changed_at': now()}))
        s.commit(); return True
    finally:
        s.close()


with ThreadPoolExecutor(max_workers=12) as pool:
    list(pool.map(consent_write, [i % 2 == 0 for i in range(24)]))
session = SessionLocal()
assert session.scalar(select(func.count(Consent.id)).where(Consent.user_id == consent_owner_id, Consent.consent_type == 'enterprise_search')) == 1
session.close()


def consume(user_id):
    s = SessionLocal()
    try:
        allowed = consume_search_quota(s, org_id, user_id)
        s.commit()
        return allowed
    except Exception:
        s.rollback(); raise
    finally:
        s.close()


# First-row race: every request obtains the organization lock before creating its
# per-member daily row, so no unique constraint exception leaks to callers.
with ThreadPoolExecutor(max_workers=6) as pool:
    first_results = list(pool.map(consume, member_ids))
assert all(first_results), first_results

# Organization near-limit burst: exactly five remaining requests can succeed.
session = SessionLocal()
usage = session.scalar(select(TalentSearchUsage).where(TalentSearchUsage.organization_id == org_id, TalentSearchUsage.user_id == owner.id, TalentSearchUsage.usage_date == now().date()))
if not usage:
    usage = TalentSearchUsage(organization_id=org_id, user_id=owner.id, usage_date=now().date(), request_count=0); session.add(usage)
usage.request_count = 89  # six first requests + 89 = 95; burst admits exactly five.
session.commit(); session.close()
with ThreadPoolExecutor(max_workers=6) as pool:
    near_limit = list(pool.map(consume, member_ids))
assert near_limit.count(True) == 5, near_limit
session = SessionLocal()
total = session.scalar(select(func.coalesce(func.sum(TalentSearchUsage.request_count), 0)).where(TalentSearchUsage.organization_id == org_id, TalentSearchUsage.usage_date == now().date()))
assert total == 100, total
session.close()
print(f'phase3a1 postgres consent_rows=1 first_row_allowed={first_results.count(True)} org_burst_allowed={near_limit.count(True)} final_count={total}')
