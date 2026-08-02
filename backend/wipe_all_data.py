"""
wipe_all_data.py — Delete ALL rows from every table in dependency order.
Schema (tables/columns/constraints) is NOT touched.

Run from the backend/ directory:
    python wipe_all_data.py

Use --dry-run to see what would be deleted without executing:
    python wipe_all_data.py --dry-run

IMPORTANT: This is irreversible. Confirm row counts before running.
"""

import os
import sys
import argparse

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.extensions import db
from sqlalchemy import text

# ── Tables in dependency order (children BEFORE parents) ──────────────────────
# This ensures no FK constraint violations during DELETE.
TABLES_IN_ORDER = [
    # ── Session / auth tokens ─────────────────────────────────────────────
    "otp_tokens",
    "refresh_tokens",
    "invites",

    # ── Chat ──────────────────────────────────────────────────────────────
    "chat_messages",
    "student_blocks",
    "student_reports",
    "group_memberships",
    "conversations",

    # ── Academic (children first) ─────────────────────────────────────────
    "grade_revisions",
    "grades",
    "assignment_submissions",
    "assignments",
    "attendance_records",
    "timetable_bookings",
    "professor_checkins",
    "timetable_slots",
    "subjects",
    "grade_result_locks",
    "re_evaluation_requests",
    "professor_class_assignments",

    # ── Community ─────────────────────────────────────────────────────────
    "moderation_reports",
    "merchandise_orders",
    "official_merchandise",
    "admin_detail_requests",
    "event_registrations",
    "campus_events",
    "announcements",
    "marketplace_items",
    "lost_found_items",
    "study_notes",
    "library_requests",
    "library_resources",

    # ── Placement ─────────────────────────────────────────────────────────
    "eligibility_overrides",
    "branch_placements",
    "placement_offers",
    "drive_shortlists",
    "drive_applications",
    "placement_drives",
    "companies",

    # ── Career content ────────────────────────────────────────────────────
    "mock_interview_bookings",
    "mock_interview_sessions",
    "mentorship_requests",
    "mentor_profiles",
    "lecture_recordings",
    "syllabus_progress",

    # ── Notifications / audit / rules ─────────────────────────────────────
    "notifications",
    "system_rules",
    "audit_logs",

    # ── Profiles ──────────────────────────────────────────────────────────
    "student_resumes",
    "student_profiles",
    "professor_profiles",

    # ── Core auth ─────────────────────────────────────────────────────────
    "users",

    # ── Tenant root ───────────────────────────────────────────────────────
    "colleges",
]


def get_existing_tables(conn):
    """Return set of table names that actually exist in the DB."""
    result = conn.execute(text(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    ))
    return {row[0] for row in result}


def count_rows(conn, table):
    try:
        result = conn.execute(text(f'SELECT COUNT(*) FROM "{table}"'))
        return result.scalar()
    except Exception:
        return "N/A"


def wipe(dry_run=False):
    env = os.environ.get("FLASK_ENV", "production")
    app = create_app(env)

    with app.app_context():
        with db.engine.connect() as conn:
            existing = get_existing_tables(conn)

            print("\n── Pre-wipe row counts ────────────────────────────────────────")
            pre_counts = {}
            for table in TABLES_IN_ORDER:
                if table in existing:
                    n = count_rows(conn, table)
                    pre_counts[table] = n
                    if n and n != "N/A" and n > 0:
                        print(f"  {table:<45} {n:>6} rows")
                else:
                    pre_counts[table] = "SKIP (table not in DB)"

            total_rows = sum(v for v in pre_counts.values() if isinstance(v, int))
            print(f"\n  Total rows to delete: {total_rows}")

            if dry_run:
                print("\n  [DRY RUN] No data was deleted. Remove --dry-run to execute.\n")
                return

            if total_rows == 0:
                print("\n  ✅ Database is already empty. Nothing to delete.\n")
                return

            print("\n── Deleting rows ──────────────────────────────────────────────")
            # Use TRUNCATE ... CASCADE for reliability and speed
            # (faster than individual DELETEs, handles FK automatically)
            tables_to_truncate = [t for t in TABLES_IN_ORDER if t in existing]

            try:
                # Temporarily disable triggers during truncation for speed
                conn.execute(text("SET session_replication_role = 'replica'"))
                for table in tables_to_truncate:
                    conn.execute(text(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE'))
                    print(f"  ✓ Truncated  {table}")
                conn.execute(text("SET session_replication_role = 'origin'"))
                conn.commit()
                print("\n  ── All truncations committed ──")
            except Exception as e:
                conn.rollback()
                print(f"\n  ✗ Error during truncation: {e}")
                print("  Rolling back. No data was changed.")
                sys.exit(1)

            # ── Post-wipe verification ────────────────────────────────────
            print("\n── Post-wipe row counts (all must be 0) ──────────────────────")
            all_zero = True
            for table in tables_to_truncate:
                n = count_rows(conn, table)
                status = "✅" if n == 0 else "❌"
                print(f"  {status} {table:<45} {n:>6} rows")
                if n != 0:
                    all_zero = False

            if all_zero:
                print("\n  ✅ SUCCESS — Database is fully empty (0 rows in all tables).\n")
            else:
                print("\n  ❌ WARNING — Some tables still have rows. Review output above.\n")
                sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Wipe all data from Campus Connect database.")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted without executing.")
    args = parser.parse_args()
    wipe(dry_run=args.dry_run)
