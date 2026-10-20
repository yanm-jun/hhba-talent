"""Phase 1 baseline migration.

Revision ID: 20261013_phase1
"""
from alembic import op
import sqlalchemy as sa
revision='20261013_phase1'; down_revision=None; branch_labels=None; depends_on=None
def upgrade():
    op.create_table('users',sa.Column('id',sa.Uuid(),primary_key=True),sa.Column('email',sa.String(320),nullable=False),sa.Column('name',sa.String(100),nullable=False),sa.Column('password_hash',sa.String(512),nullable=False),sa.Column('status',sa.String(32),nullable=False),sa.Column('role',sa.String(32),nullable=False),sa.UniqueConstraint('email'))
    op.create_table('auth_sessions',sa.Column('id',sa.Uuid(),primary_key=True),sa.Column('user_id',sa.Uuid(),sa.ForeignKey('users.id',ondelete='CASCADE'),nullable=False),sa.Column('token_hash',sa.String(64),nullable=False),sa.Column('csrf',sa.String(128),nullable=False),sa.Column('expires_at',sa.DateTime(timezone=True),nullable=False),sa.Column('revoked_at',sa.DateTime(timezone=True)),sa.UniqueConstraint('token_hash'))
    op.create_table('organizations',sa.Column('id',sa.Uuid(),primary_key=True),sa.Column('legal_name',sa.String(200),nullable=False),sa.Column('status',sa.String(32),nullable=False),sa.Column('created_by',sa.Uuid(),sa.ForeignKey('users.id'),nullable=False),sa.Column('reviewed_by',sa.Uuid(),sa.ForeignKey('users.id')),sa.Column('reviewed_at',sa.DateTime(timezone=True)))
    op.create_table('organization_memberships',sa.Column('id',sa.Uuid(),primary_key=True),sa.Column('organization_id',sa.Uuid(),sa.ForeignKey('organizations.id'),nullable=False),sa.Column('user_id',sa.Uuid(),sa.ForeignKey('users.id'),nullable=False),sa.Column('role',sa.String(32),nullable=False),sa.Column('status',sa.String(32),nullable=False))
    op.create_table('consents',sa.Column('id',sa.Uuid(),primary_key=True),sa.Column('user_id',sa.Uuid(),sa.ForeignKey('users.id'),nullable=False),sa.Column('consent_type',sa.String(64),nullable=False),sa.Column('granted',sa.Boolean(),nullable=False),sa.Column('changed_at',sa.DateTime(timezone=True),nullable=False))
    op.create_table('audit_events',sa.Column('id',sa.Uuid(),primary_key=True),sa.Column('occurred_at',sa.DateTime(timezone=True),nullable=False),sa.Column('actor_id',sa.Uuid(),sa.ForeignKey('users.id')),sa.Column('action',sa.String(120),nullable=False),sa.Column('outcome',sa.String(32),nullable=False),sa.Column('resource',sa.String(100),nullable=False),sa.Column('request_id',sa.String(64),nullable=False),sa.Column('metadata_redacted',sa.JSON(),nullable=False))
def downgrade():
    op.drop_table('audit_events');op.drop_table('consents');op.drop_table('organization_memberships');op.drop_table('organizations');op.drop_table('auth_sessions');op.drop_table('users')
