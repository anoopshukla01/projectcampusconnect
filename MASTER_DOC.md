# theVidyaverse — Master Application Documentation

**Purpose of this document:** a single stable reference for what exists in
the app, organized so that changing one feature doesn't require re-discovering
how everything else works. Read the relevant section before touching a
feature; update this document in the same commit whenever a feature's
behavior, routes, or file locations change. Repo:
https://github.com/anoopshukla01/projectcampusconnect (branch `main`).

---

## 1. Architecture — read this first, it prevents the most common mistake

### 1.1 Backend
- **Framework:** Flask (not FastAPI — an early spec called for FastAPI, but
  the actual codebase is Flask; treat the code as the source of truth over
  older planning docs).
- **Database:** PostgreSQL via Supabase. Use the **connection pooler**
  string (Supavisor, port 6543), not the direct connection string — the
  direct string resolves to IPv6 and has caused `Network is unreachable`
  errors from Render.
- **ORM:** SQLAlchemy, migrations via Alembic (`backend/migrations/`).
- **Auth:** `flask_jwt_extended`. JWT carries `role` and `college_id` as
  claims — both always server-resolved, never trusted from client input.
- **Structure:** `backend/app/blueprints/*.py` (one file per feature area —
  `academics`, `admin`, `auth`, `career`, `chats`, `community`, `placement`,
  `professors`, `students`, `notifications`), `backend/app/models/*.py` (35
  tables), `backend/app/auth/permissions.py` (the RBAC/tenancy gate system,
  see §4.1).
- **Deployment:** Render, config in `render.yaml`. Build command runs
  `flask db upgrade` automatically — a bad migration file breaks every
  deploy, not just a dev environment.
- **Tests:** `backend/tests/`, run via `python -m pytest backend/tests/ -q`.
  Uses SQLite in-memory (`db.create_all()`) — this does **not** exercise
  Alembic migration files, so a passing test suite does not confirm a
  migration is correct. Test migrations separately against a scratch DB.

### 1.2 Frontend — the part most likely to cause confusion

This is the single most important thing to understand before changing
frontend code: **the live app is not fully contained in `campus-connect-react/src/`.**

`campus-connect-react/vite.config.js` defines path aliases that pull in
three sibling folders at the repo root as if they were part of `src/`:

| Alias | Points to | Contains |
|---|---|---|
| `@` | `campus-connect-react/src` | Student pages, shared shell (Sidebar/Topbar/Login), context, services |
| `@professor` | `professorDashboard/` (repo root) | All Professor-only pages |
| `@placement` | `placementDashboard/` (repo root) | All TPO/Placement-only pages |
| `@admin` | `adminDashboard/` (repo root) | All Admin-only pages |

**These three root-level folders are live source code, not legacy.** Editing
a professor feature means editing files in `professorDashboard/`, not
searching for it inside `campus-connect-react/src/`.

**Genuinely dead/legacy** (safe to delete, not referenced by any alias or
import): `studentDashboard/` and the root-level `LoginPage/` folder. These
predate the current React app and are not part of the live build.

- **Framework:** React + Vite. Routing: `react-router-dom`, all routes
  defined in `campus-connect-react/src/App.jsx`.
- **Auth state:** `src/context/AuthContext.jsx` — `user` object persisted to
  `localStorage`. Real login always resolves `role` from the backend JWT
  response; never trust client-side role state for authorization (the
  backend enforces this regardless, but keep the frontend consistent too).
- **API layer:** `src/services/api.js` — single module all components import
  to talk to the backend. Handles auth headers, silent token refresh on 401,
  and native-APK vs. web base-URL switching.
- **Data fetching pattern:** `src/hooks/useApiData.js` — standard hook used
  across most pages for `{ data, loading, error, isEmpty }`.
- **Deployment:** Vercel (web), Capacitor-wrapped APK (`campus-connect-react/android`,
  `capacitor.config.ts`) for the Android app.
- **APK vs. web rebuilds:** backend-only changes never require a new APK.
  Any change to `campus-connect-react/` (new screen, new field, changed
  component) requires a new APK build for Android users to receive it — web
  users get it on next page load automatically via Vercel.

### 1.3 Naming history
The product has been called StudentSphere → CampusConnect → theVidyaverse
across its life; you may see all three names in code comments, config
defaults, and file paths. They refer to the same product.

---

## 2. Feature Map

Each entry: **what it does** → backend blueprint/model → frontend
location(s). This is the category structure — use it to find where a
feature lives before changing it.

### 2.1 Academics (shared: Student + Professor, some Admin)

| Feature | Backend | Frontend |
|---|---|---|
| Timetable | `academics.py` | `src/pages/Timetable/` (student), `professorDashboard/Timetable/` |
| Attendance | `academics.py` | `src/pages/Attendance/` |
| Assignments | `academics.py` | `src/pages/Assignments/`, `professorDashboard/Assignments/` |
| Gradebook / Grading Zone | `academics.py` | `src/pages/GradeBook/` |
| Lectures | `career.py` (`LectureRecording` model) | `src/pages/Lectures/`, `professorDashboard/Lectures/` |
| E-Library | `community.py` | `src/pages/ELibrary/`, `professorDashboard/ELibrary/` |
| Notes & PYQs | `community.py` | `src/pages/Notes/`, `professorDashboard/Notes/` |

