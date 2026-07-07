import { useState, useEffect } from 'react';
import { useToast } from '@ctx/ToastContext';
import '@admin/admin.shared.css';

export default function AnalyticsDashboard() {
  const showToast = useToast();
  const [data, setData]       = useState(null);
  const [profiles, setProfiles] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      const [pRes, prRes] = await Promise.all([
        fetch('/api/v1/admin/analytics/placement', { headers }),
        fetch('/api/v1/admin/analytics/profiles', { headers })
      ]);

      if (pRes.ok) { const pData = await pRes.json(); setData(pData); }
      if (prRes.ok) { const prData = await prRes.json(); setProfiles(prData); }
    } catch {
      showToast('Network error loading analytics data.', 'error', 3000);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="ad-root">
        <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
          <div className="ad-spinner" style={{ margin: '0 auto 1rem auto' }} />
          Calculating institutional analytics & compliance metrics…
        </div>
      </div>
    );
  }

  return (
    <div className="ad-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">College-Wide Analytics</h1>
          <p className="page-sub">NAAC/NBA ready · Real-time metrics computed directly from institutional records</p>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="ad-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Placements (This Year)</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>
            {data?.placements_this_year ?? 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '0.35rem' }}>
            vs {data?.placements_last_year ?? 0} last year
          </div>
        </div>

        <div className="ad-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Average Package</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>
            ₹{data?.avg_package_lpa ?? 0} <span style={{ fontSize: '1rem', fontWeight: 600, color: '#94a3b8' }}>LPA</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6366f1', marginTop: '0.35rem' }}>
            NAAC Criterion C5.2 compliant
          </div>
        </div>

        <div className="ad-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student Roster</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>
            {profiles?.total_students ?? 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#38bdf8', marginTop: '0.35rem' }}>
            {profiles?.profile_completeness?.completed_pct ?? 0}% profile complete
          </div>
        </div>

        <div className="ad-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DPDP Act Compliance</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>
            {profiles?.dpdp_compliance?.consent_pct ?? 0}%
          </div>
          <div style={{ fontSize: '0.78rem', color: '#34d399', marginTop: '0.35rem' }}>
            {profiles?.dpdp_compliance?.consented ?? 0} consented records
          </div>
        </div>
      </div>

      {/* Branch Performance Table */}
      <div className="ad-card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1rem' }}>Branch-wise Performance Breakdown</h2>
        {!data?.branch_performance || data.branch_performance.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            No branch placement data recorded in database.
          </div>
        ) : (
          <table className="ad-table">
            <thead>
              <tr><th>Branch</th><th>Placed Count</th></tr>
            </thead>
            <tbody>
              {data.branch_performance.map(b => (
                <tr key={b.branch}>
                  <td><strong style={{ color: '#818cf8' }}>{b.branch}</strong></td>
                  <td>{b.placed_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
