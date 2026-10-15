"""Add durable, recipient-bound recruiter team invitations."""
from alembic import op
import sqlalchemy as sa

revision='20261015_phase3a2_recruiter_invitations'
down_revision='20261015_phase3a2_onboarding_steps'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('recruiter_invitations',
        sa.Column('id',sa.Uuid(),primary_key=True),
        sa.Column('organization_id',sa.Uuid(),sa.ForeignKey('organizations.id',ondelete='CASCADE'),nullable=False),
        sa.Column('invitee_user_id',sa.Uuid(),sa.ForeignKey('users.id',ondelete='CASCADE'),nullable=False),
        sa.Column('created_by_user_id',sa.Uuid(),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('proposed_role',sa.String(32),nullable=False),
        sa.Column('status',sa.String(32),nullable=False,server_default='pending'),
        sa.Column('expires_at',sa.DateTime(timezone=True),nullable=False),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),
        sa.Column('accepted_at',sa.DateTime(timezone=True)),
        sa.Column('revoked_at',sa.DateTime(timezone=True)),
    )
    op.create_index('ix_recruiter_invitations_organization_id','recruiter_invitations',['organization_id'])
    op.create_index('ix_recruiter_invitations_invitee_user_id','recruiter_invitations',['invitee_user_id'])

def downgrade():
    op.drop_index('ix_recruiter_invitations_invitee_user_id',table_name='recruiter_invitations')
    op.drop_index('ix_recruiter_invitations_organization_id',table_name='recruiter_invitations')
    op.drop_table('recruiter_invitations')
