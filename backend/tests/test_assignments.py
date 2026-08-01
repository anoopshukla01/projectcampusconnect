import pytest
import uuid
from flask_jwt_extended import create_access_token
from app.models.user import User, UserRole
from app.models.college import College, DEFAULT_COLLEGE_ID
from app.models.student import StudentProfile
from app.models.academic import ProfessorClassAssignment, Assignment


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

    admin2 = User(college_id=col2_id, email="admin2@col2.edu", role=UserRole.ADMIN, is_active=True)
    prof2  = User(college_id=col2_id, email="prof2@col2.edu", role=UserRole.PROFESSOR, is_active=True)
    tpo2   = User(college_id=col2_id, email="tpo2@col2.edu", role=UserRole.PLACEMENT_CELL, is_active=True)
    stud2  = User(college_id=col2_id, phone="9222222222", role=UserRole.STUDENT, is_active=True)

    for u in [admin1, prof1, tpo1, stud1, admin2, prof2, tpo2, stud2]:
        u.set_password("Pass1234")
        db_session.add(u)
    db_session.commit()

    sp1 = StudentProfile(college_id=col1_id, user_id=stud1.id, full_name="Student One", roll_no="R101", branch="CSE", semester=4, batch_year="2026", cgpa=8.5, attendance_pct=90.0)
    sp2 = StudentProfile(college_id=col2_id, user_id=stud2.id, full_name="Student Two", roll_no="R202", branch="CSE", semester=4, batch_year="2026", cgpa=8.5, attendance_pct=90.0)
    db_session.add(sp1)
    db_session.add(sp2)
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


def test_professor_create_assignment_with_class_picker(client, db_session, tenancy_setup):
    h_prof1 = {"Authorization": f"Bearer {tenancy_setup['tokens']['prof1']}"}
    prof1   = tenancy_setup["prof1"]

    # Assign class to prof1
    pca = ProfessorClassAssignment(
        professor_user_id=prof1.id,
        course_name="Data Structures",
        course_code="CS201",
        branch="CSE",
        semester=4,
        is_active=True,
    )
    db_session.add(pca)
    db_session.commit()

    # Create assignment matching assigned class
    res = client.post("/api/v1/academics/assignments", headers=h_prof1, json={
        "title": "Assignment 1",
        "subject": "Data Structures",
        "branch": "CSE",
        "semester": 4,
        "due_date": "2026-09-01",
        "points": "50 pts",
    })
    assert res.status_code == 201
    assign_id = res.get_json()["id"]

    a = db_session.get(Assignment, uuid.UUID(assign_id))
    assert a is not None
    assert str(a.college_id) == str(tenancy_setup["col1_id"])
    assert a.subject == "Data Structures"
    assert a.branch == "CSE"
    assert a.semester == 4


def test_professor_create_assignment_unassigned_blocked(client, db_session, tenancy_setup):
    h_prof1 = {"Authorization": f"Bearer {tenancy_setup['tokens']['prof1']}"}

    # Attempt to create assignment for a class prof1 is NOT assigned to
    res = client.post("/api/v1/academics/assignments", headers=h_prof1, json={
        "title": "Unassigned HW",
        "subject": "Quantum Physics",
        "branch": "PHYS",
        "semester": 6,
        "due_date": "2026-09-01",
    })
    assert res.status_code == 403
    assert "not assigned to teach" in res.get_json()["error"]


def test_assignments_cross_college_isolation(client, db_session, tenancy_setup):
    h_prof1  = {"Authorization": f"Bearer {tenancy_setup['tokens']['prof1']}"}
    h_stud1  = {"Authorization": f"Bearer {tenancy_setup['tokens']['stud1']}"}
    h_stud2  = {"Authorization": f"Bearer {tenancy_setup['tokens']['stud2']}"}
    h_admin2 = {"Authorization": f"Bearer {tenancy_setup['tokens']['admin2']}"}
    prof1    = tenancy_setup["prof1"]

    # Assign class to prof1
    pca = ProfessorClassAssignment(
        professor_user_id=prof1.id,
        course_name="Algorithms",
        course_code="CS301",
        branch="CSE",
        semester=4,
        is_active=True,
    )
    db_session.add(pca)
    db_session.commit()

    # Prof 1 posts assignment
    res = client.post("/api/v1/academics/assignments", headers=h_prof1, json={
        "title": "Algo HW1",
        "subject": "Algorithms",
        "branch": "CSE",
        "semester": 4,
        "due_date": "2026-09-01",
    })
    assert res.status_code == 201

    # Student 1 (College 1, CSE) sees assignment
    res = client.get("/api/v1/academics/assignments", headers=h_stud1)
    assert res.status_code == 200
    assert len(res.get_json()["assignments"]) == 1

    # Student 2 (College 2, CSE) does NOT see College 1's assignment
    res = client.get("/api/v1/academics/assignments", headers=h_stud2)
    assert res.status_code == 200
    assert len(res.get_json()["assignments"]) == 0

    # Admin 2 (College 2 Admin) does NOT see College 1's assignment
    res = client.get("/api/v1/academics/assignments", headers=h_admin2)
    assert res.status_code == 200
    assert len(res.get_json()["assignments"]) == 0
