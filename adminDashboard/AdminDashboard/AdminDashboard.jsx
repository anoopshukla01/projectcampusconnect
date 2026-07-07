import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '@admin/admin.shared.css';

const IconStudents = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconFaculty  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
const IconPlace    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
const IconDrives   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>;
const iconMap = { students: <IconStudents/>, faculty: <IconFaculty/>, place: <IconPlace/>, drives: <IconDrives/> };

const statusPill = (s) => {
  if (s === 'up')   return <span className="ad-status-pill ad-pill-up">● Operational</span>;
  if (s === 'warn') return <span className="ad-status-pill ad-pill-warn">⚠ Degraded</span>;
  return                   <span className="ad-status-pill ad-pill-down">✕ Down</span>;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    totalStudents: 0,
    pendingStudents: 0,
    facultyMembers: 0,
    pendingFaculty: 0,
    placementRate: 0,
    activeDrives: 0,
    roleOverview: [
      { role: 'Students',       total: 0, active: 0, pending: 0 },
      { role: 'Faculty',        total: 0, active: 0, pending: 0 },
      { role: 'Placement Cell', total: 0, active: 0, pending: 0 },
      { role: 'Admins',         total: 0, active: 0, pending: 0 },
    ],
    activity: [],
    systemStatus: [
      { label: 'Student Portal',     status: 'up'   },
      { label: 'Placement Module',   status: 'up'   },
      { label: 'Email Notifications',status: 'up'   },
      { label: 'PDF Export Service', status: 'up'   },
      { label: 'SMS Alerts',         status: 'up'   },
    ]
  });

  useEffect(() => {
    async function loadData() {
      try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch users to count roles
        const usersRes = await fetch('/api/v1/admin/users?per_page=100', { headers });
        const usersData = await usersRes.json();
        
        // Fetch placement analytics for placement rate
        const placementRes = await fetch('/api/v1/admin/analytics/placement', { headers });
        const placementData = await placementRes.json();

        // Fetch drives
        const drivesRes = await fetch('/api/v1/placement/drives', { headers });
        const drivesData = await drivesRes.json();

        // Fetch audit logs
        const auditRes = await fetch('/api/v1/admin/audit-logs?per_page=6', { headers });
        const auditData = await auditRes.json();

        if (usersRes.ok) {
          const users = usersData.users || [];
          
          const students = users.filter(u => u.role === 'student');
          const faculty = users.filter(u => u.role === 'professor');
          const tpo = users.filter(u => u.role === 'placement_cell');
          const admins = users.filter(u => u.role === 'admin');

          const pendingStudents = students.filter(u => !u.is_active).length;
          const pendingFaculty = faculty.filter(u => !u.is_active).length;

          // Placement rate from actual placement analytics
          const totalPlacements = placementRes.ok ? (placementData.placements_this_year || 0) : 0;
          const placementRatePct = students.length > 0 ? Math.round((totalPlacements / students.length) * 100) : 0;

          // Activity logs mapping
          const activityLogs = auditRes.ok ? (auditData.logs || []).map(log => ({
            icon: log.action.includes('invite') ? '✉️' : log.action.includes('approve') ? '✅' : '📋',
            text: `${log.action.replace('admin.', '').replace('.', ' ')}: ${log.detail?.email || log.target_type || ''}`,
            time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            cls: log.action.includes('reject') ? 'ad-act-rose' : 'ad-act-blue'
          })) : [];

          setData(prev => ({
            ...prev,
            totalStudents: students.length,
            pendingStudents,
            facultyMembers: faculty.length,
            pendingFaculty,
            placementRate: placementRatePct,
            activeDrives: drivesRes.ok ? (drivesData.drives || []).length : 0,
            roleOverview: [
              { role: 'Students',       total: students.length, active: students.filter(u => u.is_active).length, pending: pendingStudents },
              { role: 'Faculty',        total: faculty.length, active: faculty.filter(u => u.is_active).length, pending: pendingFaculty },
              { role: 'Placement Cell', total: tpo.length, active: tpo.filter(u => u.is_active).length, pending: 0 },
              { role: 'Admins',         total: admins.length, active: admins.filter(u => u.is_active).length, pending: 0 },
            ],
            activity: activityLogs,
          }));
        }
      } catch (err) {
        console.error('Error loading admin dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const STATS = [
    { label: 'Total Students', value: loading ? '...' : data.totalStudents, sub: `${data.pendingStudents} pending approvals`, icon: 'students', color: 'blue',   badge: 'Registered' },
    { label: 'Faculty Members', value: loading ? '...' : data.facultyMembers,   sub: `${data.pendingFaculty} pending approvals`, icon: 'faculty',  color: 'violet', badge: 'Active'         },
    { label: 'Placement Rate',  value: loading ? '...' : `${data.placementRate}%`,  sub: 'Accepted offers rate', icon: 'place', color: 'teal',  badge: 'Live Status'      },
    { label: 'Active Drives',   value: loading ? '...' : data.activeDrives,   sub: 'Drives this year', icon: 'drives', color: 'rose',  badge: 'Ongoing'    },
  ];

  const quickActions = [
    { label: 'Analytics',     icon: '📊', path: '/admin/analytics'    },
    { label: 'Users',         icon: '👥', path: '/admin/users'        },
    { label: 'Data Manager',  icon: '🗄️', path: '/admin/data'         },
    { label: 'Audit Log',     icon: '🔍', path: '/admin/audit'        },
    { label: 'Rules Engine',  icon: '⚙️',  path: '/admin/rules'        },
    { label: 'Broadcast',     icon: '📢', path: '/admin/announcements'},
    { label: 'Data Health',   icon: '🛡️',  path: '/admin/datahealth'  },
    { label: 'Branches',      icon: '🏛️',  path: '/admin/branches'    },
  ];

  return (
    <div className="ad-root">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Control Panel</h1>
          <p className="page-sub">Principal / Administrator — College-wide oversight</p>
        </div>
        <div className="ad-header-actions">
          <button className="ad-btn ad-btn-outline" onClick={() => navigate('/admin/audit')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Audit Log
          </button>
          <button className="ad-btn ad-btn-primary" onClick={() => navigate('/admin/analytics')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
            View Analytics
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="ad-stats-grid">
        {STATS.map(s => (
          <div key={s.label} className={`ad-stat-card ad-stat-${s.color}`}>
            <div className="ad-stat-top">
              <div className="ad-stat-icon">{iconMap[s.icon]}</div>
              <span className="ad-stat-badge">{s.badge}</span>
            </div>
            <div className="ad-stat-body">
              <span className="ad-stat-value">{s.value}</span>
              <span className="ad-stat-label">{s.label}</span>
              <span className="ad-stat-sub">{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="ad-card">
        <div className="ad-card-header">
          <h2 className="ad-card-title">Quick Actions</h2>
        </div>
        <div className="ad-quick-grid">
          {quickActions.map(a => (
            <button key={a.label} className="ad-quick-btn" onClick={() => navigate(a.path)}>
              <span className="ad-quick-icon">{a.icon}</span>
              <span className="ad-quick-label">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="ad-main-grid">
        {/* Role Overview */}
        <div className="ad-card">
          <div className="ad-card-header">
            <h2 className="ad-card-title">Role Overview</h2>
            <button className="ad-link" onClick={() => navigate('/admin/users')}>Manage users →</button>
          </div>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr><th>Role</th><th>Total</th><th>Active</th><th>Pending</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.roleOverview.map(r => (
                  <tr key={r.role}>
                    <td><strong>{r.role}</strong></td>
                    <td>{r.total}</td>
                    <td>{r.active}</td>
                    <td>{r.pending > 0 ? <span style={{color:'#f59e0b',fontWeight:700}}>{r.pending}</span> : <span style={{color:'var(--clr-muted)'}}>—</span>}</td>
                    <td><span className="ad-dot ad-dot-green" /><span style={{color:'#4ade80',fontWeight:600}}>Healthy</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Activity + System */}
        <div className="ad-right-col">
          <div className="ad-card">
            <div className="ad-card-header">
              <h2 className="ad-card-title">Recent Activity</h2>
              <button className="ad-link" onClick={() => navigate('/admin/audit')}>See all →</button>
            </div>
            <ul className="ad-activity-list">
              {data.activity.length > 0 ? data.activity.map((a, i) => (
                <li key={i} className="ad-activity-item">
                  <span className={`ad-act-icon ${a.cls}`}>{a.icon}</span>
                  <span className="ad-activity-text">{a.text}</span>
                  <span className="ad-activity-time">{a.time}</span>
                </li>
              )) : (
                <li style={{ color: 'var(--clr-muted)', fontSize: '0.825rem', padding: '1rem 0', textAlign: 'center' }}>
                  No recent activity logs recorded.
                </li>
              )}
            </ul>
          </div>

          <div className="ad-card">
            <div className="ad-card-header">
              <h2 className="ad-card-title">System Status</h2>
            </div>
            <div className="ad-status-list">
              {data.systemStatus.map(s => (
                <div key={s.label} className="ad-status-row">
                  <span>{s.label}</span>
                  {statusPill(s.status)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
