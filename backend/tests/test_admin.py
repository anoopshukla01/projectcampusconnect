import pytest
from flask_jwt_extended import create_access_token
from app.extensions import db
from app.models.user import User, UserRole
from app.models.professor import ProfessorProfile, ApprovalStatus
from app.models.student import StudentProfile
from app.models.placement import PlacementDrive, PlacementOffer, OfferStatus, DriveType, DriveStatus
from datetime import date, datetime, timezone, timedelta

@pytest.fixture
def admin_test_context(db_session):
    # Setup test database records for admin tests
    admin = User(email="admin@college.edu.in", role=UserRole.ADMIN, is_active=True)
    admin.set_password("AdminPassword1")
    db_session.add(admin)

    student1 = User(phone="9999999901", role=UserRole.STUDENT, is_active=True)
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

    prof = User(email="prof@college.edu.in", role=UserRole.PROFESSOR, is_active=False)
    prof.set_password("ProfPassword1")
    db_session.add(prof)
    db_session.flush()

    prof_profile = ProfessorProfile(
        user_id=prof.id,
        employee_id="EMP9988",
        full_name="Dr. Hopper",
        department="Mathematics",
        designation="Professor",
        approval_status=ApprovalStatus.PENDING
    )
    db_session.add(prof_profile)

    # Setup drives and offers for analytics test
    tpo = User(email="tpo@college.edu.in", role=UserRole.PLACEMENT_CELL, is_active=True)
    db_session.add(tpo)
    db_session.flush()

    drive = PlacementDrive(
        company_name="Google",
        role_title="Software Engineer",
        drive_type=DriveType.FULL_TIME,
        batch_year=2026,
        cgpa_cutoff=8.5,
        backlog_cutoff=0,
        drive_date=date(datetime.now(timezone.utc).year, 10, 10),
        registration_deadline=datetime.now(timezone.utc) + timedelta(days=5),
        ctc_offered="₹35 LPA",
        status=DriveStatus.ACTIVE,
        one_offer_lock=True,
        created_by=tpo.id
    )
    db_session.add(drive)
    db_session.flush()

    offer = PlacementOffer(
        drive_id=drive.id,
        student_id=student1.id,
        ctc_offered="₹35 LPA",
        status=OfferStatus.ACCEPTED,
        offer_date=date(datetime.now(timezone.utc).year, 10, 11)
    )
    db_session.add(offer)

    db_session.commit()

    return {
        "admin": admin,
        "student1": student1,
        "prof": prof,
        "prof_profile": prof_profile,
        "tpo": tpo
    }


def test_list_users_as_admin(client, admin_test_context):
    token = create_access_token(identity=str(admin_test_context["admin"].id), additional_claims={"role": "admin"})
    resp = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json["total"] >= 4  # admin, student, prof, tpo


def test_student_cannot_list_users(client, admin_test_context):
    token = create_access_token(identity=str(admin_test_context["student1"].id), additional_claims={"role": "student"})
    resp = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_faculty_approval_workflow(client, admin_test_context):
    token = create_access_token(identity=str(admin_test_context["admin"].id), additional_claims={"role": "admin"})
    prof_id = str(admin_test_context["prof_profile"].id)

    # Approve
    resp = client.post(f"/api/v1/admin/faculty/approve/{prof_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "approved" in resp.json["message"]

    prof = admin_test_context["prof"]
    assert prof.is_active is True
    assert prof.professor_profile.approval_status == ApprovalStatus.APPROVED


def test_invite_generation_flow(client, admin_test_context):
    token = create_access_token(identity=str(admin_test_context["admin"].id), additional_claims={"role": "admin"})
    invite_data = {
        "email": "another_tpo@college.edu.in",
        "role": "placement_cell"
    }
    resp = client.post("/api/v1/admin/invites", json=invite_data, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    assert "token" in resp.json


def test_placement_analytics(client, admin_test_context):
    token = create_access_token(identity=str(admin_test_context["admin"].id), additional_claims={"role": "admin"})
    resp = client.get("/api/v1/admin/analytics/placement", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json["placements_this_year"] == 1
    assert resp.json["avg_package_lpa"] == 35.0
    assert len(resp.json["branch_performance"]) > 0
    assert resp.json["branch_performance"][0]["branch"] == "Computer Science"
    assert resp.json["branch_performance"][0]["placement_pct"] == 100.0


def test_profile_compliance_analytics(client, admin_test_context):
    token = create_access_token(identity=str(admin_test_context["admin"].id), additional_claims={"role": "admin"})
    resp = client.get("/api/v1/admin/analytics/profiles", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json["total_students"] == 1
    assert resp.json["dpdp_compliance"]["consent_pct"] == 100.0


def test_audit_logs_actor_id_validation(client, admin_test_context):
    """Verify list audit logs validates actor_id UUID formatting safely."""
    token = create_access_token(identity=str(admin_test_context["admin"].id), additional_claims={"role": "admin"})
    
    # Passing invalid UUID string returns 400
    resp_invalid = client.get("/api/v1/admin/audit-logs?actor_id=invalid-uuid", headers={"Authorization": f"Bearer {token}"})
    assert resp_invalid.status_code == 400
    assert "Invalid actor_id format" in resp_invalid.json["error"]

    # Passing valid UUID string returns 200
    valid_uuid = str(admin_test_context["admin"].id)
    resp_valid = client.get(f"/api/v1/admin/audit-logs?actor_id={valid_uuid}", headers={"Authorization": f"Bearer {token}"})
    assert resp_valid.status_code == 200
    assert "logs" in resp_valid.json


def test_add_and_list_subjects_as_admin(client, admin_test_context):
    token = create_access_token(identity=str(admin_test_context["admin"].id), additional_claims={"role": "admin"})
    
    # Add subject
    resp = client.post("/api/v1/admin/subjects", json={
        "name": "Database Management Systems",
        "code": "CS3030",
        "branch": "Computer Science"
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    assert "Successfully added subject" in resp.json["message"]
    
    # List subjects
    resp_list = client.get("/api/v1/admin/subjects", headers={"Authorization": f"Bearer {token}"})
    assert resp_list.status_code == 200
    assert len(resp_list.json["subjects"]) >= 1
    assert resp_list.json["subjects"][0]["code"] == "CS3030"


def test_add_branch_placement_as_admin(client, admin_test_context):
    token = create_access_token(identity=str(admin_test_context["admin"].id), additional_claims={"role": "admin"})
    
    # Add branch placement override
    resp = client.post("/api/v1/admin/branch-placements", json={
        "branch": "Computer Science",
        "placed_count": 42,
        "total_count": 100
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "placement override" in resp.json["message"].lower()
    
    # Verify override is reflected in placement analytics
    resp_analytics = client.get("/api/v1/admin/analytics/placement", headers={"Authorization": f"Bearer {token}"})
    assert resp_analytics.status_code == 200
    cs_stat = next(b for b in resp_analytics.json["branch_performance"] if b["branch"] == "Computer Science")
    assert cs_stat["placed_students"] == 42
    assert cs_stat["total_students"] == 100
    assert cs_stat["placement_pct"] == 42.0

