"""
Tests for the Campus Events system:
  - create_event must persist college_id (the root cause of the 500 crash)
  - audience-targeted events (class_branch set) are hidden from students in other branches
  - registration uses EventRegistration.user_id (not student_id)
  - unregister DELETE endpoint exists
  - admin approve/reject workflow
"""
import uuid
import pytest
from flask_jwt_extended import create_access_token
from app.models.user import User, UserRole
from app.models.college import DEFAULT_COLLEGE_ID
from app.models.student import StudentProfile
from app.models.community import CampusEvent, EventRegistration

COLLEGE_ID = DEFAULT_COLLEGE_ID


def _make_user(db_session, role, suffix=""):
    u = User(
        id=uuid.uuid4(),
        phone=f"+91000{suffix:0>7}",
        role=role,
        college_id=COLLEGE_ID,
        is_active=True,
    )
    db_session.add(u)
    db_session.commit()
    return u


def _make_student(db_session, user, branch="CSE", semester=3):
    sp = StudentProfile(
        id=uuid.uuid4(),
        user_id=user.id,
        full_name=f"Student {str(user.id)[:4]}",
        roll_no=f"ROLL{str(user.id)[:4]}",
        batch_year=2022,
        branch=branch,
        semester=semester,
        cgpa=8.5,
        attendance_pct=90.0,
        college_id=COLLEGE_ID,
    )
    db_session.add(sp)
    db_session.commit()
    return sp


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


# -- create_event persists college_id -----------------------------------------

def test_create_event_stores_college_id(client, db_session):
    admin = _make_user(db_session, UserRole.ADMIN, "001")
    payload = {
        "title": "Hackathon Hyperion",
        "date_time": "Dec 20, 2025 10:00 AM",
        "venue": "CHL",
        "event_type": "hackathon",
    }
    resp = client.post("/api/v1/community/events", json=payload, headers=_auth(admin))
    assert resp.status_code == 201, resp.get_json()
    data = resp.get_json()
    event = db_session.get(CampusEvent, uuid.UUID(data["id"]))
    assert event is not None
    assert event.college_id == COLLEGE_ID, "college_id must be set by the server"
    assert event.approval_status == "live"   # admin -> live immediately


def test_professor_event_requires_approval(client, db_session):
    prof_user = _make_user(db_session, UserRole.PROFESSOR, "002")
    payload = {
        "title": "Python Workshop",
        "date_time": "Dec 21, 2025 2 PM",
        "venue": "LH1",
        "event_type": "workshop",
    }
    resp = client.post("/api/v1/community/events", json=payload, headers=_auth(prof_user))
    assert resp.status_code == 201, resp.get_json()
    body = resp.get_json()
    assert body["approval_status"] == "pending"
    event = db_session.get(CampusEvent, uuid.UUID(body["id"]))
    assert event.college_id == COLLEGE_ID


# -- audience-targeted visibility ---------------------------------------------

def test_targeted_event_hidden_from_other_branch(client, db_session):
    admin = _make_user(db_session, UserRole.ADMIN, "003")
    resp = client.post("/api/v1/community/events", json={
        "title": "CSE Branch Event",
        "date_time": "Dec 22, 2025 10 AM",
        "venue": "CSE Lab",
        "event_type": "general",
        "class_branch": "CSE",
    }, headers=_auth(admin))
    assert resp.status_code == 201
    event_id = resp.get_json()["id"]

    mech_user = _make_user(db_session, UserRole.STUDENT, "004")
    _make_student(db_session, mech_user, branch="MECH", semester=3)
    resp2 = client.get("/api/v1/community/events", headers=_auth(mech_user))
    assert resp2.status_code == 200
    event_ids = [e["id"] for e in resp2.get_json()["events"]]
    assert event_id not in event_ids, "MECH student must not see CSE-only event"


def test_targeted_event_visible_to_matching_branch(client, db_session):
    admin = _make_user(db_session, UserRole.ADMIN, "005")
    resp = client.post("/api/v1/community/events", json={
        "title": "ECE Hackathon",
        "date_time": "Dec 23, 2025 11 AM",
        "venue": "ECE Lab",
        "event_type": "hackathon",
        "class_branch": "ECE",
    }, headers=_auth(admin))
    assert resp.status_code == 201
    event_id = resp.get_json()["id"]

    ece_user = _make_user(db_session, UserRole.STUDENT, "006")
    _make_student(db_session, ece_user, branch="ECE", semester=5)
    resp2 = client.get("/api/v1/community/events", headers=_auth(ece_user))
    assert resp2.status_code == 200
    event_ids = [e["id"] for e in resp2.get_json()["events"]]
    assert event_id in event_ids, "ECE student must see ECE-targeted event"


