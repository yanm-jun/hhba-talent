"""Phase 3A.2 dual business identities and recruiter verification.

This migration is additive.  It deliberately does not infer recruiter rights
from legacy organization membership; existing users remain unable to use the
new restricted recruiter operations until explicitly verified.
"""
from alembic import op
import sqlalchemy as sa
from uuid import uuid4

revision = '20261014_phase3a2_identity'
down_revision = '20261014_rotate_candidate_refs'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('business_identities',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('user_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('identity_type', sa.String(32), nullable=False),
        sa.Column('status', sa.String(32), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('user_id', 'identity_type', name='uq_business_identity_user_type'))
    op.create_index('ix_business_identities_user_id', 'business_identities', ['user_id'])
    op.create_table('organization_verifications',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('organization_id', sa.Uuid(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('applicant_user_id', sa.Uuid(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('recruitment_subject_type', sa.String(32), nullable=False, server_default='employer'),
        sa.Column('legal_name', sa.String(200)), sa.Column('credit_code', sa.String(32)), sa.Column('registered_location', sa.String(160)),
        sa.Column('status', sa.String(32), nullable=False, server_default='draft'), sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('submitted_at', sa.DateTime(timezone=True)), sa.Column('reviewed_at', sa.DateTime(timezone=True)), sa.Column('reviewed_by', sa.Uuid(), sa.ForeignKey('users.id')),
        sa.Column('review_reason_code', sa.String(80)), sa.Column('verified_at', sa.DateTime(timezone=True)), sa.Column('next_review_due_at', sa.DateTime(timezone=True)),
        sa.Column('suspended_at', sa.DateTime(timezone=True)), sa.Column('suspension_reason_code', sa.String(80)), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_organization_verifications_credit_code', 'organization_verifications', ['credit_code'])
    op.create_table('recruiter_verifications',
        sa.Column('id', sa.Uuid(), primary_key=True), sa.Column('user_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('status', sa.String(32), nullable=False, server_default='draft'), sa.Column('real_name', sa.String(100)), sa.Column('job_title', sa.String(120)),
        sa.Column('reviewed_at', sa.DateTime(timezone=True)), sa.Column('reviewed_by', sa.Uuid(), sa.ForeignKey('users.id')), sa.Column('review_reason_code', sa.String(80)),
        sa.Column('verified_at', sa.DateTime(timezone=True)), sa.Column('next_review_due_at', sa.DateTime(timezone=True)), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_recruiter_verifications_user_id', 'recruiter_verifications', ['user_id'])
    op.create_table('recruiter_organization_authorizations',
        sa.Column('id', sa.Uuid(), primary_key=True), sa.Column('organization_id', sa.Uuid(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False), sa.Column('user_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(32), nullable=False, server_default='recruiter'), sa.Column('status', sa.String(32), nullable=False, server_default='draft'),
        sa.Column('granted_at', sa.DateTime(timezone=True)), sa.Column('expires_at', sa.DateTime(timezone=True)), sa.Column('revoked_at', sa.DateTime(timezone=True)), sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint('organization_id', 'user_id', name='uq_recruiter_org_authorization'))
    op.create_index('ix_recruiter_org_authorizations_organization_id', 'recruiter_organization_authorizations', ['organization_id'])
    op.create_index('ix_recruiter_org_authorizations_user_id', 'recruiter_organization_authorizations', ['user_id'])
    op.create_table('verification_documents',
        sa.Column('id', sa.Uuid(), primary_key=True), sa.Column('organization_id', sa.Uuid(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False), sa.Column('uploader_user_id', sa.Uuid(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('document_type', sa.String(48), nullable=False), sa.Column('storage_key', sa.String(255), nullable=False, unique=True), sa.Column('original_filename', sa.String(255), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=False), sa.Column('size_bytes', sa.Integer(), nullable=False), sa.Column('sha256', sa.String(64), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_verification_documents_organization_id', 'verification_documents', ['organization_id'])
    op.create_table('verification_reviews',
        sa.Column('id', sa.Uuid(), primary_key=True), sa.Column('organization_id', sa.Uuid(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False), sa.Column('reviewer_user_id', sa.Uuid(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('outcome', sa.String(32), nullable=False), sa.Column('reason_code', sa.String(80), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_verification_reviews_organization_id', 'verification_reviews', ['organization_id'])
    op.create_table('platform_service_gates', sa.Column('gate_key', sa.String(64), primary_key=True), sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column('reviewed_at', sa.DateTime(timezone=True)), sa.Column('reviewed_by', sa.Uuid(), sa.ForeignKey('users.id')), sa.Column('reason_code', sa.String(80)))
    # Profiles are trustworthy evidence of an existing candidate journey, but
    # historic organization membership is not evidence of recruiter authority.
    bind=op.get_bind()
    owners=bind.execute(sa.text("SELECT owner_user_id FROM profiles")).fetchall()
    for (owner_user_id,) in owners:
        exists=bind.execute(sa.text("SELECT 1 FROM business_identities WHERE user_id=:user_id AND identity_type='candidate'"),{'user_id':owner_user_id}).fetchone()
        if not exists:
            bind.execute(sa.text("INSERT INTO business_identities (id,user_id,identity_type,status,created_at) VALUES (:id,:user_id,'candidate','active',CURRENT_TIMESTAMP)"),{'id':str(uuid4()),'user_id':owner_user_id})


def downgrade():
    op.drop_table('platform_service_gates'); op.drop_index('ix_verification_reviews_organization_id', table_name='verification_reviews'); op.drop_table('verification_reviews')
    op.drop_index('ix_verification_documents_organization_id', table_name='verification_documents'); op.drop_table('verification_documents')
    op.drop_index('ix_recruiter_org_authorizations_user_id', table_name='recruiter_organization_authorizations'); op.drop_index('ix_recruiter_org_authorizations_organization_id', table_name='recruiter_organization_authorizations'); op.drop_table('recruiter_organization_authorizations')
    op.drop_index('ix_recruiter_verifications_user_id', table_name='recruiter_verifications'); op.drop_table('recruiter_verifications')
    op.drop_index('ix_organization_verifications_credit_code', table_name='organization_verifications'); op.drop_table('organization_verifications')
    op.drop_index('ix_business_identities_user_id', table_name='business_identities'); op.drop_table('business_identities')
