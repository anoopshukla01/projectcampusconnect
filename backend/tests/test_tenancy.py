import pytest
from flask_jwt_extended import create_access_token
from app.models.user import User, UserRole
from app.models.college import College, DEFAULT_COLLEGE_ID
from app.models.community import Announcement, CampusEvent, MarketplaceItem, LostFoundItem, LibraryResource, StudyNote, LibraryRequest, LibraryRequestStatus
from app.models.placement import PlacementDrive, DriveType
from app.models.chat import Conversation, ConversationType, GroupMembership, GroupRole
import uuid

@pytest.fixture
def tenancy_setup(db_session):
    # College 1 (Default College)
    col1_id = DEFAULT_COLLEGE_ID

    # College 2
    col2_id = uuid.uuid4()
    col2 = College(id=col2_id, name="Second College", slug="second-college", code="SC2026", is_active=True)
    db_session.add(col2)
    db_session.commit()

    # College 1 users
    admin1 = User(college_id=col1_id, email="admin1@col1.edu", role=UserRole.ADMIN, is_active=True)
    prof1 = User(college_id=col1_id, email="prof1@col1.edu", role=UserRole.PROFESSOR, is_active=True)
    tpo1 = User(college_id=col1_id, email="tpo1@col1.edu", role=UserRole.PLACEMENT_CELL, is_active=True)
    stud1 = User(college_id=col1_id, phone="9111111111", role=UserRole.STUDENT, is_active=True)
    for u in [admin1, prof1, tpo1, stud1]:
        u.set_password("Pass1234")
        db_session.add(u)

    # College 2 users
    admin2 = User(college_id=col2_id, email="admin2@col2.edu", role=UserRole.ADMIN, is_active=True)
    prof2 = User(college_id=col2_id, email="prof2@col2.edu", role=UserRole.PROFESSOR, is_active=True)
    tpo2 = User(college_id=col2_id, email="tpo2@col2.edu", role=UserRole.PLACEMENT_CELL, is_active=True)
    stud2 = User(college_id=col2_id, phone="9222222222", role=UserRole.STUDENT, is_active=True)
    for u in [admin2, prof2, tpo2, stud2]:
        u.set_password("Pass1234")
        db_session.add(u)

    db_session.commit()

    tokens = {
        "admin1": create_access_token(identity=str(admin1.id), additional_claims={"role": "admin"}),
        "prof1": create_access_token(identity=str(prof1.id), additional_claims={"role": "professor"}),
        "tpo1": create_access_token(identity=str(tpo1.id), additional_claims={"role": "placement_cell"}),
        "stud1": create_access_token(identity=str(stud1.id), additional_claims={"role": "student"}),
        "admin2": create_access_token(identity=str(admin2.id), additional_claims={"role": "admin"}),
        "prof2": create_access_token(identity=str(prof2.id), additional_claims={"role": "professor"}),
        "tpo2": create_access_token(identity=str(tpo2.id), additional_claims={"role": "placement_cell"}),
        "stud2": create_access_token(identity=str(stud2.id), additional_claims={"role": "student"}),
    }

    return {
        "col1_id": col1_id, "col2_id": col2_id,
        "admin1": admin1, "prof1": prof1, "tpo1": tpo1, "stud1": stud1,
        "admin2": admin2, "prof2": prof2, "tpo2": tpo2, "stud2": stud2,
        "tokens": tokens
    }


def test_cross_college_event_mutation_blocked(client, db_session, tenancy_setup):
    t = tenancy_setup
    # College 1 event
    ev1 = CampusEvent(college_id=t["col1_id"], title="Col 1 Event", date_time="Tomorrow", venue="Auditorium", created_by_id=t["admin1"].id)
    db_session.add(ev1)
    db_session.commit()

    # College 2 admin attempts update
    headers2 = {"Authorization": f"Bearer {t['tokens']['admin2']}"}
    res = client.patch(f"/api/v1/community/events/{ev1.id}", json={"title": "Hacked Title"}, headers=headers2)
    assert res.status_code == 404

    # College 2 admin attempts delete
    res = client.delete(f"/api/v1/community/events/{ev1.id}", headers=headers2)
    assert res.status_code == 404


