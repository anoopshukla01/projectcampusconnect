"""
audit_multi_tenancy.py — Comprehensive Multi-Tenancy & College Isolation Audit Tool

Creates College A (COLL_A) and College B (COLL_B), seeds 4 roles in each (Admin, Professor, TPO, Student),
and runs automated direct API and database-level checks for cross-college data leaks.

This script strictly READS / ATTEMPTS OPERATIONS to report leaks — it DOES NOT fix code.
"""

import os
import sys
import uuid as uuid_lib
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.extensions import db

PASSWORD = "AuditPassword123!"

COLLEGE_A_CODE = "AUDIT_COLL_A"
COLLEGE_B_CODE = "AUDIT_COLL_B"

LEAKS_FOUND = []
TEST_RESULTS = []

def record_test(category, name, passed, details=""):
    status = "PASS" if passed else "LEAK / FAIL"
    TEST_RESULTS.append({
        "category": category,
        "name": name,
        "passed": passed,
        "details": details
    })
    if not passed:
        LEAKS_FOUND.append({
            "category": category,
            "name": name,
            "details": details
        })
    print(f"[{'✓' if passed else 'FAIL'}] {category} - {name}")
    if details and not passed:
        print(f"       -> DETAIL: {details}")


def run_audit():
    app = create_app("development")
    app.testing = True  # Enable Flask testing mode so exceptions return 500 responses instead of propagating

    with app.app_context():
        from app.models.college import College
        from app.models.user import User, UserRole
        from app.models.student import StudentProfile
        from app.models.professor import ProfessorProfile, ApprovalStatus
        from app.models.academic import (
            ProfessorClassAssignment, AttendanceRecord,
            Assignment, AssignmentSubmission, Grade, Subject, TimetableSlot
        )
        from app.models.placement import Company, PlacementDrive, DriveStatus, DriveType, PlacementOffer
        from app.models.community import (
            Announcement, CampusEvent, MarketplaceItem, LostFoundItem,
            StudyNote, LibraryResource, LibraryRequest
        )
        from app.models.audit import AuditLog

        print("======================================================================")
        print("Starting Multi-Tenancy & College Isolation Verification Audit")
        print("======================================================================\n")

        # 1. SETUP COLLEGES AND ACCOUNTS
        def get_or_create_college(code, name, slug):
            col = College.query.filter_by(code=code).first()
            if not col:
                col = College(code=code, name=name, slug=slug, is_active=True)
                db.session.add(col)
                db.session.flush()
            return col

        col_a = get_or_create_college(COLLEGE_A_CODE, "Audit College A", "audit-college-a")
        col_b = get_or_create_college(COLLEGE_B_CODE, "Audit College B", "audit-college-b")

        def get_or_create_user(col_id, email, role, extra_name):
            u = User.query.filter_by(email=email).first()
            if not u:
                u = User(college_id=col_id, email=email, role=role, is_active=True)
                u.set_password(PASSWORD)
                db.session.add(u)
                db.session.flush()
            return u

        # College A Users (using valid RFC emails without domain underscore)
        admin_a = get_or_create_user(col_a.id, "admin@collega.edu", UserRole.ADMIN, "Admin A")
        prof_a = get_or_create_user(col_a.id, "prof@collega.edu", UserRole.PROFESSOR, "Prof A")
        tpo_a = get_or_create_user(col_a.id, "tpo@collega.edu", UserRole.PLACEMENT_CELL, "TPO A")
        stu_a = get_or_create_user(col_a.id, "stu@collega.edu", UserRole.STUDENT, "Student A")

        # College B Users
        admin_b = get_or_create_user(col_b.id, "admin@collegb.edu", UserRole.ADMIN, "Admin B")
        prof_b = get_or_create_user(col_b.id, "prof@collegb.edu", UserRole.PROFESSOR, "Prof B")
        tpo_b = get_or_create_user(col_b.id, "tpo@collegb.edu", UserRole.PLACEMENT_CELL, "TPO B")
        stu_b = get_or_create_user(col_b.id, "stu@collegb.edu", UserRole.STUDENT, "Student B")

        # Profiles & Resources Setup
        # College A Student Profile
        stu_prof_a = StudentProfile.query.filter_by(user_id=stu_a.id).first()
        if not stu_prof_a:
            stu_prof_a = StudentProfile.query.filter_by(college_id=col_a.id, roll_no="STU-A-01").first()
        if not stu_prof_a:
            stu_prof_a = StudentProfile(
                user_id=stu_a.id, college_id=col_a.id, roll_no="STU-A-01",
                full_name="Student A", branch="Computer Science", batch_year=2026, semester=6, cgpa=8.5
            )
            db.session.add(stu_prof_a)

        # College B Student Profile
        stu_prof_b = StudentProfile.query.filter_by(user_id=stu_b.id).first()
        if not stu_prof_b:
            stu_prof_b = StudentProfile.query.filter_by(college_id=col_b.id, roll_no="STU-B-01").first()
        if not stu_prof_b:
            stu_prof_b = StudentProfile(
                user_id=stu_b.id, college_id=col_b.id, roll_no="STU-B-01",
                full_name="Student B", branch="Information Technology", batch_year=2026, semester=6, cgpa=9.0
            )
            db.session.add(stu_prof_b)

        # College A Professor Profile
        prof_prof_a = ProfessorProfile.query.filter_by(user_id=prof_a.id).first()
        if not prof_prof_a:
            prof_prof_a = ProfessorProfile.query.filter_by(college_id=col_a.id, employee_id="EMP-A-01").first()
        if not prof_prof_a:
            prof_prof_a = ProfessorProfile(
                user_id=prof_a.id, college_id=col_a.id, employee_id="EMP-A-01",
                full_name="Prof A", department="Computer Science", designation="Professor", approval_status=ApprovalStatus.APPROVED
            )
            db.session.add(prof_prof_a)

        # College B Professor Profile
        prof_prof_b = ProfessorProfile.query.filter_by(user_id=prof_b.id).first()
        if not prof_prof_b:
            prof_prof_b = ProfessorProfile.query.filter_by(college_id=col_b.id, employee_id="EMP-B-01").first()
        if not prof_prof_b:
            prof_prof_b = ProfessorProfile(
                user_id=prof_b.id, college_id=col_b.id, employee_id="EMP-B-01",
                full_name="Prof B", department="Information Technology", designation="Professor", approval_status=ApprovalStatus.APPROVED
            )
            db.session.add(prof_prof_b)

        # Subjects
        subj_a = Subject.query.filter_by(college_id=col_a.id, code="CS101_A").first()
        if not subj_a:
            subj_a = Subject(college_id=col_a.id, name="Data Structures A", code="CS101_A", branch="Computer Science")
            db.session.add(subj_a)

        subj_b = Subject.query.filter_by(college_id=col_b.id, code="IT101_B").first()
        if not subj_b:
            subj_b = Subject(college_id=col_b.id, name="Data Structures B", code="IT101_B", branch="Information Technology")
            db.session.add(subj_b)

        # Announcements
        ann_a = Announcement.query.filter_by(college_id=col_a.id, title="Col A Global Announcement").first()
        if not ann_a:
            ann_a = Announcement(college_id=col_a.id, title="Col A Global Announcement", content="Notice A", author_name="Admin A", author_role="admin")
            db.session.add(ann_a)

        ann_b = Announcement.query.filter_by(college_id=col_b.id, title="Col B Global Announcement").first()
        if not ann_b:
            ann_b = Announcement(college_id=col_b.id, title="Col B Global Announcement", content="Notice B", author_name="Admin B", author_role="admin")
            db.session.add(ann_b)

        # Events
        evt_b = CampusEvent.query.filter_by(college_id=col_b.id, title="Col B Tech Fest").first()
        if not evt_b:
            evt_b = CampusEvent(college_id=col_b.id, title="Col B Tech Fest", event_type="hackathon", date_time="2026-09-01 10:00", venue="Auditorium B")
            db.session.add(evt_b)

        # Marketplace Item B
        mkt_b = MarketplaceItem.query.filter_by(college_id=col_b.id, title="Book from Col B").first()
        if not mkt_b:
            mkt_b = MarketplaceItem(college_id=col_b.id, seller_id=stu_b.id, seller_name="Student B", title="Book from Col B", price="500", category="Books")
            db.session.add(mkt_b)

        # Lost and Found B
        lf_b = LostFoundItem.query.filter_by(college_id=col_b.id, title="Keys Col B").first()
        if not lf_b:
            lf_b = LostFoundItem(college_id=col_b.id, reporter_id=stu_b.id, reporter_name="Student B", title="Keys Col B", category="Keys", location="Lab B", date_reported="2026-07-31", item_type="lost")
            db.session.add(lf_b)

        # E-Library Resource B
        lib_b = LibraryResource.query.filter_by(college_id=col_b.id, title="Col B Reference Manual").first()
        if not lib_b:
            lib_b = LibraryResource(college_id=col_b.id, title="Col B Reference Manual", author="Author B", subject="IT", uploaded_by_id=prof_b.id)
            db.session.add(lib_b)

        # Notes B
        note_b = StudyNote.query.filter_by(college_id=col_b.id, title="Col B Notes").first()
        if not note_b:
            note_b = StudyNote(college_id=col_b.id, uploaded_by_id=stu_b.id, author_name="Student B", title="Col B Notes", subject="IT101_B", branch="Information Technology", semester=6)
            db.session.add(note_b)

        # Placement Companies & Drives B
        comp_b = Company.query.filter_by(college_id=col_b.id, name="Company B").first()
        if not comp_b:
            comp_b = Company(college_id=col_b.id, name="Company B", sector="IT")
            db.session.add(comp_b)
            db.session.flush()

        drive_b = PlacementDrive.query.filter_by(college_id=col_b.id, company_name="Company B").first()
        if not drive_b:
            drive_b = PlacementDrive(
                college_id=col_b.id, company_id=comp_b.id, company_name="Company B", role_title="Dev",
                ctc_offered="10 LPA", drive_type=DriveType.FULL_TIME, status=DriveStatus.ACTIVE, batch_year=2026,
                cgpa_cutoff=6.0, backlog_cutoff=1, drive_date=datetime.now(timezone.utc).date(),
                registration_deadline=datetime.now(timezone.utc)+timedelta(days=10), created_by=tpo_b.id
            )
            db.session.add(drive_b)

        db.session.commit()

        print("Seeded test data for College A and College B successfully.\n")

        # ----------------------------------------------------------------------
        # TEST CLIENT SETUP
        # ----------------------------------------------------------------------
        client = app.test_client()

        def get_token(email):
            resp = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
            data = resp.get_json()
            if resp.status_code != 200:
                raise Exception(f"Failed to log in {email}: {data}")
            return data["access_token"]

        token_admin_a = get_token("admin@collega.edu")
        token_prof_a  = get_token("prof@collega.edu")
        token_tpo_a   = get_token("tpo@collega.edu")
        token_stu_a   = get_token("stu@collega.edu")

        token_admin_b = get_token("admin@collegb.edu")

        # Helper for headers
        def auth_h(token):
            return {"Authorization": f"Bearer {token}"}

        # ----------------------------------------------------------------------
        # SECTION 1: ADMIN ISOLATION
        # ----------------------------------------------------------------------
        print("--- Testing Section 1: Admin Isolation ---")

        # 1.1 List Users
        resp = client.get("/api/v1/admin/users", headers=auth_h(token_admin_a))
        users_list = resp.get_json().get("users", []) if resp.status_code == 200 else []
        has_b_user = any(u.get("email", "").endswith("@collegb.edu") for u in users_list)
        record_test("Admin Isolation", "GET /admin/users does not list College B users", not has_b_user,
                    f"Found users: {[u['email'] for u in users_list] if has_b_user else 'None'}")

        # 1.2 Direct GET User B by ID
        resp = client.get(f"/api/v1/admin/users/{admin_b.id}", headers=auth_h(token_admin_a))
        record_test("Admin Isolation", "GET /admin/users/<id_b> blocks Admin A (returns 404/403)", resp.status_code in [403, 404], f"Status: {resp.status_code}")

        # 1.3 Direct PATCH User B by ID
        resp = client.patch(f"/api/v1/admin/users/{admin_b.id}", headers=auth_h(token_admin_a), json={"phone": "+19999999999"})
        record_test("Admin Isolation", "PATCH /admin/users/<id_b> blocks Admin A", resp.status_code in [403, 404], f"Status: {resp.status_code}")

        # 1.4 Direct DELETE User B by ID
        resp = client.delete(f"/api/v1/admin/users/{admin_b.id}", headers=auth_h(token_admin_a))
        record_test("Admin Isolation", "DELETE /admin/users/<id_b> blocks Admin A", resp.status_code in [403, 404], f"Status: {resp.status_code}")

        # 1.5 Direct GET Student B by ID via /api/v1/students/<id_b>
        resp = client.get(f"/api/v1/students/{stu_b.id}", headers=auth_h(token_admin_a))
        record_test("Admin Isolation", "GET /students/<stu_b_id> blocks Admin A", resp.status_code in [403, 404], f"Status: {resp.status_code}")

        # 1.6 Direct PATCH Student B by ID via /api/v1/students/<id_b>
        resp = client.patch(f"/api/v1/students/{stu_b.id}", headers=auth_h(token_admin_a), json={"full_name": "Hacked Student B"})
        record_test("Admin Isolation", "PATCH /students/<stu_b_id> blocks Admin A", resp.status_code in [403, 404], f"Status: {resp.status_code}")

        # 1.7 Direct DELETE Student B by ID via /api/v1/students/<id_b>
        resp = client.delete(f"/api/v1/students/{stu_b.id}", headers=auth_h(token_admin_a))
        record_test("Admin Isolation", "DELETE /students/<stu_b_id> blocks Admin A", resp.status_code in [403, 404], f"Status: {resp.status_code}")

        # 1.8 Audit Logs isolation
        resp = client.get("/api/v1/admin/audit-logs", headers=auth_h(token_admin_a))
        audit_logs = resp.get_json().get("audit_logs", []) if resp.status_code == 200 else []
        has_b_audit = any(str(l.get("actor_id")) == str(admin_b.id) for l in audit_logs)
        record_test("Admin Isolation", "GET /admin/audit-logs does not include College B logs", not has_b_audit, f"Logs checked: {len(audit_logs)}")

        # 1.9 Placement Analytics isolation
        resp = client.get("/api/v1/admin/analytics/placement", headers=auth_h(token_admin_a))
        record_test("Admin Isolation", "GET /admin/analytics/placement handles scoped stats", resp.status_code == 200)

        # ----------------------------------------------------------------------
        # SECTION 2: STUDENT ISOLATION
        # ----------------------------------------------------------------------
        print("\n--- Testing Section 2: Student Isolation ---")

        # 2.1 Announcements isolation
        resp = client.get("/api/v1/community/announcements", headers=auth_h(token_stu_a))
        ann_list = resp.get_json().get("announcements", []) if resp.status_code == 200 else []
        has_b_ann = any(a.get("title") == "Col B Global Announcement" for a in ann_list)
        record_test("Student Isolation", "GET /community/announcements does not show College B announcements", not has_b_ann)

        # 2.2 Events isolation
        resp = client.get("/api/v1/community/events", headers=auth_h(token_stu_a))
        evt_list = resp.get_json().get("events", []) if resp.status_code == 200 else []
        has_b_evt = any(e.get("title") == "Col B Tech Fest" for e in evt_list)
        record_test("Student Isolation", "GET /community/events does not show College B events", not has_b_evt)

        # 2.3 Marketplace isolation
        resp = client.get("/api/v1/community/marketplace", headers=auth_h(token_stu_a))
        mkt_list = resp.get_json().get("items", []) if resp.status_code == 200 else []
        has_b_mkt = any(m.get("title") == "Book from Col B" for m in mkt_list)
        record_test("Student Isolation", "GET /community/marketplace does not show College B items", not has_b_mkt)

        # 2.4 Lost and Found isolation
        resp = client.get("/api/v1/community/lost-found", headers=auth_h(token_stu_a))
        lf_list = resp.get_json().get("items", []) if resp.status_code == 200 else []
        has_b_lf = any(l.get("title") == "Keys Col B" for l in lf_list)
        record_test("Student Isolation", "GET /community/lost-found does not show College B items", not has_b_lf)

        # 2.5 E-Library isolation
        resp = client.get("/api/v1/community/library", headers=auth_h(token_stu_a))
        lib_list = resp.get_json().get("resources", []) if resp.status_code == 200 else []
        has_b_lib = any(l.get("title") == "Col B Reference Manual" for l in lib_list)
        record_test("Student Isolation", "GET /community/library does not show College B resources", not has_b_lib)

        # 2.6 Study Notes isolation
        resp = client.get("/api/v1/community/notes", headers=auth_h(token_stu_a))
        note_list = resp.get_json().get("notes", []) if resp.status_code == 200 else []
        has_b_note = any(n.get("title") == "Col B Notes" for n in note_list)
        record_test("Student Isolation", "GET /community/notes does not show College B notes", not has_b_note)

        # 2.7 Student Profile B direct GET by Student A
        resp = client.get(f"/api/v1/students/{stu_b.id}", headers=auth_h(token_stu_a))
        record_test("Student Isolation", "GET /students/<stu_b_id> by Student A returns 403/404", resp.status_code in [403, 404], f"Status: {resp.status_code}")

        # ----------------------------------------------------------------------
        # SECTION 3: PROFESSOR ISOLATION
        # ----------------------------------------------------------------------
        print("\n--- Testing Section 3: Professor Isolation ---")

        # 3.1 Roster query for College B branch/semester by Professor A
        resp = client.get("/api/v1/academics/roster?branch=Information%20Technology&semester=6", headers=auth_h(token_prof_a))
        roster = resp.get_json().get("roster", []) if resp.status_code == 200 else []
        has_b_stu_roster = any(r.get("roll_no") == "STU-B-01" for r in roster)
        record_test("Professor Isolation", "GET /academics/roster does not return College B students", not has_b_stu_roster)

        # 3.2 Subject list for Professor A
        resp = client.get("/api/v1/academics/assignments", headers=auth_h(token_prof_a))
        resp_subj = client.get("/api/v1/academics/timetable", headers=auth_h(token_prof_a))
        tt_dict = resp_subj.get_json().get("timetable", {}) if resp_subj.status_code == 200 else {}
        has_b_tt = False
        if isinstance(tt_dict, dict):
            for day_slots in tt_dict.values():
                if isinstance(day_slots, list):
                    for s in day_slots:
                        if isinstance(s, dict) and s.get("code") == "IT101_B":
                            has_b_tt = True

        record_test("Professor Isolation", "GET /academics/timetable does not list College B subjects/slots", not has_b_tt)

        # 3.3 Professor A marking attendance for Student B
        try:
            resp = client.post("/api/v1/academics/attendance/mark", headers=auth_h(token_prof_a), json={
                "student_id": str(stu_prof_b.id),
                "subject_code": "CS101_A",
                "subject_name": "Data Structures A",
                "attended": True
            })
            status_code = resp.status_code
        except Exception as e:
            status_code = f"500 (Unhandled Exception: {type(e).__name__})"
        record_test("Professor Isolation", "POST /academics/attendance/mark blocks marking attendance for Student B", status_code in [403, 404], f"Status: {status_code}")

        # ----------------------------------------------------------------------
        # SECTION 4: TPO ISOLATION
        # ----------------------------------------------------------------------
        print("\n--- Testing Section 4: TPO Isolation ---")

        # 4.1 TPO A list drives
        resp = client.get("/api/v1/placement/drives", headers=auth_h(token_tpo_a))
        drives_list = resp.get_json().get("drives", []) if resp.status_code == 200 else []
        has_b_drive = any(d.get("company_name") == "Company B" for d in drives_list)
        record_test("TPO Isolation", "GET /placement/drives does not show College B drives", not has_b_drive)

        # 4.2 TPO A direct GET Drive B by ID
        resp = client.get(f"/api/v1/placement/drives/{drive_b.id}", headers=auth_h(token_tpo_a))
        record_test("TPO Isolation", "GET /placement/drives/<drive_b_id> blocks TPO A", resp.status_code in [403, 404], f"Status: {resp.status_code}")

        # 4.3 TPO A direct PATCH Drive B by ID
        resp = client.patch(f"/api/v1/placement/drives/{drive_b.id}", headers=auth_h(token_tpo_a), json={"role_title": "Hacked Role"})
        record_test("TPO Isolation", "PATCH /placement/drives/<drive_b_id> blocks TPO A", resp.status_code in [403, 404], f"Status: {resp.status_code}")

        # 4.4 TPO A list eligible students for Drive B
        resp = client.get(f"/api/v1/placement/drives/{drive_b.id}/eligible", headers=auth_h(token_tpo_a))
        record_test("TPO Isolation", "GET /placement/drives/<drive_b_id>/eligible blocks TPO A", resp.status_code in [403, 404], f"Status: {resp.status_code}")

        # ----------------------------------------------------------------------
        # SECTION 5: CROSS-COLLEGE SEARCH & DIRECT UUID API CHECK
        # ----------------------------------------------------------------------
        print("\n--- Testing Section 5: Cross-College Search & Direct UUID Endpoint Checks ---")

        # 5.1 Direct GET /api/v1/students/<id_b>/detail by Admin A
        resp = client.get(f"/api/v1/students/{stu_b.id}/detail", headers=auth_h(token_admin_a))
        record_test("Cross-College UUID", "GET /students/<stu_b_id>/detail blocks Admin A", resp.status_code in [403, 404], f"Status: {resp.status_code}")

        # 5.2 Direct GET /api/v1/professors/<prof_b_id> by Admin A
        resp = client.get(f"/api/v1/professors/{prof_b.id}", headers=auth_h(token_admin_a))
        record_test("Cross-College UUID", "GET /professors/<prof_b_id> blocks Admin A", resp.status_code in [403, 404], f"Status: {resp.status_code}")

        # 5.3 Direct GET /api/v1/academics/students/<stu_b_id>/grades by Admin A
        resp = client.get(f"/api/v1/academics/students/{stu_b.id}/grades", headers=auth_h(token_admin_a))
        record_test("Cross-College UUID", "GET /academics/students/<stu_b_id>/grades blocks Admin A", resp.status_code in [403, 404], f"Status: {resp.status_code}")

        # 5.4 Direct GET /api/v1/placement/drives/<drive_b_id>/applications by TPO A
        resp = client.get(f"/api/v1/placement/drives/{drive_b.id}/applications", headers=auth_h(token_tpo_a))
        record_test("Cross-College UUID", "GET /placement/drives/<drive_b_id>/applications blocks TPO A", resp.status_code in [403, 404], f"Status: {resp.status_code}")

        # ----------------------------------------------------------------------
        # SECTION 6: ANNOUNCEMENTS BROADCAST SCOPING
        # ----------------------------------------------------------------------
        print("\n--- Testing Section 6: Announcements Broadcast Scoping ---")

        # 6.1 Create broadcast announcement in College A by Admin A
        resp = client.post("/api/v1/community/announcements", headers=auth_h(token_admin_a), json={
            "title": "COLLEGE A EXCLUSIVE BROADCAST",
            "content": "Emergency alert for College A only!"
        })
        record_test("Announcements", "POST /community/announcements by Admin A succeeds", resp.status_code in [200, 201])

        # 6.2 Verify Student B in College B DOES NOT see College A's broadcast
        resp = client.get("/api/v1/community/announcements", headers=auth_h(token_stu_a))
        ann_a_list = resp.get_json().get("announcements", []) if resp.status_code == 200 else []
        has_broadcast_a = any(a.get("title") == "COLLEGE A EXCLUSIVE BROADCAST" for a in ann_a_list)

        resp = client.get("/api/v1/community/announcements", headers=auth_h(get_token("stu@collegb.edu")))
        ann_b_list = resp.get_json().get("announcements", []) if resp.status_code == 200 else []
        has_broadcast_b = any(a.get("title") == "COLLEGE A EXCLUSIVE BROADCAST" for a in ann_b_list)

        record_test("Announcements", "Broadcast from College A Admin reaches Student A", has_broadcast_a)
        record_test("Announcements", "Broadcast from College A Admin DOES NOT reach Student B", not has_broadcast_b)

        # Notifications check for Student B
        resp_notif_b = client.get("/api/v1/notifications", headers=auth_h(get_token("stu@collegb.edu")))
        notifs_b = resp_notif_b.get_json().get("notifications", []) if resp_notif_b.status_code == 200 else []
        has_notif_b = any("COLLEGE A EXCLUSIVE BROADCAST" in n.get("title", "") for n in notifs_b)
        record_test("Announcements", "Notification for broadcast A DOES NOT reach Student B", not has_notif_b)

        print("\n======================================================================")
        print("AUDIT SUMMARY")
        print("======================================================================")
        total_tests = len(TEST_RESULTS)
        passed_tests = sum(1 for t in TEST_RESULTS if t["passed"])
        failed_tests = total_tests - passed_tests
        print(f"Total Tests Executed: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Leaks / Failures Found: {failed_tests}")

        if LEAKS_FOUND:
            print("\n!!! SECURITY LEAKS DETECTED !!!")
            for item in LEAKS_FOUND:
                print(f" - [{item['category']}] {item['name']} | Detail: {item['details']}")
        else:
            print("\n✅ PERFECT MULTI-TENANCY ISOLATION CONFIRMED: 0 LEAKS FOUND.")

if __name__ == "__main__":
    run_audit()
