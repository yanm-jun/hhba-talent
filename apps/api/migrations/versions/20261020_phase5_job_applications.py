"""Candidate opt-in applications to manually reviewed HHBA employer postings.

Each candidate authorizes one vacancy; withdrawal clears the transmitted snapshot.
Separate from third-party ATS applications and enterprise talent-search consent.
"""
from alembic import op
import sqlalchemy as sa

revision='20261020_phase5_job_applications'
down_revision='20261020_phase4_employer_postings'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('employer_job_applications',
        sa.Column('id',sa.Uuid(),primary_key=True),
        sa.Column('posting_id',sa.Uuid(),sa.ForeignKey('employer_postings.id',ondelete='CASCADE'),nullable=False),
        sa.Column('organization_id',sa.Uuid(),sa.ForeignKey('organizations.id',ondelete='CASCADE'),nullable=False),
        sa.Column('candidate_user_id',sa.Uuid(),sa.ForeignKey('users.id',ondelete='CASCADE'),nullable=False),
        sa.Column('snapshot_json',sa.JSON(),nullable=False),
        sa.Column('cover_note',sa.Text(),nullable=False,server_default=''),
        sa.Column('status',sa.String(32),nullable=False,server_default='submitted'),
        sa.Column('consented_at',sa.DateTime(timezone=True),nullable=False),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),
        sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False),
        sa.Column('withdrawn_at',sa.DateTime(timezone=True)),
        sa.Column('updated_by',sa.Uuid(),sa.ForeignKey('users.id')),
        sa.UniqueConstraint('posting_id','candidate_user_id',name='uq_employer_application_posting_candidate'))
    op.create_index('ix_employer_application_organization_posting','employer_job_applications',['organization_id','posting_id'])
    op.create_index('ix_employer_application_candidate','employer_job_applications',['candidate_user_id','created_at'])

def downgrade():
    op.drop_index('ix_employer_application_candidate',table_name='employer_job_applications')
    op.drop_index('ix_employer_application_organization_posting',table_name='employer_job_applications')
    op.drop_table('employer_job_applications')
