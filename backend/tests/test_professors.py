import pytest
from flask_jwt_extended import create_access_token
from app.extensions import db
from app.models.user import User, UserRole
from app.models.professor import ProfessorProfile, ApprovalStatus

from app.models.college import DEFAULT_COLLEGE_ID

@pytest.fixture
def test_prof_users(db_session):
    # Setup test users for professor tests
    prof1 = User(college_id=DEFAULT_COLLEGE_ID, email="prof1@college.edu.in", role=UserRole.PROFESSOR, is_active=True)
    prof1.set_password("ProfPassword1")
    db_session.add(prof1)
    db_session.flush()

    profile1 = ProfessorProfile(
        user_id=prof1.id,
        employee_id="EMP1122",
        full_name="Dr. Alan Turing",
        department="Computer Science",
        designation="Professor",
        publications_count=15,
        approval_status=ApprovalStatus.APPROVED
    )
    db_session.add(profile1)

    prof2 = User(college_id=DEFAULT_COLLEGE_ID, email="prof2@college.edu.in", role=UserRole.PROFESSOR, is_active=False) # pending approval
    prof2.set_password("ProfPassword2")
    db_session.add(prof2)
    db_session.flush()

    profile2 = ProfessorProfile(
        user_id=prof2.id,
        employee_id="EMP3344",
        full_name="Dr. Grace Hopper",
        department="Mathematics",
        designation="Assistant Professor",
        publications_count=8,
        approval_status=ApprovalStatus.PENDING
    )
    db_session.add(profile2)

    admin = User(college_id=DEFAULT_COLLEGE_ID, email="admin@college.edu.in", role=UserRole.ADMIN, is_active=True)
    admin.set_password("AdminPassword1")
    db_session.add(admin)

    student = User(college_id=DEFAULT_COLLEGE_ID, phone="9999999999", role=UserRole.STUDENT, is_active=True)
    student.set_password("StudentPassword1")
    db_session.add(student)

    db_session.commit()

    return {
        "prof1": prof1,
        "profile1": profile1,
        "prof2": prof2,
        "profile2": profile2,
        "admin": admin,
        "student": student
    }


def test_get_own_professor_profile(client, test_prof_users):
    token = create_access_token(identity=str(test_prof_users["prof1"].id), additional_claims={"role": "professor"})
    resp = client.get("/api/v1/professors/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json["employee_id"] == "EMP1122"
    assert resp.json["full_name"] == "Dr. Alan Turing"
    assert resp.json["email"] == "prof1@college.edu.in"


def test_update_own_professor_profile_immutable_fields(client, test_prof_users):
    token = create_access_token(identity=str(test_prof_users["prof1"].id), additional_claims={"role": "professor"})

    # Update allowed fields
    update_data = {
        "full_name": "Dr. Alan Turing Sr.",
        "publications_count": 16
    }
    resp = client.patch("/api/v1/professors/me", json=update_data, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json["full_name"] == "Dr. Alan Turing Sr."
    assert resp.json["publications_count"] == 16

    # Attempt to update protected fields
    protected_data = {
        "employee_id": "EMP9999",
        "approval_status": "approved"
    }
    resp = client.patch("/api/v1/professors/me", json=protected_data, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 400
    assert "details" in resp.json


def test_student_blocked_from_professors_api(client, test_prof_users):
    token_stud = create_access_token(identity=str(test_prof_users["student"].id), additional_claims={"role": "student"})

    resp = client.get("/api/v1/professors", headers={"Authorization": f"Bearer {token_stud}"})
    assert resp.status_code == 403

    profile1_id = str(test_prof_users["profile1"].id)
    resp = client.get(f"/api/v1/professors/{profile1_id}", headers={"Authorization": f"Bearer {token_stud}"})
    assert resp.status_code == 403


def test_admin_approve_and_activate_professor(client, test_prof_users):
    token_admin = create_access_token(identity=str(test_prof_users["admin"].id), additional_claims={"role": "admin"})
    profile2_id = str(test_prof_users["profile2"].id)

    # Admin approves Grace Hopper
    update_data = {
        "approval_status": "approved"
    }
    resp = client.patch(f"/api/v1/professors/{profile2_id}", json=update_data, headers={"Authorization": f"Bearer {token_admin}"})
    assert resp.status_code == 200
    assert resp.json["approval_status"] == "approved"

    # Verify database model reflects approval and auto-activation
    user2 = test_prof_users["prof2"]
    assert user2.is_active is True
    assert user2.professor_profile.approved_by is not None
    assert user2.professor_profile.approved_at is not None


def test_admin_delete_professor(client, test_prof_users):
    token_admin = create_access_token(identity=str(test_prof_users["admin"].id), additional_claims={"role": "admin"})
    profile1_id = str(test_prof_users["profile1"].id)

    resp = client.delete(f"/api/v1/professors/{profile1_id}", headers={"Authorization": f"Bearer {token_admin}"})
    assert resp.status_code == 200

    # Ensure profile soft-deleted
    resp = client.get(f"/api/v1/professors/{profile1_id}", headers={"Authorization": f"Bearer {token_admin}"})
    assert resp.status_code == 404
