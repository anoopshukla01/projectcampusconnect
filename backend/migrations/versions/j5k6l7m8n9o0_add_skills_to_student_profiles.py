"""add_skills_to_student_profiles

Adds the structured `skills` JSON column to `student_profiles`.
Nullable with server_default='[]' — existing rows get an empty list.
No data migration needed.

Revision ID: j5k6l7m8n9o0
Revises:     i4j5k6l7m8n9
Create Date: 2026-07-27
"""

from alembic import op
import sqlalchemy as sa

revision = "j5k6l7m8n9o0"
down_revision = "i4j5k6l7m8n9"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("student_profiles", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "skills",
                sa.JSON(),
                nullable=True,
                comment=(
                    "Structured skills list: "
                    "[{name, category: technical|soft, proficiency: beginner|intermediate|advanced}]"
                ),
            )
        )


def downgrade():
    with op.batch_alter_table("student_profiles", schema=None) as batch_op:
        batch_op.drop_column("skills")
