"""add_college_id_to_content_and_reports

Adds `college_id` FK column (nullable=False) to:
- `lecture_recordings`
- `syllabus_progress`
- `mock_interview_sessions`
- `mock_interview_bookings`
- `mentor_profiles`
- `mentorship_requests`
- `moderation_reports`

Backfills existing rows using joined user college_id where available, falling back to DEFAULT_COLLEGE_ID.

Revision ID: k6l7m8n9o0p1
Revises:     j5k6l7m8n9o0
Create Date: 2026-08-01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "k6l7m8n9o0p1"
down_revision = "j5k6l7m8n9o0"
branch_labels = None
depends_on = None

DEFAULT_COLLEGE_ID = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d"

TABLES_JOIN_MAP = [
    ("lecture_recordings", "uploaded_by_id"),
    ("syllabus_progress", "professor_id"),
    ("mock_interview_bookings", "student_id"),
    ("mentor_profiles", "user_id"),
    ("mentorship_requests", "student_id"),
    ("moderation_reports", "reporter_id"),
]


def upgrade():
    conn = op.get_bind()

    # 1. Add nullable college_id columns
    target_tables = [
        "lecture_recordings",
        "syllabus_progress",
        "mock_interview_sessions",
        "mock_interview_bookings",
        "mentor_profiles",
        "mentorship_requests",
        "moderation_reports",
    ]

    for table in target_tables:
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("college_id", sa.UUID(as_uuid=True), nullable=True, index=True)
            )

    # 2. Join-based backfills from users table
    for table, fk_col in TABLES_JOIN_MAP:
        update_sql = f"""
        UPDATE {table}
        SET college_id = (SELECT college_id FROM users WHERE users.id = {table}.{fk_col})
        WHERE college_id IS NULL AND {fk_col} IS NOT NULL
        """
        conn.execute(text(update_sql))

    # 3. Fallback backfill to DEFAULT_COLLEGE_ID for any remaining NULLs
    fallback_counts = {}
    for table in target_tables:
        fallback_sql = f"UPDATE {table} SET college_id = :default_id WHERE college_id IS NULL"
        res = conn.execute(text(fallback_sql), {"default_id": DEFAULT_COLLEGE_ID})
        row_count = res.rowcount if hasattr(res, "rowcount") else 0
        fallback_counts[table] = row_count
        print(f"[Migration k6l7m8n9o0p1] Table '{table}': {row_count} rows fell back to DEFAULT_COLLEGE_ID.")

    # 4. Alter columns to NOT NULL and create FKs
    for table in target_tables:
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.alter_column("college_id", existing_type=sa.UUID(as_uuid=True), nullable=False)
            batch_op.create_foreign_key(f"fk_{table}_college_id", "colleges", ["college_id"], ["id"])


def downgrade():
    target_tables = [
        "lecture_recordings",
        "syllabus_progress",
        "mock_interview_sessions",
        "mock_interview_bookings",
        "mentor_profiles",
        "mentorship_requests",
        "moderation_reports",
    ]

    for table in target_tables:
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.drop_constraint(f"fk_{table}_college_id", type_="foreignkey")
            batch_op.drop_index(f"ix_{table}_college_id")
            batch_op.drop_column("college_id")
