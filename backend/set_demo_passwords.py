"""
set_demo_passwords.py — Bulk-set a demo login password for all student accounts.

Run from the backend/ directory:
    python set_demo_passwords.py

This sets DEMO_PASSWORD on every User row whose role is 'student'.
Students can then log in with:
    email:    (whatever email was set during CSV import, or their registered email)
    roll_no:  their roll number  (if no email was set)
    password: Demo@Campus24

Safe to re-run — it is idempotent (just re-hashes the same password).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.extensions import db

DEMO_PASSWORD = "Demo@Campus24"


def run():
    env = os.environ.get("FLASK_ENV", "production")
    app = create_app(env)

    with app.app_context():
        from app.models.user import User, UserRole

        students = User.query.filter_by(role=UserRole.STUDENT).all()

        if not students:
            print("No student accounts found in the database.")
            return

        print(f"\nSetting demo password for {len(students)} student account(s)...\n")

        for u in students:
            u.set_password(DEMO_PASSWORD)
            label = u.email or f"(no email — user_id={u.id})"
            print(f"  ok  {label}")

        db.session.commit()

        print(f"\nDone. {len(students)} student(s) can now log in with:")
        print(f"    Password : {DEMO_PASSWORD}")
        print( "    Login    : use their email address OR roll number\n")


if __name__ == "__main__":
    run()
