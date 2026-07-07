import { useState, useEffect } from 'react';
import { useToast } from '@ctx/ToastContext';
import './Applications.css';

export default function Applications() {
  const showToast = useToast();
  const [drives, setDrives]           = useState([]);
  const [selectedDriveId, setSelectedDriveId] = useState('');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    fetchDrives();
  }, []);

  useEffect(() => {
    if (selectedDriveId) {
      fetchApplications(selectedDriveId);
    } else {
      setApplications([]);
    }
  }, [selectedDriveId]);

  async function fetchDrives() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/placement/drives', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        const driveList = data.drives || [];
        setDrives(driveList);
        if (driveList.length > 0) {
          setSelectedDriveId(driveList[0].id);
        } else {
          setLoading(false);
        }
      }
    } catch {
      showToast('Error loading placement drives.', 'error', 3000);
      setLoading(false);
    }
  }

  async function fetchApplications(driveId) {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/placement/drives/${driveId}/applications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setApplications(data.applications || []);
      } else {
        showToast(data.error || 'Failed to fetch drive applications.', 'error', 3000);
      }
    } catch {
      showToast('Error fetching drive applications.', 'error', 3000);
    } finally {
      setLoading(false);
    }
  }

  async function shortlistStudent(studentId) {
    if (!selectedDriveId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/placement/drives/${selectedDriveId}/shortlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ student_ids: [studentId] })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Student shortlisted successfully!', 'success', 2500);
        fetchApplications(selectedDriveId);
      } else {
        showToast(data.error || 'Failed to shortlist.', 'error', 3000);
      }
    } catch {
      showToast('Error shortlisting student.', 'error', 3000);
    }
  }

  async function offerStudent(studentId) {
    if (!selectedDriveId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/placement/drives/${selectedDriveId}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ student_id: studentId, ctc_lpa: 12.0 })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Offer extended successfully!', 'success', 2500);
        fetchApplications(selectedDriveId);
      } else {
        showToast(data.error || 'Failed to extend offer.', 'error', 3000);
      }
    } catch {
      showToast('Error extending offer.', 'error', 3000);
    }
  }

  return (
    <div className="ap-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Application Pipeline & Tracking</h1>
          <p className="page-sub">Review candidates, shortlist profiles, and issue offer letters</p>
        </div>
      </div>

      {/* Drive Selector */}
      <div className="ad-card" style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>Select Active Placement Drive</label>
        <select
          value={selectedDriveId}
          onChange={e => setSelectedDriveId(e.target.value)}
          style={{ width: '100%', maxWidth: '400px', padding: '0.6rem', borderRadius: '8px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
        >
          {drives.map(d => (
            <option key={d.id} value={d.id}>{d.company_name} — {d.role_title}</option>
          ))}
        </select>
      </div>

      <div className="ad-card">
        <div className="ad-table-wrap">
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <div className="ad-spinner" style={{ margin: '0 auto 1rem auto' }} />
              Loading drive candidate applications…
            </div>
          ) : applications.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No student applications for this drive</p>
              <p style={{ fontSize: '0.85rem' }}>Student applications submitted for this drive will appear here.</p>
            </div>
          ) : (
            <table className="ad-table">
              <thead>
                <tr><th>Student Name</th><th>Roll No</th><th>Branch</th><th>CGPA</th><th>Applied On</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {applications.map(a => (
                  <tr key={a.id}>
                    <td><div style={{ fontWeight: 600, color: '#f8fafc' }}>{a.student_name}</div></td>
                    <td><code>{a.roll_no}</code></td>
                    <td>{a.branch}</td>
                    <td><strong>{a.cgpa}</strong></td>
                    <td style={{ color: '#94a3b8', fontSize: '0.82rem' }}>{a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}</td>
                    <td><span className="ad-badge ad-badge-info">{a.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {a.status === 'Applied' && (
                          <button className="ad-btn ad-btn-primary" style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem' }} onClick={() => shortlistStudent(a.student_id)}>
                            Shortlist
                          </button>
                        )}
                        {a.status === 'Shortlisted' && (
                          <button className="ad-btn ad-btn-primary" style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem', background: '#10b981' }} onClick={() => offerStudent(a.student_id)}>
                            Extend Offer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
