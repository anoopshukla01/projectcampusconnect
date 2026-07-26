"""add_missing_db_columns

Adds missing college_id column to placement_drives and ticket_code column to event_registrations.

Revision ID: i4j5k6l7m8n9
Revises: h3i4j5k6l7m8
Create Date: 2026-07-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = 'i4j5k6l7m8n9'
down_revision = 'h3i4j5k6l7m8'
branch_labels = None
depends_on = None

DEFAULT_COLLEGE_ID = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d"


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # 1. placement_drives.college_id
    cols = [c['name'] for c in inspector.get_columns('placement_drives')]
    if 'college_id' not in cols:
        op.add_column(
            'placement_drives',
            sa.Column(
                'college_id',
                sa.UUID(),
                sa.ForeignKey('colleges.id'),
                nullable=True,
            ),
        )
        # Backfill existing rows with initial college UUID
        conn.execute(
            text("UPDATE placement_drives SET college_id = :cid WHERE college_id IS NULL"),
            {"cid": DEFAULT_COLLEGE_ID},
        )
        op.alter_column('placement_drives', 'college_id', nullable=False)
        op.create_index(
            'ix_placement_drives_college_id',
            'placement_drives',
            ['college_id'],
        )

    # 2. event_registrations.ticket_code
    er_cols = [c['name'] for c in inspector.get_columns('event_registrations')]
    if 'ticket_code' not in er_cols:
        op.add_column(
            'event_registrations',
            sa.Column('ticket_code', sa.String(length=100), nullable=True)
        )


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    er_cols = [c['name'] for c in inspector.get_columns('event_registrations')]
    if 'ticket_code' in er_cols:
        op.drop_column('event_registrations', 'ticket_code')

    cols = [c['name'] for c in inspector.get_columns('placement_drives')]
    if 'college_id' in cols:
        op.drop_index('ix_placement_drives_college_id', table_name='placement_drives')
        op.drop_column('placement_drives', 'college_id')
