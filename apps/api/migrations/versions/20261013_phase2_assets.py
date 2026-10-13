"""Phase 2 private resume and capability-card persistence.

Revision ID: 20261013_phase2
Revises: 20261013_phase1
"""
from alembic import op
import sqlalchemy as sa
revision='20261013_phase2'; down_revision='20261013_phase1'; branch_labels=None; depends_on=None
def upgrade():
 op.create_table('resumes',sa.Column('id',sa.Uuid(),primary_key=True),sa.Column('owner_user_id',sa.Uuid(),sa.ForeignKey('users.id',ondelete='CASCADE'),nullable=False),sa.Column('storage_key',sa.String(255),nullable=False,unique=True),sa.Column('original_filename',sa.String(255),nullable=False),sa.Column('mime_type',sa.String(100),nullable=False),sa.Column('size_bytes',sa.BigInteger(),nullable=False),sa.Column('sha256',sa.String(64),nullable=False),sa.Column('status',sa.String(32),nullable=False),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False))
 op.create_table('parsing_jobs',sa.Column('id',sa.Uuid(),primary_key=True),sa.Column('resume_id',sa.Uuid(),sa.ForeignKey('resumes.id',ondelete='CASCADE'),nullable=False),sa.Column('state',sa.String(32),nullable=False),sa.Column('error_code',sa.String(64)),sa.Column('error_safe_message',sa.String(300)),sa.Column('result_json',sa.JSON()),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False),sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False))
 op.create_table('profiles',sa.Column('id',sa.Uuid(),primary_key=True),sa.Column('owner_user_id',sa.Uuid(),sa.ForeignKey('users.id',ondelete='CASCADE'),nullable=False,unique=True),sa.Column('status',sa.String(32),nullable=False),sa.Column('display_name',sa.String(100)),sa.Column('content_json',sa.JSON(),nullable=False),sa.Column('public_slug',sa.String(100),unique=True),sa.Column('published_at',sa.DateTime(timezone=True)),sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False))
 op.create_table('profile_versions',sa.Column('id',sa.Uuid(),primary_key=True),sa.Column('profile_id',sa.Uuid(),sa.ForeignKey('profiles.id',ondelete='CASCADE'),nullable=False),sa.Column('version',sa.Integer(),nullable=False),sa.Column('content_json',sa.JSON(),nullable=False),sa.Column('confirmed_at',sa.DateTime(timezone=True),nullable=False),sa.UniqueConstraint('profile_id','version'))
def downgrade(): op.drop_table('profile_versions');op.drop_table('profiles');op.drop_table('parsing_jobs');op.drop_table('resumes')
