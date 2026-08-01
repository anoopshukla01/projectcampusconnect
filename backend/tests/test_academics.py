import pytest
from flask_jwt_extended import create_access_token
from app.models.college import DEFAULT_COLLEGE_ID
from app.models.user import User, UserRole

def test_academics_endpoints_empty(client, db_session):
    student_user = User(college_id=DEFAULT_COLLEGE_ID, email="student_test@college.edu", role=UserRole.STUDENT, is_active=True)
    student_user.set_password("Pass@123456")
    db_session.add(student_user)
    db_session.commit()

    token = create_access_token(identity=str(student_user.id), additional_claims={"role": "student"})
    headers = {"Authorization": f"Bearer {token}"}

    # Test grades empty
    res = client.get("/api/v1/academics/grades", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert "grades" in data
    assert data["cgpa"] == "--"

    # Test attendance empty
    res = client.get("/api/v1/academics/attendance", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert "subjects" in data

    # Test timetable empty
    res = client.get("/api/v1/academics/timetable", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert "timetable" in data

    # Test assignments empty
    res = client.get("/api/v1/academics/assignments", headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert "assignments" in data


def test_professor_free_slots_endpoint(client, db_session):
    from app.models.academic import ProfessorClassAssignment, TimetableSlot
    prof_user = User(college_id=DEFAULT_COLLEGE_ID, email="prof_free@college.edu", role=UserRole.PROFESSOR, is_active=True)
    prof_user.set_password("Pass@123456")
    db_session.add(prof_user)
    db_session.commit()

    assignment = ProfessorClassAssignment(
        professor_user_id=prof_user.id,
        course_name="Data Structures",
        course_code="CS101",
        branch="CSE",
        semester=3,
        is_active=True
    )
    db_session.add(assignment)
    db_session.commit()

    token = create_access_token(identity=str(prof_user.id), additional_claims={"role": "professor"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Unassigned course_code -> 403
    res_unassigned = client.get("/api/v1/academics/timetable/professor/free-slots?course_code=MATH101&day=Mon", headers=headers)
    assert res_unassigned.status_code == 403

    # 2. Assigned course_code -> 200 with full list
    res_free = client.get("/api/v1/academics/timetable/professor/free-slots?course_code=CS101&day=Mon", headers=headers)
    assert res_free.status_code == 200
    free_slots = res_free.get_json()["free_slots"]
    assert "08:00 - 09:30" in free_slots

    # 3. Add an occupied slot -> free_slots excludes it
    slot = TimetableSlot(
        branch="CSE", semester=3, user_id=prof_user.id,
        day_of_week="Mon", time_slot="08:00 - 09:30",
        course_name="Data Structures", course_code="CS101",
        room="LH-101", professor_name="Dr. Free", slot_type="lecture"
    )
    db_session.add(slot)
    db_session.commit()

    res_occupied = client.get("/api/v1/academics/timetable/professor/free-slots?course_code=CS101&day=Mon", headers=headers)
    assert res_occupied.status_code == 200
    free_slots_updated = res_occupied.get_json()["free_slots"]
    assert "08:00 - 09:30" not in free_slots_updated

    # 4. With exclude_slot_id parameter -> "08:00 - 09:30" is returned
    res_excl = client.get(f"/api/v1/academics/timetable/professor/free-slots?course_code=CS101&day=Mon&exclude_slot_id={slot.id}", headers=headers)
    assert res_excl.status_code == 200
    free_slots_excl = res_excl.get_json()["free_slots"]
    assert "08:00 - 09:30" in free_slots_excl

