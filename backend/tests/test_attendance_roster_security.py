import pytest
import uuid
from datetime import datetime, timedelta
from flask_jwt_extended import create_access_token
from app.models.user import User, UserRole
from app.models.college import College, DEFAULT_COLLEGE_ID
from app.models.student import StudentProfile
from app.models.academic import TimetableSlot, ProfessorClassAssignment, AttendanceRecord


@pytest.fixture
def attendance_setup(db_session):
    col1_id = DEFAULT_COLLEGE_ID

    prof1 = User(college_id=col1_id, email="prof1_att@col1.edu", role=UserRole.PROFESSOR, is_active=True)
    prof2 = User(college_id=col1_id, email="prof2_att@col1.edu", role=UserRole.PROFESSOR, is_active=True)
    admin = User(college_id=col1_id, email="admin_att@col1.edu", role=UserRole.ADMIN, is_active=True)
    stud1 = User(college_id=col1_id, phone="9888811111", role=UserRole.STUDENT, is_active=True)
    stud2 = User(college_id=col1_id, phone="9888822222", role=UserRole.STUDENT, is_active=True)

    for u in [prof1, prof2, admin, stud1, stud2]:
        u.set_password("Pass1234")
        db_session.add(u)
    db_session.commit()

    sp1 = StudentProfile(
        college_id=col1_id, user_id=stud1.id, full_name="CSE Student", roll_no="CSE101",
        branch="CSE", semester=4, batch_year="2026", cgpa=8.5, attendance_pct=90.0
    )
    sp2 = StudentProfile(
        college_id=col1_id, user_id=stud2.id, full_name="ECE Student", roll_no="ECE101",
        branch="ECE", semester=4, batch_year="2026", cgpa=8.0, attendance_pct=85.0
    )
    db_session.add(sp1)
    db_session.add(sp2)

    # Class assignments
    pca1 = ProfessorClassAssignment(
        professor_user_id=prof1.id, course_name="Data Structures", course_code="CS201",
        branch="CSE", semester=4, is_active=True
    )
    pca2 = ProfessorClassAssignment(
        professor_user_id=prof2.id, course_name="Digital Signal Processing", course_code="EC201",
        branch="ECE", semester=4, is_active=True
    )
    db_session.add(pca1)
    db_session.add(pca2)
    db_session.commit()

    tokens = {
        "prof1": create_access_token(identity=str(prof1.id), additional_claims={"role": "professor"}),
        "prof2": create_access_token(identity=str(prof2.id), additional_claims={"role": "professor"}),
        "admin": create_access_token(identity=str(admin.id), additional_claims={"role": "admin"}),
    }

    return {
        "col1_id": col1_id,
        "prof1": prof1, "prof2": prof2, "admin": admin,
        "stud1": stud1, "stud2": stud2,
        "tokens": tokens,
    }


def test_professor_active_slot_roster_and_marking_success(client, db_session, attendance_setup):
    s = attendance_setup
    h_prof1 = {"Authorization": f"Bearer {s['tokens']['prof1']}"}

    now = datetime.now()
    today_day = now.strftime("%A")
    start_time = (now - timedelta(minutes=10)).strftime("%H:%M")
    end_time = (now + timedelta(minutes=50)).strftime("%H:%M")

    # Active timetable slot for prof1
    slot = TimetableSlot(
        college_id=s["col1_id"],
        user_id=s["prof1"].id,
        branch="CSE", semester=4,
        day_of_week=today_day,
        time_slot=f"{start_time} - {end_time}",
        course_name="Data Structures",
        course_code="CS201",
        room="LH-1",
        professor_name="Prof One",
        slot_type="lecture",
    )
    db_session.add(slot)
    db_session.commit()

    # 1. GET /academics/roster/active-class
    res = client.get("/api/v1/academics/roster/active-class", headers=h_prof1)
    assert res.status_code == 200
    data = res.get_json()
    assert data["active"] is True
    assert data["class"]["course_code"] == "CS201"
    assert data["class"]["branch"] == "CSE"

    # 2. GET /academics/roster (no query params)
    res_r = client.get("/api/v1/academics/roster", headers=h_prof1)
    assert res_r.status_code == 200
    r_data = res_r.get_json()
    assert r_data["count"] == 1
    assert r_data["students"][0]["roll_no"] == "CSE101"
    assert r_data["active_class"]["course_code"] == "CS201"

    # 3. POST /academics/attendance/mark
    res_m = client.post("/api/v1/academics/attendance/mark", headers=h_prof1, json={
        "present_roll_nos": ["CSE101"],
    })
    assert res_m.status_code == 200

    rec = AttendanceRecord.query.filter_by(subject_code="CS201").first()
    assert rec is not None
    assert rec.attended_classes == 1


