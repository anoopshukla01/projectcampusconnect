import { useState } from 'react';
import { useAuth } from '@ctx/AuthContext';
import { useNavigate } from 'react-router-dom';
import './PlacementDashboard.css';

const RECENT_DRIVES = [
  { id: 1, company: 'Google', role: 'SWE', date: 'Dec 10', branches: 'CS, EC', ctc: '₹42 LPA', status: 'upcoming', eligible: 48, applied: 32 },
  { id: 2, company: 'Microsoft', role: 'SDE', date: 'Dec 14', branches: 'CS', ctc: '₹38 LPA', status: 'upcoming', eligible: 36, applied: 28 },
  { id: 3, company: 'TCS', role: 'Analyst', date: 'Nov 28', branches: 'ALL', ctc: '₹7 LPA', status: 'completed', eligible: 210, applied: 175, placed: 62 },
  { id: 4, company: 'Infosys', role: 'SE', date: 'Nov 20', branches: 'ALL', ctc: '₹6.5 LPA', status: 'completed', eligible: 198, applied: 161, placed: 55 },
  { id: 5, company: 'Amazon', role: 'SDE-I', date: 'Dec 18', branches: 'CS, EC', ctc: '₹28 LPA', status: 'upcoming', eligible: 52, applied: 19 },
];

const PIPELINE = [
  { label: 'Applied',     count: 312, color: '#6366f1' },
  { label: 'Shortlisted', count: 198, color: '#3b82f6' },
  { label: 'Interviewed', count: 112, color: '#f59e0b' },
  { label: 'Offered',     count: 67,  color: '#10b981' },
  { label: 'Accepted',    count: 55,  color: '#22c55e' },
];

const BRANCH_STATS = [
  { branch: 'CS', placed: 78, total: 120, pct: 65 },
  { branch: 'EC', placed: 51, total: 90,  pct: 57 },
  { branch: 'ME', placed: 28, total: 72,  pct: 39 },
  { branch: 'CE', placed: 18, total: 58,  pct: 31 },
  { branch: 'EE', placed: 12, total: 48,  pct: 25 },
];

const RECENT_ACTIVITY = [
  { id: 1, text: 'Google shortlisted 18 students',         time: '1h ago',  type: 'shortlist' },
  { id: 2, text: 'Amazon offer letter sent to 4 students', time: '3h ago',  type: 'offer'     },
  { id: 3, text: 'Microsoft drive scheduled for Dec 14',   time: '5h ago',  type: 'drive'     },
  { id: 4, text: 'TCS: 62 students placed — drive closed', time: '1d ago',  type: 'placed'    },
  { id: 5, text: 'Wipro JD uploaded & eligibility set',    time: '2d ago',  type: 'drive'     },
];

const TrendUp = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
);

