"""
Chats Blueprint — WhatsApp-Style Messaging
"""

from flask import Blueprint, jsonify, request
from app.auth.permissions import require_auth, get_current_user
from app.extensions import db
from app.models.user import User, UserRole
from app.models.student import StudentProfile
from app.models.professor import ProfessorProfile
from app.models.chat import Conversation, GroupMembership, ChatMessage, ConversationType, GroupRole, MessageType
from app.utils.errors import error_response, internal_error_response
from datetime import datetime, timezone
import uuid

chats_bp = Blueprint("chats", __name__)

# Helper to safe-parse UUID
def parse_uuid(val):
    if not val:
        return None
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except ValueError:
        return None

# ── GET /chats ─────────────────────────────────────────────────────────────────
@chats_bp.route("", methods=["GET"])
@require_auth
def get_conversations():
    """Retrieve all conversations the user is a member of, sorted by updated_at."""
    user = get_current_user()
    memberships = GroupMembership.query.filter_by(user_id=user.id).all()
    conv_ids = [m.conversation_id for m in memberships]
    
    if not conv_ids:
        return jsonify({"rooms": []}), 200

    conversations = Conversation.query.filter(
        Conversation.id.in_(conv_ids),
        Conversation.is_deleted == False
    ).order_by(Conversation.updated_at.desc()).all()

    res = []
    for c in conversations:
        # Determine display name
        display_name = c.name
        if c.type == ConversationType.DIRECT:
            # Find the other member
            other_mem = GroupMembership.query.filter(
                GroupMembership.conversation_id == c.id,
                GroupMembership.user_id != user.id
            ).first()
            if other_mem:
                other_user = User.query.get(other_mem.user_id)
                if other_user:
                    if other_user.role == UserRole.STUDENT and other_user.student_profile:
                        display_name = other_user.student_profile.full_name
                    elif other_user.role == UserRole.PROFESSOR and other_user.professor_profile:
                        display_name = other_user.professor_profile.full_name
                    else:
                        display_name = other_user.email.split("@")[0]
            else:
                display_name = "Self Chat"

        last_msg = ChatMessage.query.filter_by(conversation_id=c.id, is_deleted=False).order_by(ChatMessage.created_at.desc()).first()
        
        # User role in this conversation
        user_mem = next((m for m in c.memberships if m.user_id == user.id), None)
        user_role = user_mem.role.value if user_mem else "member"

        res.append({
            "id": str(c.id),
            "name": display_name,
            "type": c.type.value,
            "class_code": c.class_code,
            "branch": c.branch,
            "semester": c.semester,
            "user_role": user_role,
            "lastMessage": last_msg.content if last_msg else None,
            "lastTime": last_msg.created_at.strftime("%I:%M %p") if last_msg else None,
            "unread": False
        })

    return jsonify({"rooms": res}), 200


# ── GET /chats/contacts ────────────────────────────────────────────────────────
@chats_bp.route("/contacts", methods=["GET"])
@require_auth
def get_contacts():
    """List students and professors to start a new direct message conversation."""
    user = get_current_user()
    
    students = StudentProfile.query.filter_by(is_deleted=False).all()
    professors = ProfessorProfile.query.filter_by(is_deleted=False).all()

    student_list = [{
        "user_id": str(s.user_id),
        "name": s.full_name,
        "roll": s.roll_no,
        "branch": s.branch,
        "role": "student"
    } for s in students if s.user_id != user.id]

    prof_list = [{
        "user_id": str(p.user_id),
        "name": p.full_name,
        "designation": p.designation,
        "role": "professor"
    } for p in professors if p.user_id != user.id]

    return jsonify({
        "students": student_list,
        "professors": prof_list
    }), 200


