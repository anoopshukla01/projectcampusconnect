from app.models.college import College
from app.models.user import User, UserRole
from app.models.student import StudentProfile, StudentResume
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
    BranchPlacement,
    Company,
    EligibilityOverride
)

from app.models.token import OTPToken, RefreshToken, Invite, OTPPurpose
from app.models.audit import AuditLog
from app.models.academic import (
    Grade, AttendanceRecord, TimetableSlot, Assignment, AssignmentSubmission,
    Subject, GradeRevision,
    ProfessorClassAssignment, GradeResultLock, ReEvaluationRequest, ReEvalStatus,
    TimetableBooking, ProfessorCheckIn,
)
from app.models.community import (
    Announcement, CampusEvent, MarketplaceItem, LostFoundItem,
    StudyNote, LibraryResource, LibraryRequest, LibraryRequestStatus,
    EventRegistration, AdminDetailRequest, ModerationReport,
    OfficialMerchandise, MerchandiseOrder,
)
from app.models.chat import Conversation, GroupMembership, ChatMessage, ConversationType, GroupRole, MessageType, StudentBlock, StudentReport
from app.models.content import (
    MentorProfile, MentorshipRequest, MentorshipRequestStatus,
    MockInterviewSession, MockInterviewBooking,
    LectureRecording, SyllabusProgress,
)
from app.models.notification import Notification
from app.models.rule import SystemRule

__all__ = [
    "College",
    "User", "UserRole",
    "StudentProfile", "StudentResume",
    "ProfessorProfile", "ApprovalStatus",
    "PlacementDrive", "DriveApplication", "DriveShortlist", "PlacementOffer",
    "DriveType", "DriveStatus", "ApplicationStatus", "ShortlistStatus", "OfferStatus",
    "BranchPlacement", "Company", "EligibilityOverride",
    "OTPToken", "RefreshToken", "Invite", "OTPPurpose",
    "AuditLog",
    "Grade", "GradeRevision", "AttendanceRecord", "TimetableSlot",
    "Assignment", "AssignmentSubmission", "Subject",
    "ProfessorClassAssignment", "GradeResultLock", "ReEvaluationRequest", "ReEvalStatus",
    "TimetableBooking", "ProfessorCheckIn",
    "Announcement", "CampusEvent", "MarketplaceItem", "LostFoundItem",
    "StudyNote", "LibraryResource", "LibraryRequest", "LibraryRequestStatus",
    "EventRegistration", "AdminDetailRequest", "ModerationReport",
    "OfficialMerchandise", "MerchandiseOrder",
    "Conversation", "GroupMembership", "ChatMessage", "ConversationType",
    "GroupRole", "MessageType", "StudentBlock", "StudentReport",
    "MentorProfile", "MentorshipRequest", "MentorshipRequestStatus",
    "MockInterviewSession", "MockInterviewBooking",
    "LectureRecording", "SyllabusProgress",
    "Notification", "SystemRule",
]
