/**
 * Placement Dashboard — TPO Portal
 *
 * Fetches live stats from /placement/stats.
 * Falls back to sensible zeros while loading.
 * Role enforced server-side; no role field sent in any request.
 */

import { useNavigate } from 'react-router-dom';
import { useApiData } from '@/hooks/useApiData';
import { placementApi } from '@/services/api';
import '@ctx/AuthContext';   // ensure context is in scope via alias
import './PlacementDashboard.css';

const TrendUp = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const ICON = {
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

export default function PlacementDashboard() {
  const navigate = useNavigate();

  const { data: statsData, loading } = useApiData(
    '/placement/stats',
    {
      total_students: 0, placed: 0, avg_package: '—', highest_package: '—',
      drives_this_year: 0, total_offers: 0,
      recent_drives: [], pipeline: [], branch_stats: [], recent_activity: [],
    },
  );

  const s = statsData || {};
  const placedCount  = s.placed        || 0;
  const totalCount   = s.total_students || 0;
  const placementPct = totalCount > 0 ? Math.round((placedCount / totalCount) * 100) : 0;

  const statCards = [
    { label: 'Total Students',  value: totalCount,          sub: 'Eligible batch',        icon: 'students', color: 'blue',   trend: 'enrolled' },
    { label: 'Students Placed', value: placedCount,         sub: `${placementPct}% rate`, icon: 'placed',   color: 'green',  trend: 'confirmed' },
    { label: 'Avg. Package',    value: s.avg_package || '—',sub: `Highest: ${s.highest_package || '—'}`, icon: 'package', color: 'purple', trend: '↑ YoY' },
    { label: 'Drives This Year',value: s.drives_this_year || 0, sub: `${s.total_offers || 0} total offers`, icon: 'drives', color: 'amber', trend: 'active' },
  ];

  const recentDrives   = s.recent_drives   || [];
  const pipeline       = s.pipeline        || [];
  const branchStats    = s.branch_stats    || [];
  const recentActivity = s.recent_activity || [];

  const activityClass = { shortlist: 'pd-ai-shortlist', offer: 'pd-ai-offer', drive: 'pd-ai-drive', placed: 'pd-ai-placed' };
  const activityIcon  = { shortlist: '📋', offer: '🎉', drive: '🏢', placed: '✅' };

  return (
    <div className="pd-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Placement Dashboard</h1>
          <p className="page-sub">Training &amp; Placement Cell — Live Overview</p>
        </div>
        <div className="pd-header-actions">
          <button className="pd-btn pd-btn-outline" onClick={() => navigate('/plreports')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Export Report
          </button>
          <button className="pd-btn pd-btn-primary" onClick={() => navigate('/drives')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Schedule Drive
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="pd-stats-grid">
        {statCards.map(card => (
          <div key={card.label} className={`pd-stat-card pd-stat-${card.color}`}>
            <div className="pd-stat-top">
              <div className="pd-stat-icon">{ICON[card.icon]}</div>
              <span className="pd-stat-trend"><TrendUp /> {card.trend}</span>
            </div>
            <div className="pd-stat-body">
              <span className="pd-stat-value">{loading ? '…' : card.value}</span>
              <span className="pd-stat-label">{card.label}</span>
              <span className="pd-stat-sub">{card.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="pd-main-grid">
        {/* Recent Drives */}
        <div className="pd-card pd-drives-card">
          <div className="pd-card-header">
            <h2 className="pd-card-title">Recent &amp; Upcoming Drives</h2>
            <button className="pd-link" onClick={() => navigate('/drives')}>View all →</button>
          </div>
          {recentDrives.length === 0 && !loading ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              No drives yet. Schedule one to get started.
            </p>
          ) : (
            <div className="pd-table-wrap">
              <table className="pd-table">
                <thead>
                  <tr><th>Company</th><th>Role</th><th>CTC</th><th>Applied</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {recentDrives.map(d => (
                    <tr key={d.id}>
                      <td><strong>{d.company_name}</strong></td>
                      <td>{d.role_title}</td>
                      <td className="pd-ctc">₹{d.ctc_lpa} LPA</td>
                      <td>{d.application_count || 0}</td>
                      <td>
                        <span className={`pd-badge pd-badge-${d.status === 'active' ? 'upcoming' : 'completed'}`}>
                          {d.status === 'active' ? '🔵 Active' : `✅ ${d.status}`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="pd-right-col">
          {/* Pipeline */}
          {pipeline.length > 0 && (
            <div className="pd-card pd-pipeline-card">
              <div className="pd-card-header"><h2 className="pd-card-title">Offer Pipeline</h2></div>
              <div className="pd-pipeline">
                {pipeline.map((p, i) => {
                  const max = pipeline[0]?.count || 1;
                  const pct = Math.round((p.count / max) * 100);
                  return (
                    <div key={i} className="pd-pipe-row">
                      <span className="pd-pipe-label">{p.label}</span>
                      <div className="pd-pipe-bar-wrap">
                        <div className="pd-pipe-bar" style={{ width: `${pct}%`, background: p.color || '#6366f1' }} />
                      </div>
                      <span className="pd-pipe-count">{p.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Branch Stats */}
          {branchStats.length > 0 && (
            <div className="pd-card pd-branch-card">
              <div className="pd-card-header">
                <h2 className="pd-card-title">Branch-wise Placement</h2>
                <button className="pd-link" onClick={() => navigate('/plreports')}>Full report →</button>
              </div>
              <div className="pd-branch-list">
                {branchStats.map(b => (
                  <div key={b.branch} className="pd-branch-row">
                    <span className="pd-branch-name">{b.branch}</span>
                    <div className="pd-branch-bar-wrap">
                      <div className="pd-branch-bar" style={{ width: `${b.pct || 0}%` }} />
                    </div>
                    <span className="pd-branch-pct">{b.placed}/{b.total} ({b.pct || 0}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      {recentActivity.length > 0 && (
        <div className="pd-card pd-activity-card">
          <div className="pd-card-header"><h2 className="pd-card-title">Recent Activity</h2></div>
          <ul className="pd-activity-list">
            {recentActivity.map((a, i) => (
              <li key={a.id || i} className="pd-activity-item">
                <span className={`pd-activity-icon-wrap ${activityClass[a.type] || ''}`}>
                  {activityIcon[a.type] || '📌'}
                </span>
                <span className="pd-activity-text">{a.text}</span>
                <span className="pd-activity-time">{a.time}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick Actions */}
      <div className="pd-quick-actions">
        {[
          { label: 'Add Company',        icon: '🏢', path: '/companies'   },
          { label: 'Schedule Drive',     icon: '📅', path: '/drives'      },
          { label: 'Eligibility Filter', icon: '🎯', path: '/eligibility' },
          { label: 'Post Notice',        icon: '📢', path: '/plnotices'   },
          { label: 'View Offers',        icon: '🎉', path: '/offers'      },
          { label: 'Export Report',      icon: '📊', path: '/plreports'   },
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
