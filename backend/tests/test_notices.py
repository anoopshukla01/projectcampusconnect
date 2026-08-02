"""
Tests for DB health endpoint & Notice/Announcement system:
  - GET /health/db returns 200 with database connection status
  - create_notice stores college_id (fixes shared 500 crash cause)
  - structured audience targeting (target_audience, target_branch, target_semester)
  - is_pinned and is_urgent persistence and sorting
  - inline validation errors for missing title/content (400)
"""
import uuid
import pytest
from flask_jwt_extended import create_access_token
from app.models.user import User, UserRole
from app.models.college import DEFAULT_COLLEGE_ID
from app.models.community import Announcement

COLLEGE_ID = DEFAULT_COLLEGE_ID


def _make_user(db_session, role, suffix=""):
    u = User(
        id=uuid.uuid4(),
        phone=f"+918800{suffix:0>6}",
        email=f"user_{suffix}@college.edu.in",
        role=role,
        college_id=COLLEGE_ID,
        is_active=True,
    )
    db_session.add(u)
    db_session.commit()
    return u


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


# -- GET /health/db -----------------------------------------------------------

def test_health_db_returns_200(client):
    resp = client.get("/health/db")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"

    resp2 = client.get("/api/health/db")
    assert resp2.status_code == 200


# -- Notice creation & college_id persistence ----------------------------------

def test_create_notice_stores_college_id(client, db_session):
    tpo = _make_user(db_session, UserRole.PLACEMENT_CELL, "101")
    payload = {
        "title": "TCS Campus Drive 2026",
        "content": "Eligible branches: CSE, ECE. Registrations open now.",
        "target_audience": "students",
        "target_branch": "CSE",
        "target_semester": 6,
        "is_pinned": True,
        "is_urgent": False,
    }
    resp = client.post("/api/v1/placement/notices", json=payload, headers=_auth(tpo))
    assert resp.status_code == 201, resp.get_json()
    notice_id = uuid.UUID(resp.get_json()["id"])

    notice = db_session.get(Announcement, notice_id)
    assert notice is not None
    assert notice.college_id == COLLEGE_ID, "Notice must persist user.college_id"
    assert notice.target_branch == "CSE"
    assert notice.target_semester == 6
    assert notice.is_pinned is True
    assert notice.is_urgent is False


def test_create_notice_validation_error(client, db_session):
    tpo = _make_user(db_session, UserRole.PLACEMENT_CELL, "102")
    # Missing title
    resp = client.post("/api/v1/placement/notices", json={"title": "", "content": "Sample"}, headers=_auth(tpo))
    assert resp.status_code == 400
    assert "Title and content are required" in resp.get_json()["error"]

    # Missing content
    resp2 = client.post("/api/v1/placement/notices", json={"title": "Heading", "content": "  "}, headers=_auth(tpo))
    assert resp2.status_code == 400


# -- Notice listing, sorting & targeting --------------------------------------

def test_get_notices_sorting_and_tenancy(client, db_session):
    tpo = _make_user(db_session, UserRole.PLACEMENT_CELL, "103")
    headers = _auth(tpo)

    # Create regular notice
    client.post("/api/v1/placement/notices", json={
        "title": "Regular Notice", "content": "Info 1", "is_pinned": False, "is_urgent": False
    }, headers=headers)

    # Create urgent notice
    client.post("/api/v1/placement/notices", json={
        "title": "Urgent Notice", "content": "Info 2", "is_pinned": False, "is_urgent": True
    }, headers=headers)

    # Create pinned notice
    client.post("/api/v1/placement/notices", json={
        "title": "Pinned Notice", "content": "Info 3", "is_pinned": True, "is_urgent": False
    }, headers=headers)

    resp = client.get("/api/v1/placement/notices", headers=headers)
    assert resp.status_code == 200
    notices = resp.get_json()["notices"]
    assert len(notices) >= 3

    # Pinned notice should be first
    assert notices[0]["title"] == "Pinned Notice"
    assert notices[0]["pinned"] is True

    # Urgent notice should be second
    assert notices[1]["title"] == "Urgent Notice"
    assert notices[1]["urgent"] is True


def test_delete_notice(client, db_session):
    tpo = _make_user(db_session, UserRole.PLACEMENT_CELL, "104")
    headers = _auth(tpo)

    post_resp = client.post("/api/v1/placement/notices", json={
        "title": "Temporary Notice", "content": "To be deleted"
    }, headers=headers)
    notice_id = post_resp.get_json()["id"]

    del_resp = client.delete(f"/api/v1/placement/notices/{notice_id}", headers=headers)
    assert del_resp.status_code == 200

    n = db_session.get(Announcement, uuid.UUID(notice_id))
    assert n is None
