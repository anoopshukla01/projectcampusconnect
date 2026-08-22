"""
Campus Connect — Comprehensive Demo Data Seeder
================================================
Seeds realistic, interconnected sample data for all 4 user roles:
  - Student (Standard) — Anoop Shukla, CT Sem 6
  - Student (CR elevated) — Kajal Maurya, CT Sem 6, canBroadcast=True
  - Professor — Dr. Ramesh Tiwari, CS/CN courses, CT Sem 6
  - TPO — Ms. Priya Mehta, active placement drives
  - Admin — already exists (anoopbuilds@gmail.com)

Also seeds:
  - Timetable slots for today (CT Sem 6) with valid geofence coords
  - Attendance records for CT students
  - Grades (all subjects)
  - Assignments
  - Announcements (dept + placement)
  - Placement companies + drives
  - CR privilege delegation

Run via:
    cd backend
    source .venv/bin/activate
    python seed_demo.py
"""

import sys
import os
import uuid
from datetime import datetime, timedelta, timezone, date

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.extensions import db
from app.models.user import User, UserRole
from app.models.student import StudentProfile
from app.models.professor import ProfessorProfile, ApprovalStatus
from app.models.academic import (
    TimetableSlot, AttendanceRecord, Grade, Assignment,
    ProfessorClassAssignment, StudentPrivilege, Subject
)
from app.models.placement import Company, PlacementDrive, DriveType, DriveStatus
from app.models.community import Announcement, CampusEvent
from app.models.college import College

app = create_app()

# ─── Constants ────────────────────────────────────────────────────────────────

COLLEGE_CODE = "IERT2025"
BRANCH = "CT"        # Computer Technology — matches existing students
SEMESTER = 6

# IERT Allahabad coordinates (main block geofence)
CLASSROOMS = [
    {"room": "CS-301", "lat": 25.4484, "lng": 81.8462, "radius": 30.0},
    {"room": "CS-302", "lat": 25.4486, "lng": 81.8464, "radius": 30.0},
    {"room": "CS-303", "lat": 25.4488, "lng": 81.8460, "radius": 30.0},
]

# Today's weekday name for timetable slots
WEEKDAY_FULL = datetime.now().strftime("%A")   # e.g. "Saturday"
WEEKDAY_SHORT = WEEKDAY_FULL[:3]               # e.g. "Sat"

SUBJECTS = [
    {"name": "Operating Systems",     "code": "CT601"},
    {"name": "Computer Networks",     "code": "CT603"},
    {"name": "Database Systems",      "code": "CT605"},
    {"name": "Software Engineering",  "code": "CT607"},
    {"name": "Web Technologies",      "code": "CT609"},
]

DEMO_PASSWORD = "Campus@123"

# ─── Helpers ──────────────────────────────────────────────────────────────────

def now_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def get_college():
    c = College.query.filter_by(code=COLLEGE_CODE).first()
    if not c:
        raise RuntimeError(f"College '{COLLEGE_CODE}' not found in DB. Run migrations first.")
    return c

def upsert_user(college_id, email, phone, role_enum, password=DEMO_PASSWORD):
    """Get or create a user with given credentials."""
    u = User.query.filter_by(college_id=college_id, email=email).first()
    if not u and phone:
        u = User.query.filter_by(college_id=college_id, phone=phone).first()
    if not u:
        u = User(
            id=uuid.uuid4(),
            college_id=college_id,
            email=email,
            phone=phone,
            role=role_enum,
            is_active=True,
        )
        u.set_password(password)
        db.session.add(u)
        print(f"  [CREATE] User {email} ({role_enum.value})")
    else:
        u.email = u.email or email
        u.phone = u.phone or phone
        u.is_active = True
        if not u.password_hash:
            u.set_password(password)
        print(f"  [EXISTS] User {email} ({role_enum.value})")
    db.session.flush()
    return u


# ─── Phase 1: Professor ───────────────────────────────────────────────────────