def test_cross_college_marketplace_mutation_blocked(client, db_session, tenancy_setup):
    t = tenancy_setup
    item1 = MarketplaceItem(college_id=t["col1_id"], seller_id=t["stud1"].id, seller_name="Stud 1", title="Book", price="100", category="books", status="active")
    db_session.add(item1)
    db_session.commit()

    headers2 = {"Authorization": f"Bearer {t['tokens']['stud2']}"}
    res = client.patch(f"/api/v1/community/marketplace/{item1.id}", json={"price": "50"}, headers=headers2)
    assert res.status_code == 404

    res = client.delete(f"/api/v1/community/marketplace/{item1.id}", headers=headers2)
    assert res.status_code == 404


def test_cross_college_placement_drive_shortlist_blocked(client, db_session, tenancy_setup):
    t = tenancy_setup
    from datetime import date
    drive1 = PlacementDrive(college_id=t["col1_id"], company_name="TechCorp", role_title="Dev", drive_type=DriveType.FULL_TIME, batch_year=2026, cgpa_cutoff=7.0, backlog_cutoff=0, ctc_offered=12.5, drive_date=date.today(), registration_deadline=date.today(), created_by=t["tpo1"].id)
    db_session.add(drive1)
    db_session.commit()

    headers2 = {"Authorization": f"Bearer {t['tokens']['tpo2']}"}
    res = client.get(f"/api/v1/placement/drives/{drive1.id}/shortlist", headers=headers2)
    assert res.status_code == 404

    res = client.get(f"/api/v1/placement/drives/{drive1.id}/bookings", headers=headers2)
    assert res.status_code == 404


def test_cross_college_chat_user_invite_blocked(client, db_session, tenancy_setup):
    t = tenancy_setup
    # Admin 1 attempts to create private chat including User from College 2
    headers1 = {"Authorization": f"Bearer {t['tokens']['admin1']}"}
    res = client.post("/api/v1/career/chats/create", json={
        "type": "private",
        "name": "Cross-College Group",
        "invited_user_ids": [str(t["stud2"].id)]
    }, headers=headers1)
    assert res.status_code == 201

    conv_id = res.get_json()["conversation_id"]
    # Check memberships: stud2 should NOT be in memberships
    mems = GroupMembership.query.filter_by(conversation_id=uuid.UUID(conv_id)).all()
    user_ids = [m.user_id for m in mems]
    assert t["stud2"].id not in user_ids


def test_manage_library_request_missing_resource_404(client, db_session, tenancy_setup):
    t = tenancy_setup
    # Create request with no associated resource
    req = LibraryRequest(resource_id=uuid.uuid4(), user_id=t["stud1"].id, status=LibraryRequestStatus.PENDING)
    db_session.add(req)
    db_session.commit()

    headers1 = {"Authorization": f"Bearer {t['tokens']['admin1']}"}
    res = client.patch(f"/api/v1/community/library/requests/{req.id}", json={"status": "approved"}, headers=headers1)
    assert res.status_code == 404


def test_cross_college_student_applications_returns_404(client, db_session, tenancy_setup):
    t = tenancy_setup
    # Admin 2 attempts to fetch applications for Student 1 (College 1)
    headers2 = {"Authorization": f"Bearer {t['tokens']['admin2']}"}
    res = client.get(f"/api/v1/students/{t['stud1'].id}/applications", headers=headers2)
    assert res.status_code == 404
    assert res.get_json()["error"] == "Resource not found."


def test_cross_college_assignment_update_returns_404(client, db_session, tenancy_setup):
    t = tenancy_setup
    from app.models.academic import Assignment
    from datetime import date
    asgn1 = Assignment(
        professor_id=t["prof1"].id,
        title="Col 1 Assignment", subject="Physics", due_date=str(date.today()), points=100
    )
    db_session.add(asgn1)
    db_session.commit()

    # Professor 2 (College 2) attempts to update Assignment 1
    headers2 = {"Authorization": f"Bearer {t['tokens']['prof2']}"}
    res = client.patch(f"/api/v1/academics/assignments/{asgn1.id}", json={"title": "Hacked Assignment"}, headers=headers2)
    assert res.status_code == 404
    assert res.get_json()["error"] == "Resource not found."


def test_cross_college_direct_chat_creation_returns_404(client, db_session, tenancy_setup):
    t = tenancy_setup
    # Student 1 (College 1) attempts to initiate direct chat with Student 2 (College 2)
    headers1 = {"Authorization": f"Bearer {t['tokens']['stud1']}"}
    res = client.post("/api/v1/career/chats/create", json={
        "type": "direct",
        "recipient_id": str(t["stud2"].id)
    }, headers=headers1)
    assert res.status_code == 404
    assert res.get_json()["error"] == "Resource not found."
