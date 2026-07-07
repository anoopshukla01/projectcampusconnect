import enum
import uuid
from datetime import datetime, timezone
from app.extensions import db
from werkzeug.security import generate_password_hash, check_password_hash

class UserRole(enum.Enum):
    STUDENT = "student"
    PROFESSOR = "professor"
    ADMIN = "admin"
    PLACEMENT_CELL = "placement_cell"

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = db.Column(db.String(255), unique=True, nullable=True)
    phone = db.Column(db.String(15), unique=True, nullable=True)
    password_hash = db.Column(db.String(255), nullable=True) # NULL for OTP-only registration phase
    role = db.Column(db.Enum(UserRole), nullable=False)
    is_active = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)
    failed_login_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    student_profile = db.relationship("StudentProfile", back_populates="user", uselist=False)
    professor_profile = db.relationship(
        "ProfessorProfile",
        back_populates="user",
        uselist=False,
        foreign_keys="ProfessorProfile.user_id",
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def is_locked(self):
        if self.locked_until:
            # self.locked_until might be naive, so we compare naive UTC datetimes
            now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
            if self.locked_until > now_naive:
                return True
        return False