def test_professor_slot_without_formal_assignment_denied(client, db_session, attendance_setup):
    s = attendance_setup
    h_prof1 = {"Authorization": f"Bearer {s['tokens']['prof1']}"}

    now = datetime.now()
    today_day = now.strftime("%A")
    start_time = (now - timedelta(minutes=10)).strftime("%H:%M")
    end_time = (now + timedelta(minutes=50)).strftime("%H:%M")

    # Timetable slot for a course prof1 is NOT assigned to (CS999)
    slot = TimetableSlot(
        college_id=s["col1_id"],
        user_id=s["prof1"].id,
        branch="CSE", semester=4,
        day_of_week=today_day,
        time_slot=f"{start_time} - {end_time}",
        course_name="Quantum Computing",
        course_code="CS999",
        room="LH-9",
        professor_name="Prof One",
        slot_type="lecture",
    )
    db_session.add(slot)
    db_session.commit()

    # Active class check should deny
    res = client.get("/api/v1/academics/roster/active-class", headers=h_prof1)
    assert res.status_code == 200
    assert res.get_json()["active"] is False
    assert res.get_json()["reason"] == "no_class_now"

    # Mark attendance should fail 403
    res_m = client.post("/api/v1/academics/attendance/mark", headers=h_prof1, json={
        "present_roll_nos": ["CSE101"],
    })
    assert res_m.status_code == 403
    assert "no scheduled class right now" in res_m.get_json()["error"]


def test_professor_no_active_slot_denied(client, db_session, attendance_setup):
    s = attendance_setup
    h_prof1 = {"Authorization": f"Bearer {s['tokens']['prof1']}"}

    # No timetable slots created at all
    res = client.get("/api/v1/academics/roster/active-class", headers=h_prof1)
    assert res.status_code == 200
    assert res.get_json()["active"] is False

    res_r = client.get("/api/v1/academics/roster", headers=h_prof1)
    assert res_r.status_code == 200
    assert res_r.get_json()["count"] == 0
    assert res_r.get_json()["reason"] == "no_class_now"

    res_m = client.post("/api/v1/academics/attendance/mark", headers=h_prof1, json={
        "present_roll_nos": ["CSE101"],
    })
    assert res_m.status_code == 403


def test_professor_client_input_overridden_by_derived(client, db_session, attendance_setup):
    s = attendance_setup
    h_prof1 = {"Authorization": f"Bearer {s['tokens']['prof1']}"}

    now = datetime.now()
    today_day = now.strftime("%A")
    start_time = (now - timedelta(minutes=10)).strftime("%H:%M")
    end_time = (now + timedelta(minutes=50)).strftime("%H:%M")

    slot = TimetableSlot(
        college_id=s["col1_id"],
        user_id=s["prof1"].id,
        branch="CSE", semester=4,
        day_of_week=today_day,
        time_slot=f"{start_time} - {end_time}",
        course_name="Data Structures",
        course_code="CS201",
        room="LH-1",
        professor_name="Prof One",
        slot_type="lecture",
    )
    db_session.add(slot)
    db_session.commit()

    # Prof attempts to submit fake branch and course_code in request body
    res_m = client.post("/api/v1/academics/attendance/mark", headers=h_prof1, json={
        "subject_name": "Fake Subject",
        "subject_code": "FAKE999",
        "branch": "MECHANICAL",
        "semester": 8,
        "present_roll_nos": ["CSE101"],
    })
    assert res_m.status_code == 200

    # Verify that AttendanceRecord was created for real active class (CS201) and NOT FAKE999
    fake_rec = AttendanceRecord.query.filter_by(subject_code="FAKE999").first()
    assert fake_rec is None

    real_rec = AttendanceRecord.query.filter_by(subject_code="CS201").first()
    assert real_rec is not None
    assert real_rec.attended_classes == 1


