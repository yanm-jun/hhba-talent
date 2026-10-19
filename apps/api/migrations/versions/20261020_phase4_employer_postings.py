"""Enterprise-origin postings: private drafts, independent review, public expiry.

No existing ATS job rows or candidate profiles are modified.
"""
from alembic import op
import sqlalchemy as sa

revision='20261020_phase4_employer_postings'
down_revision='20261015_phase3a2_recruiter_invitations'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('employer_postings',
        sa.Column('id',sa.Uuid(),primary_key=True),
        sa.Column('organization_id',sa.Uuid(),sa.ForeignKey('organizations.id',ondelete='CASCADE'),nullable=False),
        sa.Column('created_by',sa.Uuid(),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('title',sa.String(160),nullable=False),
        sa.Column('description',sa.Text(),nullable=False),
        sa.Column('requirements',sa.Text(),nullable=False),
        sa.Column('location',sa.String(120),nullable=False),
        sa.Column('work_mode',sa.String(32),nullable=False),
        sa.Column('recruitment_type',sa.String(24),nullable=False),
        sa.Column('apply_url',sa.String(1000),nullable=False),
        sa.Column('status',sa.String(32),nullable=False,server_default='draft'),
        sa.Column('submitted_at',sa.DateTime(timezone=True)),
        sa.Column('reviewed_at',sa.DateTime(timezone=True)),
        sa.Column('reviewed_by',sa.Uuid(),sa.ForeignKey('users.id')),
        sa.Column('review_reason',sa.String(120)),
        sa.Column('published_at',sa.DateTime(timezone=True)),
        sa.Column('expires_at',sa.DateTime(timezone=True)),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),
        sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False))
    op.create_index('ix_employer_postings_organization_id','employer_postings',['organization_id'])
    op.create_index('ix_employer_postings_status_expiry','employer_postings',['status','expires_at'])

def downgrade():
    op.drop_index('ix_employer_postings_status_expiry',table_name='employer_postings')
    op.drop_index('ix_employer_postings_organization_id',table_name='employer_postings')
    op.drop_table('employer_postings')
