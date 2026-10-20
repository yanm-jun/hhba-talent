"""Add independent file-security and review-conclusion evidence.

Existing verification documents remain `pending`; this migration intentionally
does not invent historical scan or legal-verification conclusions.
"""
from alembic import op
import sqlalchemy as sa

revision='20261015_phase3a2_integrity_status'
down_revision='20261014_phase3a2_review_binding'
branch_labels=None
depends_on=None

def upgrade():
    op.add_column('verification_documents',sa.Column('security_status',sa.String(32),nullable=False,server_default='pending'))
    op.add_column('verification_documents',sa.Column('security_checked_at',sa.DateTime(timezone=True),nullable=True))
    op.add_column('verification_documents',sa.Column('security_checked_by',sa.Uuid(),nullable=True))
    op.create_foreign_key('fk_verification_document_security_reviewer','verification_documents','users',['security_checked_by'],['id'])
    op.add_column('verification_reviews',sa.Column('entity_verification',sa.String(32),nullable=False,server_default='not_verified'))
    op.add_column('verification_reviews',sa.Column('representative_verification',sa.String(32),nullable=False,server_default='not_verified'))
    op.add_column('verification_reviews',sa.Column('authorization_verification',sa.String(32),nullable=False,server_default='not_verified'))
def downgrade():
    op.drop_column('verification_reviews','authorization_verification');op.drop_column('verification_reviews','representative_verification');op.drop_column('verification_reviews','entity_verification');op.drop_constraint('fk_verification_document_security_reviewer','verification_documents',type_='foreignkey');op.drop_column('verification_documents','security_checked_by');op.drop_column('verification_documents','security_checked_at');op.drop_column('verification_documents','security_status')