# ── POST /chats/create ─────────────────────────────────────────────────────────
@chats_bp.route("/create", methods=["POST"])
@require_auth
def create_conversation():
    """Create a new direct (1:1) message or private/subject group."""
    user = get_current_user()
    data = request.get_json() or {}
    conv_type_str = data.get("type", "direct")
    
    try:
        conv_type = ConversationType(conv_type_str)
    except ValueError:
        return error_response(f"Invalid conversation type '{conv_type_str}'", 400)

    if conv_type == ConversationType.DIRECT:
        recipient_id_str = data.get("recipient_id")
        recipient_id = parse_uuid(recipient_id_str)
        if not recipient_id:
            return error_response("Valid recipient_id is required for direct chat", 400)
        
        # Check if direct conversation already exists
        existing_mem = db.session.query(GroupMembership.conversation_id).join(Conversation).filter(
            Conversation.type == ConversationType.DIRECT,
            GroupMembership.user_id.in_([user.id, recipient_id])
        ).group_by(GroupMembership.conversation_id).having(db.func.count(GroupMembership.conversation_id) == 2).first()

        if existing_mem:
            c = Conversation.query.get(existing_mem.conversation_id)
            return jsonify({"conversation_id": str(c.id), "name": c.name, "type": "direct"}), 200

        # Create new direct conversation
        c = Conversation(type=ConversationType.DIRECT)
        db.session.add(c)
        db.session.flush()

        m1 = GroupMembership(conversation_id=c.id, user_id=user.id, role=GroupRole.MEMBER)
        m2 = GroupMembership(conversation_id=c.id, user_id=recipient_id, role=GroupRole.MEMBER)
        db.session.add_all([m1, m2])
        db.session.commit()
        return jsonify({"conversation_id": str(c.id), "type": "direct"}), 201

    elif conv_type == ConversationType.PRIVATE:
        name = data.get("name")
        if not name or not name.strip():
            return error_response("Group name is required", 400)

        c = Conversation(name=name.strip(), type=ConversationType.PRIVATE)
        db.session.add(c)
        db.session.flush()

        # Add creator as admin
        admin_membership = GroupMembership(
            conversation_id=c.id,
            user_id=user.id,
            role=GroupRole.ADMIN
        )
        db.session.add(admin_membership)

        # Invite additional users
        invited_ids = data.get("invited_user_ids", [])
        for uid_str in invited_ids:
            uid = parse_uuid(uid_str)
            if uid and uid != user.id:
                m = GroupMembership(conversation_id=c.id, user_id=uid, role=GroupRole.MEMBER)
                db.session.add(m)

        db.session.commit()
        return jsonify({"conversation_id": str(c.id), "type": "private"}), 201

    return error_response("Unsupported request configuration", 400)


# ── POST /chats/leave ──────────────────────────────────────────────────────────
@chats_bp.route("/leave", methods=["POST"])
@require_auth
def leave_conversation():
    """Leave a private chat group."""
    user = get_current_user()
    data = request.get_json() or {}
    conv_id = parse_uuid(data.get("conversation_id"))
    if not conv_id:
        return error_response("Valid conversation_id is required", 400)

    conv = Conversation.query.get_or_404(conv_id)
    if conv.type in [ConversationType.OFFICIAL, ConversationType.SUBJECT]:
        return error_response("Cannot leave mandatory institutional/subject groups.", 403)

    GroupMembership.query.filter_by(conversation_id=conv.id, user_id=user.id).delete()
    db.session.commit()
    return jsonify({"message": "Successfully left the group"}), 200


# ── Member Administration (Private Groups Only) ───────────────────────────────
@chats_bp.route("/members/add", methods=["POST"])
@require_auth
def add_member():
    user = get_current_user()
    data = request.get_json() or {}
    conv_id = parse_uuid(data.get("conversation_id"))
    new_user_id = parse_uuid(data.get("user_id"))

    if not conv_id or not new_user_id:
        return error_response("Valid conversation_id and user_id are required", 400)

    # Authorize: must be admin or co_admin
    my_mem = GroupMembership.query.filter_by(conversation_id=conv_id, user_id=user.id).first()
    if not my_mem or my_mem.role not in [GroupRole.ADMIN, GroupRole.CO_ADMIN]:
        return error_response("Only admins or co-admins can add members", 403)

    # Check if already member
    exist = GroupMembership.query.filter_by(conversation_id=conv_id, user_id=new_user_id).first()
    if exist:
        return error_response("User is already a member of this conversation", 400)

    m = GroupMembership(conversation_id=conv_id, user_id=new_user_id, role=GroupRole.MEMBER)
    db.session.add(m)
    db.session.commit()
    return jsonify({"message": "Member added successfully"}), 200


@chats_bp.route("/members/remove", methods=["POST"])
@require_auth
def remove_member():
    user = get_current_user()
    data = request.get_json() or {}
    conv_id = parse_uuid(data.get("conversation_id"))
    target_user_id = parse_uuid(data.get("user_id"))

    if not conv_id or not target_user_id:
        return error_response("Valid conversation_id and user_id are required", 400)

    my_mem = GroupMembership.query.filter_by(conversation_id=conv_id, user_id=user.id).first()
    if not my_mem or my_mem.role not in [GroupRole.ADMIN, GroupRole.CO_ADMIN]:
        return error_response("Only admins or co-admins can remove members", 403)

    # Prevent removing original creator if creator is Admin
    target_mem = GroupMembership.query.filter_by(conversation_id=conv_id, user_id=target_user_id).first()
    if target_mem and target_mem.role == GroupRole.ADMIN:
        return error_response("Cannot remove the primary administrator", 403)

    GroupMembership.query.filter_by(conversation_id=conv_id, user_id=target_user_id).delete()
    db.session.commit()
    return jsonify({"message": "Member removed successfully"}), 200


