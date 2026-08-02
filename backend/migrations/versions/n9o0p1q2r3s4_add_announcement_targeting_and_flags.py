"""add_announcement_targeting_and_flags

Adds `target_audience`, `target_semester`, `is_pinned`, and `is_urgent` columns to `announcements`.

Revision ID: n9o0p1q2r3s4
Revises:     m8n9o0p1q2r3
Create Date: 2026-08-02
"""

from alembic import op
import sqlalchemy as sa

revision = "n9o0p1q2r3s4"
down_revision = "m8n9o0p1q2r3"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("announcements", schema=None) as batch_op:
        batch_op.add_column(sa.Column("target_audience", sa.String(length=50), nullable=True, server_default="everyone"))
        batch_op.add_column(sa.Column("target_semester", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")))
        batch_op.add_column(sa.Column("is_urgent", sa.Boolean(), nullable=False, server_default=sa.text("false")))


def downgrade():
    with op.batch_alter_table("announcements", schema=None) as batch_op:
        batch_op.drop_column("is_urgent")
        batch_op.drop_column("is_pinned")
        batch_op.drop_column("target_semester")
        batch_op.drop_column("target_audience")
