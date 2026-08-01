import pytest
from flask_jwt_extended import create_access_token
from app.extensions import db
from app.models.user import User, UserRole
from app.models.professor import ProfessorProfile, ApprovalStatus
from app.models.student import StudentProfile
from app.models.placement import PlacementDrive, PlacementOffer, OfferStatus, DriveType, DriveStatus
from datetime import date, datetime, timezone, timedelta

from app.models.college import DEFAULT_COLLEGE_ID

@pytest.fixture
def admin_test_context(db_session):
    # Setup test database records for admin tests
    admin = User(college_id=DEFAULT_COLLEGE_ID, email="admin@college.edu.in", role=UserRole.ADMIN, is_active=True)
    admin.set_password("AdminPassword1")
    db_session.add(admin)

    student1 = User(college_id=DEFAULT_COLLEGE_ID, phone="9999999901", role=UserRole.STUDENT, is_active=True)
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

    prof = User(college_id=DEFAULT_COLLEGE_ID, email="prof@college.edu.in", role=UserRole.PROFESSOR, is_active=False)
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
    tpo = User(college_id=DEFAULT_COLLEGE_ID, email="tpo@college.edu.in", role=UserRole.PLACEMENT_CELL, is_active=True)
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


def test_add_branch_as_admin(client, admin_test_context):
    token = create_access_token(identity=str(admin_test_context["admin"].id), additional_claims={"role": "admin"})
    
    # Add branch
    resp = client.post("/api/v1/admin/branches", json={
        "branch": "Civil Engineering"
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201
    assert "Successfully added branch" in resp.json["message"]
    
    # Verify it is returned in placement analytics
    resp_analytics = client.get("/api/v1/admin/analytics/placement", headers={"Authorization": f"Bearer {token}"})
    assert resp_analytics.status_code == 200
    civil_stat = next(b for b in resp_analytics.json["branch_performance"] if b["branch"] == "Civil Engineering")
    assert civil_stat["placed_students"] == 0
    assert civil_stat["total_students"] == 0


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


def test_admin_summary(client, admin_test_context):
    token = create_access_token(identity=str(admin_test_context["admin"].id), additional_claims={"role": "admin"})
    resp = client.get("/api/v1/admin/summary", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "total_students" in resp.json
    assert "total_faculty" in resp.json


def test_admin_delete_rule(client, admin_test_context):
    from app.models.rule import SystemRule
    token = create_access_token(identity=str(admin_test_context["admin"].id), additional_claims={"role": "admin"})
    
    # Pre-add a rule
    rule = SystemRule(id="test_rule_1", section="eligibility", label="Test Rule", value="10")
    db.session.add(rule)
    db.session.commit()

    resp = client.delete("/api/v1/admin/rules/test_rule_1", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "deleted successfully" in resp.json["message"]

    # Verify rule deleted
    assert db.session.query(SystemRule).filter_by(id="test_rule_1").first() is None


# ── Professor Class Assignment tests ──────────────────────────────────────────

def test_create_professor_assignment_valid(client, admin_test_context, db_session):
    """AD-PA2: Admin creates a valid assignment — expects 201 and round-trip in GET."""
    from app.models.branch import Branch

    # The professor in admin_test_context is not yet active; activate so filters pass
    admin = admin_test_context["admin"]
    prof  = admin_test_context["prof"]
    prof.is_active = True
    prof.role      = __import__("app.models.user", fromlist=["UserRole"]).UserRole.PROFESSOR

    branch = Branch(college_id=DEFAULT_COLLEGE_ID, name="Computer Science", code="CSE", is_active=True)
    db_session.add(branch)
    db_session.commit()

    token = create_access_token(identity=str(admin.id), additional_claims={"role": "admin"})
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post("/api/v1/admin/professor-assignments", json={
        "professor_user_id": str(prof.id),
        "course_name":  "Data Structures",
        "course_code":  "cs101",         # should be auto-upcased
        "branch":       "cse",           # should be auto-upcased
        "semester":     3,
        "academic_year": "2025-26",
    }, headers=headers)
    assert resp.status_code == 201, resp.json
    data = resp.json["assignment"]
    assert data["course_code"] == "CS101"
    assert data["branch"]      == "CSE"
    assert data["semester"]    == 3
    assert data["is_active"]   is True

    # Verify the assignment appears in the GET list
    list_resp = client.get("/api/v1/admin/professor-assignments", headers=headers)
    assert list_resp.status_code == 200
    codes = [a["course_code"] for a in list_resp.json["assignments"]]
    assert "CS101" in codes


def test_create_professor_assignment_bad_branch(client, admin_test_context, db_session):
    """AD-PA2: Reject an assignment whose branch code doesn't exist in this college → 400."""
    admin = admin_test_context["admin"]
    prof  = admin_test_context["prof"]
    prof.is_active = True
    db_session.commit()

    token = create_access_token(identity=str(admin.id), additional_claims={"role": "admin"})
    resp = client.post("/api/v1/admin/professor-assignments", json={
        "professor_user_id": str(prof.id),
        "course_name":  "Algorithms",
        "course_code":  "CS202",
        "branch":       "NONEXISTENT",
        "semester":     4,
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 400
    assert "not found" in resp.json.get("error", "").lower() or "not found" in resp.json.get("message", "").lower()


def test_create_professor_assignment_cross_college_professor(client, admin_test_context, db_session):
    """AD-PA2: Reject an assignment for a professor who belongs to a different college → 404."""
    from app.models.branch import Branch
    from app.models.college import College
    import uuid

    admin = admin_test_context["admin"]

    # Create a second college and a professor in it
    other_college = College(id=uuid.uuid4(), name="Other College", slug="other-college",
                            code="OC2024", is_active=True)
    db_session.add(other_college)
    db_session.flush()

    UserRole = __import__("app.models.user", fromlist=["UserRole"]).UserRole
    other_prof = __import__("app.models.user", fromlist=["User"]).User(
        college_id=other_college.id, email="other_prof@other.edu",
        role=UserRole.PROFESSOR, is_active=True,
    )
    other_prof.set_password("Test@1234")
    db_session.add(other_prof)

    branch = Branch(college_id=DEFAULT_COLLEGE_ID, name="ECE", code="ECE", is_active=True)
    db_session.add(branch)
    db_session.commit()

    token = create_access_token(identity=str(admin.id), additional_claims={"role": "admin"})
    resp = client.post("/api/v1/admin/professor-assignments", json={
        "professor_user_id": str(other_prof.id),   # professor from OTHER college
        "course_name": "Electronics",
        "course_code": "EC101",
        "branch":      "ECE",
        "semester":    2,
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404   # professor not found in THIS college
