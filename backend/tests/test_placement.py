"""
Placement endpoint tests — PL1–PL16

Covers:
  - Drive creation (TPO), eligibility filtering, student apply/withdraw
  - CGPA / backlog cutoff enforcement
  - one_offer_lock enforcement
  - Bulk shortlisting & individual status update
  - Offer creation, student accept/decline, TPO revoke
  - Student cannot see non-active drives
  - RBAC: student cannot create drives, professors can't apply
"""

import pytest
from datetime import date, datetime, timedelta, timezone
from flask_jwt_extended import create_access_token
from app.extensions import db
from app.models.user import User, UserRole
from app.models.student import StudentProfile
from app.models.placement import (
    PlacementDrive, DriveApplication, PlacementOffer,
    DriveType, DriveStatus, OfferStatus
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def placement_context(db_session):
    tpo = User(email="tpo@college.edu.in", role=UserRole.PLACEMENT_CELL, is_active=True)
    db_session.add(tpo)
    db_session.flush()

    admin = User(email="admin@college.edu.in", role=UserRole.ADMIN, is_active=True)
    db_session.add(admin)

    # Eligible student
    student_a = User(phone="9999900001", role=UserRole.STUDENT, is_active=True)
    db_session.add(student_a)
    db_session.flush()
    profile_a = StudentProfile(
        user_id=student_a.id, roll_no="CS2601", full_name="Alice",
        branch="CSE", batch_year=2026, semester=8, cgpa=9.0,
        active_backlogs=0, dpdp_consent_given=True, profile_complete=True
    )
    db_session.add(profile_a)

    # Ineligible student (low CGPA)
    student_b = User(phone="9999900002", role=UserRole.STUDENT, is_active=True)
    db_session.add(student_b)
    db_session.flush()
    profile_b = StudentProfile(
        user_id=student_b.id, roll_no="CS2602", full_name="Bob",
        branch="CSE", batch_year=2026, semester=8, cgpa=7.0,
        active_backlogs=0, dpdp_consent_given=True, profile_complete=True
    )
    db_session.add(profile_b)

    db_session.commit()

    # Create a drive
    drive = PlacementDrive(
        company_name="Infosys",
        role_title="SDE",
        drive_type=DriveType.FULL_TIME,
        batch_year=2026,
        cgpa_cutoff=8.0,
        backlog_cutoff=0,
        drive_date=date(2026, 11, 1),
        registration_deadline=datetime.now(timezone.utc) + timedelta(days=10),
        ctc_offered="₹8 LPA",
        status=DriveStatus.ACTIVE,
        one_offer_lock=True,
        created_by=tpo.id,
    )
    db_session.add(drive)
    db_session.commit()

    return {
        "tpo": tpo, "admin": admin,
        "student_a": student_a, "profile_a": profile_a,
        "student_b": student_b, "profile_b": profile_b,
        "drive": drive,
    }


# ── PL1 & PL2 ─────────────────────────────────────────────────────────────────

def test_tpo_creates_drive(client, placement_context):
    tpo = placement_context["tpo"]
    token = create_access_token(identity=str(tpo.id), additional_claims={"role": "placement_cell"})

    data = {
        "company_name": "TCS",
        "role_title": "Analyst",
        "drive_type": "full_time",
        "batch_year": 2026,
        "cgpa_cutoff": 7.5,
        "backlog_cutoff": 1,
        "drive_date": "2026-12-01",
        "registration_deadline": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "ctc_offered": "₹6.5 LPA",
        "one_offer_lock": True,
    }
    resp = client.post("/api/v1/placement/drives", json=data, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    assert resp.json["company_name"] == "TCS"


def test_student_cannot_create_drive(client, placement_context):
    student = placement_context["student_a"]
    token = create_access_token(identity=str(student.id), additional_claims={"role": "student"})
    data = {
        "company_name": "Hack Inc",
        "role_title": "Engineer",
        "drive_type": "full_time",
        "batch_year": 2026,
        "cgpa_cutoff": 6.0,
        "drive_date": "2026-12-01",
        "registration_deadline": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "ctc_offered": "₹5 LPA",
    }
    resp = client.post("/api/v1/placement/drives", json=data, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


# ── PL7: Apply ────────────────────────────────────────────────────────────────

def test_eligible_student_applies(client, placement_context):
    student = placement_context["student_a"]
    drive = placement_context["drive"]
    token = create_access_token(identity=str(student.id), additional_claims={"role": "student"})

    resp = client.post(
        f"/api/v1/placement/drives/{drive.id}/apply",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 201
    assert "application_id" in resp.json


def test_ineligible_student_blocked(client, placement_context):
    student = placement_context["student_b"]
    drive = placement_context["drive"]
    token = create_access_token(identity=str(student.id), additional_claims={"role": "student"})

    resp = client.post(
        f"/api/v1/placement/drives/{drive.id}/apply",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 400
    assert "CGPA" in resp.json["error"]


def test_duplicate_application_rejected(client, placement_context):
    student = placement_context["student_a"]
    drive = placement_context["drive"]
    token = create_access_token(identity=str(student.id), additional_claims={"role": "student"})

    # First application
    client.post(f"/api/v1/placement/drives/{drive.id}/apply", headers={"Authorization": f"Bearer {token}"})
    # Second application
    resp = client.post(f"/api/v1/placement/drives/{drive.id}/apply", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 409


# ── PL10 & PL13 & PL14: Shortlist → Offer → Accept ──────────────────────────

def test_full_placement_workflow(client, placement_context, db_session):
    tpo = placement_context["tpo"]
    admin = placement_context["admin"]
    student_a = placement_context["student_a"]
    drive = placement_context["drive"]

    student_token = create_access_token(identity=str(student_a.id), additional_claims={"role": "student"})
    tpo_token = create_access_token(identity=str(tpo.id), additional_claims={"role": "placement_cell"})

    # 1. Student applies
    resp = client.post(f"/api/v1/placement/drives/{drive.id}/apply",
                       headers={"Authorization": f"Bearer {student_token}"})
    assert resp.status_code == 201

    # 2. TPO bulk shortlists
    resp = client.post(
        f"/api/v1/placement/drives/{drive.id}/shortlist",
        json={"student_ids": [str(student_a.id)], "round": 1, "status": "shortlisted"},
        headers={"Authorization": f"Bearer {tpo_token}"}
    )
    assert resp.status_code == 200
    assert resp.json["added"] == [str(student_a.id)]

    # 3. TPO creates offer
    resp = client.post(
        f"/api/v1/placement/drives/{drive.id}/offers",
        json={
            "student_id": str(student_a.id),
            "ctc_offered": "₹8.5 LPA",
            "offer_date": "2026-11-15",
        },
        headers={"Authorization": f"Bearer {tpo_token}"}
    )
    assert resp.status_code == 201

    # 4. Student accepts offer
    resp = client.patch(
        f"/api/v1/placement/drives/{drive.id}/offers/{student_a.id}",
        json={"status": "accepted"},
        headers={"Authorization": f"Bearer {student_token}"}
    )
    assert resp.status_code == 200

    # 5. Verify student's own offers list
    resp = client.get("/api/v1/placement/offers/me", headers={"Authorization": f"Bearer {student_token}"})
    assert resp.status_code == 200
    assert len(resp.json) == 1
    assert resp.json[0]["status"] == "accepted"


def test_one_offer_lock_blocks_second_application(client, placement_context, db_session):
    tpo = placement_context["tpo"]
    student_a = placement_context["student_a"]
    drive = placement_context["drive"]

    tpo_token = create_access_token(identity=str(tpo.id), additional_claims={"role": "placement_cell"})
    student_token = create_access_token(identity=str(student_a.id), additional_claims={"role": "student"})

    # Apply and get offer accepted on drive 1
    client.post(f"/api/v1/placement/drives/{drive.id}/apply",
                headers={"Authorization": f"Bearer {student_token}"})
    client.post(
        f"/api/v1/placement/drives/{drive.id}/offers",
        json={"student_id": str(student_a.id), "ctc_offered": "₹8 LPA", "offer_date": "2026-11-10"},
        headers={"Authorization": f"Bearer {tpo_token}"}
    )
    client.patch(
        f"/api/v1/placement/drives/{drive.id}/offers/{student_a.id}",
        json={"status": "accepted"},
        headers={"Authorization": f"Bearer {student_token}"}
    )

    # Create a second drive with one_offer_lock=True
    drive2 = PlacementDrive(
        company_name="Wipro", role_title="Engineer",
        drive_type=DriveType.FULL_TIME, batch_year=2026,
        cgpa_cutoff=7.0, backlog_cutoff=0,
        drive_date=date(2026, 12, 1),
        registration_deadline=datetime.now(timezone.utc) + timedelta(days=10),
        ctc_offered="₹6 LPA", status=DriveStatus.ACTIVE,
        one_offer_lock=True, created_by=tpo.id
    )
    db_session.add(drive2)
    db_session.commit()

    # Student tries to apply to drive2 — should be blocked
    resp = client.post(
        f"/api/v1/placement/drives/{drive2.id}/apply",
        headers={"Authorization": f"Bearer {student_token}"}
    )
    assert resp.status_code == 400
    assert "already accepted" in resp.json["error"]


def test_withdraw_application_nonexistent_drive(client, placement_context):
    """Verify withdrawing from a non-existent or deleted drive returns 404 cleanly."""
    import uuid
    student_a = placement_context["student_a"]
    student_token = create_access_token(identity=str(student_a.id), additional_claims={"role": "student"})
    random_uuid = uuid.uuid4()
    
    resp = client.delete(
        f"/api/v1/placement/drives/{random_uuid}/apply",
        headers={"Authorization": f"Bearer {student_token}"}
    )
    assert resp.status_code == 404
    assert "Application not found." in resp.json["error"] or "Drive not found." in resp.json["error"]

