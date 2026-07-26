"""
Test S9: GET /students/<uuid>/detail — multi-role masking verification

Verifies:
1. Admin sees all fields including quota_category, fees_submitted, admin_edits_meta
2. TPO sees academic fields but NOT quota_category, fees_submitted, hostel_address
3. Professor without class assignment gets 403
4. Student cross-IDOR on /detail gets 403
5. S5 PATCH with edited_section writes admin_edits_meta to DB (and skips setattr)
6. New admission fields (entrance_exam_type, entrance_rank, quota_category) are
   returned to admin and masked correctly for TPO
"""

import pytest
from flask_jwt_extended import create_access_token
from app.extensions import db
from app.models.user import User, UserRole
from app.models.student import StudentProfile
from app.models.college import DEFAULT_COLLEGE_ID


@pytest.fixture
def detail_users(db_session):
    """Seed 2 students + admin + tpo + professor for S9 tests."""
    # Student A — full data, DPDP consent given
    s1 = User(college_id=DEFAULT_COLLEGE_ID, phone="8001000001", role=UserRole.STUDENT, is_active=True)
    s1.set_password("Pass@1234")
    db_session.add(s1)
    db_session.flush()

    p1 = StudentProfile(
        user_id=s1.id,
        roll_no="DETAIL001",
        full_name="Detail Student Alpha",
        branch="CSE",
        batch_year=2024,
        semester=4,
        cgpa=8.8,
        attendance_pct=92.0,
        active_backlogs=0,
        dpdp_consent_given=True,
        profile_complete=True,
        # New admission fields
        entrance_exam_type="JEE Advanced",
        entrance_rank=3500,
        quota_category="OBC",

        fees_submitted=75000.0,
        scholarship_details="Merit-based, ₹20k/yr",
        hostel_address="Hostel B, Room 202",
        home_address="123 Main Street, Delhi",
        parent_contact="9876543210",
        linkedin_url="https://linkedin.com/in/detail-alpha",
    )
    db_session.add(p1)

    # Student B — for cross-IDOR check
    s2 = User(college_id=DEFAULT_COLLEGE_ID, phone="8001000002", role=UserRole.STUDENT, is_active=True)
    s2.set_password("Pass@1234")
    db_session.add(s2)
    db_session.flush()

    p2 = StudentProfile(
        user_id=s2.id, roll_no="DETAIL002", full_name="Student Beta",
        branch="IT", batch_year=2024, semester=4, cgpa=7.5,
        dpdp_consent_given=True, profile_complete=True,
    )
    db_session.add(p2)

    admin = User(college_id=DEFAULT_COLLEGE_ID, email="admin_detail@college.edu",
                 role=UserRole.ADMIN, is_active=True)
    admin.set_password("Pass@1234")
    db_session.add(admin)

    tpo = User(college_id=DEFAULT_COLLEGE_ID, email="tpo_detail@college.edu",
               role=UserRole.PLACEMENT_CELL, is_active=True)
    tpo.set_password("Pass@1234")
    db_session.add(tpo)

    professor = User(college_id=DEFAULT_COLLEGE_ID, email="prof_detail@college.edu",
                     role=UserRole.PROFESSOR, is_active=True)
    professor.set_password("Pass@1234")
    db_session.add(professor)

    db_session.commit()

    return {
        "s1": s1, "p1": p1,
        "s2": s2, "p2": p2,
        "admin": admin,
        "tpo": tpo,
        "professor": professor,
    }


def _tok(user, role):
    return {"Authorization": f"Bearer {create_access_token(identity=str(user.id), additional_claims={'role': role})}"}


# ── S9 Tests ──────────────────────────────────────────────────────────────────

def test_s9_admin_sees_all_fields(client, detail_users):
    """Admin must see all 6 sections including quota_category, fees, admin_edits_meta."""
    p1_id = str(detail_users["p1"].id)
    resp = client.get(f"/api/v1/students/{p1_id}/detail",
                      headers=_tok(detail_users["admin"], "admin"))
    assert resp.status_code == 200, resp.json
    data = resp.json.get("student", resp.json)

    # Identity
    assert data["full_name"] == "Detail Student Alpha"
    assert data["roll_no"] == "DETAIL001"

    # Academic
    assert data["cgpa"] == 8.8
    assert data["attendance_pct"] == 92.0
    assert data["active_backlogs"] == 0

    # Admission (new fields)
    assert data["entrance_exam_type"] == "JEE Advanced"
    assert data["entrance_rank"] == 3500          # Int field — stored as integer
    assert data["quota_category"] == "OBC"          # Admin MUST see this


    # Administrative (sensitive)
    assert data["fees_submitted"] == 75000.0
    assert data["scholarship_details"] == "Merit-based, ₹20k/yr"
    assert data["hostel_address"] == "Hostel B, Room 202"
    assert data["home_address"] == "123 Main Street, Delhi"
    assert data["parent_contact"] == "9876543210"

    # admin_edits_meta should be present (even if empty dict)
    assert "admin_edits_meta" in data


