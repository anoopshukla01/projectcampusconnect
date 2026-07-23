"""add_college_id_to_official_merchandise

Adds a nullable college_id FK to the official_merchandise table so each
college's admin can manage their own merchandise store independently.

Nullable (not NOT NULL) so existing rows are not broken on upgrade —
the application layer treats NULL as "legacy/global" and shows them to all
admins until they re-create items through the new UI which sets college_id.

Revision ID: g2h3i4j5k6l7
Revises: f1a2b3c4d5e6
Create Date: 2026-07-24
"""

from alembic import op
import sqlalchemy as sa

revision = "g2h3i4j5k6l7"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None

DEFAULT_COLLEGE_ID = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d"


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Add college_id column if not already present
    existing_cols = [c["name"] for c in inspector.get_columns("official_merchandise")]
    if "college_id" not in existing_cols:
        op.add_column(
            "official_merchandise",
            sa.Column(
                "college_id",
                sa.UUID(),
                sa.ForeignKey("colleges.id"),
                nullable=True,
            ),
        )
        op.create_index(
            "ix_official_merchandise_college_id",
            "official_merchandise",
            ["college_id"],
        )
        # Backfill existing rows to the default college so they are owned
        conn.execute(
            sa.text(
                "UPDATE official_merchandise SET college_id = :cid WHERE college_id IS NULL"
            ),
            {"cid": DEFAULT_COLLEGE_ID},
        )


def downgrade():
    op.drop_index("ix_official_merchandise_college_id", table_name="official_merchandise")
    op.drop_column("official_merchandise", "college_id")
