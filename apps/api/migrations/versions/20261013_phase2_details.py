"""Normalized capability detail tables.

Revision ID: 20261013_phase2_details
Revises: 20261013_phase2
"""
from alembic import op
import sqlalchemy as sa
revision='20261013_phase2_details';down_revision='20261013_phase2';branch_labels=None;depends_on=None
def upgrade():
 for name,columns in [
  ('profile_experiences',[sa.Column('id',sa.Uuid(),primary_key=True),sa.Column('profile_id',sa.Uuid(),sa.ForeignKey('profiles.id',ondelete='CASCADE'),nullable=False),sa.Column('employer',sa.String(200)),sa.Column('title',sa.String(200)),sa.Column('summary',sa.Text()),sa.Column('visibility',sa.String(32),nullable=False,server_default='private')]),
  ('profile_educations',[sa.Column('id',sa.Uuid(),primary_key=True),sa.Column('profile_id',sa.Uuid(),sa.ForeignKey('profiles.id',ondelete='CASCADE'),nullable=False),sa.Column('institution',sa.String(200)),sa.Column('degree',sa.String(200)),sa.Column('visibility',sa.String(32),nullable=False,server_default='private')]),
  ('profile_projects',[sa.Column('id',sa.Uuid(),primary_key=True),sa.Column('profile_id',sa.Uuid(),sa.ForeignKey('profiles.id',ondelete='CASCADE'),nullable=False),sa.Column('name',sa.String(200)),sa.Column('summary',sa.Text()),sa.Column('visibility',sa.String(32),nullable=False,server_default='private')]),
  ('profile_service_intents',[sa.Column('id',sa.Uuid(),primary_key=True),sa.Column('profile_id',sa.Uuid(),sa.ForeignKey('profiles.id',ondelete='CASCADE'),nullable=False),sa.Column('service_name',sa.String(200),nullable=False),sa.Column('region',sa.String(100)),sa.Column('work_mode',sa.String(64)),sa.Column('visibility',sa.String(32),nullable=False,server_default='private')])]:op.create_table(name,*columns)
def downgrade():
 for name in ['profile_service_intents','profile_projects','profile_educations','profile_experiences']:op.drop_table(name)
