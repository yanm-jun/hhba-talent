"""Lock submitted verification evidence to immutable version snapshots."""
from alembic import op
import sqlalchemy as sa

revision='20261014_phase3a2_evidence_lock'
down_revision='20261014_phase3a2_identity'
branch_labels=None
depends_on=None

def upgrade():
    op.add_column('verification_documents',sa.Column('evidence_version',sa.Integer(),nullable=False,server_default='1'))
    op.create_table('verification_evidence_snapshots',
        sa.Column('id',sa.Uuid(),primary_key=True),sa.Column('organization_id',sa.Uuid(),sa.ForeignKey('organizations.id',ondelete='CASCADE'),nullable=False),sa.Column('evidence_version',sa.Integer(),nullable=False),sa.Column('manifest',sa.JSON(),nullable=False),sa.Column('manifest_sha256',sa.String(64),nullable=False),sa.Column('submitted_at',sa.DateTime(timezone=True),nullable=False),sa.UniqueConstraint('organization_id','evidence_version',name='uq_verification_evidence_version'))
    op.create_index('ix_verification_evidence_snapshots_organization_id','verification_evidence_snapshots',['organization_id'])
def downgrade():
    op.drop_index('ix_verification_evidence_snapshots_organization_id',table_name='verification_evidence_snapshots');op.drop_table('verification_evidence_snapshots');op.drop_column('verification_documents','evidence_version')
