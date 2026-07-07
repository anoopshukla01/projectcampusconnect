import enum
import uuid
from datetime import datetime, timezone
from app.extensions import db

class ConversationType(enum.Enum):
    DIRECT = "direct"
    OFFICIAL = "official"
    SUBJECT = "subject"
    PRIVATE = "private"

class GroupRole(enum.Enum):
    MEMBER = "member"
    ADMIN = "admin"
    CO_ADMIN = "co_admin"

class MessageType(enum.Enum):
    TEXT = "text"
    ATTACHMENT = "attachment"

class Conversation(db.Model):
    __tablename__ = "conversations"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = db.Column(db.String(255), nullable=True)
    type = db.Column(db.Enum(ConversationType), nullable=False)
    class_code = db.Column(db.String(50), nullable=True)
    branch = db.Column(db.String(50), nullable=True)
    semester = db.Column(db.Integer, nullable=True)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    memberships = db.relationship("GroupMembership", back_populates="conversation", cascade="all, delete-orphan")
    messages = db.relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan")

class GroupMembership(db.Model):
    __tablename__ = "group_memberships"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = db.Column(db.Enum(GroupRole), default=GroupRole.MEMBER, nullable=False)
    joined_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    is_muted = db.Column(db.Boolean, default=False, nullable=False)

    conversation = db.relationship("Conversation", back_populates="memberships")
    user = db.relationship("User", backref=db.backref("chat_memberships", cascade="all, delete-orphan"))

    __table_args__ = (db.UniqueConstraint("conversation_id", "user_id", name="uq_conversation_user"),)

class ChatMessage(db.Model):
    __tablename__ = "chat_messages"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender_id = db.Column(db.UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content = db.Column(db.Text, nullable=False)
    message_type = db.Column(db.Enum(MessageType), default=MessageType.TEXT, nullable=False)
    file_url = db.Column(db.String(1000), nullable=True)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    deleted_at = db.Column(db.DateTime, nullable=True)

    conversation = db.relationship("Conversation", back_populates="messages")
    sender = db.relationship("User", backref="sent_messages")

# ── SQLAlchemy event listeners for auto-sync ──────────────────────────────────
from sqlalchemy import event

def reconcile_student_chat_memberships(session, target):
    """
    Auto-sync student to matching Official Group.
    """
    from app.models.chat import Conversation, GroupMembership, ConversationType, GroupRole
    
    if not target.branch or not target.semester:
        return

    # Find/create official group
    official_conv = session.query(Conversation).filter_by(
        type=ConversationType.OFFICIAL,
        branch=target.branch,
        semester=target.semester
    ).first()
    
    if not official_conv:
        official_conv = Conversation(
            name=f"{target.branch} Semester {target.semester} Official Group",
            type=ConversationType.OFFICIAL,
            branch=target.branch,
            semester=target.semester
        )
        session.add(official_conv)

    # Ensure user is in this conversation
    mem = None
    if official_conv.id:
        mem = session.query(GroupMembership).filter_by(
            conversation_id=official_conv.id,
            user_id=target.user_id
        ).first()

    if not mem:
        unsaved = [x for x in session.new if isinstance(x, GroupMembership) and x.user_id == target.user_id]
        matching = [x for x in unsaved if x.conversation == official_conv or x.conversation_id == official_conv.id]
        if not matching:
            mem = GroupMembership(
                conversation=official_conv,
                user_id=target.user_id,
                role=GroupRole.MEMBER
            )
            session.add(mem)

    # Remove student from other official groups
    other_convs = session.query(Conversation).filter(
        Conversation.type == ConversationType.OFFICIAL,
        (Conversation.branch != target.branch) | (Conversation.semester != target.semester)
    ).all()
    for oc in other_convs:
        session.query(GroupMembership).filter_by(
            conversation_id=oc.id,
            user_id=target.user_id
        ).delete()

def reconcile_professor_chat_memberships(session, target):
    """
    Auto-sync professor to subject groups they teach.
    """
    from app.models.chat import Conversation, GroupMembership, ConversationType, GroupRole
    from app.models.academic import TimetableSlot

    slots = session.query(TimetableSlot).filter_by(professor_name=target.full_name).all()
    subject_codes = {s.course_code for s in slots if s.course_code}
    
    for code in subject_codes:
        slot = next(s for s in slots if s.course_code == code)
        sub_conv = session.query(Conversation).filter_by(
            type=ConversationType.SUBJECT,
            class_code=code
        ).first()
        if not sub_conv:
            sub_conv = Conversation(
                name=f"{slot.course_name} ({code}) Group",
                type=ConversationType.SUBJECT,
                class_code=code
            )
            session.add(sub_conv)

        mem = None
        if sub_conv.id:
            mem = session.query(GroupMembership).filter_by(
                conversation_id=sub_conv.id,
                user_id=target.user_id
            ).first()

        if not mem:
            unsaved = [x for x in session.new if isinstance(x, GroupMembership) and x.user_id == target.user_id]
            matching = [x for x in unsaved if x.conversation == sub_conv or x.conversation_id == sub_conv.id]
            if not matching:
                mem = GroupMembership(
                    conversation=sub_conv,
                    user_id=target.user_id,
                    role=GroupRole.ADMIN
                )
                session.add(mem)

def chat_before_flush(session, flush_context, instances):
    from app.models.student import StudentProfile
    from app.models.professor import ProfessorProfile

    for obj in session.new.union(session.dirty):
        if isinstance(obj, StudentProfile):
            reconcile_student_chat_memberships(session, obj)
        elif isinstance(obj, ProfessorProfile):
            reconcile_professor_chat_memberships(session, obj)

event.listen(db.session, "before_flush", chat_before_flush)


