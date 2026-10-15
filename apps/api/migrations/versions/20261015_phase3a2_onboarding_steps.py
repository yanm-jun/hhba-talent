"""Persist the recruiter relationship selected in staged onboarding.

This is intentionally nullable for historical recruiter records.  A missing
relationship is not inferred and therefore cannot satisfy a future approval.
"""
from alembic import op
import sqlalchemy as sa

revision='20261015_phase3a2_onboarding_steps'
down_revision='20261015_phase3a2_integrity_status'
branch_labels=None
depends_on=None

def upgrade():
    op.add_column('recruiter_verifications',sa.Column('relationship_type',sa.String(48),nullable=True))

def downgrade():
    op.drop_column('recruiter_verifications','relationship_type')
