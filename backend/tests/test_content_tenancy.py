import pytest
import uuid
from flask_jwt_extended import create_access_token
from app.models.user import User, UserRole
from app.models.college import College, DEFAULT_COLLEGE_ID
from app.models.content import (
    LectureRecording,
    SyllabusProgress,
    MockInterviewSession,
    MockInterviewBooking,
    MentorProfile,
    MentorshipRequest,
)
from app.models.community import ModerationReport


@pytest.fixture
def tenancy_setup(db_session):
    col1_id = DEFAULT_COLLEGE_ID

    col2_id = uuid.uuid4()
    col2 = College(id=col2_id, name="Second College", slug="second-college", code="SC2026", is_active=True)
    db_session.add(col2)
    db_session.commit()

    admin1 = User(college_id=col1_id, email="admin1@col1.edu", role=UserRole.ADMIN, is_active=True)
    prof1  = User(college_id=col1_id, email="prof1@col1.edu", role=UserRole.PROFESSOR, is_active=True)
    tpo1   = User(college_id=col1_id, email="tpo1@col1.edu", role=UserRole.PLACEMENT_CELL, is_active=True)
    stud1  = User(college_id=col1_id, phone="9111111111", role=UserRole.STUDENT, is_active=True)
    for u in [admin1, prof1, tpo1, stud1]:
        u.set_password("Pass1234")
        db_session.add(u)

    admin2 = User(college_id=col2_id, email="admin2@col2.edu", role=UserRole.ADMIN, is_active=True)
    prof2  = User(college_id=col2_id, email="prof2@col2.edu", role=UserRole.PROFESSOR, is_active=True)
    tpo2   = User(college_id=col2_id, email="tpo2@col2.edu", role=UserRole.PLACEMENT_CELL, is_active=True)
    stud2  = User(college_id=col2_id, phone="9222222222", role=UserRole.STUDENT, is_active=True)
    for u in [admin2, prof2, tpo2, stud2]:
        u.set_password("Pass1234")
        db_session.add(u)

    db_session.commit()

    tokens = {
        "admin1": create_access_token(identity=str(admin1.id), additional_claims={"role": "admin"}),
        "prof1":  create_access_token(identity=str(prof1.id),  additional_claims={"role": "professor"}),
        "tpo1":   create_access_token(identity=str(tpo1.id),   additional_claims={"role": "placement_cell"}),
        "stud1":  create_access_token(identity=str(stud1.id),  additional_claims={"role": "student"}),
        "admin2": create_access_token(identity=str(admin2.id), additional_claims={"role": "admin"}),
        "prof2":  create_access_token(identity=str(prof2.id),  additional_claims={"role": "professor"}),
        "tpo2":   create_access_token(identity=str(tpo2.id),   additional_claims={"role": "placement_cell"}),
        "stud2":  create_access_token(identity=str(stud2.id),  additional_claims={"role": "student"}),
    }

    return {
        "col1_id": col1_id, "col2_id": col2_id,
        "admin1": admin1, "prof1": prof1, "tpo1": tpo1, "stud1": stud1,
        "admin2": admin2, "prof2": prof2, "tpo2": tpo2, "stud2": stud2,
        "tokens": tokens
    }


def test_lectures_get_and_upload_tenancy(client, db_session, tenancy_setup):
    headers1 = {"Authorization": f"Bearer {tenancy_setup['tokens']['prof1']}"}
    headers2 = {"Authorization": f"Bearer {tenancy_setup['tokens']['prof2']}"}
    h_stud1  = {"Authorization": f"Bearer {tenancy_setup['tokens']['stud1']}"}
    h_stud2  = {"Authorization": f"Bearer {tenancy_setup['tokens']['stud2']}"}

    # Upload lecture for College 1
    res = client.post("/api/v1/career/lectures", headers=headers1, json={
        "title": "Data Structures L1",
        "subject": "CS101",
        "code": "CS101",
        "video_url": "https://example.com/lec1.mp4",
        "duration": "45:00",
    })
    assert res.status_code == 201

    # Professor 1 views recordings
    res = client.get("/api/v1/career/lectures", headers=headers1)
    assert res.status_code == 200
    data = res.get_json()
    assert len(data["recordings"]) == 1
    assert data["recordings"][0]["title"] == "Data Structures L1"

    # Student 1 (College 1) views recordings
    res = client.get("/api/v1/career/lectures", headers=h_stud1)
    assert res.status_code == 200
    data = res.get_json()
    assert len(data["recordings"]) == 1

    # Professor 2 (College 2) views recordings -> empty (isolation)
    res = client.get("/api/v1/career/lectures", headers=headers2)
    assert res.status_code == 200
    assert len(res.get_json()["recordings"]) == 0

    # Student 2 (College 2) views recordings -> empty (isolation)
    res = client.get("/api/v1/career/lectures", headers=h_stud2)
    assert res.status_code == 200
    assert len(res.get_json()["recordings"]) == 0


