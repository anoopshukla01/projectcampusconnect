import { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const PATH_TO_PAGE = {
  '/':             'dashboard',
  '/timetable':    'timetable',
  '/attendance':   'attendance',
  '/assignments':  'assignments',
  '/lectures':     'lectures',
  '/elibrary':     'elibrary',
  '/notes':        'notes',
  '/grades':       'grades',
  '/chats':        'chats',
  '/events':       'events',
  '/marketplace':  'marketplace',
  '/lostandfound': 'lostandfound',
  '/internships':  'internships',
  '/resume':       'resume',
  '/mentorship':   'mentorship',
  '/mock':         'mock',
  '/classes':      'classes',
  '/roster':       'roster',
  '/announcements': 'announcements',
  // TPO routes
  '/placement':    'dashboard',
  '/companies':    'companies',
  '/drives':       'drives',
  '/eligibility':  'eligibility',
  '/applications': 'applications',
  '/offers':       'offers',
  '/plreports':    'plreports',
  '/plnotices':    'plnotices',
  // Admin routes
  '/admin':              'admin',
  '/admin/analytics':    'analytics',
  '/admin/users':        'adminusers',
  '/admin/audit':        'audit',
  '/admin/rules':        'rules',
  '/admin/announcements':'adminann',
  '/admin/datahealth':   'datahealth',
  '/admin/branches':     'branches',
  '/admin/data':         'datamanager',
  '/admin/timetable-attendance': 'admintimetable',  // M4: was missing
  '/admin/marketplace':          'adminmarket',      // M4: was missing
};

export default function DashboardLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  const activePage = PATH_TO_PAGE[location.pathname] || 'dashboard';

  return (
    <div className="layout" id="layout">
      <Sidebar activePage={activePage} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="main-wrapper">
        <Topbar onMenuToggle={() => setSidebarOpen(o => !o)} />
        <main className="content" id="mainContent" role="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
