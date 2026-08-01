"""add_college_id_to_timetable_slots

Adds `college_id` (nullable=False) column to `timetable_slots`.
Backfills `college_id` using joined user college_id from `user_id`, falling back to DEFAULT_COLLEGE_ID.

Revision ID: m8n9o0p1q2r3
Revises:     l7m8n9o0p1q2
Create Date: 2026-08-01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "m8n9o0p1q2r3"
down_revision = "l7m8n9o0p1q2"
branch_labels = None
depends_on = None

DEFAULT_COLLEGE_ID = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d"


def upgrade():
    conn = op.get_bind()

    # 1. Add nullable college_id column
    with op.batch_alter_table("timetable_slots", schema=None) as batch_op:
        batch_op.add_column(sa.Column("college_id", sa.UUID(as_uuid=True), nullable=True, index=True))

    # 2. Backfill college_id from users table using user_id
    update_sql = """
    UPDATE timetable_slots
    SET college_id = (SELECT college_id FROM users WHERE users.id = timetable_slots.user_id)
    WHERE college_id IS NULL AND user_id IS NOT NULL
    """
    conn.execute(text(update_sql))

    # 3. Fallback backfill to DEFAULT_COLLEGE_ID for any remaining NULLs
    fallback_sql = "UPDATE timetable_slots SET college_id = :default_id WHERE college_id IS NULL"
    res = conn.execute(text(fallback_sql), {"default_id": DEFAULT_COLLEGE_ID})
    row_count = res.rowcount if hasattr(res, "rowcount") else 0
    print(f"[Migration m8n9o0p1q2r3] Table 'timetable_slots': {row_count} rows fell back to DEFAULT_COLLEGE_ID.")

    # 4. Alter college_id column to NOT NULL and create FK
    with op.batch_alter_table("timetable_slots", schema=None) as batch_op:
        batch_op.alter_column("college_id", existing_type=sa.UUID(as_uuid=True), nullable=False)
        batch_op.create_foreign_key("fk_timetable_slots_college_id", "colleges", ["college_id"], ["id"])


def downgrade():
    with op.batch_alter_table("timetable_slots", schema=None) as batch_op:
        batch_op.drop_constraint("fk_timetable_slots_college_id", type_="foreignkey")
        batch_op.drop_index("ix_timetable_slots_college_id")
        batch_op.drop_column("college_id")