def seed_professor(college):
    print("\n→ Seeding Professor account...")
    prof_user = upsert_user(
        college.id,
        email="prof.ramesh.tiwari@iert.ac.in",
        phone="9876543210",
        role_enum=UserRole.PROFESSOR,
    )

    prof = ProfessorProfile.query.filter_by(user_id=prof_user.id).first()
    if not prof:
        prof = ProfessorProfile(
            id=uuid.uuid4(),
            user_id=prof_user.id,
            college_id=college.id,
            employee_id="FAC-2026-001",
            full_name="Dr. Ramesh Tiwari",
            department="Computer Technology",
            designation="Associate Professor",
            joined_date=date(2018, 7, 15),
            publications_count=12,
            approval_status=ApprovalStatus.APPROVED,
        )
        db.session.add(prof)
        print("  [CREATE] ProfessorProfile: Dr. Ramesh Tiwari")
    else:
        prof.approval_status = ApprovalStatus.APPROVED
        print("  [EXISTS] ProfessorProfile: Dr. Ramesh Tiwari")
    db.session.flush()
    return prof_user, prof


# ─── Phase 2: TPO ─────────────────────────────────────────────────────────────

def seed_tpo(college):
    print("\n→ Seeding TPO account...")
    tpo_user = upsert_user(
        college.id,
        email="tpo.priya.mehta@iert.ac.in",
        phone="9876500001",
        role_enum=UserRole.PLACEMENT_CELL,
    )
    return tpo_user


# ─── Phase 3: Demo Student (with email/phone) ─────────────────────────────────

def seed_demo_student(college):
    print("\n→ Seeding Demo Student account (Anoop Shukla)...")
    # First, look for the user by the specific email that already exists
    existing_email_user = User.query.filter_by(
        college_id=college.id,
        email="anoopshukla0709@gmail.com"
    ).first()

    if existing_email_user:
        # Find or link the student profile for this user
        sp = StudentProfile.query.filter_by(user_id=existing_email_user.id).first()
        if not sp:
            # Find Anoop Singh by roll_no
            sp = StudentProfile.query.filter_by(roll_no="2511217", branch=BRANCH).first()
        if sp and sp.user_id != existing_email_user.id:
            # The email user is different from roll_no user; use email user as demo
            pass
        if not sp:
            sp = StudentProfile(
                id=uuid.uuid4(), user_id=existing_email_user.id, college_id=college.id,
                full_name="Anoop Shukla", roll_no="2511217", branch=BRANCH,
                semester=SEMESTER, batch_year=2026,
            )
            db.session.add(sp)
        if not existing_email_user.phone:
            existing_email_user.phone = "8738804344"
        if not existing_email_user.password_hash:
            existing_email_user.set_password(DEMO_PASSWORD)
        existing_email_user.is_active = True
        print(f"  [EXISTS] Email user {existing_email_user.email} — updated")
        db.session.flush()
        return existing_email_user, sp
    else:
        # Find Anoop Singh by roll_no and set his email
        sp = StudentProfile.query.filter_by(roll_no="2511217", branch=BRANCH).first()
        if sp:
            user = sp.user
            user.email = "anoopshukla0709@gmail.com"
            user.phone = "8738804344"
            if not user.password_hash:
                user.set_password(DEMO_PASSWORD)
            user.is_active = True
            print(f"  [UPDATE] Student {sp.full_name} — email/phone/password set")
        else:
            user = upsert_user(college.id, "anoopshukla0709@gmail.com", "8738804344", UserRole.STUDENT)
            sp = StudentProfile(
                id=uuid.uuid4(), user_id=user.id, college_id=college.id,
                full_name="Anoop Shukla", roll_no="2511217", branch=BRANCH,
                semester=SEMESTER, batch_year=2026,
            )
            db.session.add(sp)
        db.session.flush()
        return user, sp


# ─── Phase 4: CR Student (Elevated Privileges) ───────────────────────────────

