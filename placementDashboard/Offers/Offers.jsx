/**
 * Offers — TPO Portal  (PL13)
 * View all offers per drive. Student accept/decline is PL14 (student portal).
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@ctx/ToastContext';
import { placementApi } from '@/services/api';
import './Offers.css';

export default function Offers() {
  const showToast = useToast();
  const [drives,          setDrives]          = useState([]);
  const [selectedDriveId, setSelectedDriveId] = useState('');
  const [offers,          setOffers]          = useState([]);
  const [loading,         setLoading]         = useState(true);

  const fetchDrives = useCallback(async () => {
    const res = await placementApi.listDrives();
    const list = res?.drives || [];
    setDrives(list);
    if (list.length > 0) setSelectedDriveId(String(list[0].id));
    else setLoading(false);
  }, []);

  const fetchOffers = useCallback(async (driveId) => {
    setLoading(true);
    const res = await placementApi.getDriveOffers(driveId);
    setLoading(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    setOffers(res || []);
  }, []);

  useEffect(() => { fetchDrives(); }, [fetchDrives]);
  useEffect(() => {
    if (selectedDriveId) fetchOffers(selectedDriveId);
    else setOffers([]);
  }, [selectedDriveId, fetchOffers]);

  const accepted  = offers.filter(o => o.status === 'accepted').length;
  const pending   = offers.filter(o => o.status === 'issued').length;
  const declined  = offers.filter(o => o.status === 'declined').length;

  return (
    <div className="of-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Offer Management</h1>
          <p className="page-sub">Track official job offers and One-Student One-Offer policy status</p>
        </div>
      </div>

      {/* Stats Row */}
      {offers.length > 0 && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Total Offers', val: offers.length, color: '#6366f1' },
            { label: 'Accepted',     val: accepted,      color: '#10b981' },
            { label: 'Pending',      val: pending,       color: '#f59e0b' },
            { label: 'Declined',     val: declined,      color: '#ef4444' },
          ].map(s => (
            <div key={s.label} className="pd-stat-card" style={{ flex: 1, minWidth: 120, padding: '1rem' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.val}</span>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block' }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Drive selector */}
      <div className="ad-card" style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
          Select Drive
        </label>
        <select value={selectedDriveId} onChange={e => setSelectedDriveId(e.target.value)}
          style={{ width: '100%', maxWidth: 400, padding: '0.6rem', borderRadius: 8,
                   background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
          {drives.map(d => (
            <option key={d.id} value={d.id}>{d.company_name} — {d.role_title}</option>
          ))}
        </select>
      </div>

      <div className="ad-card">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Loading offers…</div>
        ) : offers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <p style={{ fontWeight: 600 }}>No offers issued for this drive yet</p>
            <p style={{ fontSize: '0.85rem' }}>Issue offers from the Applications page after shortlisting.</p>
          </div>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Student Name</th><th>Roll No</th><th>Branch</th>
                  <th>CTC (LPA)</th><th>Status</th><th>Issued On</th>
                </tr>
              </thead>
              <tbody>
                {offers.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>{o.student_name || '—'}</td>
                    <td><code>{o.roll_no || '—'}</code></td>
                    <td>{o.branch || '—'}</td>
                    <td><strong style={{ color: '#10b981' }}>₹{o.ctc_offered} LPA</strong></td>
                    <td>
                      <span className={`ad-badge ${
                        o.status === 'accepted' ? 'ad-badge-success'
                        : o.status === 'declined' ? 'ad-badge-error'
                        : 'ad-badge-info'
                      }`}>{o.status}</span>
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                      {o.offer_date ? new Date(o.offer_date).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
