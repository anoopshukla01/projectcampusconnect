"""add_multi_tenancy

Retrofit per-college data isolation (multi-tenancy) into the schema.

Steps performed (in this exact order to satisfy FK and NOT NULL constraints):
  1.  Create the `colleges` table.
  2.  Insert the initial college row for the existing single-tenant deployment.
  3.  Add `college_id` (nullable FK) to: users, student_profiles, professor_profiles,
      companies, branch_placements, subjects.
  4.  Backfill every existing row's college_id with the initial college's UUID.
  5.  Alter all six college_id columns to NOT NULL.
  6.  Drop old global unique constraints; add new composite unique constraints.

Revision ID: f1a2b3c4d5e6
Revises: e7f8a9b0c1d2
Create Date: 2026-07-20

SAFETY NOTE: Run against a dev DB snapshot first.
  Before: SELECT COUNT(*) FROM users;  -- record this
  After:  SELECT COUNT(*) FROM users;  -- must be identical (no rows dropped)
"""

import uuid as _uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# ---------------------------------------------------------------------------
# Revision identifiers
# ---------------------------------------------------------------------------
revision = "f1a2b3c4d5e6"
down_revision = "e7f8a9b0c1d2"
branch_labels = None
depends_on = None

# ---------------------------------------------------------------------------
# The initial college UUID is fixed so the downgrade can locate it exactly.
# Change this constant if you need a different UUID for the initial tenant.
# ---------------------------------------------------------------------------
DEFAULT_COLLEGE_ID = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d"
INITIAL_COLLEGE_NAME = "Campus Connect College"
INITIAL_COLLEGE_SLUG = "campus-connect-college"
INITIAL_COLLEGE_CODE = "CC2024"


def upgrade():
    conn = op.get_bind()

    # ── 1. Create colleges table ─────────────────────────────────────────────
    op.create_table(
        "colleges",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_college_name"),
        sa.UniqueConstraint("slug", name="uq_college_slug"),
        sa.UniqueConstraint("code", name="uq_college_code"),
    )

    # ── 2. Insert the initial college row ────────────────────────────────────
    conn.execute(
        text(
            "INSERT INTO colleges (id, name, slug, code, is_active, created_at) "
            "VALUES (:id, :name, :slug, :code, true, NOW())"
        ),
        {
            "id": DEFAULT_COLLEGE_ID,
            "name": INITIAL_COLLEGE_NAME,
            "slug": INITIAL_COLLEGE_SLUG,
            "code": INITIAL_COLLEGE_CODE,
        },
    )

    # ── 3. Add college_id (nullable) to the six tables ───────────────────────
    tables_needing_college_id = [
        "users",
        "student_profiles",
        "professor_profiles",
        "companies",
        "branch_placements",
        "subjects",
        "announcements",
        "campus_events",
        "marketplace_items",
        "lost_found_items",
        "study_notes",
        "library_resources",
    ]
    for table in tables_needing_college_id:
        op.add_column(
            table,
            sa.Column(
                "college_id",
                sa.UUID(),
                sa.ForeignKey("colleges.id"),
                nullable=True,
            ),
        )
        op.create_index(
            f"ix_{table}_college_id",
            table,
            ["college_id"],
        )

    # invites.college_id: nullable so existing invite rows without a college are preserved.
    # New invites issued post-migration MUST set college_id from g.current_user.college_id.
    op.add_column(
        "invites",
        sa.Column(
            "college_id",
            sa.UUID(),
            sa.ForeignKey("colleges.id"),
            nullable=True,
        ),
    )
    # Backfill existing invites with the initial college
    conn.execute(
        text("UPDATE invites SET college_id = :cid WHERE college_id IS NULL"),
        {"cid": DEFAULT_COLLEGE_ID},
    )

    # ── 4. Backfill all existing rows with the initial college's UUID ─────────
    # Each UPDATE is logged separately for auditability.
    for table in tables_needing_college_id:
        result = conn.execute(
            text(f"UPDATE {table} SET college_id = :cid WHERE college_id IS NULL"),
            {"cid": DEFAULT_COLLEGE_ID},
        )
        print(f"  [backfill] {table}: {result.rowcount} row(s) updated")

    # ── 5. Alter college_id columns to NOT NULL ───────────────────────────────
    for table in tables_needing_college_id:
        op.alter_column(table, "college_id", nullable=False)

    # ── 6. Drop old global unique constraints; add composite ones ─────────────

    # --- users: email and phone ---
    # The constraint names vary by database; use batch_alter_table for SQLite
    # compatibility in dev and explicit named drops for PostgreSQL in prod.
    with op.batch_alter_table("users") as batch_op:
        # Try to drop existing global unique constraints.
        # Names were auto-generated by SQLAlchemy; PostgreSQL names them
        # 'users_email_key' / 'users_phone_key' by convention.
        try:
            batch_op.drop_constraint("users_email_key", type_="unique")
        except Exception:
            pass  # constraint may already be gone or named differently
        try:
            batch_op.drop_constraint("users_phone_key", type_="unique")
        except Exception:
            pass
        batch_op.create_unique_constraint(
            "uq_college_user_email", ["college_id", "email"]
        )
        batch_op.create_unique_constraint(
            "uq_college_user_phone", ["college_id", "phone"]
        )

    # --- student_profiles: roll_no ---
    with op.batch_alter_table("student_profiles") as batch_op:
        try:
            batch_op.drop_constraint("student_profiles_roll_no_key", type_="unique")
        except Exception:
            pass
        batch_op.create_unique_constraint(
            "uq_college_roll_no", ["college_id", "roll_no"]
        )

    # --- professor_profiles: employee_id ---
    with op.batch_alter_table("professor_profiles") as batch_op:
        try:
            batch_op.drop_constraint(
                "professor_profiles_employee_id_key", type_="unique"
            )
        except Exception:
            pass
        batch_op.create_unique_constraint(
            "uq_college_employee_id", ["college_id", "employee_id"]
        )

    # --- companies: name ---
    with op.batch_alter_table("companies") as batch_op:
        try:
            batch_op.drop_constraint("companies_name_key", type_="unique")
        except Exception:
            pass
        batch_op.create_unique_constraint(
            "uq_college_company_name", ["college_id", "name"]
        )

    # --- branch_placements: branch ---
    with op.batch_alter_table("branch_placements") as batch_op:
        try:
            batch_op.drop_constraint("branch_placements_branch_key", type_="unique")
        except Exception:
            pass
        batch_op.create_unique_constraint(
            "uq_college_branch_placement", ["college_id", "branch"]
        )

    # --- subjects: code ---
    with op.batch_alter_table("subjects") as batch_op:
        try:
            batch_op.drop_constraint("subjects_code_key", type_="unique")
        except Exception:
            pass
        batch_op.create_unique_constraint(
            "uq_college_subject_code", ["college_id", "code"]
        )

    print("✅ add_multi_tenancy migration complete.")


