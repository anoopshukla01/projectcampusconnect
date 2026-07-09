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
    OfferStatus,
    BranchPlacement
)
from app.models.token import OTPToken, RefreshToken, Invite, OTPPurpose
from app.models.audit import AuditLog
from app.models.academic import Grade, AttendanceRecord, TimetableSlot, Assignment, AssignmentSubmission, Subject
from app.models.community import Announcement, CampusEvent, MarketplaceItem, LostFoundItem, StudyNote, LibraryResource
from app.models.chat import Conversation, GroupMembership, ChatMessage, ConversationType, GroupRole, MessageType
from app.models.content import (
    MentorProfile, MentorshipRequest, MentorshipRequestStatus,
    MockInterviewSession, MockInterviewBooking,
    LectureRecording, SyllabusProgress,
)
from app.models.notification import Notification

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
    "BranchPlacement",
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
    "Subject",
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