def test_mock_interviews_tenancy(client, db_session, tenancy_setup):
    h_stud1 = {"Authorization": f"Bearer {tenancy_setup['tokens']['stud1']}"}
    h_stud2 = {"Authorization": f"Bearer {tenancy_setup['tokens']['stud2']}"}

    # Create mock session for College 1
    sess1 = MockInterviewSession(
        college_id=tenancy_setup["col1_id"],
        session_type="Technical",
        company_style="Google",
        difficulty="Medium",
        is_active=True,
    )
    db_session.add(sess1)
    db_session.commit()

    # Student 1 sees session
    res = client.get("/api/v1/career/mock-interviews", headers=h_stud1)
    assert res.status_code == 200
    assert len(res.get_json()["sessions"]) == 1

    # Student 2 does NOT see College 1 session
    res = client.get("/api/v1/career/mock-interviews", headers=h_stud2)
    assert res.status_code == 200
    assert len(res.get_json()["sessions"]) == 0

    # Student 1 books session -> 201
    res = client.post(f"/api/v1/career/mock-interviews/{sess1.id}/book", headers=h_stud1)
    assert res.status_code == 201

    # Student 2 attempts to book College 1 session -> 404 (session not found for College 2)
    res = client.post(f"/api/v1/career/mock-interviews/{sess1.id}/book", headers=h_stud2)
    assert res.status_code == 404


def test_mentorship_flow_tenancy(client, db_session, tenancy_setup):
    h_stud1 = {"Authorization": f"Bearer {tenancy_setup['tokens']['stud1']}"}
    h_stud2 = {"Authorization": f"Bearer {tenancy_setup['tokens']['stud2']}"}
    h_prof1 = {"Authorization": f"Bearer {tenancy_setup['tokens']['prof1']}"}
    h_prof2 = {"Authorization": f"Bearer {tenancy_setup['tokens']['prof2']}"}

    # Create MentorProfile for Professor 1 in College 1
    mentor1 = MentorProfile(
        college_id=tenancy_setup["col1_id"],
        user_id=tenancy_setup["prof1"].id,
        name="Prof One",
        role_title="Senior Faculty",
        is_available=True,
        is_active=True,
    )
    db_session.add(mentor1)
    db_session.commit()

    # Student 1 lists mentors -> sees Prof One
    res = client.get("/api/v1/career/mentors", headers=h_stud1)
    assert res.status_code == 200
    assert len(res.get_json()["mentors"]) == 1

    # Student 2 lists mentors -> empty (isolation)
    res = client.get("/api/v1/career/mentors", headers=h_stud2)
    assert res.status_code == 200
    assert len(res.get_json()["mentors"]) == 0

    # Student 1 requests mentorship -> 201
    res = client.post(f"/api/v1/career/mentors/{mentor1.id}/request", headers=h_stud1, json={
        "topic": "Career Advice",
        "message": "Hello Prof One",
    })
    assert res.status_code == 201

    # Student 2 attempts to request mentorship with mentor1 -> 404
    res = client.post(f"/api/v1/career/mentors/{mentor1.id}/request", headers=h_stud2, json={
        "topic": "Hack",
    })
    assert res.status_code == 404

    # Prof 1 gets requests -> 200 (1 request)
    res = client.get("/api/v1/career/mentors/requests", headers=h_prof1)
    assert res.status_code == 200
    assert len(res.get_json()["requests"]) == 1

    # Prof 2 gets requests -> 200 (0 requests)
    res = client.get("/api/v1/career/mentors/requests", headers=h_prof2)
    assert res.status_code == 200
    assert len(res.get_json()["requests"]) == 0


def test_moderation_reports_tenancy(client, db_session, tenancy_setup):
    h_tpo1   = {"Authorization": f"Bearer {tenancy_setup['tokens']['tpo1']}"}
    h_admin1 = {"Authorization": f"Bearer {tenancy_setup['tokens']['admin1']}"}
    h_admin2 = {"Authorization": f"Bearer {tenancy_setup['tokens']['admin2']}"}

    # TPO 1 submits moderation report
    res = client.post("/api/v1/placement/reports", headers=h_tpo1, json={
        "target_type": "company",
        "target_id": "comp-123",
        "reason": "Suspicious offer terms",
    })
    assert res.status_code == 201
    report_id = res.get_json()["id"]

    # Admin 1 sees report
    res = client.get("/api/v1/placement/reports", headers=h_admin1)
    assert res.status_code == 200
    assert len(res.get_json()["reports"]) == 1

    # Admin 2 does NOT see College 1 report
    res = client.get("/api/v1/placement/reports", headers=h_admin2)
    assert res.status_code == 200
    assert len(res.get_json()["reports"]) == 0

    # Admin 2 attempts to resolve College 1 report -> 404
    res = client.post(f"/api/v1/admin/reports/{report_id}/resolve", headers=h_admin2)
    assert res.status_code == 404

    # Admin 1 resolves report -> 200
    res = client.post(f"/api/v1/admin/reports/{report_id}/resolve", headers=h_admin1)
    assert res.status_code == 200