@chats_bp.route("/members/promote", methods=["POST"])
@require_auth
def promote_member():
    user = get_current_user()
    data = request.get_json() or {}
    conv_id = parse_uuid(data.get("conversation_id"))
    target_user_id = parse_uuid(data.get("user_id"))

    if not conv_id or not target_user_id:
        return error_response("Valid conversation_id and user_id are required", 400)

    my_mem = GroupMembership.query.filter_by(conversation_id=conv_id, user_id=user.id).first()
    if not my_mem or my_mem.role not in [GroupRole.ADMIN, GroupRole.CO_ADMIN]:
        return error_response("Only admins or co-admins can promote members", 403)

    target_mem = GroupMembership.query.filter_by(conversation_id=conv_id, user_id=target_user_id).first()
    if not target_mem:
        return error_response("User is not in the group", 404)

    target_mem.role = GroupRole.CO_ADMIN
    db.session.commit()
    return jsonify({"message": "Member promoted to co-admin successfully"}), 200


# ── GET /chats/<conversation_id>/messages ──────────────────────────────────────
@chats_bp.route("/<conversation_id>/messages", methods=["GET"])
@require_auth
def get_messages(conversation_id):
    """Retrieve message history for a conversation."""
    user = get_current_user()
    conv_uuid = parse_uuid(conversation_id)
    if not conv_uuid:
        return error_response("Invalid conversation_id format", 400)

    # Check if user is a member
    mem = GroupMembership.query.filter_by(conversation_id=conv_uuid, user_id=user.id).first()
    if not mem:
        return error_response("You are not a member of this conversation", 403)

    messages = ChatMessage.query.filter_by(
        conversation_id=conv_uuid,
        is_deleted=False
    ).order_by(ChatMessage.created_at.asc()).all()

    res = []
    for m in messages:
        sender_name = "System"
        if m.sender:
            if m.sender.role == UserRole.STUDENT and m.sender.student_profile:
                sender_name = m.sender.student_profile.full_name
            elif m.sender.role == UserRole.PROFESSOR and m.sender.professor_profile:
                sender_name = m.sender.professor_profile.full_name
            else:
                sender_name = m.sender.email.split("@")[0]

        res.append({
            "id": str(m.id),
            "sender": sender_name,
            "sender_id": str(m.sender_id) if m.sender_id else None,
            "text": m.content,
            "time": m.created_at.strftime("%I:%M %p"),
            "out": m.sender_id == user.id
        })

    return jsonify({"messages": res}), 200


# ── POST /chats/<conversation_id>/messages/send ────────────────────────────────
@chats_bp.route("/<conversation_id>/messages/send", methods=["POST"])
@require_auth
def send_message(conversation_id):
    """Send a message to a conversation."""
    user = get_current_user()
    conv_uuid = parse_uuid(conversation_id)
    if not conv_uuid:
        return error_response("Invalid conversation_id format", 400)

    data = request.get_json() or {}
    content = data.get("content")

    if not content or not content.strip():
        return error_response("Message content is required", 400)

    # Verify membership
    mem = GroupMembership.query.filter_by(conversation_id=conv_uuid, user_id=user.id).first()
    if not mem:
        return error_response("You are not a member of this conversation", 403)

    m = ChatMessage(
        conversation_id=conv_uuid,
        sender_id=user.id,
        content=content.strip(),
        message_type=MessageType.TEXT
    )
    db.session.add(m)

    # Touch updated_at for conversation sorting
    conv = Conversation.query.get(conv_uuid)
    conv.updated_at = datetime.now(timezone.utc)

    db.session.commit()
    return jsonify({
        "id": str(m.id),
        "sender_id": str(user.id),
        "text": m.content,
        "time": m.created_at.strftime("%I:%M %p"),
        "out": True
    }), 201


@chats_bp.route("/join", methods=["POST"])
@require_auth
def join_group():
    """Join a private group by ID."""
    user = get_current_user()
    data = request.get_json() or {}
    conv_id = parse_uuid(data.get("conversation_id"))
    if not conv_id:
        return error_response("Valid conversation_id is required", 400)

    conv = Conversation.query.get_or_404(conv_id)
    if conv.type != ConversationType.PRIVATE:
        return error_response("Can only join private groups", 400)

    # Check if already member
    exist = GroupMembership.query.filter_by(conversation_id=conv_id, user_id=user.id).first()
    if exist:
        return error_response("You are already a member of this group", 400)

    m = GroupMembership(conversation_id=conv_id, user_id=user.id, role=GroupRole.MEMBER)
    db.session.add(m)
    db.session.commit()
    return jsonify({
        "message": "Joined group successfully",
        "conversation_id": str(conv.id),
        "name": conv.name
    }), 200
