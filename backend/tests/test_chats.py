import pytest
from flask_jwt_extended import create_access_token
from app.extensions import db
from app.models.user import User, UserRole
from app.models.student import StudentProfile
from app.models.chat import Conversation, GroupMembership, ChatMessage, ConversationType, GroupRole

from app.models.college import DEFAULT_COLLEGE_ID

@pytest.fixture
def chat_test_setup(db_session):
    # Setup test users
    s1 = User(college_id=DEFAULT_COLLEGE_ID, phone="9900000001", role=UserRole.STUDENT, is_active=True)
    s1.set_password("Pass1")
    db_session.add(s1)
    db_session.flush()

    profile1 = StudentProfile(
        user_id=s1.id,
        roll_no="CS1001",
        full_name="Alice",
        branch="CS",
        batch_year=2026,
        semester=6,
        cgpa=8.5,
        dpdp_consent_given=True
    )
    db_session.add(profile1)

    s2 = User(college_id=DEFAULT_COLLEGE_ID, phone="9900000002", role=UserRole.STUDENT, is_active=True)
    s2.set_password("Pass2")
    db_session.add(s2)
    db_session.flush()

    profile2 = StudentProfile(
        user_id=s2.id,
        roll_no="CS1002",
        full_name="Bob",
        branch="CS",
        batch_year=2026,
        semester=6,
        cgpa=8.0,
        dpdp_consent_given=True
    )
    db_session.add(profile2)

    s3 = User(college_id=DEFAULT_COLLEGE_ID, phone="9900000003", role=UserRole.STUDENT, is_active=True)
    s3.set_password("Pass3")
    db_session.add(s3)
    db_session.flush()

    profile3 = StudentProfile(
        user_id=s3.id,
        roll_no="ME1001",
        full_name="Charlie",
        branch="ME",
        batch_year=2026,
        semester=6,
        cgpa=7.5,
        dpdp_consent_given=True
    )
    db_session.add(profile3)

    db_session.commit()
    return {
        "student1": s1,
        "student2": s2,
        "student3": s3
    }

def test_auto_sync_official_groups(chat_test_setup, db_session):
    # Verify s1 and s2 are placed in CS Sem 6 Group
    c_cs = Conversation.query.filter_by(type=ConversationType.OFFICIAL, branch="CS", semester=6).first()
    assert c_cs is not None
    assert c_cs.name == "CS Semester 6 Official Group"

    mems = [str(m.user_id) for m in c_cs.memberships]
    assert str(chat_test_setup["student1"].id) in mems
    assert str(chat_test_setup["student2"].id) in mems
    assert str(chat_test_setup["student3"].id) not in mems

    # Charlie should be in ME Sem 6
    c_me = Conversation.query.filter_by(type=ConversationType.OFFICIAL, branch="ME", semester=6).first()
    assert c_me is not None
    mems_me = [str(m.user_id) for m in c_me.memberships]
    assert str(chat_test_setup["student3"].id) in mems_me

def test_get_conversations_api(client, chat_test_setup):
    token = create_access_token(identity=str(chat_test_setup["student1"].id))
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/career/chats", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    print("DEBUG GET CONVERSATIONS:", data)
    assert "rooms" in data
    # Should see the CS Sem 6 official group
    types = [r["type"] for r in data["rooms"]]
    assert "official" in types

def test_create_and_send_direct_message(client, chat_test_setup):
    s1 = chat_test_setup["student1"]
    s2 = chat_test_setup["student2"]

    token = create_access_token(identity=str(s1.id))
    headers = {"Authorization": f"Bearer {token}"}

    # Create DM
    resp = client.post("/api/v1/career/chats/create", json={
        "type": "direct",
        "recipient_id": str(s2.id)
    }, headers=headers)
    assert resp.status_code in [200, 201]
    conv_id = resp.get_json()["conversation_id"]

    # Send message
    resp_send = client.post(f"/api/v1/career/chats/{conv_id}/messages/send", json={
        "content": "Hi Bob!"
    }, headers=headers)
    assert resp_send.status_code == 201

    # Fetch messages
    resp_fetch = client.get(f"/api/v1/career/chats/{conv_id}/messages", headers=headers)
    assert resp_fetch.status_code == 200
    messages = resp_fetch.get_json()["messages"]
    assert len(messages) == 1
    assert messages[0]["text"] == "Hi Bob!"
    assert messages[0]["out"] is True

def test_private_group_administration(client, chat_test_setup):
    s1 = chat_test_setup["student1"]
    s2 = chat_test_setup["student2"]
    s3 = chat_test_setup["student3"]

    token1 = create_access_token(identity=str(s1.id))
    headers1 = {"Authorization": f"Bearer {token1}"}

    # S1 creates group
    resp_create = client.post("/api/v1/career/chats/create", json={
        "type": "private",
        "name": "Hackathon 2026",
        "invited_user_ids": [str(s2.id)]
    }, headers=headers1)
    assert resp_create.status_code == 201
    conv_id = resp_create.get_json()["conversation_id"]

    # S1 promotes S2 to co-admin
    resp_promote = client.post("/api/v1/career/chats/members/promote", json={
        "conversation_id": conv_id,
        "user_id": str(s2.id)
    }, headers=headers1)
    assert resp_promote.status_code == 200

    # S2 (co-admin) adds S3
    token2 = create_access_token(identity=str(s2.id))
    headers2 = {"Authorization": f"Bearer {token2}"}
    resp_add = client.post("/api/v1/career/chats/members/add", json={
        "conversation_id": conv_id,
        "user_id": str(s3.id)
    }, headers=headers2)
    assert resp_add.status_code == 200

    # S3 (normal member) tries to remove S1 (creator) -> Forbidden
    token3 = create_access_token(identity=str(s3.id))
    headers3 = {"Authorization": f"Bearer {token3}"}
    resp_remove = client.post("/api/v1/career/chats/members/remove", json={
        "conversation_id": conv_id,
        "user_id": str(s1.id)
    }, headers=headers3)
    assert resp_remove.status_code == 403

def test_join_group(client, chat_test_setup):
    s1 = chat_test_setup["student1"]
    s2 = chat_test_setup["student2"]

    token1 = create_access_token(identity=str(s1.id))
    headers1 = {"Authorization": f"Bearer {token1}"}

    # S1 creates group
    resp_create = client.post("/api/v1/career/chats/create", json={
        "type": "private",
        "name": "Public Study Group"
    }, headers=headers1)
    assert resp_create.status_code == 201
    conv_id = resp_create.get_json()["conversation_id"]

    # S2 joins the group
    token2 = create_access_token(identity=str(s2.id))
    headers2 = {"Authorization": f"Bearer {token2}"}
    resp_join = client.post("/api/v1/career/chats/join", json={
        "conversation_id": conv_id
    }, headers=headers2)
    assert resp_join.status_code == 200
    assert resp_join.get_json()["conversation_id"] == conv_id
