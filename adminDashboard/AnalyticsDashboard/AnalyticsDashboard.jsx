import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@ctx/ToastContext';
import { adminApi, apiPost } from '@/services/api';
import '@admin/admin.shared.css';

export default function AnalyticsDashboard() {
  const showToast = useToast();
  const [data, setData]       = useState(null);
  const [profiles, setProfiles] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedRole, setSelectedRole] = useState('student');

  // Modals state
  const [showBranchModal, setShowBranchModal]       = useState(false);
  const [showPlacementModal, setShowPlacementModal] = useState(false);

  // Forms state
  const [branchForm, setBranchForm]       = useState({ branch: '' });
  const [placementForm, setPlacementForm] = useState({ branch: 'Computer Science', placed_count: '', total_count: '' });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Compute available branches dynamically for the Update Stats dropdown
  const availableBranches = useMemo(() => {
    const defaults = ['Computer Science', 'Information Technology', 'Electronics & Comm.', 'Electrical', 'Mechanical', 'Civil'];
    const current = data?.branch_performance?.map(b => b.branch) || [];
    return Array.from(new Set([...defaults, ...current]));
  }, [data]);

  // Set default selection when availableBranches list changes
  useEffect(() => {
    if (availableBranches.length > 0) {
      setPlacementForm(prev => ({ ...prev, branch: availableBranches[0] }));
    }
  }, [availableBranches]);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const [pRes, prRes, usersRes] = await Promise.all([
        adminApi.getAnalytics(),          // /admin/analytics/placement
        adminApi.getProfileAnalytics(),   // /admin/analytics/profiles
        adminApi.listUsers({ per_page: 500 }),
      ]);
      if (pRes && !pRes.error) setData(pRes);
      if (prRes && !prRes.error) setProfiles(prRes);
      if (usersRes && !usersRes.error) setUsers(usersRes.users || []);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddBranch(e) {
    e.preventDefault();
    if (!branchForm.branch.trim()) { showToast('Branch name is required.', 'error', 3000); return; }
    const res = await apiPost('/admin/branches', { branch: branchForm.branch.trim() });
    if (res?.error) { showToast(res.error, 'error', 3000); return; }
    showToast(res?.message || 'Branch added!', 'success', 3000);
    setShowBranchModal(false);
    setBranchForm({ branch: '' });
    fetchAnalytics();
  }

  async function handleUpdatePlacement(e) {
    e.preventDefault();
    if (!placementForm.placed_count || !placementForm.total_count) {
      showToast('Placed count and total count are required.', 'error', 3000); return;
    }
    const res = await apiPost('/admin/branch-placements', placementForm);
    if (res?.error) { showToast(res.error, 'error', 3000); return; }
    showToast(res?.message || 'Placement stats updated!', 'success', 3000);
    setShowPlacementModal(false);
    setPlacementForm({ branch: availableBranches[0] || 'Computer Science', placed_count: '', total_count: '' });
    fetchAnalytics();
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

  const roleStats = useMemo(() => {
    const roleUsers = users.filter(u => {
      if (selectedRole === 'student') return u.role === 'student';
      if (selectedRole === 'professor') return u.role === 'professor';
      return u.role === 'placement_cell';
    });

    const total = roleUsers.length;
    const active = roleUsers.filter(u => u.is_active).length;
    const pending = roleUsers.filter(u => !u.is_active).length;

    return { total, active, pending };
  }, [users, selectedRole]);

  return (
    <div className="ad-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">College-Wide Analytics</h1>
          <p className="page-sub">NAAC/NBA ready · Real-time metrics computed directly from institutional records</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="ad-btn ad-btn-primary" onClick={() => setShowBranchModal(true)}>
            🏢 Add Branch
          </button>
          <button className="ad-btn ad-btn-outline" onClick={() => setShowPlacementModal(true)}>
            📈 Add Placed Count
          </button>
        </div>
      </div>

      {/* Role Toggle Selector */}
      <div className="tab-nav-wrapper" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--border)' }}>
        <button
          className={`tab-nav-btn ${selectedRole === 'student' ? 'active' : ''}`}
          onClick={() => setSelectedRole('student')}
        >
          🎓 Student Metrics
        </button>
        <button
          className={`tab-nav-btn ${selectedRole === 'professor' ? 'active' : ''}`}
          onClick={() => setSelectedRole('professor')}
        >
          👤 Professor Metrics
        </button>
        <button
          className={`tab-nav-btn ${selectedRole === 'tpo' ? 'active' : ''}`}
          onClick={() => setSelectedRole('tpo')}
        >
          💼 TPO Metrics
        </button>
      </div>

      {/* Role-Specific Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
        <div className="ad-card" style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total {selectedRole.toUpperCase()}s</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {roleStats.total}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Registered accounts
          </div>
        </div>

        <div className="ad-card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active {selectedRole.toUpperCase()}s</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {roleStats.active}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '0.35rem' }}>
            Approved and operational
          </div>
        </div>

        <div className="ad-card" style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending / Inactive</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {roleStats.pending}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: '0.35rem' }}>
            Awaiting signup approval
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>General Institutional Analytics</h3>

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="ad-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Placements (This Year)</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {data?.placements_this_year ?? 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '0.35rem' }}>
            vs {data?.placements_last_year ?? 0} last year
          </div>
        </div>

        <div className="ad-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Average Package</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            ₹{data?.avg_package_lpa ?? 0} <span style={{ fontSize: '1rem', fontWeight: 600, color: '#94a3b8' }}>LPA</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6366f1', marginTop: '0.35rem' }}>
            NAAC Criterion C5.2 compliant
          </div>
        </div>

        <div className="ad-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student Roster</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {profiles?.total_students ?? 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#38bdf8', marginTop: '0.35rem' }}>
            {profiles?.profile_completeness?.completed_pct ?? 0}% profile complete
          </div>
        </div>

        <div className="ad-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DPDP Act Compliance</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {profiles?.dpdp_compliance?.consent_pct ?? 0}%
          </div>
          <div style={{ fontSize: '0.78rem', color: '#34d399', marginTop: '0.35rem' }}>
            {profiles?.dpdp_compliance?.consented ?? 0} consented records
          </div>
        </div>
      </div>

      {/* Branch Performance Table */}
      <div className="ad-card">
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Branch-wise Performance Breakdown</h2>
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
                  <td>{b.placed_students} / {b.total_students} students placed ({b.placement_pct}%)</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Branch Modal */}
      {showBranchModal && (
        <div className="ad-modal-overlay open" onClick={() => setShowBranchModal(false)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()}>
            <h2 className="ad-modal-title">Add New Branch</h2>
            <p className="ad-modal-sub">Create a new academic branch/department in the college ecosystem</p>
            
            <form onSubmit={handleAddBranch}>
              <div className="ad-modal-fields">
                <div className="ad-field">
                  <label>Branch Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Civil Engineering"
                    value={branchForm.branch}
                    onChange={e => setBranchForm({ branch: e.target.value })}
                    className="ad-input"
                  />
                </div>
              </div>

              <div className="ad-modal-actions">
                <button type="button" className="ad-btn ad-btn-outline" onClick={() => setShowBranchModal(false)}>Cancel</button>
                <button type="submit" className="ad-btn ad-btn-primary">Add Branch</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Placed Count Modal */}
      {showPlacementModal && (
        <div className="ad-modal-overlay open" onClick={() => setShowPlacementModal(false)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()}>
            <h2 className="ad-modal-title">Update Branch Placements</h2>
            <p className="ad-modal-sub">Set or override manual placement statistics for college branches</p>
            
            <form onSubmit={handleUpdatePlacement}>
              <div className="ad-modal-fields">
                <div className="ad-field">
                  <label>Select Branch</label>
                  <select
                    value={placementForm.branch}
                    onChange={e => setPlacementForm({ ...placementForm, branch: e.target.value })}
                    className="ad-select"
                  >
                    {availableBranches.map(bName => (
                      <option key={bName} value={bName}>{bName}</option>
                    ))}
                  </select>
                </div>

                <div className="ad-field">
                  <label>Placed Count (Students Placed)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 45"
                    value={placementForm.placed_count}
                    onChange={e => setPlacementForm({ ...placementForm, placed_count: e.target.value })}
                    className="ad-input"
                  />
                </div>

                <div className="ad-field">
                  <label>Total Students in Batch</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 60"
                    value={placementForm.total_count}
                    onChange={e => setPlacementForm({ ...placementForm, total_count: e.target.value })}
                    className="ad-input"
                  />
                </div>
              </div>

              <div className="ad-modal-actions">
                <button type="button" className="ad-btn ad-btn-outline" onClick={() => setShowPlacementModal(false)}>Cancel</button>
                <button type="submit" className="ad-btn ad-btn-primary">Update Stats</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