def test_same_college_professors_roster_isolation(client, db_session, attendance_setup):
    s = attendance_setup
    h_prof1 = {"Authorization": f"Bearer {s['tokens']['prof1']}"}
    h_prof2 = {"Authorization": f"Bearer {s['tokens']['prof2']}"}

    now = datetime.now()
    today_day = now.strftime("%A")
    start_time = (now - timedelta(minutes=10)).strftime("%H:%M")
    end_time = (now + timedelta(minutes=50)).strftime("%H:%M")

    # Prof 1 slot (CSE)
    slot1 = TimetableSlot(
        college_id=s["col1_id"], user_id=s["prof1"].id, branch="CSE", semester=4,
        day_of_week=today_day, time_slot=f"{start_time} - {end_time}",
        course_name="Data Structures", course_code="CS201", room="LH-1", professor_name="Prof 1",
    )
    # Prof 2 slot (ECE)
    slot2 = TimetableSlot(
        college_id=s["col1_id"], user_id=s["prof2"].id, branch="ECE", semester=4,
        day_of_week=today_day, time_slot=f"{start_time} - {end_time}",
        course_name="Digital Signal Processing", course_code="EC201", room="LH-2", professor_name="Prof 2",
    )
    db_session.add(slot1)
    db_session.add(slot2)
    db_session.commit()

    # Prof 1 roster -> CSE student only
    r1 = client.get("/api/v1/academics/roster", headers=h_prof1).get_json()
    assert r1["count"] == 1
    assert r1["students"][0]["roll_no"] == "CSE101"

    # Prof 2 roster -> ECE student only
    r2 = client.get("/api/v1/academics/roster", headers=h_prof2).get_json()
    assert r2["count"] == 1
    assert r2["students"][0]["roll_no"] == "ECE101"


def test_double_booking_ambiguous_handling(client, db_session, attendance_setup):
    s = attendance_setup
    h_prof1 = {"Authorization": f"Bearer {s['tokens']['prof1']}"}

    now = datetime.now()
    today_day = now.strftime("%A")
    start_time = (now - timedelta(minutes=10)).strftime("%H:%M")
    end_time = (now + timedelta(minutes=50)).strftime("%H:%M")

    # Add second assignment for prof1
    pca_extra = ProfessorClassAssignment(
        professor_user_id=s["prof1"].id, course_name="Algorithms", course_code="CS301",
        branch="CSE", semester=4, is_active=True
    )
    db_session.add(pca_extra)

    # 2 active slots at the exact same time
    slot1 = TimetableSlot(
        college_id=s["col1_id"], user_id=s["prof1"].id, branch="CSE", semester=4,
        day_of_week=today_day, time_slot=f"{start_time} - {end_time}",
        course_name="Data Structures", course_code="CS201", room="LH-1", professor_name="Prof 1",
    )
    slot2 = TimetableSlot(
        college_id=s["col1_id"], user_id=s["prof1"].id, branch="CSE", semester=4,
        day_of_week=today_day, time_slot=f"{start_time} - {end_time}",
        course_name="Algorithms", course_code="CS301", room="LH-2", professor_name="Prof 1",
    )
    db_session.add(slot1)
    db_session.add(slot2)
    db_session.commit()

    # Active class check -> ambiguous
    res = client.get("/api/v1/academics/roster/active-class", headers=h_prof1)
    assert res.status_code == 200
    assert res.get_json()["active"] is False
    assert res.get_json()["reason"] == "ambiguous"
    assert len(res.get_json()["candidates"]) == 2

    # Mark attendance without slot_id -> 409
    res_m = client.post("/api/v1/academics/attendance/mark", headers=h_prof1, json={
        "present_roll_nos": ["CSE101"],
    })
    assert res_m.status_code == 409

    # Mark attendance WITH slot_id -> 200
    res_m2 = client.post("/api/v1/academics/attendance/mark", headers=h_prof1, json={
        "slot_id": str(slot1.id),
        "present_roll_nos": ["CSE101"],
    })
    assert res_m2.status_code == 200


def test_admin_role_retains_arbitrary_roster_and_marking(client, db_session, attendance_setup):
    s = attendance_setup
    h_admin = {"Authorization": f"Bearer {s['tokens']['admin']}"}

    # Admin requests roster by branch/semester without needing an active slot
    res_r = client.get("/api/v1/academics/roster?branch=ECE&semester=4", headers=h_admin)
    assert res_r.status_code == 200
    assert res_r.get_json()["count"] == 1
    assert res_r.get_json()["students"][0]["roll_no"] == "ECE101"

    # Admin marks attendance for arbitrary subject/branch/semester
    res_m = client.post("/api/v1/academics/attendance/mark", headers=h_admin, json={
        "subject_name": "Admin Correction",
        "subject_code": "ADM101",
        "branch": "ECE",
        "semester": 4,
        "present_roll_nos": ["ECE101"],
    })
    assert res_m.status_code == 200
    rec = AttendanceRecord.query.filter_by(subject_code="ADM101").first()
    assert rec is not None
    assert rec.attended_classes == 1