def seed_cr_student(college, admin_user, prof_user):
    print("\n→ Seeding CR Student account (Kajal Maurya)...")
    sp = StudentProfile.query.filter_by(roll_no="2511232", branch=BRANCH).first()
    if sp:
        user = sp.user
        # Don't update email if another user already has it
        if not user.email:
            # Check if email is taken by another user
            taken = User.query.filter_by(
                college_id=college.id, email="kajal.maurya.cr@iert.ac.in"
            ).first()
            if not taken:
                user.email = "kajal.maurya.cr@iert.ac.in"
        if not user.phone:
            user.phone = "9900000002"
        if not user.password_hash:
            user.set_password(DEMO_PASSWORD)
        user.is_active = True
        print(f"  [UPDATE] Student {sp.full_name} — CR credentials set")
    else:
        user = upsert_user(college.id, "kajal.maurya.cr@iert.ac.in", "9900000002", UserRole.STUDENT)
        sp = StudentProfile(
            id=uuid.uuid4(), user_id=user.id, college_id=college.id,
            full_name="Kajal Maurya", roll_no="2511232", branch=BRANCH,
            semester=SEMESTER, batch_year=2026,
        )
        db.session.add(sp)
    db.session.flush()

    # Grant CR privilege
    priv = StudentPrivilege.query.filter_by(student_id=sp.id, delegated_role="CLASS_REPRESENTATIVE").first()
    if not priv:
        priv = StudentPrivilege(
            id=uuid.uuid4(),
            student_id=sp.id,
            delegated_role="CLASS_REPRESENTATIVE",
            granted_by_id=prof_user.id,
            batch_id=f"{BRANCH}-Sem{SEMESTER}-2026",
            can_broadcast=True,
            can_edit_schedule=False,
            can_view_logs=True,
            is_active=True,
        )
        db.session.add(priv)
        print("  [CREATE] CR privilege granted to Kajal Maurya")
    else:
        priv.can_broadcast = True
        priv.can_view_logs = True
        priv.is_active = True
        print("  [EXISTS] CR privilege already exists for Kajal Maurya")
    db.session.flush()
    return user, sp


# ─── Phase 5: Fix null emails for all existing students ──────────────────────

def fix_null_emails(college):
    print("\n→ Fixing null email/phone for existing students...")
    students = StudentProfile.query.filter_by(college_id=college.id).all()
    # Collect all already-assigned emails to prevent duplicates
    existing_emails = set(
        u.email for u in User.query.filter_by(college_id=college.id).all() if u.email
    )

    fixed = 0
    for i, sp in enumerate(students):
        user = sp.user
        if not user:
            continue
        if not user.email:
            safe_name = (sp.full_name or f"student{i}").lower().replace(" ", ".").replace("(", "").replace(")", "")
            candidate = f"{safe_name}.{sp.roll_no or i}@iert.ac.in"
            # Ensure uniqueness
            if candidate in existing_emails:
                candidate = f"student.{sp.roll_no or i}.{i}@iert.ac.in"
            user.email = candidate
            existing_emails.add(candidate)
            fixed += 1
        if not user.phone:
            user.phone = f"900000{str(i+10).zfill(4)}"
        if not user.password_hash:
            user.set_password(DEMO_PASSWORD)
        user.is_active = True
    db.session.flush()
    print(f"  [FIXED] {fixed} student accounts given auto-generated emails")



# ─── Phase 6: Timetable Slots ─────────────────────────────────────────────────

def seed_timetable(college, prof_user):
    print(f"\n→ Seeding Timetable slots for {WEEKDAY_FULL}...")

    slots_config = [
        {"subject_idx": 0, "time": "09:00-10:30", "room": CLASSROOMS[0]},
        {"subject_idx": 1, "time": "10:45-12:15", "room": CLASSROOMS[1]},
        {"subject_idx": 2, "time": "13:00-14:30", "room": CLASSROOMS[2]},
        {"subject_idx": 3, "time": "14:45-16:15", "room": CLASSROOMS[0]},
    ]

    created_slots = []
    for cfg in slots_config:
        subj = SUBJECTS[cfg["subject_idx"]]
        classroom = cfg["room"]
        existing = TimetableSlot.query.filter_by(
            college_id=college.id,
            branch=BRANCH,
            semester=SEMESTER,
            day_of_week=WEEKDAY_FULL,
            time_slot=cfg["time"].replace("-", " - "),
            course_code=subj["code"],
        ).first()

        if not existing:
            slot = TimetableSlot(
                id=uuid.uuid4(),
                college_id=college.id,
                branch=BRANCH,
                semester=SEMESTER,
                role="student",
                user_id=prof_user.id,
                day_of_week=WEEKDAY_FULL,
                time_slot=cfg["time"].replace("-", " - "),
                course_name=subj["name"],
                course_code=subj["code"],
                room=classroom["room"],
                professor_name="Dr. Ramesh Tiwari",
                slot_type="lecture",
                latitude=classroom["lat"],
                longitude=classroom["lng"],
                radius_meters=classroom["radius"],
                is_deleted=False,
            )
            db.session.add(slot)
            created_slots.append(slot)
            print(f"  [CREATE] Slot: {subj['name']} | {WEEKDAY_FULL} {cfg['time']} | {classroom['room']}")
        else:
            # Ensure geofence coords are set
            existing.latitude = classroom["lat"]
            existing.longitude = classroom["lng"]
            existing.radius_meters = classroom["radius"]
            existing.user_id = prof_user.id
            existing.professor_name = "Dr. Ramesh Tiwari"
            existing.is_deleted = False
            created_slots.append(existing)
            print(f"  [EXISTS] Slot: {subj['name']} | {WEEKDAY_FULL} {cfg['time']}")

    db.session.flush()
    return created_slots


