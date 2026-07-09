import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import DashboardLayout from './components/DashboardLayout';
import Login           from './pages/Login/Login';
import Dashboard       from './pages/Dashboard/Dashboard';
import Timetable       from './pages/Timetable/Timetable';
import ProfessorTimetable from '@professor/Timetable/Timetable';
import Attendance      from './pages/Attendance/Attendance';
import Assignments     from './pages/Assignments/Assignments';
import Lectures        from './pages/Lectures/Lectures';
import ELibrary        from './pages/ELibrary/ELibrary';
import Notes           from './pages/Notes/Notes';
import GradeBook       from './pages/GradeBook/GradeBook';
import Chats           from './pages/Chats/Chats';
import Events          from './pages/Events/Events';
import Marketplace     from './pages/Marketplace/Marketplace';
import LostAndFound    from './pages/LostAndFound/LostAndFound';
import Internships     from './pages/Internships/Internships';
import ResumeBuilder   from './pages/ResumeBuilder/ResumeBuilder';
import Mentorship      from './pages/Mentorship/Mentorship';
import MockInterviews  from './pages/MockInterviews/MockInterviews';

// Professor-only pages
import Classes         from './pages/professorDashboard/Classes/Classes';
import Roster          from './pages/professorDashboard/Roster/Roster';
import Announcements   from './pages/professorDashboard/Announcements/Announcements';

// TPO / Placement pages  (source lives at projectcampusconnect/placementDashboard/)
import PlacementDashboard from '@placement/PlacementDashboard/PlacementDashboard';
import Companies          from '@placement/Companies/Companies';
import Drives             from '@placement/Drives/Drives';
import Eligibility        from '@placement/Eligibility/Eligibility';
import Applications       from '@placement/Applications/Applications';
import Offers             from '@placement/Offers/Offers';
import PlacementReports   from '@placement/PlacementReports/PlacementReports';
import PlacementNotices   from '@placement/PlacementNotices/PlacementNotices';

// Admin / Principal pages  (source lives at projectcampusconnect/adminDashboard/)
import AdminDashboard     from '@admin/AdminDashboard/AdminDashboard';
import AnalyticsDashboard from '@admin/AnalyticsDashboard/AnalyticsDashboard';
import UserManagement     from '@admin/UserManagement/UserManagement';
import AuditLog           from '@admin/AuditLog/AuditLog';
import RulesEngine        from '@admin/RulesEngine/RulesEngine';
import AdminAnnouncements from '@admin/Announcements/Announcements';
import DataHealth         from '@admin/DataHealth/DataHealth';
import BranchComparison   from '@admin/BranchComparison/BranchComparison';
import DataManager        from '@admin/DataManager/DataManager';

import { PermissionModal } from './components/PermissionModal/PermissionModal';

export default function App() {
  // Pull pre-computed booleans from AuthContext (role sourced from JWT, never client input)
  const { user, isStudent, isProfessor, isTPO, isAdmin } = useAuth();
  const isProf = isProfessor;

  // Redirect helpers
  const onlyStudent = (el) => isStudent ? el : <Navigate to="/" replace />;
  const onlyProf    = (el) => isProf    ? el : <Navigate to="/" replace />;
  const onlyTPO     = (el) => isTPO     ? el : <Navigate to="/" replace />;
  const notTPO      = (el) => !isTPO    ? el : <Navigate to="/placement" replace />;
  const notProf     = (el) => !isProf   ? el : <Navigate to="/" replace />;
  const onlyAdmin   = (el) => isAdmin   ? el : <Navigate to="/" replace />;

  return (
    <>
      <PermissionModal />
      <Routes>
        {/* Public */}
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login />}
        />

        {/* Protected – DashboardLayout is the shared parent */}
        <Route element={<DashboardLayout />}>

          {/* ── Dashboard (role-aware) ── */}
          <Route path="/"              element={isAdmin ? <AdminDashboard /> : isTPO ? <PlacementDashboard /> : <Dashboard />} />

          {/* ── Shared pages (student + professor) ── */}
          <Route path="/timetable"     element={notTPO(isProf ? <ProfessorTimetable /> : <Timetable />)} />
          <Route path="/attendance"    element={notTPO(<Attendance />)} />
          <Route path="/assignments"   element={notTPO(<Assignments />)} />
          <Route path="/lectures"      element={notTPO(<Lectures />)} />
          <Route path="/elibrary"      element={notTPO(<ELibrary />)} />
          <Route path="/notes"         element={notTPO(<Notes />)} />
          <Route path="/grades"        element={notTPO(<GradeBook />)} />
          <Route path="/chats"         element={notTPO(<Chats />)} />
          <Route path="/events"        element={notTPO(<Events />)} />
          <Route path="/mentorship"    element={notTPO(<Mentorship />)} />

          {/* ── Student-only ── */}
          <Route path="/marketplace"   element={onlyStudent(<Marketplace />)} />
          <Route path="/lostandfound"  element={onlyStudent(<LostAndFound />)} />
          <Route path="/internships"   element={onlyStudent(<Internships />)} />
          <Route path="/resume"        element={onlyStudent(<ResumeBuilder />)} />
          <Route path="/mock"          element={onlyStudent(<MockInterviews />)} />

          {/* ── Professor-only ── */}
          <Route path="/classes"       element={onlyProf(<Classes />)} />
          <Route path="/roster"        element={onlyProf(<Roster />)} />
          <Route path="/announcements" element={onlyProf(<Announcements />)} />

          {/* ── TPO-only ── */}
          <Route path="/placement"     element={onlyTPO(<PlacementDashboard />)} />
          <Route path="/companies"     element={onlyTPO(<Companies />)} />
          <Route path="/drives"        element={onlyTPO(<Drives />)} />
          <Route path="/eligibility"   element={onlyTPO(<Eligibility />)} />
          <Route path="/applications"  element={onlyTPO(<Applications />)} />
          <Route path="/offers"        element={onlyTPO(<Offers />)} />
          <Route path="/plreports"     element={onlyTPO(<PlacementReports />)} />
          <Route path="/plnotices"     element={onlyTPO(<PlacementNotices />)} />

          {/* ── Admin-only ── */}
          <Route path="/admin"              element={onlyAdmin(<AdminDashboard />)} />
          <Route path="/admin/analytics"   element={onlyAdmin(<AnalyticsDashboard />)} />
          <Route path="/admin/users"       element={onlyAdmin(<UserManagement />)} />
          <Route path="/admin/audit"       element={onlyAdmin(<AuditLog />)} />
          <Route path="/admin/rules"       element={onlyAdmin(<RulesEngine />)} />
          <Route path="/admin/announcements" element={onlyAdmin(<AdminAnnouncements />)} />
          <Route path="/admin/datahealth" element={onlyAdmin(<DataHealth />)} />
          <Route path="/admin/branches"   element={onlyAdmin(<BranchComparison />)} />
          <Route path="/admin/data"       element={onlyAdmin(<DataManager />)} />

        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