def downgrade():
    """
    Reverse the migration.  Data loss warning: college_id columns are dropped,
    and the colleges table is dropped.  Run only against a dev environment with
    a full backup.
    """
    conn = op.get_bind()

    # Re-add global unique constraints
    with op.batch_alter_table("users") as batch_op:
        try:
            batch_op.drop_constraint("uq_college_user_email", type_="unique")
            batch_op.drop_constraint("uq_college_user_phone", type_="unique")
        except Exception:
            pass
        batch_op.create_unique_constraint("users_email_key", ["email"])
        batch_op.create_unique_constraint("users_phone_key", ["phone"])

    with op.batch_alter_table("student_profiles") as batch_op:
        try:
            batch_op.drop_constraint("uq_college_roll_no", type_="unique")
        except Exception:
            pass
        batch_op.create_unique_constraint(
            "student_profiles_roll_no_key", ["roll_no"]
        )

    with op.batch_alter_table("professor_profiles") as batch_op:
        try:
            batch_op.drop_constraint("uq_college_employee_id", type_="unique")
        except Exception:
            pass
        batch_op.create_unique_constraint(
            "professor_profiles_employee_id_key", ["employee_id"]
        )

    with op.batch_alter_table("companies") as batch_op:
        try:
            batch_op.drop_constraint("uq_college_company_name", type_="unique")
        except Exception:
            pass
        batch_op.create_unique_constraint("companies_name_key", ["name"])

    with op.batch_alter_table("branch_placements") as batch_op:
        try:
            batch_op.drop_constraint("uq_college_branch_placement", type_="unique")
        except Exception:
            pass
        batch_op.create_unique_constraint(
            "branch_placements_branch_key", ["branch"]
        )

    with op.batch_alter_table("subjects") as batch_op:
        try:
            batch_op.drop_constraint("uq_college_subject_code", type_="unique")
        except Exception:
            pass
        batch_op.create_unique_constraint("subjects_code_key", ["code"])

    # Drop college_id columns
    tables = [
        "subjects",
        "branch_placements",
        "companies",
        "professor_profiles",
        "student_profiles",
        "users",
    ]
    for table in tables:
        op.drop_index(f"ix_{table}_college_id", table_name=table)
        op.drop_column(table, "college_id")

    # Drop the colleges table last (FK dependencies removed above)
    op.drop_table("colleges")
