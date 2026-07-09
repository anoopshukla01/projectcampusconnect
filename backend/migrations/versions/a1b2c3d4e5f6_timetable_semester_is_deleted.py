"""timetable_semester_is_deleted

Add `semester` (Integer, nullable) and `is_deleted` (Boolean, default False)
columns to timetable_slots, and `created_at` timestamp.

Revision ID: a1b2c3d4e5f6
Revises: 9f27e1af7e48
Create Date: 2026-07-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import timezone

# revision identifiers
revision = 'a1b2c3d4e5f6'
down_revision = '9f27e1af7e48'
branch_labels = None
depends_on = None


def upgrade():
    # Add semester column (nullable — existing rows default to NULL = all semesters)
    op.add_column(
        'timetable_slots',
        sa.Column('semester', sa.Integer(), nullable=True),
    )
    # Add soft-delete flag (NOT NULL, defaults to False so existing rows are visible)
    op.add_column(
        'timetable_slots',
        sa.Column(
            'is_deleted',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false'),
        ),
    )
    # Add created_at timestamp for ordering / auditing
    op.add_column(
        'timetable_slots',
        sa.Column(
            'created_at',
            sa.DateTime(),
            nullable=True,
            server_default=sa.text('NOW()'),
        ),
    )

    # Index to speed up the most common query pattern
    op.create_index(
        'ix_timetable_slots_branch_semester',
        'timetable_slots',
        ['branch', 'semester'],
    )
    op.create_index(
        'ix_timetable_slots_user_id',
        'timetable_slots',
        ['user_id'],
    )


def downgrade():
    op.drop_index('ix_timetable_slots_user_id', table_name='timetable_slots')
    op.drop_index('ix_timetable_slots_branch_semester', table_name='timetable_slots')
    op.drop_column('timetable_slots', 'created_at')
    op.drop_column('timetable_slots', 'is_deleted')
    op.drop_column('timetable_slots', 'semester')