# ─── Phase 7: Professor Class Assignments ─────────────────────────────────────

def seed_prof_class_assignments(prof_user):
    print("\n→ Seeding ProfessorClassAssignments...")
    for subj in SUBJECTS[:4]:
        existing = ProfessorClassAssignment.query.filter_by(
            professor_user_id=prof_user.id,
            course_code=subj["code"],
            branch=BRANCH,
            semester=SEMESTER,
        ).first()
        if not existing:
            pca = ProfessorClassAssignment(
                id=uuid.uuid4(),
                professor_user_id=prof_user.id,
                course_name=subj["name"],
                course_code=subj["code"],
                branch=BRANCH,
                semester=SEMESTER,
                academic_year="2025-26",
                is_active=True,
            )
            db.session.add(pca)
            print(f"  [CREATE] ClassAssignment: {subj['name']} ({BRANCH} Sem{SEMESTER})")
        else:
            existing.is_active = True
            print(f"  [EXISTS] ClassAssignment: {subj['name']}")
    db.session.flush()


# ─── Phase 8: Attendance Records ──────────────────────────────────────────────

def seed_attendance(college):
    print("\n→ Seeding Attendance records...")
    students = StudentProfile.query.filter_by(college_id=college.id, branch=BRANCH, semester=SEMESTER).all()

    ATTENDANCE_DATA = {
        "CT601": (28, 32),   # 87.5% — SAFE
        "CT603": (22, 30),   # 73.3% — RISK
        "CT605": (30, 32),   # 93.75% — EXCELLENT
        "CT607": (18, 30),   # 60% — DANGER (< 75%)
        "CT609": (26, 32),   # 81.25% — SAFE
    }

    for sp in students:
        for code, (attended, total) in ATTENDANCE_DATA.items():
            subj = next((s for s in SUBJECTS if s["code"] == code), None)
            if not subj:
                continue
            existing = AttendanceRecord.query.filter_by(
                student_id=sp.id, subject_code=code
            ).first()
            if not existing:
                rec = AttendanceRecord(
                    id=uuid.uuid4(),
                    student_id=sp.id,
                    subject_name=subj["name"],
                    subject_code=code,
                    attended_classes=attended,
                    total_classes=total,
                )
                db.session.add(rec)
            else:
                existing.attended_classes = attended
                existing.total_classes = total
    db.session.flush()
    print(f"  [SEEDED] Attendance for {len(students)} CT Sem{SEMESTER} students × {len(ATTENDANCE_DATA)} subjects")


# ─── Phase 9: Grades ──────────────────────────────────────────────────────────

def seed_grades(college):
    print("\n→ Seeding Grades...")
    students = StudentProfile.query.filter_by(college_id=college.id, branch=BRANCH, semester=SEMESTER).all()

    GRADE_DATA = [
        ("CT601", "Operating Systems",    35, 28, 9, "A+"),
        ("CT603", "Computer Networks",    30, 25, 8, "A"),
        ("CT605", "Database Systems",     38, 30, 10, "O"),
        ("CT607", "Software Engineering", 28, 22, 7, "B+"),
        ("CT609", "Web Technologies",     32, 26, 8, "A"),
    ]

    for sp in students:
        for code, name, internal, mid, gp, grade_letter in GRADE_DATA:
            existing = Grade.query.filter_by(student_id=sp.id, course_code=code).first()
            if not existing:
                g = Grade(
                    id=uuid.uuid4(),
                    student_id=sp.id,
                    course_name=name,
                    course_code=code,
                    internal_marks=internal,
                    mid_sem_marks=mid,
                    credits=4,
                    grade=grade_letter,
                    grade_point=gp,
                )
                db.session.add(g)
    db.session.flush()
    print(f"  [SEEDED] Grades for {len(students)} students × {len(GRADE_DATA)} subjects")


