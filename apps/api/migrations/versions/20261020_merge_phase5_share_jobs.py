"""Merge independent public recruitment-sharing and employer application migration lines.

No DDL is applied here. Alembic records both existing branches without replaying
or rewriting historical production migrations.
"""
revision = "20261020_merge_phase5_share_jobs"
down_revision = ("20261015_a_share_recruitment_data", "20261020_phase5_job_applications")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
