"""Phase 3A.1 consent safety and opaque candidate references.

Revision ID: 20261014_phase3a1_hardening
Revises: 20261014_phase3a_talent_search
"""
from alembic import op
import sqlalchemy as sa

revision = '20261014_phase3a1_hardening'
down_revision = '20261014_phase3a_talent_search'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    # Retain a minimal migration audit trail before resolving historical rows. A
    # conflicting history is fail-closed: all copies become revoked and the owner
    # must explicitly grant again after the migration.
    op.create_table(
        'consent_conflict_resolutions',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('consent_type', sa.String(64), nullable=False),
        sa.Column('resolution', sa.String(80), nullable=False),
        sa.Column('detected_at', sa.DateTime(timezone=True), nullable=False),
    )
    if bind.dialect.name == 'postgresql':
        op.execute("""
            INSERT INTO consent_conflict_resolutions
                (user_id, consent_type, resolution, detected_at)
            SELECT user_id, consent_type, 'revoked_conflicting_historical_records', timezone('utc', now())
            FROM consents
            GROUP BY user_id, consent_type
            HAVING count(*) > 1 AND bool_or(granted) AND bool_or(NOT granted)
        """)
        op.execute("""
            UPDATE consents AS c SET granted = false, changed_at = timezone('utc', now())
            FROM (
                SELECT user_id, consent_type FROM consents
                GROUP BY user_id, consent_type
                HAVING count(*) > 1 AND bool_or(granted) AND bool_or(NOT granted)
            ) AS conflicts
            WHERE c.user_id = conflicts.user_id AND c.consent_type = conflicts.consent_type
        """)
        op.execute("""
            DELETE FROM consents AS duplicate
            USING (
                SELECT id, row_number() OVER (
                    PARTITION BY user_id, consent_type
                    ORDER BY changed_at DESC NULLS LAST, id DESC
                ) AS rank
                FROM consents
            ) AS ranked
            WHERE duplicate.id = ranked.id AND ranked.rank > 1
        """)
    else:
        # Alembic acceptance is PostgreSQL-first. The generic path is only for
        # local metadata tooling and remains fail-closed for duplicate histories.
        rows = bind.execute(sa.text("SELECT user_id, consent_type FROM consents GROUP BY user_id, consent_type HAVING count(*) > 1")).fetchall()
        for user_id, consent_type in rows:
            bind.execute(sa.text("UPDATE consents SET granted = 0 WHERE user_id = :user_id AND consent_type = :consent_type"), {'user_id': user_id, 'consent_type': consent_type})
            ids = bind.execute(sa.text("SELECT id FROM consents WHERE user_id = :user_id AND consent_type = :consent_type ORDER BY changed_at DESC, id DESC"), {'user_id': user_id, 'consent_type': consent_type}).fetchall()
            for (duplicate_id,) in ids[1:]:
                bind.execute(sa.text("DELETE FROM consents WHERE id = :id"), {'id': duplicate_id})
    op.create_unique_constraint('uq_consents_user_type', 'consents', ['user_id', 'consent_type'])

    op.add_column('candidate_search_projections', sa.Column('candidate_ref', sa.String(32), nullable=True))
    if bind.dialect.name == 'postgresql':
        op.execute("UPDATE candidate_search_projections SET candidate_ref = md5(profile_id::text) WHERE candidate_ref IS NULL")
    else:
        # Generic migration execution is not an acceptance target; development
        # PostgreSQL always uses the opaque md5 UUID representation above.
        bind.execute(sa.text("UPDATE candidate_search_projections SET candidate_ref = lower(hex(randomblob(16))) WHERE candidate_ref IS NULL"))
    op.alter_column('candidate_search_projections', 'candidate_ref', nullable=False)
    op.create_unique_constraint('uq_candidate_search_projection_ref', 'candidate_search_projections', ['candidate_ref'])
    op.create_index('ix_candidate_search_projections_candidate_ref', 'candidate_search_projections', ['candidate_ref'])


def downgrade():
    op.drop_index('ix_candidate_search_projections_candidate_ref', table_name='candidate_search_projections')
    op.drop_constraint('uq_candidate_search_projection_ref', 'candidate_search_projections', type_='unique')
    op.drop_column('candidate_search_projections', 'candidate_ref')
    op.drop_constraint('uq_consents_user_type', 'consents', type_='unique')
    op.drop_table('consent_conflict_resolutions')
