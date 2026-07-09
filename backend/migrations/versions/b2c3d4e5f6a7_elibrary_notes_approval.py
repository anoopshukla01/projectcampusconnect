"""elibrary_notes_approval

Add approved, uploaded_by_id, note_type, description, downloads_count
to study_notes and library_resources for the upload→approve→download flow.

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


def upgrade():
    # ── study_notes ──────────────────────────────────────────────────────────
    op.add_column('study_notes',
        sa.Column('uploaded_by_id', sa.UUID(), nullable=True))
    op.add_column('study_notes',
        sa.Column('note_type', sa.String(50), nullable=True, server_default='notes'))
    op.add_column('study_notes',
        sa.Column('description', sa.Text(), nullable=True))
    op.add_column('study_notes',
        sa.Column('approved', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('study_notes',
        sa.Column('downloads_count', sa.Integer(), nullable=False, server_default=sa.text('0')))

    # FK to users (nullable — existing rows stay NULL)
    try:
        op.create_foreign_key(
            'fk_study_notes_uploaded_by',
            'study_notes', 'users',
            ['uploaded_by_id'], ['id'],
        )
    except Exception:
        pass  # skip if FK not supported (SQLite)

    # ── library_resources ────────────────────────────────────────────────────
    op.add_column('library_resources',
        sa.Column('uploaded_by_id', sa.UUID(), nullable=True))
    op.add_column('library_resources',
        sa.Column('description', sa.Text(), nullable=True))
    op.add_column('library_resources',
        sa.Column('approved', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('library_resources',
        sa.Column('downloads_count', sa.Integer(), nullable=False, server_default=sa.text('0')))

    try:
        op.create_foreign_key(
            'fk_library_resources_uploaded_by',
            'library_resources', 'users',
            ['uploaded_by_id'], ['id'],
        )
    except Exception:
        pass


def downgrade():
    op.drop_column('library_resources', 'downloads_count')
    op.drop_column('library_resources', 'approved')
    op.drop_column('library_resources', 'description')
    op.drop_column('library_resources', 'uploaded_by_id')

    op.drop_column('study_notes', 'downloads_count')
    op.drop_column('study_notes', 'approved')
    op.drop_column('study_notes', 'description')
    op.drop_column('study_notes', 'note_type')
    op.drop_column('study_notes', 'uploaded_by_id')
