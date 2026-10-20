"""Persist parser attempt limits for isolated Docling jobs.

Revision ID: 20261014_phase25_parse_worker
Revises: 20261014_phase25_requirements
"""
from alembic import op
import sqlalchemy as sa

revision = '20261014_phase25_parse_worker'
down_revision = '20261014_phase25_requirements'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('parsing_jobs', sa.Column('attempt_count', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    op.drop_column('parsing_jobs', 'attempt_count')
