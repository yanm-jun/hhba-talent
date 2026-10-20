"""Worker-owned parsing task state.

Revision ID: 20261014_phase26_worker_queue
Revises: 20261014_phase25_parse_worker
"""
from alembic import op
import sqlalchemy as sa

revision = '20261014_phase26_worker_queue'
down_revision = '20261014_phase25_parse_worker'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('parsing_jobs', sa.Column('worker_id', sa.String(100)))
    op.add_column('parsing_jobs', sa.Column('started_at', sa.DateTime(timezone=True)))
    op.add_column('parsing_jobs', sa.Column('finished_at', sa.DateTime(timezone=True)))
    op.add_column('parsing_jobs', sa.Column('lease_expires_at', sa.DateTime(timezone=True)))
    op.add_column('parsing_jobs', sa.Column('cancel_requested', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index('ix_parsing_jobs_worker_claim', 'parsing_jobs', ['state', 'created_at'])


def downgrade():
    op.drop_index('ix_parsing_jobs_worker_claim', table_name='parsing_jobs')
    for name in ['cancel_requested', 'lease_expires_at', 'finished_at', 'started_at', 'worker_id']:
        op.drop_column('parsing_jobs', name)
