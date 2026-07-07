from app.models.user import User, UserRole
from app.models.student import StudentProfile
from app.models.professor import ProfessorProfile, ApprovalStatus
from app.models.placement import (
    PlacementDrive,
    DriveApplication,
    DriveShortlist,
    PlacementOffer,
    DriveType,
    DriveStatus,
    ApplicationStatus,
    ShortlistStatus,
    OfferStatus
)
from app.models.token import OTPToken, RefreshToken, Invite, OTPPurpose
from app.models.audit import AuditLog
from app.models.academic import Grade, AttendanceRecord, TimetableSlot, Assignment, AssignmentSubmission
from app.models.community import Announcement, CampusEvent, MarketplaceItem, LostFoundItem, StudyNote, LibraryResource
from app.models.chat import Conversation, GroupMembership, ChatMessage, ConversationType, GroupRole, MessageType

__all__ = [
    "User",
    "UserRole",
    "StudentProfile",
    "ProfessorProfile",
    "ApprovalStatus",
    "PlacementDrive",
    "DriveApplication",
    "DriveShortlist",
    "PlacementOffer",
    "DriveType",
    "DriveStatus",
    "ApplicationStatus",
    "ShortlistStatus",
    "OfferStatus",
    "OTPToken",
    "RefreshToken",
    "Invite",
    "OTPPurpose",
    "AuditLog",
    "Grade",
    "AttendanceRecord",
    "TimetableSlot",
    "Assignment",
    "AssignmentSubmission",
    "Announcement",
    "CampusEvent",
    "MarketplaceItem",
    "LostFoundItem",
    "StudyNote",
    "LibraryResource",
    "Conversation",
    "GroupMembership",
    "ChatMessage",
    "ConversationType",
    "GroupRole",
    "MessageType"
]
