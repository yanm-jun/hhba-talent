"""Bind every verification decision to an immutable evidence snapshot."""
from alembic import op
import sqlalchemy as sa

revision='20261014_phase3a2_review_binding'
down_revision='20261014_phase3a2_evidence_lock'
branch_labels=None
depends_on=None

def upgrade():
    # No historical evidence is fabricated. Existing reviews predate the
    # snapshot model and remain legible but are explicitly unbound.
    op.add_column('verification_reviews',sa.Column('evidence_version',sa.Integer(),nullable=True))
    op.add_column('verification_reviews',sa.Column('evidence_snapshot_id',sa.Uuid(),nullable=True))
    op.add_column('verification_reviews',sa.Column('evidence_manifest_sha256',sa.String(64),nullable=True))
    op.create_foreign_key('fk_verification_reviews_snapshot','verification_reviews','verification_evidence_snapshots',['evidence_snapshot_id'],['id'])
def downgrade():
    op.drop_constraint('fk_verification_reviews_snapshot','verification_reviews',type_='foreignkey');op.drop_column('verification_reviews','evidence_manifest_sha256');op.drop_column('verification_reviews','evidence_snapshot_id');op.drop_column('verification_reviews','evidence_version')