def test_global_event_visible_to_all_branches(client, db_session):
    admin = _make_user(db_session, UserRole.ADMIN, "007")
    resp = client.post("/api/v1/community/events", json={
        "title": "Annual Fest",
        "date_time": "Dec 24, 2025",
        "venue": "Ground",
        "event_type": "fest",
    }, headers=_auth(admin))
    assert resp.status_code == 201
    event_id = resp.get_json()["id"]

    for branch, suf in [("CSE", "008"), ("MECH", "009"), ("ECE", "010")]:
        u = _make_user(db_session, UserRole.STUDENT, suf)
        _make_student(db_session, u, branch=branch)
        r = client.get("/api/v1/community/events", headers=_auth(u))
        assert r.status_code == 200
        ids = [e["id"] for e in r.get_json()["events"]]
        assert event_id in ids, f"{branch} student must see global event"


# -- event registration / unregistration --------------------------------------

def test_student_can_register_and_unregister(client, db_session):
    admin = _make_user(db_session, UserRole.ADMIN, "011")
    ev_resp = client.post("/api/v1/community/events", json={
        "title": "Data Science Talk",
        "date_time": "Monday Dec 30 2025 3 PM",
        "venue": "Room 101",
        "event_type": "talk",
    }, headers=_auth(admin))
    assert ev_resp.status_code == 201
    event_id = ev_resp.get_json()["id"]

    stud = _make_user(db_session, UserRole.STUDENT, "012")
    _make_student(db_session, stud)

    # Register
    reg_resp = client.post(f"/api/v1/community/events/{event_id}/register",
                           json={}, headers=_auth(stud))
    assert reg_resp.status_code == 201, reg_resp.get_json()

    # Confirm stored with user_id (not student_id)
    er = EventRegistration.query.filter_by(
        event_id=uuid.UUID(event_id), user_id=stud.id
    ).first()
    assert er is not None, "EventRegistration must be keyed on user_id"

    # Duplicate registration should 409
    dup = client.post(f"/api/v1/community/events/{event_id}/register",
                      json={}, headers=_auth(stud))
    assert dup.status_code == 409

    # Unregister
    unreg = client.delete(f"/api/v1/community/events/{event_id}/register",
                          headers=_auth(stud))
    assert unreg.status_code == 200, unreg.get_json()
    er2 = EventRegistration.query.filter_by(
        event_id=uuid.UUID(event_id), user_id=stud.id
    ).first()
    assert er2 is None, "Registration must be deleted after unregister"


def test_student_cannot_register_for_different_branch_event(client, db_session):
    admin = _make_user(db_session, UserRole.ADMIN, "013")
    ev_resp = client.post("/api/v1/community/events", json={
        "title": "MECH Workshop",
        "date_time": "Dec 31, 2025",
        "venue": "Mech Lab",
        "event_type": "workshop",
        "class_branch": "MECH",
    }, headers=_auth(admin))
    assert ev_resp.status_code == 201
    event_id = ev_resp.get_json()["id"]

    cse_user = _make_user(db_session, UserRole.STUDENT, "014")
    _make_student(db_session, cse_user, branch="CSE")

    resp = client.post(f"/api/v1/community/events/{event_id}/register",
                       json={}, headers=_auth(cse_user))
    assert resp.status_code == 403, resp.get_json()


# -- admin approve / reject ---------------------------------------------------

def test_admin_can_approve_professor_event(client, db_session):
    prof_user = _make_user(db_session, UserRole.PROFESSOR, "015")
    ev_resp = client.post("/api/v1/community/events", json={
        "title": "Professor Workshop",
        "date_time": "Jan 5, 2026",
        "venue": "LH2",
        "event_type": "workshop",
    }, headers=_auth(prof_user))
    assert ev_resp.status_code == 201
    event_id = ev_resp.get_json()["id"]
    assert ev_resp.get_json()["approval_status"] == "pending"

    admin = _make_user(db_session, UserRole.ADMIN, "016")
    approve_resp = client.post(f"/api/v1/admin/events/{event_id}/approve",
                               headers=_auth(admin))
    assert approve_resp.status_code == 200, approve_resp.get_json()

    event = db_session.get(CampusEvent, uuid.UUID(event_id))
    assert event.approval_status == "live"


def test_admin_can_reject_professor_event(client, db_session):
    prof_user = _make_user(db_session, UserRole.PROFESSOR, "017")
    ev_resp = client.post("/api/v1/community/events", json={
        "title": "Bad Event",
        "date_time": "Jan 6, 2026",
        "venue": "LH3",
        "event_type": "general",
    }, headers=_auth(prof_user))
    assert ev_resp.status_code == 201
    event_id = ev_resp.get_json()["id"]

    admin = _make_user(db_session, UserRole.ADMIN, "018")
    reject_resp = client.post(f"/api/v1/admin/events/{event_id}/reject",
                              headers=_auth(admin))
    assert reject_resp.status_code == 200, reject_resp.get_json()

    event = db_session.get(CampusEvent, uuid.UUID(event_id))
    assert event.approval_status == "rejected"
