import pytest
from flask_jwt_extended import create_access_token
from app.extensions import db
from app.models.user import User, UserRole
from app.models.student import StudentProfile

@pytest.fixture
def test_users(db_session):
    # Setup test users for all roles
    student1 = User(phone="9999999901", role=UserRole.STUDENT, is_active=True)
    student1.set_password("StudentPassword1")
    db_session.add(student1)
    db_session.flush()

    profile1 = StudentProfile(
        user_id=student1.id,
        roll_no="CS202611",
        full_name="Alice Johnson",
        branch="Computer Science",
        batch_year=2026,
        semester=8,
        cgpa=9.5,
        dpdp_consent_given=True,
        profile_complete=True
    )
    db_session.add(profile1)

    student2 = User(phone="9999999902", role=UserRole.STUDENT, is_active=True)
    student2.set_password("StudentPassword2")
    db_session.add(student2)
    db_session.flush()

    profile2 = StudentProfile(
        user_id=student2.id,
        roll_no="CS202612",
        full_name="Bob Smith",
        branch="Information Technology",
        batch_year=2026,
        semester=8,
        cgpa=8.0,
        dpdp_consent_given=False, # Bob did not give DPDP consent
        profile_complete=True,
        hostel_address="Room 101, Hostel A"
    )
    db_session.add(profile2)

    admin = User(email="admin@college.edu.in", role=UserRole.ADMIN, is_active=True)
    admin.set_password("AdminPassword1")
    db_session.add(admin)

    tpo = User(email="tpo@college.edu.in", role=UserRole.PLACEMENT_CELL, is_active=True)
    tpo.set_password("TpoPassword1")
    db_session.add(tpo)

    db_session.commit()

    return {
        "student1": student1,
        "profile1": profile1,
        "student2": student2,
        "profile2": profile2,
        "admin": admin,
        "tpo": tpo
    }


def test_get_own_profile(client, test_users):
    token = create_access_token(identity=str(test_users["student1"].id), additional_claims={"role": "student"})
    resp = client.get("/api/v1/students/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json["roll_no"] == "CS202611"
    assert resp.json["full_name"] == "Alice Johnson"
    assert resp.json["phone"] == "9999999901"


def test_update_own_profile_immutable_metrics(client, test_users):
    token = create_access_token(identity=str(test_users["student1"].id), additional_claims={"role": "student"})

    # Update allowed fields
    update_data = {
        "full_name": "Alice Johnson Smith",
        "linkedin_url": "https://linkedin.com/in/alice"
    }
    resp = client.patch("/api/v1/students/me", json=update_data, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json["full_name"] == "Alice Johnson Smith"
    assert resp.json["linkedin_url"] == "https://linkedin.com/in/alice"

    # Attempt to update protected metrics
    protected_data = {
        "cgpa": 10.0,
        "active_backlogs": 5
    }
    resp = client.patch("/api/v1/students/me", json=protected_data, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 400
    assert "details" in resp.json


def test_idor_prevention_on_student_details(client, test_users):
    # Student 1 attempts to read Student 2
    token1 = create_access_token(identity=str(test_users["student1"].id), additional_claims={"role": "student"})
    profile2_id = str(test_users["profile2"].id)

    # Note: S3 endpoint is only accessible to admin/placement_cell, so student 1 gets 403 instantly
    resp = client.get(f"/api/v1/students/{profile2_id}", headers={"Authorization": f"Bearer {token1}"})
    assert resp.status_code == 403


def test_tpo_read_with_dpdp_sanitization(client, test_users):
    token_tpo = create_access_token(identity=str(test_users["tpo"].id), additional_claims={"role": "placement_cell"})

    # TPO reads Student 1 (DPDP Consent Given)
    profile1_id = str(test_users["profile1"].id)
    resp = client.get(f"/api/v1/students/{profile1_id}", headers={"Authorization": f"Bearer {token_tpo}"})
    assert resp.status_code == 200
    assert resp.json["cgpa"] == 9.5
    # Hostel address must be masked for TPO even if consent given
    assert "hostel_address" not in resp.json

    # TPO reads Student 2 (DPDP Consent NOT Given)
    profile2_id = str(test_users["profile2"].id)
    resp = client.get(f"/api/v1/students/{profile2_id}", headers={"Authorization": f"Bearer {token_tpo}"})
    assert resp.status_code == 200
    assert resp.json["cgpa"] is None
    assert resp.json["phone"] is None
    assert "hostel_address" not in resp.json


def test_admin_crud_student(client, test_users):
    token_admin = create_access_token(identity=str(test_users["admin"].id), additional_claims={"role": "admin"})
    profile2_id = str(test_users["profile2"].id)

    # Admin reads Bob
    resp = client.get(f"/api/v1/students/{profile2_id}", headers={"Authorization": f"Bearer {token_admin}"})
    assert resp.status_code == 200
    assert resp.json["cgpa"] == 8.0 # Admin sees all details regardless of consent

    # Admin updates Bob's cgpa & active backlogs
    update_data = {
        "cgpa": 8.5,
        "active_backlogs": 1
    }
    resp = client.patch(f"/api/v1/students/{profile2_id}", json=update_data, headers={"Authorization": f"Bearer {token_admin}"})
    assert resp.status_code == 200
    assert resp.json["cgpa"] == 8.5
    assert resp.json["active_backlogs"] == 1

    # Admin deletes Bob (soft delete)
    resp = client.delete(f"/api/v1/students/{profile2_id}", headers={"Authorization": f"Bearer {token_admin}"})
    assert resp.status_code == 200

    # Ensure profile is now deleted
    resp = client.get(f"/api/v1/students/{profile2_id}", headers={"Authorization": f"Bearer {token_admin}"})
    assert resp.status_code == 404


def test_get_student_applications_and_offers_endpoints(client, test_users):
    """Verify S7 applications list and S8 offers list endpoints with IDOR protection."""
    student1_user_id = str(test_users["student1"].id)
    student2_user_id = str(test_users["student2"].id)

    token1 = create_access_token(identity=student1_user_id, additional_claims={"role": "student"})
    token2 = create_access_token(identity=student2_user_id, additional_claims={"role": "student"})

    # Student 1 gets own applications (S7)
    resp = client.get(f"/api/v1/students/{student1_user_id}/applications", headers={"Authorization": f"Bearer {token1}"})
    assert resp.status_code == 200
    assert isinstance(resp.json, list)

    # Student 1 gets own offers (S8)
    resp = client.get(f"/api/v1/students/{student1_user_id}/offers", headers={"Authorization": f"Bearer {token1}"})
    assert resp.status_code == 200
    assert isinstance(resp.json, list)

    # Student 2 attempts IDOR to access Student 1's applications -> 403 Forbidden
    resp_idor = client.get(f"/api/v1/students/{student1_user_id}/applications", headers={"Authorization": f"Bearer {token2}"})
    assert resp_idor.status_code == 403

