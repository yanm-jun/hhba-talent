"""Add private, organization-scoped hiring requirement drafts.

Revision ID: 20261014_phase25_requirements
Revises: 20261013_phase2_details
"""
from alembic import op
import sqlalchemy as sa

revision = '20261014_phase25_requirements'
down_revision = '20261013_phase2_details'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'hiring_requirements',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('organization_id', sa.Uuid(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_by', sa.Uuid(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String(160), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('location', sa.String(120)),
        sa.Column('work_mode', sa.String(64)),
        sa.Column('status', sa.String(32), nullable=False, server_default='draft'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_hiring_requirements_organization_id', 'hiring_requirements', ['organization_id'])


def downgrade():
    op.drop_index('ix_hiring_requirements_organization_id', table_name='hiring_requirements')
    op.drop_table('hiring_requirements')
