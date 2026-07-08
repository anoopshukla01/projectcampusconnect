import { useState, useEffect } from 'react';
import { useToast } from '@ctx/ToastContext';
import '@admin/admin.shared.css';

export default function AnalyticsDashboard() {
  const showToast = useToast();
  const [data, setData]       = useState(null);
  const [profiles, setProfiles] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showPlacementModal, setShowPlacementModal] = useState(false);

  // Forms state
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', branch: 'Computer Science' });
  const [placementForm, setPlacementForm] = useState({ branch: 'Computer Science', placed_count: '', total_count: '' });

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

  async function handleAddSubject(e) {
    e.preventDefault();
    if (!subjectForm.name.trim() || !subjectForm.code.trim()) {
      showToast('Subject name and code are required.', 'error', 3000);
      return;
    }
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/admin/subjects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: subjectForm.name.trim(),
          code: subjectForm.code.trim().toUpperCase(),
          branch: subjectForm.branch
        })
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(resData.message || 'Subject added successfully!', 'success', 3000);
        setShowSubjectModal(false);
        setSubjectForm({ name: '', code: '', branch: 'Computer Science' });
      } else {
        showToast(resData.error || 'Failed to add subject.', 'error', 3000);
      }
    } catch {
      showToast('Network error while adding subject.', 'error', 3000);
    }
  }

  async function handleUpdatePlacement(e) {
    e.preventDefault();
    if (!placementForm.placed_count || !placementForm.total_count) {
      showToast('Placed count and total count are required.', 'error', 3000);
      return;
    }
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/v1/admin/branch-placements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(placementForm)
      });
      const resData = await res.json();
      if (res.ok) {
        showToast(resData.message || 'Placement stats updated!', 'success', 3000);
        setShowPlacementModal(false);
        setPlacementForm({ branch: 'Computer Science', placed_count: '', total_count: '' });
        fetchAnalytics(); // Refresh
      } else {
        showToast(resData.error || 'Failed to update stats.', 'error', 3000);
      }
    } catch {
      showToast('Network error while updating stats.', 'error', 3000);
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
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="ad-btn ad-btn-primary" onClick={() => setShowSubjectModal(true)}>
            📚 Add Subject
          </button>
          <button className="ad-btn ad-btn-outline" onClick={() => setShowPlacementModal(true)}>
            📈 Add Placed Count
          </button>
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
                  <td>{b.placed_students} / {b.total_students} students placed ({b.placement_pct}%)</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Subject Modal */}
      {showSubjectModal && (
        <div className="ad-modal-overlay open" onClick={() => setShowSubjectModal(false)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()}>
            <h2 className="ad-modal-title">Add New Subject</h2>
            <p className="ad-modal-sub">Create a new academic subject course in the college ecosystem</p>
            
            <form onSubmit={handleAddSubject}>
              <div className="ad-modal-fields">
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Subject Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Computer Networks"
                    value={subjectForm.name}
                    onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Subject Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS3081"
                    value={subjectForm.code}
                    onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Department / Branch</label>
                  <select
                    value={subjectForm.branch}
                    onChange={e => setSubjectForm({ ...subjectForm, branch: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Electronics & Comm.">Electronics & Comm.</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Civil">Civil</option>
                  </select>
                </div>
              </div>

              <div className="ad-modal-actions">
                <button type="button" className="ad-btn ad-btn-outline" onClick={() => setShowSubjectModal(false)}>Cancel</button>
                <button type="submit" className="ad-btn ad-btn-primary">Add Subject</button>
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
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Select Branch</label>
                  <select
                    value={placementForm.branch}
                    onChange={e => setPlacementForm({ ...placementForm, branch: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Electronics & Comm.">Electronics & Comm.</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Mechanical">Mechanical</option>
                    <option value="Civil">Civil</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Placed Count (Students Placed)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 45"
                    value={placementForm.placed_count}
                    onChange={e => setPlacementForm({ ...placementForm, placed_count: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Total Students in Batch</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 60"
                    value={placementForm.total_count}
                    onChange={e => setPlacementForm({ ...placementForm, total_count: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
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
