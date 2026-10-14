"""Phase 3A: minimal, authorization-safe talent search projection.

Revision ID: 20261014_phase3a_talent_search
Revises: 20261014_phase26_worker_queue
"""
from alembic import op
import sqlalchemy as sa

revision = '20261014_phase3a_talent_search'
down_revision = '20261014_phase26_worker_queue'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'candidate_search_projections',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('profile_id', sa.Uuid(), sa.ForeignKey('profiles.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('owner_user_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('display_name', sa.String(100)),
        sa.Column('headline', sa.String(300)),
        sa.Column('capability_summary', sa.Text()),
        sa.Column('skills', sa.JSON(), nullable=False),
        sa.Column('industries', sa.JSON(), nullable=False),
        sa.Column('location', sa.String(120)),
        sa.Column('service_regions', sa.JSON(), nullable=False),
        sa.Column('work_modes', sa.JSON(), nullable=False),
        sa.Column('work_years', sa.Integer()),
        sa.Column('project_summaries', sa.JSON(), nullable=False),
        sa.Column('skills_text', sa.Text(), nullable=False, server_default=''),
        sa.Column('industries_text', sa.Text(), nullable=False, server_default=''),
        sa.Column('regions_text', sa.Text(), nullable=False, server_default=''),
        sa.Column('work_modes_text', sa.Text(), nullable=False, server_default=''),
        sa.Column('search_text', sa.Text(), nullable=False, server_default=''),
        sa.Column('profile_version', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('indexed_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_candidate_search_projections_profile_id', 'candidate_search_projections', ['profile_id'])
    op.create_index('ix_candidate_search_projections_owner_user_id', 'candidate_search_projections', ['owner_user_id'])
    op.create_index('ix_candidate_search_projection_indexed_at', 'candidate_search_projections', ['indexed_at'])
    op.create_table(
        'talent_search_usages',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('organization_id', sa.Uuid(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('usage_date', sa.Date(), nullable=False),
        sa.Column('request_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('organization_id', 'user_id', 'usage_date', name='uq_talent_search_usage_day'),
    )
    op.create_index('ix_talent_search_usages_organization_id', 'talent_search_usages', ['organization_id'])
    op.create_index('ix_talent_search_usages_user_id', 'talent_search_usages', ['user_id'])
    if op.get_bind().dialect.name == 'postgresql':
        op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')
        for column in ('search_text', 'skills_text', 'industries_text', 'regions_text', 'work_modes_text'):
            op.create_index(f'ix_candidate_search_{column}_trgm', 'candidate_search_projections', [column], postgresql_using='gin', postgresql_ops={column: 'gin_trgm_ops'})


def downgrade():
    if op.get_bind().dialect.name == 'postgresql':
        for column in ('work_modes_text', 'regions_text', 'industries_text', 'skills_text', 'search_text'):
            op.drop_index(f'ix_candidate_search_{column}_trgm', table_name='candidate_search_projections')
    op.drop_index('ix_talent_search_usages_user_id', table_name='talent_search_usages')
    op.drop_index('ix_talent_search_usages_organization_id', table_name='talent_search_usages')
    op.drop_table('talent_search_usages')
    op.drop_index('ix_candidate_search_projection_indexed_at', table_name='candidate_search_projections')
    op.drop_index('ix_candidate_search_projections_owner_user_id', table_name='candidate_search_projections')
    op.drop_index('ix_candidate_search_projections_profile_id', table_name='candidate_search_projections')
    op.drop_table('candidate_search_projections')
