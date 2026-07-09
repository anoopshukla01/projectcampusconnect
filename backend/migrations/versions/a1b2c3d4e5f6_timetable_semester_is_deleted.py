"""timetable_semester_is_deleted

Add semester, is_deleted, created_at to timetable_slots.
Idempotent — safe to run even if columns already exist.

Revision ID: a1b2c3d4e5f6
Revises: 9f27e1af7e48
Create Date: 2026-07-08 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = '9f27e1af7e48'
branch_labels = None
depends_on = None


def _col_exists(table, col):
    """Check whether a column already exists (PostgreSQL)."""
    bind = op.get_bind()
    result = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name=:t AND column_name=:c"
    ), {"t": table, "c": col})
    return result.fetchone() is not None


def _idx_exists(idx):
    bind = op.get_bind()
    result = bind.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname=:i"
    ), {"i": idx})
    return result.fetchone() is not None


def upgrade():
    if not _col_exists('timetable_slots', 'semester'):
        op.add_column('timetable_slots',
            sa.Column('semester', sa.Integer(), nullable=True))

    if not _col_exists('timetable_slots', 'is_deleted'):
        op.add_column('timetable_slots',
            sa.Column('is_deleted', sa.Boolean(), nullable=False,
                      server_default=sa.text('false')))

    if not _col_exists('timetable_slots', 'created_at'):
        op.add_column('timetable_slots',
            sa.Column('created_at', sa.DateTime(), nullable=True,
                      server_default=sa.text('NOW()')))

    if not _idx_exists('ix_timetable_slots_branch_semester'):
        op.create_index('ix_timetable_slots_branch_semester',
                        'timetable_slots', ['branch', 'semester'])

    if not _idx_exists('ix_timetable_slots_user_id'):
        op.create_index('ix_timetable_slots_user_id',
                        'timetable_slots', ['user_id'])


def downgrade():
    try:
        op.drop_index('ix_timetable_slots_user_id', table_name='timetable_slots')
    except Exception:
        pass
    try:
        op.drop_index('ix_timetable_slots_branch_semester', table_name='timetable_slots')
    except Exception:
        pass
    try:
        op.drop_column('timetable_slots', 'created_at')
        op.drop_column('timetable_slots', 'is_deleted')
        op.drop_column('timetable_slots', 'semester')
    except Exception:
        pass
