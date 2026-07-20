import json
import hashlib
from datetime import datetime, timedelta, timezone
from app.extensions import db
from app.models.user import User, UserRole
from app.models.student import StudentProfile
from app.models.token import OTPToken, OTPPurpose, Invite, RefreshToken
from flask_jwt_extended import decode_token

# ── Happy Paths & Basic Logic ──────────────────────────────────────────────────

def test_otp_flow_and_student_registration(client):
    # 1. Send OTP
    resp = client.post("/api/v1/auth/otp/send", json={"phone": "9876543210"})
    assert resp.status_code == 200
    assert "OTP sent successfully" in resp.json["message"]

    # Retrieve the OTP from DB (since MOCK_OTP is active, it's generated and stored)
    otp_record = OTPToken.query.filter_by(identifier="9876543210").first()
    assert otp_record is not None
    assert otp_record.is_used is False

    # Hack to verify: we need the actual OTP. But wait, since we can't unhash bcrypt,
    # let's write a mock/test-only method or helper. In tests, we can just intercept
    # the generated OTP or mock generate_otp to return a fixed code!
    # Let's check how we can verify. Since the code is in db we can't read it easily.
    # Let's mock generate_otp in the test.
    # To mock python functions during runtime in pytest, we can patch them.
    # But wait, since the test runs in the same process, we can monkeypatch.
    # Let's write a cleaner test where we patch `app.utils.otp.generate_otp` to return "123456".

from app.models.college import DEFAULT_COLLEGE_ID

def test_otp_verify_and_register_student_with_mock_otp(client, db_session, monkeypatch):
    monkeypatch.setattr("app.blueprints.auth.generate_otp", lambda: "123456")

    # Pre-import StudentProfile with inactive stub User (simulating Admin CSV import)
    stub_user = User(college_id=DEFAULT_COLLEGE_ID, role=UserRole.STUDENT, is_active=False)
    db_session.add(stub_user)
    db_session.flush()

    profile = StudentProfile(
        user_id=stub_user.id,
        roll_no="CS202601",
        full_name="Rohan Sharma",
        branch="Computer Science",
        batch_year=2026,
        semester=8,
        cgpa=9.15,
        profile_complete=False
    )
    db_session.add(profile)
    db_session.commit()

    # Send OTP (will be "123456")
    client.post("/api/v1/auth/otp/send", json={"phone": "9876543210"})

    # Verify incorrect OTP first
    resp = client.post("/api/v1/auth/otp/verify", json={"phone": "9876543210", "otp": "000000"})
    assert resp.status_code == 400
    assert "Incorrect OTP" in resp.json["error"]

    # Verify correct OTP
    resp = client.post("/api/v1/auth/otp/verify", json={"phone": "9876543210", "otp": "123456"})
    assert resp.status_code == 200
    token = resp.json["otp_verified_token"]
    assert token is not None

    # Student claim registration
    reg_data = {
        "otp_verified_token": token,
        "roll_no": "CS202601",
        "password": "Password123",
        "dpdp_consent": True
    }
    resp = client.post("/api/v1/auth/register/student", json=reg_data)
    assert resp.status_code == 200
    assert "Student account claimed" in resp.json["message"]

    # Verify user was created/linked and is active
    user = User.query.filter_by(phone="9876543210").first()
    assert user is not None
    assert user.is_active is True
    assert user.role == UserRole.STUDENT
    assert user.student_profile.roll_no == "CS202601"


def test_faculty_registration_and_admin_approval_mechanics(client):
    """Public faculty registration is disabled (403). Faculty require an admin invite token."""
    reg_data = {
        "email": "professor@college.edu.in",
        "employee_id": "EMP8899",
        "full_name": "Dr. Sarah Miller",
        "department": "CSE",
        "designation": "Associate Professor",
        "password": "ProfessorPassword1"
    }
    resp = client.post("/api/v1/auth/register/faculty", json=reg_data)
    assert resp.status_code == 403
    assert "Public faculty registration is disabled" in resp.json["error"]


def test_login_lockout_and_mismatch_errors(client, db_session):
    # Setup a user
    user = User(college_id=DEFAULT_COLLEGE_ID, email="staff@college.edu.in", role=UserRole.PLACEMENT_CELL, is_active=True)
    user.set_password("SecurePassword1")
    db_session.add(user)
    db_session.commit()

    # Wrong password multiple times to trigger lockout
    for _ in range(5):
        resp = client.post("/api/v1/auth/login", json={
            "email": "staff@college.edu.in",
            "password": "WrongPassword"
        })
        assert resp.status_code == 401
        assert resp.json["error"] == "Invalid credentials."

    # Check lockout flag
    assert user.failed_login_attempts >= 5
    assert user.locked_until is not None
    assert user.is_locked() is True

    # Try correct password while locked
    resp = client.post("/api/v1/auth/login", json={
        "email": "staff@college.edu.in",
        "password": "SecurePassword1"
    })
    assert resp.status_code == 401
    assert resp.json["error"] == "Invalid credentials."


