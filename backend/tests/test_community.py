import pytest
from flask_jwt_extended import create_access_token
from app.models.user import User, UserRole

def test_community_endpoints(client, db_session):
    student_user = User(email="student_test2@college.edu", role=UserRole.STUDENT, is_active=True)
    student_user.set_password("Pass@123456")
    db_session.add(student_user)
    db_session.commit()

    token = create_access_token(identity=str(student_user.id), additional_claims={"role": "student"})
    headers = {"Authorization": f"Bearer {token}"}

    # Test announcements
    res = client.get("/api/v1/community/announcements", headers=headers)
    assert res.status_code == 200
    assert "announcements" in res.get_json()

    # Test events
    res = client.get("/api/v1/community/events", headers=headers)
    assert res.status_code == 200
    assert "events" in res.get_json()

    # Test marketplace
    res = client.get("/api/v1/community/marketplace", headers=headers)
    assert res.status_code == 200
    assert "items" in res.get_json()

    # Test lost & found
    res = client.get("/api/v1/community/lost-and-found", headers=headers)
    assert res.status_code == 200
    assert "items" in res.get_json()

    # Test notes
    res = client.get("/api/v1/community/notes", headers=headers)
    assert res.status_code == 200
    assert "notes" in res.get_json()

    # Test elibrary
    res = client.get("/api/v1/community/elibrary", headers=headers)
    assert res.status_code == 200
    assert "resources" in res.get_json()
