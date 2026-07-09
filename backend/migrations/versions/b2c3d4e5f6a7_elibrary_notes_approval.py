"""elibrary_notes_approval

Add approved, uploaded_by_id, note_type, description, downloads_count
to study_notes and library_resources.
Idempotent — safe to run even if columns already exist.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-08 01:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def _col_exists(table, col):
    bind = op.get_bind()
    result = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name=:t AND column_name=:c"
    ), {"t": table, "c": col})
    return result.fetchone() is not None


def _fk_exists(constraint_name):
    bind = op.get_bind()
    result = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.table_constraints "
        "WHERE constraint_name=:n AND constraint_type='FOREIGN KEY'"
    ), {"n": constraint_name})
    return result.fetchone() is not None


def upgrade():
    # ── study_notes ──────────────────────────────────────────────────────────
    if not _col_exists('study_notes', 'uploaded_by_id'):
        op.add_column('study_notes',
            sa.Column('uploaded_by_id', sa.UUID(), nullable=True))
    if not _col_exists('study_notes', 'note_type'):
        op.add_column('study_notes',
            sa.Column('note_type', sa.String(50), nullable=True,
                      server_default='notes'))
    if not _col_exists('study_notes', 'description'):
        op.add_column('study_notes',
            sa.Column('description', sa.Text(), nullable=True))
    if not _col_exists('study_notes', 'approved'):
        op.add_column('study_notes',
            sa.Column('approved', sa.Boolean(), nullable=False,
                      server_default=sa.text('false')))
    if not _col_exists('study_notes', 'downloads_count'):
        op.add_column('study_notes',
            sa.Column('downloads_count', sa.Integer(), nullable=False,
                      server_default=sa.text('0')))

    if not _fk_exists('fk_study_notes_uploaded_by'):
        try:
            op.create_foreign_key(
                'fk_study_notes_uploaded_by',
                'study_notes', 'users',
                ['uploaded_by_id'], ['id'])
        except Exception:
            pass

    # ── library_resources ────────────────────────────────────────────────────
    if not _col_exists('library_resources', 'uploaded_by_id'):
        op.add_column('library_resources',
            sa.Column('uploaded_by_id', sa.UUID(), nullable=True))
    if not _col_exists('library_resources', 'description'):
        op.add_column('library_resources',
            sa.Column('description', sa.Text(), nullable=True))
    if not _col_exists('library_resources', 'approved'):
        op.add_column('library_resources',
            sa.Column('approved', sa.Boolean(), nullable=False,
                      server_default=sa.text('true')))
    if not _col_exists('library_resources', 'downloads_count'):
        op.add_column('library_resources',
            sa.Column('downloads_count', sa.Integer(), nullable=False,
                      server_default=sa.text('0')))

    if not _fk_exists('fk_library_resources_uploaded_by'):
        try:
            op.create_foreign_key(
                'fk_library_resources_uploaded_by',
                'library_resources', 'users',
                ['uploaded_by_id'], ['id'])
        except Exception:
            pass


def downgrade():
    for col in ['downloads_count', 'approved', 'description', 'uploaded_by_id']:
        try:
            op.drop_column('library_resources', col)
        except Exception:
            pass
    for col in ['downloads_count', 'approved', 'description', 'note_type', 'uploaded_by_id']:
        try:
            op.drop_column('study_notes', col)
        except Exception:
            pass
