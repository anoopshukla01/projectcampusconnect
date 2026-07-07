import { useState, useEffect } from 'react';
import { useToast } from '@ctx/ToastContext';
import './Offers.css';

export default function Offers() {
  const showToast = useToast();
  const [drives, setDrives]           = useState([]);
  const [selectedDriveId, setSelectedDriveId] = useState('');
  const [offers, setOffers]           = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    fetchDrives();
  }, []);

  useEffect(() => {
    if (selectedDriveId) {
      fetchOffers(selectedDriveId);
    } else {
      setOffers([]);
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

  async function fetchOffers(driveId) {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/placement/drives/${driveId}/offers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setOffers(data.offers || []);
      } else {
        showToast(data.error || 'Failed to fetch drive offers.', 'error', 3000);
      }
    } catch {
      showToast('Error fetching drive offers.', 'error', 3000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="of-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Offer Management</h1>
          <p className="page-sub">Track official job offers and One-Student One-Offer policy status</p>
        </div>
      </div>

      <div className="ad-card" style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>Select Placement Drive</label>
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
              Loading drive job offers…
            </div>
          ) : offers.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No job offers extended for this drive yet</p>
              <p style={{ fontSize: '0.85rem' }}>Offers extended to shortlisted candidates will appear here.</p>
            </div>
          ) : (
            <table className="ad-table">
              <thead>
                <tr><th>Student Name</th><th>Roll No</th><th>Branch</th><th>CTC Offered</th><th>Status</th><th>Issued On</th></tr>
              </thead>
              <tbody>
                {offers.map(o => (
                  <tr key={o.id}>
                    <td><div style={{ fontWeight: 600, color: '#f8fafc' }}>{o.student_name}</div></td>
                    <td><code>{o.roll_no}</code></td>
                    <td>{o.branch}</td>
                    <td><strong style={{ color: '#10b981' }}>₹{o.ctc_lpa} LPA</strong></td>
                    <td><span className="ad-badge ad-badge-success">{o.status}</span></td>
                    <td style={{ color: '#94a3b8', fontSize: '0.82rem' }}>{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
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