# ─── Phase 10: Assignments ────────────────────────────────────────────────────

def seed_assignments(college, prof_user):
    print("\n→ Seeding Assignments...")
    assignments_data = [
        {
            "title": "OS Process Scheduling Simulation",
            "subject": "Operating Systems",
            "code": "CT601",
            "due": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "desc": "Implement Round Robin and FCFS scheduling algorithms in C and compare throughput.",
            "points": "50 pts",
        },
        {
            "title": "TCP/IP Protocol Analysis",
            "subject": "Computer Networks",
            "code": "CT603",
            "due": (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d"),
            "desc": "Capture and analyze network packets using Wireshark. Identify TCP 3-way handshake.",
            "points": "40 pts",
        },
        {
            "title": "ER Diagram & Normalization Exercise",
            "subject": "Database Systems",
            "code": "CT605",
            "due": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "desc": "Design a fully normalized database schema for a hospital management system up to BCNF.",
            "points": "30 pts",
        },
    ]

    for data in assignments_data:
        existing = Assignment.query.filter_by(
            college_id=college.id, title=data["title"], branch=BRANCH
        ).first()
        if not existing:
            a = Assignment(
                id=uuid.uuid4(),
                college_id=college.id,
                title=data["title"],
                subject=data["subject"],
                branch=BRANCH,
                semester=SEMESTER,
                due_date=data["due"],
                points=data["points"],
                description=data["desc"],
                professor_id=prof_user.id,
            )
            db.session.add(a)
            print(f"  [CREATE] Assignment: {data['title']}")
        else:
            print(f"  [EXISTS] Assignment: {data['title']}")
    db.session.flush()


# ─── Phase 11: Announcements ──────────────────────────────────────────────────

def seed_announcements(college):
    print("\n→ Seeding Announcements...")
    announcements_data = [
        {
            "title": "Mid-Semester Examination Schedule — CT Branch",
            "content": "Mid-semester exams for CT Semester 6 will be held from 01 Sep to 08 Sep 2026. Detailed schedule is available on the notice board. Students must carry valid ID cards.",
            "author": "Dr. Ramesh Tiwari",
            "role": "professor",
            "audience": "students",
            "branch": BRANCH,
            "pinned": True,
            "urgent": False,
        },
        {
            "title": "Campus Placement Drive — Infosys Ltd.",
            "content": "Infosys is visiting campus on 15 Sep 2026 for Full-Time Software Engineer roles. Eligible: B.Tech (CT/CS/IT) Batch 2026, CGPA ≥ 7.0, 0 backlogs. Register via the Placement Portal by 10 Sep.",
            "author": "Ms. Priya Mehta",
            "role": "tpo",
            "audience": "students",
            "branch": None,
            "pinned": True,
            "urgent": True,
        },
        {
            "title": "Final Year Project Submission Deadline",
            "content": "All Semester 6 students must submit their final project reports by 30 Aug 2026. Late submissions will incur grade penalties. Reports should be submitted via the Academic Portal.",
            "author": "Dr. Ramesh Tiwari",
            "role": "professor",
            "audience": "students",
            "branch": BRANCH,
            "pinned": False,
            "urgent": False,
        },
        {
            "title": "Campus Internet Maintenance — Sunday 24 Aug",
            "content": "The campus internet network will undergo scheduled maintenance from 10:00 AM to 2:00 PM on Sunday, 24 Aug 2026. Plan your downloads and submissions accordingly.",
            "author": "Campus Administration",
            "role": "admin",
            "audience": "everyone",
            "branch": None,
            "pinned": False,
            "urgent": False,
        },
        {
            "title": "TCS National Qualifier Test — Registration Open",
            "content": "TCS NQT 2026 registration is now open for all final year students. This is a mandatory aptitude test for TCS drive eligibility. Register at tcs.com/campus by 05 Sep.",
            "author": "Ms. Priya Mehta",
            "role": "tpo",
            "audience": "students",
            "branch": None,
            "pinned": False,
            "urgent": False,
        },
    ]

    for data in announcements_data:
        existing = Announcement.query.filter_by(college_id=college.id, title=data["title"]).first()
        if not existing:
            a = Announcement(
                id=uuid.uuid4(),
                college_id=college.id,
                title=data["title"],
                content=data["content"],
                author_name=data["author"],
                author_role=data["role"],
                target_audience=data["audience"],
                target_branch=data["branch"],
                is_pinned=data["pinned"],
                is_urgent=data["urgent"],
            )
            db.session.add(a)
            print(f"  [CREATE] Announcement: {data['title'][:55]}...")
        else:
            print(f"  [EXISTS] Announcement: {data['title'][:55]}...")
    db.session.flush()


# ─── Phase 12: Placement Companies & Drives ───────────────────────────────────

def seed_placement(college, tpo_user):
    print("\n→ Seeding Placement Companies & Drives...")
    companies_data = [
        {"name": "Infosys Ltd.", "sector": "IT Services", "website": "https://infosys.com", "desc": "Global leader in IT services and consulting."},
        {"name": "Tata Consultancy Services", "sector": "IT Services", "website": "https://tcs.com", "desc": "India's largest IT company."},
        {"name": "Wipro Technologies", "sector": "IT Services", "website": "https://wipro.com", "desc": "Global IT, consulting and business process services."},
        {"name": "HCL Technologies", "sector": "IT Services", "website": "https://hcltech.com", "desc": "Next-generation global technology company."},
    ]

    company_objs = {}
    for cd in companies_data:
        c = Company.query.filter_by(college_id=college.id, name=cd["name"]).first()
        if not c:
            c = Company(
                id=uuid.uuid4(),
                college_id=college.id,
                name=cd["name"],
                sector=cd["sector"],
                website=cd["website"],
                description=cd["desc"],
            )
            db.session.add(c)
            print(f"  [CREATE] Company: {cd['name']}")
        else:
            print(f"  [EXISTS] Company: {cd['name']}")
        company_objs[cd["name"]] = c
    db.session.flush()

    drives_data = [
        {
            "company": "Infosys Ltd.",
            "role": "Systems Engineer",
            "type": DriveType.FULL_TIME,
            "batch": 2026,
            "cgpa": 7.0,
            "backlogs": 0,
            "attendance": 75.0,
            "branches": "CT,CS,IT",
            "drive_date": date(2026, 9, 15),
            "deadline": datetime(2026, 9, 10, 23, 59, 0),
            "ctc": "6.5 LPA",
            "status": DriveStatus.UPCOMING,
            "desc": "Infosys Systems Engineer program — 3-month training at Mysore campus.",
        },
        {
            "company": "Tata Consultancy Services",
            "role": "Assistant System Engineer",
            "type": DriveType.FULL_TIME,
            "batch": 2026,
            "cgpa": 7.5,
            "backlogs": 0,
            "attendance": 75.0,
            "branches": "CT,CS,IT,ECE",
            "drive_date": date(2026, 9, 22),
            "deadline": datetime(2026, 9, 18, 23, 59, 0),
            "ctc": "7.0 LPA",
            "status": DriveStatus.UPCOMING,
            "desc": "TCS ASE role — NQT qualified students only.",
        },
        {
            "company": "Wipro Technologies",
            "role": "Project Engineer",
            "type": DriveType.FULL_TIME,
            "batch": 2026,
            "cgpa": 6.5,
            "backlogs": 1,
            "attendance": 70.0,
            "branches": "CT,CS,IT,ECE,MECH",
            "drive_date": date(2026, 10, 5),
            "deadline": datetime(2026, 9, 30, 23, 59, 0),
            "ctc": "6.0 LPA",
            "status": DriveStatus.UPCOMING,
            "desc": "Wipro WILP Program — Work Integrated Learning Program.",
        },
    ]

    for dd in drives_data:
        company = company_objs.get(dd["company"])
        existing = PlacementDrive.query.filter_by(
            college_id=college.id,
            company_name=dd["company"],
            role_title=dd["role"],
            batch_year=dd["batch"],
        ).first()
        if not existing:
            drive = PlacementDrive(
                id=uuid.uuid4(),
                college_id=college.id,
                company_id=company.id if company else None,
                company_name=dd["company"],
                role_title=dd["role"],
                drive_type=dd["type"],
                batch_year=dd["batch"],
                cgpa_cutoff=dd["cgpa"],
                backlog_cutoff=dd["backlogs"],
                attendance_cutoff=dd["attendance"],
                target_branches=dd["branches"],
                drive_date=dd["drive_date"],
                registration_deadline=dd["deadline"],
                ctc_offered=dd["ctc"],
                description=dd["desc"],
                status=dd["status"],
                one_offer_lock=True,
                created_by=tpo_user.id,
                rounds=[
                    {"name": "Online Assessment", "order": 1},
                    {"name": "Technical Interview", "order": 2},
                    {"name": "HR Interview", "order": 3},
                ],
            )
            db.session.add(drive)
            print(f"  [CREATE] Drive: {dd['company']} — {dd['role']}")
        else:
            print(f"  [EXISTS] Drive: {dd['company']} — {dd['role']}")
    db.session.flush()


# ─── Phase 13: Campus Events ──────────────────────────────────────────────────

def seed_events(college):
    print("\n→ Seeding Campus Events...")
    events_data = [
        {
            "title": "CodeSprint 2026 — Annual Hackathon",
            "type": "hackathon",
            "dt": "28 Aug 2026, 09:00 AM",
            "venue": "Computer Technology Block, Lab 301",
            "desc": "48-hour hackathon open to all semester 5 and 6 students. Theme: AI in Education.",
        },
        {
            "title": "Campus Placement Orientation Seminar",
            "type": "seminar",
            "dt": "30 Aug 2026, 11:00 AM",
            "venue": "College Auditorium",
            "desc": "Mandatory orientation for all final year students. Resume tips, interview prep, and drive schedule.",
        },
    ]
    for ed in events_data:
        existing = CampusEvent.query.filter_by(college_id=college.id, title=ed["title"]).first()
        if not existing:
            ev = CampusEvent(
                id=uuid.uuid4(),
                college_id=college.id,
                title=ed["title"],
                event_type=ed["type"],
                date_time=ed["dt"],
                venue=ed["venue"],
                description=ed["desc"],
                approval_status="live",
            )
            db.session.add(ev)
            print(f"  [CREATE] Event: {ed['title']}")
        else:
            print(f"  [EXISTS] Event: {ed['title']}")
    db.session.flush()


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  Campus Connect — Demo Data Seeder")
    print("=" * 60)

    with app.app_context():
        try:
            college = get_college()
            print(f"\n✓ College: {college.name} ({college.code})")

            # Find admin user
            admin_user = User.query.filter_by(role=UserRole.ADMIN, college_id=college.id).first()
            if not admin_user:
                raise RuntimeError("Admin user not found! Run migrations and create admin first.")
            print(f"✓ Admin: {admin_user.email}")

            # Seed all entities
            prof_user, prof_profile = seed_professor(college)
            tpo_user = seed_tpo(college)
            demo_student_user, demo_sp = seed_demo_student(college)
            cr_user, cr_sp = seed_cr_student(college, admin_user, prof_user)
            fix_null_emails(college)

            slots = seed_timetable(college, prof_user)
            seed_prof_class_assignments(prof_user)
            seed_attendance(college)
            seed_grades(college)
            seed_assignments(college, prof_user)
            seed_announcements(college)
            seed_placement(college, tpo_user)
            seed_events(college)

            db.session.commit()

            print("\n" + "=" * 60)
            print("  ✅ SEED COMPLETE")
            print("=" * 60)
            print("\n📋 Demo Login Credentials:")
            print(f"  STUDENT  : anoopshukla0709@gmail.com  / {DEMO_PASSWORD}")
            print(f"  CR       : kajal.maurya.cr@iert.ac.in / {DEMO_PASSWORD}")
            print(f"  PROFESSOR: prof.ramesh.tiwari@iert.ac.in / {DEMO_PASSWORD}")
            print(f"  TPO      : tpo.priya.mehta@iert.ac.in / {DEMO_PASSWORD}")
            print(f"  ADMIN    : anoopbuilds@gmail.com (existing password)")
            print(f"\n  Timetable seeded for: {WEEKDAY_FULL}")
            print(f"  Branch: {BRANCH}, Semester: {SEMESTER}")
            print(f"  Timetable slots: {len(slots)}")
            print(f"  Subjects: {', '.join(s['code'] for s in SUBJECTS[:4])}")

        except Exception as e:
            db.session.rollback()
            print(f"\n❌ SEED FAILED: {e}")
            import traceback; traceback.print_exc()
            sys.exit(1)


if __name__ == "__main__":
    main()