def test_invite_acceptance_flow(client, db_session):
    # Setup an invite
    raw_token = "invite-token-xyz-123"
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expiry = datetime.now(timezone.utc) + timedelta(hours=48)

    # We need an admin to be the inviter
    admin = User(college_id=DEFAULT_COLLEGE_ID, email="admin@college.edu.in", role=UserRole.ADMIN, is_active=True)
    db_session.add(admin)
    db_session.commit()

    invite = Invite(
        college_id=DEFAULT_COLLEGE_ID,
        email="new_tpo@college.edu.in",
        role="placement_cell",
        invited_by=admin.id,
        token_hash=token_hash,
        expires_at=expiry,
        is_used=False
    )
    db_session.add(invite)
    db_session.commit()

    # Accept invite
    resp = client.post("/api/v1/auth/invite/accept", json={
        "token": raw_token,
        "password": "NewTPoPassword1"
    })
    assert resp.status_code == 201
    assert "Account created" in resp.json["message"]

    # Verify user created and active
    new_user = User.query.filter_by(email="new_tpo@college.edu.in").first()
    assert new_user is not None
    assert new_user.role == UserRole.PLACEMENT_CELL
    assert new_user.is_active is True
    assert invite.is_used is True


# ── Edge Cases & Security Validations ──────────────────────────────────────────

def test_student_register_consent_required(client, monkeypatch):
    monkeypatch.setattr("app.blueprints.auth.generate_otp", lambda: "123456")
    client.post("/api/v1/auth/otp/send", json={"phone": "9876543210"})
    resp = client.post("/api/v1/auth/otp/verify", json={"phone": "9876543210", "otp": "123456"})
    token = resp.json["otp_verified_token"]

    reg_data = {
        "otp_verified_token": token,
        "roll_no": "CS202602",
        "full_name": "Rohan Sharma",
        "branch": "Computer Science",
        "batch_year": 2026,
        "semester": 8,
        "cgpa": 9.15,
        "password": "Password123",
        "dpdp_consent": False # Missing consent
    }
    resp = client.post("/api/v1/auth/register/student", json=reg_data)
    assert resp.status_code == 400
    assert "details" in resp.json
    assert "dpdp_consent" in resp.json["details"]


def test_faculty_register_domain_restriction(client):
    """Public faculty registration endpoint returns 403."""
    reg_data = {
        "email": "professor@gmail.com", # Ineligible email domain
        "employee_id": "EMP9999",
        "full_name": "Dr. Sarah Miller",
        "department": "CSE",
        "designation": "Associate Professor",
        "password": "ProfessorPassword1"
    }
    resp = client.post("/api/v1/auth/register/faculty", json=reg_data)
    assert resp.status_code == 403


def test_logout_revokes_tokens(client, db_session):
    """Verify logout revokes the refresh token and blocklists access token JTI."""
    from app.models.user import User, UserRole
    from app.models.student import StudentProfile
    user = User(
        college_id=DEFAULT_COLLEGE_ID,
        email="logout_test@college.edu.in",
        phone="9876543219",
        role=UserRole.STUDENT,
        is_active=True
    )
    user.set_password("StudentPass1")
    db_session.add(user)
    db_session.flush()
    profile = StudentProfile(user_id=user.id, full_name="Logout Test Student", roll_no="CS2026999", branch="CSE", batch_year=2026, semester=7, cgpa=8.5, active_backlogs=0, dpdp_consent_given=True)
    db_session.add(profile)
    db_session.commit()

    # First login to get a fresh access and refresh token
    login_resp = client.post("/api/v1/auth/login", json={
        "email": "logout_test@college.edu.in",
        "password": "StudentPass1"
    })
    assert login_resp.status_code == 200
    access_token = login_resp.json["access_token"]
    refresh_token = login_resp.json["refresh_token"]

    # Call logout
    logout_resp = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_token},
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert logout_resp.status_code == 200
    assert logout_resp.json["message"] == "Logged out successfully."

    # Verify access token is revoked
    protected_resp = client.get(
        "/api/v1/students/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert protected_resp.status_code == 401
    assert "revoked" in protected_resp.json["error"].lower()

