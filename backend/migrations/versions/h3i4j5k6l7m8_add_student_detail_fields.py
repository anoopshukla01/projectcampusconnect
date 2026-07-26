"""add_student_detail_fields

Adds admission detail columns (entrance_exam_type, entrance_rank,
quota_category), profile photo URL, and admin edit metadata JSON to
student_profiles. All columns are nullable so existing rows are unaffected
and no data migration is needed.

Revision ID: h3i4j5k6l7m8
Revises:     g2h3i4j5k6l7
Create Date: 2026-07-26
"""

from alembic import op
import sqlalchemy as sa

revision = "h3i4j5k6l7m8"
down_revision = "g2h3i4j5k6l7"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("student_profiles", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("entrance_exam_type", sa.String(50), nullable=True)
        )
        batch_op.add_column(
            sa.Column("entrance_rank", sa.Integer(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("quota_category", sa.String(50), nullable=True)
        )
        batch_op.add_column(
            sa.Column("profile_photo_url", sa.String(1000), nullable=True)
        )
        batch_op.add_column(
            sa.Column(
                "admin_edits_meta",
                sa.JSON(),
                nullable=True,
                comment="Per-section edit metadata: {section: {editor_id, edited_at}}",
            )
        )


def downgrade():
    with op.batch_alter_table("student_profiles", schema=None) as batch_op:
        batch_op.drop_column("admin_edits_meta")
        batch_op.drop_column("profile_photo_url")
        batch_op.drop_column("quota_category")
        batch_op.drop_column("entrance_rank")
        batch_op.drop_column("entrance_exam_type")
