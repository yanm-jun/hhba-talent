"""Rotate deterministic legacy candidate references to opaque random values.

Revision ID: 20261014_rotate_candidate_refs
Revises: 20261014_phase3a1_hardening
"""
import hashlib
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision = '20261014_rotate_candidate_refs'
down_revision = '20261014_phase3a1_hardening'
branch_labels = None
depends_on = None


def upgrade():
    """Rotate only the historical md5(profile_id) values; retain stable random refs."""
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, profile_id, candidate_ref FROM candidate_search_projections")).mappings()
    for row in rows:
        legacy_ref = hashlib.md5(str(row['profile_id']).encode('utf-8')).hexdigest()
        if row['candidate_ref'] == legacy_ref:
            bind.execute(
                sa.text("UPDATE candidate_search_projections SET candidate_ref = :candidate_ref WHERE id = :id"),
                {'candidate_ref': uuid4().hex, 'id': row['id']},
            )


def downgrade():
    # The previous deterministic values are deliberately not recoverable.
    pass