def test_s9_tpo_quota_and_fees_masked(client, detail_users):
    """TPO sees CGPA/attendance/entrance but NOT quota, fees, scholarship, addresses."""
    p1_id = str(detail_users["p1"].id)
    resp = client.get(f"/api/v1/students/{p1_id}/detail",
                      headers=_tok(detail_users["tpo"], "placement_cell"))
    assert resp.status_code == 200, resp.json
    data = resp.json.get("student", resp.json)

    # Should see academic data
    assert data["cgpa"] == 8.8
    assert data["attendance_pct"] == 92.0

    # Should see entrance exam (TPO is allowed) but NOT quota_category
    assert data.get("entrance_exam_type") == "JEE Advanced"
    assert "quota_category" not in data or data.get("quota_category") is None, \
        "quota_category should be masked for TPO"

    # Must NOT see fees/scholarship/addresses
    assert "fees_submitted" not in data or data.get("fees_submitted") is None, \
        "fees_submitted must be masked for TPO"
    assert "scholarship_details" not in data or data.get("scholarship_details") is None
    assert "hostel_address" not in data or data.get("hostel_address") is None
    assert "home_address" not in data or data.get("home_address") is None
    assert "parent_contact" not in data or data.get("parent_contact") is None
    assert "admin_edits_meta" not in data or data.get("admin_edits_meta") is None


def test_s9_professor_no_class_assignment_returns_403(client, detail_users):
    """Professor with no class assignment for the student's branch/semester → 403."""
    p1_id = str(detail_users["p1"].id)
    resp = client.get(f"/api/v1/students/{p1_id}/detail",
                      headers=_tok(detail_users["professor"], "professor"))
    assert resp.status_code == 403, f"Expected 403 but got {resp.status_code}: {resp.json}"


def test_s9_student_cross_idor_returns_403(client, detail_users):
    """Student cannot access another student's detail endpoint."""
    # s2 tries to access p1's detail
    p1_id = str(detail_users["p1"].id)
    resp = client.get(f"/api/v1/students/{p1_id}/detail",
                      headers=_tok(detail_users["s2"], "student"))
    assert resp.status_code == 403, f"Expected 403 but got {resp.status_code}"


def test_s9_student_own_detail_returns_200(client, detail_users):
    """Student can access their own /detail endpoint."""
    p1_id = str(detail_users["p1"].id)
    resp = client.get(f"/api/v1/students/{p1_id}/detail",
                      headers=_tok(detail_users["s1"], "student"))
    assert resp.status_code == 200, f"Expected 200 for own profile but got {resp.status_code}: {resp.json}"
    data = resp.json.get("student", resp.json)
    # Student can see their own quota_category
    assert data["quota_category"] == "OBC"
    # Student sees their own fees (read-only in UI but visible in API)
    assert data["fees_submitted"] == 75000.0
    # admin_edits_meta NOT exposed to student
    assert "admin_edits_meta" not in data or data.get("admin_edits_meta") is None


def test_s5_edited_section_writes_meta_to_db(client, db_session, detail_users):
    """S5 with edited_section → writes admin_edits_meta; edited_section is not setattr'd."""
    admin_tok = _tok(detail_users["admin"], "admin")
    p1_id = str(detail_users["p1"].id)

    resp = client.patch(
        f"/api/v1/students/{p1_id}",
        json={"cgpa": 9.0, "edited_section": "academic"},
        headers=admin_tok,
    )
    assert resp.status_code == 200, resp.json

    # Verify DB was updated
    db_session.refresh(detail_users["p1"])
    assert detail_users["p1"].cgpa == 9.0

    # Verify admin_edits_meta written
    meta = detail_users["p1"].admin_edits_meta or {}
    assert "academic" in meta, f"Expected 'academic' in admin_edits_meta, got: {meta}"
    assert "editor_id" in meta["academic"]
    assert "edited_at" in meta["academic"]


def test_s5_edited_section_not_a_model_attribute(client, detail_users):
    """edited_section is a schema-only field — sending it must NOT cause 500."""
    admin_tok = _tok(detail_users["admin"], "admin")
    p1_id = str(detail_users["p1"].id)

    # Send only edited_section with no data change — should return 200 without error
    resp = client.patch(
        f"/api/v1/students/{p1_id}",
        json={"edited_section": "admission", "entrance_exam_type": "KCET"},
        headers=admin_tok,
    )
    assert resp.status_code == 200, f"Got {resp.status_code}: {resp.json}"

    db_session = db.session
    db_session.refresh(detail_users["p1"])
    assert detail_users["p1"].entrance_exam_type == "KCET"
    # edited_section is NOT a model column — no AttributeError should have occurred


def test_s9_unauthenticated_returns_401(client, detail_users):
    """No token → 401."""
    p1_id = str(detail_users["p1"].id)
    resp = client.get(f"/api/v1/students/{p1_id}/detail")
    assert resp.status_code == 401
