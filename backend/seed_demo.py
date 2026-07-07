"""
seed_demo.py — Create 4 demo users for local development / demo purposes.

Run from the backend/ directory:
    python seed_demo.py

This is IDEMPOTENT — running it twice will skip users that already exist.

Demo accounts created:
  Role           Email / Login ID          Password
  ─────────────────────────────────────────────────────
  Student        student@college.edu.in    Demo@1234  (also: roll_no CS21DEMO01)
  Professor      professor@college.edu.in  Demo@1234
  TPO/Placement  tpo@college.edu.in        Demo@1234
  Admin          admin@college.edu.in      Demo@1234
"""

import os
import sys

# ── Ensure the backend/ directory is on the path ──────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.extensions import db
from app.models.user import User, UserRole
from app.models.student import StudentProfile
from app.models.professor import ProfessorProfile, ApprovalStatus

DEMO_PASSWORD = "Demo@1234"

DEMO_USERS = [
    {
        "email":    "student@college.edu.in",
        "role":     UserRole.STUDENT,
        "profile": {
            "roll_no":    "CS21DEMO01",
            "full_name":  "Arjun Mehta (Demo Student)",
            "branch":     "Computer Science",
            "batch_year": 2021,
            "semester":   6,
            "cgpa":       8.45,
            "attendance_pct": 87.5,
            "active_backlogs": 0,
            "dpdp_consent_given": True,
            "profile_complete": True,
        },
    },
    {
        "email":    "professor@college.edu.in",
        "role":     UserRole.PROFESSOR,
        "profile": {
            "employee_id":  "EMP-DEMO01",
            "full_name":    "Dr. Priya Sharma (Demo Professor)",
            "department":   "Computer Science",
            "designation":  "Associate Professor",
            "approval_status": ApprovalStatus.APPROVED,
        },
    },
    {
        "email":    "tpo@college.edu.in",
        "role":     UserRole.PLACEMENT_CELL,
        "profile":  None,   # no extra profile table for TPO/Admin
    },
    {
        "email":    "admin@college.edu.in",
        "role":     UserRole.ADMIN,
        "profile":  None,
    },
]


def seed():
    app = create_app("development")
    with app.app_context():
        created = []
        skipped = []

        for spec in DEMO_USERS:
            email = spec["email"]
            existing = db.session.query(User).filter_by(email=email).first()
            if existing:
                skipped.append(email)
                continue

            user = User(
                email=email,
                role=spec["role"],
                is_active=True,
            )
            user.set_password(DEMO_PASSWORD)
            db.session.add(user)
            db.session.flush()   # get user.id before profile insert

            prof = spec.get("profile")
            if prof and spec["role"] == UserRole.STUDENT:
                from datetime import datetime, timezone
                sp = StudentProfile(
                    user_id=user.id,
                    roll_no=prof["roll_no"],
                    full_name=prof["full_name"],
                    branch=prof["branch"],
                    batch_year=prof["batch_year"],
                    semester=prof["semester"],
                    cgpa=prof["cgpa"],
                    attendance_pct=prof["attendance_pct"],
                    active_backlogs=prof["active_backlogs"],
                    dpdp_consent_given=prof["dpdp_consent_given"],
                    dpdp_consent_at=datetime.now(timezone.utc),
                    profile_complete=prof["profile_complete"],
                )
                db.session.add(sp)

            elif prof and spec["role"] == UserRole.PROFESSOR:
                pp = ProfessorProfile(
                    user_id=user.id,
                    employee_id=prof["employee_id"],
                    full_name=prof["full_name"],
                    department=prof["department"],
                    designation=prof["designation"],
                    approval_status=prof["approval_status"],
                )
                db.session.add(pp)

            created.append(email)

        db.session.commit()

        print("\n── Demo Seed Results ─────────────────────────────────────────")
        if created:
            print(f"  ✅ Created  ({len(created)}): " + ", ".join(created))
        if skipped:
            print(f"  ⏭  Skipped  ({len(skipped)}): " + ", ".join(skipped))
        print()
        print("  Demo Credentials (all roles):")
        print("  ┌──────────────────────────────────┬──────────────────────────────────┬───────────┐")
        print("  │ Role                             │ Email / Login                    │ Password  │")
        print("  ├──────────────────────────────────┼──────────────────────────────────┼───────────┤")
        print("  │ Student                          │ student@college.edu.in           │ Demo@1234 │")
        print("  │                                  │   or roll_no: CS21DEMO01         │           │")
        print("  │ Professor                        │ professor@college.edu.in         │ Demo@1234 │")
        print("  │ TPO / Placement Cell             │ tpo@college.edu.in              │ Demo@1234 │")
        print("  │ Admin                            │ admin@college.edu.in             │ Demo@1234 │")
        print("  └──────────────────────────────────┴──────────────────────────────────┴───────────┘")
        print()


if __name__ == "__main__":
    seed()
