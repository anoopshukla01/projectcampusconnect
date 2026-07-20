import pytest
from flask_jwt_extended import create_access_token
from app.models.user import User, UserRole

from app.models.college import DEFAULT_COLLEGE_ID

def test_community_endpoints(client, db_session):
    student_user = User(college_id=DEFAULT_COLLEGE_ID, email="student_test2@college.edu", role=UserRole.STUDENT, is_active=True)
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


def test_elibrary_request_approval_and_expiry_flow(client, db_session):
    from app.models.community import LibraryResource, LibraryRequest, LibraryRequestStatus
    from app.models.student import StudentProfile

    # 1. Setup Student and Admin
    student_user = User(college_id=DEFAULT_COLLEGE_ID, email="lib_stud@college.edu.in", role=UserRole.STUDENT, is_active=True)
    student_user.set_password("StudentPass12")
    db_session.add(student_user)
    db_session.flush()

    profile = StudentProfile(
        user_id=student_user.id, roll_no="CS-LIB-01", full_name="Lib Student",
        branch="CSE", batch_year=2026, semester=6, cgpa=8.5, active_backlogs=0,
        dpdp_consent_given=True, profile_complete=True
    )
    db_session.add(profile)

    admin_user = User(college_id=DEFAULT_COLLEGE_ID, email="lib_admin@college.edu.in", role=UserRole.ADMIN, is_active=True)
    admin_user.set_password("AdminPass12")
    db_session.add(admin_user)
    db_session.flush()

    # Create approved library resource
    resource = LibraryResource(title="Intro to Algorithms", author="CLRS", subject="DSA", resource_type="book", approved=True, file_url="http://example.com/clrs.pdf")
    db_session.add(resource)
    db_session.commit()

    student_token = create_access_token(identity=str(student_user.id), additional_claims={"role": "student"})
    admin_token = create_access_token(identity=str(admin_user.id), additional_claims={"role": "admin"})

    # 2. Student attempts to download resource directly — blocked (no active request)
    resp = client.get(f"/api/v1/community/elibrary/{resource.id}/download", headers={"Authorization": f"Bearer {student_token}"})
    assert resp.status_code == 403

    # 3. Student requests access
    resp = client.post("/api/v1/community/library/requests", json={"resource_id": str(resource.id)}, headers={"Authorization": f"Bearer {student_token}"})
    assert resp.status_code == 201
    request_id = resp.get_json()["id"]

    # 4. Student still blocked while request is pending
    resp = client.get(f"/api/v1/community/elibrary/{resource.id}/download", headers={"Authorization": f"Bearer {student_token}"})
    assert resp.status_code == 403

    # 5. Admin approves request
    resp = client.patch(f"/api/v1/community/library/requests/{request_id}", json={"status": "approved", "expiry_days": 5}, headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200

    # 6. Student downloads successfully
    resp = client.get(f"/api/v1/community/elibrary/{resource.id}/download", headers={"Authorization": f"Bearer {student_token}"})
    assert resp.status_code == 200
    assert resp.get_json()["file_url"] == "http://example.com/clrs.pdf"

    # 7. Mock request expiration by setting expires_at to past date
    import uuid as uuid_lib
    req_obj = db_session.get(LibraryRequest, uuid_lib.UUID(request_id))
    from datetime import datetime, timedelta, timezone
    req_obj.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.commit()

    # 8. Student downloads blocked due to expiration
    resp = client.get(f"/api/v1/community/elibrary/{resource.id}/download", headers={"Authorization": f"Bearer {student_token}"})
    assert resp.status_code == 403


def test_professor_event_creation_and_admin_approval_flow(client, db_session):
    from app.models.community import CampusEvent

    # 1. Create professor and admin users
    prof_user = User(college_id=DEFAULT_COLLEGE_ID, email="prof_test_events@college.edu.in", role=UserRole.PROFESSOR, is_active=True)
    prof_user.set_password("ProfPass123")
    db_session.add(prof_user)
    db_session.flush()

    admin_user = User(college_id=DEFAULT_COLLEGE_ID, email="admin_test_events@college.edu.in", role=UserRole.ADMIN, is_active=True)
    admin_user.set_password("AdminPass123")
    db_session.add(admin_user)
    db_session.flush()
    db_session.commit()

    prof_token = create_access_token(identity=str(prof_user.id), additional_claims={"role": "professor"})
    admin_token = create_access_token(identity=str(admin_user.id), additional_claims={"role": "admin"})

    # 2. Professor creates event
    event_data = {
        "title": "Annual Tech Symposium",
        "date_time": "July 25, 2026",
        "venue": "Campus Auditorium",
        "description": "Welcome to the technical event."
    }
    resp = client.post("/api/v1/community/events", json=event_data, headers={"Authorization": f"Bearer {prof_token}"})
    assert resp.status_code == 201
    resp_data = resp.get_json()
    assert resp_data["approval_status"] == "pending"
    event_id = resp_data["id"]

    # 3. Admin gets pending events list and checks if it's there
    resp = client.get("/api/v1/admin/events/pending", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    pending_events = resp.get_json()["events"]
    assert any(ev["id"] == event_id for ev in pending_events)

    # 4. Admin approves the event
    resp = client.post(f"/api/v1/admin/events/{event_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    assert resp.get_json()["message"] == "Event approved and is now live."

    # 5. Check if event is now live
    import uuid as uuid_lib
    event_obj = db_session.get(CampusEvent, uuid_lib.UUID(event_id))
    assert event_obj.approval_status == "live"
    assert event_obj.approved_by_id == admin_user.id