**Rules to remember:** Professors can only mark/edit attendance and grades for
students in classes they teach (scoped by `ProfessorClassAssignment`, now also
by `college_id` — see §4.2 for the bug history here). Assignment deletion is
only allowed within a 1-minute window post-posting. Grades lock after results
are out except during a 15-day re-evaluation window.

### 2.2 Community (Student + Professor + TPO + Admin, varying permissions)

| Feature | Backend | Frontend |
|---|---|---|
| Announcements | `community.py` | `src/pages/Dashboard` (feed preview), `professorDashboard/Announcements/`, `adminDashboard/Announcements/` |
| Class Chat | `chats.py` | `src/pages/Chats/`, `professorDashboard/Chats/` |
| Events | `community.py` | `src/pages/Events/` |
| Marketplace | `community.py` | `src/pages/Marketplace/`, `adminDashboard/Marketplace/` |
| Lost & Found | `community.py` | `src/pages/LostAndFound/` |

**Rules to remember:** identity privacy in chat (only Admin/TPO see real
contact details, others see username only). Marketplace listings auto-expire
after 30 days. Announcements are college-scoped; a professor can only delete
their own post (not another professor's — this was a real bug, fixed).

### 2.3 Career / Placement (Student-facing + TPO-facing)

| Feature | Backend | Frontend |
|---|---|---|
| Internships | `placement.py` | `src/pages/Internships/` |
| Resume Builder | `career.py` | `src/pages/ResumeBuilder/` |
| Mentorship | `career.py` | `src/pages/Mentorship/`, `professorDashboard/Mentorship/` |
| Mock Interviews (Daily.co) | `career.py` | `src/pages/MockInterviews/` |
| Companies | `placement.py` | `placementDashboard/Companies/` |
| Drives | `placement.py` | `placementDashboard/Drives/` |
| Eligibility Engine | `placement.py` | `placementDashboard/Eligibility/` |
| Applications | `placement.py` | `placementDashboard/Applications/` |
| Offers & CTC | `placement.py` | `placementDashboard/Offers/` |
| TPO Reports/Moderation | `placement.py` | `placementDashboard/PlacementReports/` |
| Notice Board | `placement.py` | `placementDashboard/PlacementNotices/` |

**Rules to remember:** TPO can only message/contact students within the
eligible pool for their drives (5 semesters passed for jobs, 4 for
internships). Mock interview recordings via Daily.co webhook — verify the
signature before trusting any payload (was a real gap, fixed).

### 2.4 Admin / Control Panel

| Feature | Backend | Frontend |
|---|---|---|
| Control Panel / Dashboard | `admin.py` | `adminDashboard/AdminDashboard/` |
| Analytics | `admin.py` | `adminDashboard/AnalyticsDashboard/` |
| User Management | `admin.py` | `adminDashboard/UserManagement/` |
| Rules Engine | `admin.py` | `adminDashboard/RulesEngine/` |
| Data Manager | `admin.py` | `adminDashboard/DataManager/` |
| Audit Log | `admin.py` | `adminDashboard/AuditLog/` |
| Data Health (moderation queue) | `admin.py` | `adminDashboard/DataHealth/` |
| Attendance/Timetable Oversight | `admin.py` | `adminDashboard/AttendanceTimetableOversight/` |
| Branch Comparison | `admin.py` | `adminDashboard/BranchComparison/` |

**Rules to remember:** every Admin data-view/edit through Data Manager writes
to the Audit Log, which is immutable (no edit/delete, by anyone). Admin's
"see everyone" queries must always be scoped to their own college — this was
the central risk the whole multi-tenancy retrofit addressed.

### 2.5 Cross-cutting: Notifications
`notifications.py` — bell-icon notification list, unread count, mark-read.
Scoped by `user_id` only (safe by construction, no college-scoping needed
since a notification always belongs to exactly one user). Frontend:
`src/components/Topbar.jsx`.

---

## 3. Cross-Cutting Systems

### 3.1 Auth & RBAC — the 4-gate system (`app/auth/permissions.py`)
1. **`require_auth`** — validates JWT, loads `g.current_user`.
2. **`require_roles`/`require_permission`** — role-based access.
3. **`require_self_or_roles`/`require_ownership_or_roles`** — IDOR guard
   (can only touch your own record, unless your role is exempted).
4. **`require_same_college`/`assert_college_match`** — tenancy guard (added
   during the multi-tenancy retrofit). Returns **404** (not 403) on a
   cross-college mismatch — deliberately, so a user can't tell whether a
   resource exists at all in another college, not just that they're denied.

### 3.2 Multi-tenancy (College data isolation)
Every college's data is isolated via a `college_id` column, present directly
on `users`, `student_profiles`, `professor_profiles`, `companies`,
`branch_placements`, `subjects`, and inherited through joins everywhere else.
Student registration is a two-step claim flow: Admin bulk-imports `roll_no`
via CSV → student verifies OTP + `roll_no` + `college_code` to activate.
**Do not add any new student self-registration path without resolving
`college_id` from a `college_code` first** — a previous unreviewed addition
that skipped this caused every self-registered student to be silently
misassigned to the wrong college (found and removed).

### 3.3 DPDP / Data Privacy
Field-level masking on sensitive data (address, parent contact, salary) —
gated behind an approval flow (Professor requests, Admin approves). Frontend
consent UI: `src/context/PermissionContext.jsx` — consent must default to
**not granted** until the user explicitly agrees (see known issues, H2).

---

## 4. Known Issues Tracker

Update this section as items are fixed or new ones are found — this is the
part meant to stop regressions.

### 🔴 Open — Critical
*(None remaining)*

### 🟠 Open — High
*(None remaining)*

### 🟡 Open — Medium / UI-UX
*(None remaining)*

### ✅ Fixed (kept here as history, not for re-investigation)
- **Hardcoded demo credentials secured** (C2): Demo fallback in `Login.jsx` gated behind `import.meta.env.DEV`; `Demo@1234` string verified 100% tree-shaken out of production bundle.
- **Offline mock-login fallback secured & cache-busted** (C3): Gated behind `import.meta.env.DEV` in `AuthContext.jsx`; added automatic eviction of stale mock sessions from localStorage; fixed `Dashboard.jsx` to fetch stats from `studentProfile` API.
- **`login_err.json` removed & ignored** (H1): Deleted `login_err.json` from git and added error/debug dump patterns to `.gitignore`.
- **DPDP consent default fixed** (H2): Defaulted `dpdpConsent` to `false` in `PermissionContext.jsx` and added a boot migration to reset auto-granted consent state for existing users.
- **`useApiData` error handling fixed** (H3): `useApiData` now always sets `error` on failure alongside `defaultData`, enabling call sites to distinguish errors from genuine empty states.
- **Shared design-token baseline** (M1): Extended `global.css` with a comprehensive token layer (colours, typography scale, spacing scale, border radii, shadows, z-indexes) shared across all four dashboard areas.
- **Emoji icons replaced with SVGs** (M2): Replaced functional UI emojis across `PermissionContext.jsx`, `Dashboard.jsx`, etc., with clean SVG components.
- **Announcements pagination & interactivity** (M3): Added `page`/`limit` pagination to `GET /community/announcements`; created dedicated paginated `Announcements.jsx` page with inline expandable items.
- **Sidebar missing admin routes added** (M4): Added `/admin/timetable-attendance` and `/admin/marketplace` to `PATH_TO_PAGE` mapping in `DashboardLayout.jsx`.
- **`AdminErrorBoundary` error details hidden** (M5): Replaced raw stack trace display with user-friendly fallback UI and DevTools console logging.
- **localStorage key consolidation** (M6): Added boot migration in `AuthContext.jsx` to collapse legacy `ss_token` keys into `access_token`.
- **Student registration frontend/backend mismatch** (commit `917ab2c`):
  Added `college_code` field to `Login.jsx` Claim Student form; removed
  `load_default="CC2024"` silent fallback from `StudentRegisterSchema`
  (made `required=True`); updated `test_auth.py` to supply `college_code`
  and `college_id` on the fixture `StudentProfile`. All 62 tests pass.
- Multi-tenancy retrofit: `college_id` scoping across all blueprints/models,
  the 39 direct-lookup IDOR gaps, 2 raw-SQL cross-college leaks, the
  branch/semester-matching roster bug in `professors.py`, the migration
  `NameError`, the silently-wrong-college `/register/email` endpoint
  (removed entirely), config hardening (`SECRET_KEY` fail-fast), `render.yaml`
  cleanup (`COLLEGE_NAME`/`ALLOWED_EMAIL_DOMAIN` removed, `MOCK_OTP` off,
  real Redis instead of in-memory), cross-college denial responses
  standardized to 404, duplicate event-registration route removed,
  `delete_announcement` inverted-logic bug fixed, "TPO dashboard mislabeled
  Learner portal" fixed.

---

## 5. How to use this document going forward

- Before changing a feature: read its row in §2, its rules, and check §4 for
  any open issue already flagged against it.
- After fixing something in §4: move it to "Fixed" with a one-line note, don't
  just delete it — the history is useful.
- After adding a new feature: add a row to the relevant §2 table with
  backend + frontend locations, so it's discoverable the same way.
- If a change touches the tenancy/auth system (§3.1, §3.2): treat it as
  higher-risk than a normal feature change, and re-verify against the
  cross-college test scenarios in `backend/tests/test_tenancy.py`.