export default function PlacementDashboard() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const stats     = user?.stats || {};

  const statCards = [
    {
      label: 'Total Students', value: stats.totalStudents || 320,
      sub: 'Eligible batch 2021', icon: 'students', color: 'blue',
      trend: '+12 this week',
    },
    {
      label: 'Students Placed', value: stats.placed || 187,
      sub: `${Math.round((187/320)*100)}% placement rate`, icon: 'placed', color: 'green',
      trend: '+8 today',
    },
    {
      label: 'Avg. Package', value: stats.avgPackage || '12.4 LPA',
      sub: `Highest: ${stats.highestPackage || '42 LPA'}`, icon: 'package', color: 'purple',
      trend: '↑ 2.1 LPA',
    },
    {
      label: 'Drives This Year', value: stats.drivesThisYear || 34,
      sub: `${stats.offersThisYear || 210} total offers`, icon: 'drives', color: 'amber',
      trend: '6 upcoming',
    },
  ];

  const iconSVG = {
    students: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    placed: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
    package: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
    drives: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      </svg>
    ),
  };

  const activityClass = { shortlist: 'pd-ai-shortlist', offer: 'pd-ai-offer', drive: 'pd-ai-drive', placed: 'pd-ai-placed' };
  const activityIcon  = { shortlist: '📋', offer: '🎉', drive: '🏢', placed: '✅' };

  return (
    <div className="pd-root">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Placement Dashboard</h1>
          <p className="page-sub">Training &amp; Placement Cell — Batch 2021 Overview</p>
        </div>
        <div className="pd-header-actions">
          <button className="pd-btn pd-btn-outline" onClick={() => navigate('/plreports')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Export Report
          </button>
          <button className="pd-btn pd-btn-primary" onClick={() => navigate('/drives')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Schedule Drive
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="pd-stats-grid">
        {statCards.map((card) => (
          <div key={card.label} className={`pd-stat-card pd-stat-${card.color}`}>
            <div className="pd-stat-top">
              <div className="pd-stat-icon">{iconSVG[card.icon]}</div>
              <span className="pd-stat-trend">
                <TrendUp /> {card.trend}
              </span>
            </div>
            <div className="pd-stat-body">
              <span className="pd-stat-value">{card.value}</span>
              <span className="pd-stat-label">{card.label}</span>
              <span className="pd-stat-sub">{card.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Grid ── */}
      <div className="pd-main-grid">
        {/* Recent Drives Table */}
        <div className="pd-card pd-drives-card">
          <div className="pd-card-header">
            <h2 className="pd-card-title">Recent &amp; Upcoming Drives</h2>
            <button className="pd-link" onClick={() => navigate('/drives')}>View all →</button>
          </div>
          <div className="pd-table-wrap">
            <table className="pd-table">
              <thead>
                <tr>
                  <th>Company</th><th>Role</th><th>Date</th>
                  <th>CTC</th><th>Applied</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_DRIVES.map(d => (
                  <tr key={d.id}>
                    <td><strong>{d.company}</strong></td>
                    <td>{d.role}</td>
                    <td>{d.date}</td>
                    <td className="pd-ctc">{d.ctc}</td>
                    <td>{d.applied}/{d.eligible}</td>
                    <td>
                      <span className={`pd-badge pd-badge-${d.status}`}>
                        {d.status === 'upcoming' ? '🔵 Upcoming' : `✅ Done (${d.placed || 0} placed)`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column */}
        <div className="pd-right-col">
          {/* Pipeline */}
          <div className="pd-card pd-pipeline-card">
            <div className="pd-card-header">
              <h2 className="pd-card-title">Offer Pipeline</h2>
            </div>
            <div className="pd-pipeline">
              {PIPELINE.map((p, i) => {
                const max = PIPELINE[0].count;
                const pct = Math.round((p.count / max) * 100);
                return (
                  <div key={i} className="pd-pipe-row">
                    <span className="pd-pipe-label">{p.label}</span>
                    <div className="pd-pipe-bar-wrap">
                      <div className="pd-pipe-bar" style={{ width: `${pct}%`, background: p.color }} />
                    </div>
                    <span className="pd-pipe-count">{p.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Branch Stats */}
          <div className="pd-card pd-branch-card">
            <div className="pd-card-header">
              <h2 className="pd-card-title">Branch-wise Placement</h2>
              <button className="pd-link" onClick={() => navigate('/plreports')}>Full report →</button>
            </div>
            <div className="pd-branch-list">
              {BRANCH_STATS.map(b => (
                <div key={b.branch} className="pd-branch-row">
                  <span className="pd-branch-name">{b.branch}</span>
                  <div className="pd-branch-bar-wrap">
                    <div className="pd-branch-bar" style={{ width: `${b.pct}%` }} />
                  </div>
                  <span className="pd-branch-pct">{b.placed}/{b.total} ({b.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Activity Feed ── */}
      <div className="pd-card pd-activity-card">
        <div className="pd-card-header">
          <h2 className="pd-card-title">Recent Activity</h2>
        </div>
        <ul className="pd-activity-list">
          {RECENT_ACTIVITY.map(a => (
            <li key={a.id} className="pd-activity-item">
              <span className={`pd-activity-icon-wrap ${activityClass[a.type] || ''}`}>
                {activityIcon[a.type] || '📌'}
              </span>
              <span className="pd-activity-text">{a.text}</span>
              <span className="pd-activity-time">{a.time}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Quick Actions ── */}
      <div className="pd-quick-actions">
        {[
          { label: 'Add Company',       icon: '🏢', path: '/companies'  },
          { label: 'Schedule Drive',    icon: '📅', path: '/drives'     },
          { label: 'Eligibility Filter',icon: '🎯', path: '/eligibility'},
          { label: 'Post Notice',       icon: '📢', path: '/plnotices'  },
          { label: 'View Offers',       icon: '🎉', path: '/offers'     },
          { label: 'Export Report',     icon: '📊', path: '/plreports'  },
        ].map(a => (
          <button key={a.label} className="pd-quick-btn" onClick={() => navigate(a.path)}>
            <span className="pd-quick-icon">{a.icon}</span>
            <span className="pd-quick-label">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
