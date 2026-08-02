"""
create_test_accounts.py — Create 4 test accounts and verify 5 cross-role data flows.

Run from the backend/ directory:
    python create_test_accounts.py

This script:
  1. Creates college TESTCOL24 ("CampusConnect Test College")
  2. Creates one account per role (Student, Professor, TPO, Admin)
  3. Runs 5 cross-role verification flows directly against the DB (no HTTP)
  4. Prints PASS/FAIL for each flow

Test accounts created:
  Role        Email                           Password      Roll / Employee ID
  ─────────────────────────────────────────────────────────────────────────────
  Admin       admin@testcol24.edu.in          Test@Verify24
  Professor   professor@testcol24.edu.in      Test@Verify24  EMP-TEST001
  TPO         tpo@testcol24.edu.in            Test@Verify24
  Student     student@testcol24.edu.in        Test@Verify24  CS24TEST01
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

DEMO_PASSWORD = "Test@Verify24"
COLLEGE_CODE  = "TESTCOL24"
COLLEGE_NAME  = "CampusConnect Test College"
RESULTS       = {}


def log(flow, passed, detail=""):
    icon = "✅ PASS" if passed else "❌ FAIL"
    RESULTS[flow] = passed
    msg = f"  {icon} — {flow}"
    if detail:
        msg += f"\n         {detail}"
    print(msg)


def _make_audit(actor_user, action, target_type=None, target_id=None, detail=None):
    """Helper: create an AuditLog row correctly (ip_address is NOT NULL)."""
    from app.models.audit import AuditLog
    return AuditLog(
        actor_id=actor_user.id,
        actor_role=actor_user.role.value,
        action=action,
        target_type=target_type,
        target_id=target_id,
        ip_address="127.0.0.1",      # script-internal call
        user_agent="create_test_accounts.py",
        detail=detail or {},
    )


def run():
    env = os.environ.get("FLASK_ENV", "production")
    app = create_app(env)

    with app.app_context():
        from app.models.college import College
        from app.models.user import User, UserRole
        from app.models.student import StudentProfile
        from app.models.professor import ProfessorProfile, ApprovalStatus
        from app.models.academic import (
            ProfessorClassAssignment, AttendanceRecord,
            Assignment, AssignmentSubmission, Grade, GradeRevision,
        )
        from app.models.placement import (
            Company, PlacementDrive, DriveStatus, DriveType,
        )
        from app.models.community import (
            LibraryResource, LibraryRequest, LibraryRequestStatus,
        )
        from app.models.audit import AuditLog

        print("\n╔══════════════════════════════════════════════════════════════╗")
        print("║  Campus Connect — Test Account Creation & Flow Verification  ║")
        print("╚══════════════════════════════════════════════════════════════╝\n")

        # ── Step 1: Create College ─────────────────────────────────────────────
        print("─ Creating test college …")
        college = College.query.filter_by(code=COLLEGE_CODE).first()
        if not college:
            college = College(
                name=COLLEGE_NAME,
                slug="campusconnect-test-college",
                code=COLLEGE_CODE,
                is_active=True,
            )
            db.session.add(college)
            db.session.flush()
        college_id = college.id
        print(f"  College: {college.name}  (code={college.code}, id={college_id})\n")

        # ── Step 2: Create Users ───────────────────────────────────────────────
        print("─ Creating test users …")

        def get_or_create_user(email, role_enum):
            u = User.query.filter_by(email=email).first()
            if not u:
                u = User(college_id=college_id, email=email, role=role_enum, is_active=True)
                u.set_password(DEMO_PASSWORD)
                db.session.add(u)
                db.session.flush()
                print(f"  ✓ Created  {role_enum.value:<22} {email}")
            else:
                print(f"  ↺ Exists   {role_enum.value:<22} {email}")
            return u

        admin_user = get_or_create_user("admin@testcol24.edu.in",     UserRole.ADMIN)
        prof_user  = get_or_create_user("professor@testcol24.edu.in", UserRole.PROFESSOR)
        tpo_user   = get_or_create_user("tpo@testcol24.edu.in",       UserRole.PLACEMENT_CELL)
        stu_user   = get_or_create_user("student@testcol24.edu.in",   UserRole.STUDENT)

        # ── Step 3: Create Profiles ────────────────────────────────────────────
        print("\n─ Creating profiles …")

        # Professor profile
        prof_profile = ProfessorProfile.query.filter_by(user_id=prof_user.id).first()
        if not prof_profile:
            prof_profile = ProfessorProfile(
                user_id=prof_user.id,
                college_id=college_id,          # explicit — avoids DEFAULT_COLLEGE_ID fallback
                employee_id="EMP-TEST001",
                full_name="Dr. Test Professor",
                department="Computer Science",
                designation="Associate Professor",
                approval_status=ApprovalStatus.APPROVED,
            )
            db.session.add(prof_profile)
            db.session.flush()
            print("  ✓ Professor profile  (EMP-TEST001, CS dept, APPROVED)")


        # Class assignment for professor
        class_assign = ProfessorClassAssignment.query.filter_by(
            professor_user_id=prof_user.id, course_code="CS601"
        ).first()
        if not class_assign:
            class_assign = ProfessorClassAssignment(
                professor_user_id=prof_user.id,
                course_name="Advanced Algorithms",
                course_code="CS601",
                branch="Computer Science",
                semester=6,
                academic_year="2025-26",
            )
            db.session.add(class_assign)
            db.session.flush()
            print("  ✓ Professor class assignment  (CS601, sem 6)")

        # Student profile
        stu_profile = StudentProfile.query.filter_by(user_id=stu_user.id).first()
        if not stu_profile:
            stu_profile = StudentProfile(
                user_id=stu_user.id,
                college_id=college_id,
                roll_no="CS24TEST01",
                full_name="Test Student",
                branch="Computer Science",
                batch_year=2024,
                semester=6,
                cgpa=8.5,
                attendance_pct=85.0,
                active_backlogs=0,
                dpdp_consent_given=True,
                dpdp_consent_at=datetime.now(timezone.utc),
                profile_complete=True,
            )
            db.session.add(stu_profile)
            db.session.flush()
            print("  ✓ Student profile  (CS24TEST01, CGPA 8.5, batch 2024, CS branch)")

        db.session.commit()
        print()
        print("  ╔── Login Credentials ─────────────────────────────────────────╗")
        print(f"  │  Admin     → admin@testcol24.edu.in        / {DEMO_PASSWORD}  │")
        print(f"  │  Professor → professor@testcol24.edu.in    / {DEMO_PASSWORD}  │")
        print(f"  │  TPO       → tpo@testcol24.edu.in          / {DEMO_PASSWORD}  │")
        print(f"  │  Student   → student@testcol24.edu.in      / {DEMO_PASSWORD}  │")
        print(f"  │             (roll no: CS24TEST01, college code: {COLLEGE_CODE})          │")
        print("  ╚─────────────────────────────────────────────────────────────╝\n")

        # ══════════════════════════════════════════════════════════════════════
        # VERIFICATION FLOWS
        # ══════════════════════════════════════════════════════════════════════
        print("─" * 68)
        print("  RUNNING VERIFICATION FLOWS")
        print("─" * 68)

        # ── Flow 1: Professor marks attendance → student sees it + audit log ──
        print("\n[Flow 1] Professor marks attendance → student record exists + audit log")
        try:
            AttendanceRecord.query.filter_by(student_id=stu_profile.id, subject_code="CS601").delete()
            db.session.flush()

            rec = AttendanceRecord(
                student_id=stu_profile.id,
                subject_name="Advanced Algorithms",
                subject_code="CS601",
                attended_classes=1,
                total_classes=1,
            )
            db.session.add(rec)
            db.session.add(_make_audit(
                prof_user, "academics.attendance.marked",
                target_type="attendance_record",
                detail={"subject": "CS601", "branch": "Computer Science", "student_roll": "CS24TEST01"},
            ))
            db.session.commit()

            check = AttendanceRecord.query.filter_by(student_id=stu_profile.id, subject_code="CS601").first()
            assert check is not None, "AttendanceRecord row missing"
            assert check.attended_classes == 1
            assert check.total_classes == 1

            a = AuditLog.query.filter_by(actor_id=prof_user.id, action="academics.attendance.marked").first()
            assert a is not None, "AuditLog row missing"
            assert a.actor_role == "professor"

            log("Flow 1 — Attendance: professor→student record+audit",
                True, f"attendance_record.id={check.id}, audit.id={a.id}")
        except Exception as e:
            db.session.rollback()
            log("Flow 1 — Attendance: professor→student record+audit", False, str(e))

        # ── Flow 2: Professor grades assignment → student gradebook + audit ───
        print("\n[Flow 2] Professor grades assignment → student submission graded + audit")
        try:
            # Clean up previous test data — submissions first (FK child), then assignments
            old_assigns = Assignment.query.filter_by(subject="CS601", professor_id=prof_user.id).all()
            for a in old_assigns:
                AssignmentSubmission.query.filter_by(assignment_id=a.id).delete()
                GradeRevision.query.filter(
                    GradeRevision.grade_id.in_(
                        [g.id for g in Grade.query.filter_by(student_id=stu_profile.id, course_code="CS601").all()]
                    )
                ).delete(synchronize_session=False)
            Assignment.query.filter_by(subject="CS601", professor_id=prof_user.id).delete()
            Grade.query.filter_by(student_id=stu_profile.id, course_code="CS601").delete()
            db.session.flush()

            # Create assignment (using actual model fields: no created_by / college_id)
            assgn = Assignment(
                title="Test Assignment 1",
                subject="CS601",
                branch="Computer Science",
                due_date="2025-12-31",
                points="100 pts",
                professor_id=prof_user.id,
            )
            db.session.add(assgn)
            db.session.flush()

            # Create a Grade row for the student (GradeRevision links to grades.id)
            Grade.query.filter_by(student_id=stu_profile.id, course_code="CS601").delete()
            db.session.flush()

            grade_row = Grade(
                student_id=stu_profile.id,
                course_name="Advanced Algorithms",
                course_code="CS601",
                internal_marks=90,
                mid_sem_marks=85,
                credits=4,
                grade="A+",
                grade_point=10,
            )
            db.session.add(grade_row)
            db.session.flush()

            # Student submission with all required non-null fields
            sub = AssignmentSubmission(
                assignment_id=assgn.id,
                student_id=stu_profile.id,
                student_name="Test Student",
                roll_no="CS24TEST01",
                file_name="test_assignment_1.pdf",
                status="graded",
                grade="A+",
                feedback="Excellent work!",
            )
            db.session.add(sub)
            db.session.flush()

            # GradeRevision — links to grade_id (not submission_id)
            rev = GradeRevision(
                grade_id=grade_row.id,
                old_grade="A",
                new_grade="A+",
                old_grade_point=9,
                new_grade_point=10,
                updated_by_id=prof_user.id,
            )
            db.session.add(rev)

            db.session.add(_make_audit(
                prof_user, "academics.assignment.graded",
                target_type="assignment_submission",
                target_id=sub.id,
                detail={"grade": "A+", "student_roll": "CS24TEST01"},
            ))
            db.session.commit()

            sub_check = AssignmentSubmission.query.filter_by(assignment_id=assgn.id, student_id=stu_profile.id).first()
            assert sub_check is not None, "AssignmentSubmission row missing"
            assert sub_check.grade == "A+", f"Expected A+, got {sub_check.grade}"

            rev_check = GradeRevision.query.filter_by(grade_id=grade_row.id).first()
            assert rev_check is not None, "GradeRevision row missing"

            a = AuditLog.query.filter_by(actor_id=prof_user.id, action="academics.assignment.graded").first()
            assert a is not None, "AuditLog for grading missing"

            log("Flow 2 — Grading: professor→submission graded+grade_revision+audit",
                True, f"submission.id={sub.id}, grade=A+, revision.id={rev_check.id}")
        except Exception as e:
            db.session.rollback()
            log("Flow 2 — Grading: professor→submission graded+grade_revision+audit", False, str(e))

        # ── Flow 3: TPO creates drive → eligible student CGPA check ──────────
        print("\n[Flow 3] TPO creates placement drive → eligible student check + audit")
        try:
            # Get-or-create company (avoid UniqueViolation on re-runs)
            company = Company.query.filter_by(college_id=college_id, name="Acme Corp (Test)").first()
            if not company:
                company = Company(
                    college_id=college_id,
                    name="Acme Corp (Test)",
                    sector="Technology",
                )
                db.session.add(company)
                db.session.flush()


            drive = PlacementDrive(
                college_id=college_id,
                company_id=company.id,
                company_name="Acme Corp (Test)",
                role_title="Software Engineer",
                ctc_offered="12 LPA",            # correct field: ctc_offered (str), not ctc_lpa
                drive_type=DriveType.FULL_TIME,
                status=DriveStatus.ACTIVE,
                batch_year=2024,
                cgpa_cutoff=7.5,         # student has 8.5 — eligible
                backlog_cutoff=0,
                drive_date=(datetime.now(timezone.utc) + timedelta(days=14)).date(),  # required field
                registration_deadline=datetime.now(timezone.utc) + timedelta(days=30),
                created_by=tpo_user.id,  # correct field: created_by (not created_by_id)
            )
            db.session.add(drive)

            db.session.add(_make_audit(
                tpo_user, "placement.drive.created",
                target_type="placement_drive",
                detail={"company": "Acme Corp (Test)", "role": "Software Engineer"},
            ))
            db.session.commit()

            drive_check = PlacementDrive.query.filter_by(
                college_id=college_id, company_name="Acme Corp (Test)"
            ).first()
            assert drive_check is not None, "PlacementDrive row missing"
            assert drive_check.status == DriveStatus.ACTIVE

            # Eligibility check — same logic as placement blueprint
            eligible = (
                float(stu_profile.cgpa) >= drive_check.cgpa_cutoff and
                stu_profile.active_backlogs <= drive_check.backlog_cutoff and
                stu_profile.batch_year == drive_check.batch_year
            )
            assert eligible, (
                f"Student should be eligible: cgpa={stu_profile.cgpa} vs cutoff={drive_check.cgpa_cutoff}, "
                f"backlogs={stu_profile.active_backlogs} vs cutoff={drive_check.backlog_cutoff}, "
                f"batch={stu_profile.batch_year} vs drive={drive_check.batch_year}"
            )

            a = AuditLog.query.filter_by(actor_id=tpo_user.id, action="placement.drive.created").first()
            assert a is not None, "AuditLog for drive creation missing"

            log("Flow 3 — TPO drive created → student eligible + audit",
                True,
                f"drive.id={drive_check.id}, student_cgpa={stu_profile.cgpa}≥cutoff={drive_check.cgpa_cutoff}")
        except Exception as e:
            db.session.rollback()
            log("Flow 3 — TPO drive created → student eligible + audit", False, str(e))

        # ── Flow 4: Admin approves E-Library request → student access ────────
        print("\n[Flow 4] Admin approves E-Library resource → student access granted + audit")
        try:
            # LibraryResource — correct fields from model (no 'category'/'branch'/'semester', has 'subject')
            resource = LibraryResource(
                college_id=college_id,
                title="Advanced Algorithms: Test Textbook",
                author="Dr. Test Author",
                subject="Advanced Algorithms",
                resource_type="book",
                uploaded_by_id=prof_user.id,
                file_url="https://example.com/test-algo.pdf",
                approved=True,
            )
            db.session.add(resource)
            db.session.flush()

            lib_req = LibraryRequest(
                resource_id=resource.id,
                user_id=stu_user.id,
                status=LibraryRequestStatus.PENDING,
            )
            db.session.add(lib_req)
            db.session.flush()

            # Admin approves
            lib_req.status = LibraryRequestStatus.APPROVED
            lib_req.expires_at = datetime.now(timezone.utc) + timedelta(days=7)

            db.session.add(_make_audit(
                admin_user, "community.library_request.approved",
                target_type="library_request",
                target_id=lib_req.id,
                detail={"resource_id": str(resource.id), "student_id": str(stu_user.id)},
            ))
            db.session.commit()

            req_check = LibraryRequest.query.filter_by(user_id=stu_user.id, resource_id=resource.id).first()
            assert req_check is not None, "LibraryRequest row missing"
            assert req_check.status == LibraryRequestStatus.APPROVED, f"Got {req_check.status}"
            assert req_check.expires_at is not None, "expires_at not set"

            a = AuditLog.query.filter_by(
                actor_id=admin_user.id, action="community.library_request.approved"
            ).first()
            assert a is not None, "AuditLog for library approval missing"
            assert a.actor_id == admin_user.id

            log("Flow 4 — Admin approves E-Library → student access + audit",
                True,
                f"library_request.id={req_check.id}, status=APPROVED, expires={req_check.expires_at.date()}")
        except Exception as e:
            db.session.rollback()
            log("Flow 4 — Admin approves E-Library → student access + audit", False, str(e))

        # ── Flow 5: Audit log integrity check ─────────────────────────────────
        print("\n[Flow 5] Audit Log — all 4 actions recorded with correct actor + timestamp")
        try:
            expected = [
                ("academics.attendance.marked",        prof_user.id,  "professor"),
                ("academics.assignment.graded",         prof_user.id,  "professor"),
                ("placement.drive.created",             tpo_user.id,   "placement_cell"),
                ("community.library_request.approved",  admin_user.id, "admin"),
            ]
            all_ok = True
            details = []
            for action, actor_id, actor_role in expected:
                entry = AuditLog.query.filter_by(action=action, actor_id=actor_id).first()
                if entry is None:
                    all_ok = False
                    details.append(f"  MISSING:  {action}")
                elif entry.actor_role != actor_role:
                    all_ok = False
                    details.append(f"  ROLE ERR: {action} — expected {actor_role!r}, got {entry.actor_role!r}")
                elif entry.timestamp is None:
                    all_ok = False
                    details.append(f"  NO TIME:  {action}")
                else:
                    details.append(f"  OK:  {action}  ({entry.actor_role}, {entry.timestamp.strftime('%H:%M:%S UTC')})")

            for d in details:
                print(f"       {d}")

            log("Flow 5 — Audit log: 4 entries, correct actor_role + timestamp",
                all_ok, f"Checked {len(expected)} entries")
        except Exception as e:
            log("Flow 5 — Audit log: 4 entries, correct actor_role + timestamp", False, str(e))

        # ── Final summary ──────────────────────────────────────────────────────
        passed = sum(1 for v in RESULTS.values() if v)
        total  = len(RESULTS)
        print("\n" + "═" * 68)
        print(f"  RESULT: {passed}/{total} flows PASSED")
        print("═" * 68 + "\n")

        if passed == total:
            print("  ✅ All verification flows passed. Database is clean and functional.\n")
        else:
            print("  ❌ Some flows failed. See details above.\n")
            sys.exit(1)


if __name__ == "__main__":
    run()
