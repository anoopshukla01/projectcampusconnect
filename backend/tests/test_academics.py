import pytest
from flask_jwt_extended import create_access_token
from app.models.college import DEFAULT_COLLEGE_ID
from app.models.user import User, UserRole

def test_academics_endpoints_empty(client, db_session):
    student_user = User(college_id=DEFAULT_COLLEGE_ID, email="student_test@college.edu", role=UserRole.STUDENT, is_active=True)
    student_user.set_password("Pass@123456")
    db_session.add(student_user)
    db_session.commit()

    token = create_access_token(identity=str(student_user.id), additional_claims={"role": "student"})
    headers = {"Authorization": f"Bearer {token}"}

    # Test grades empty
    res = client.get("/api/v1/academics/grades", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert "grades" in data
    assert data["cgpa"] == "--"

    # Test attendance empty
    res = client.get("/api/v1/academics/attendance", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert "subjects" in data

    # Test timetable empty
    res = client.get("/api/v1/academics/timetable", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert "timetable" in data

    # Test assignments empty
    res = client.get("/api/v1/academics/assignments", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert "assignments" in data
