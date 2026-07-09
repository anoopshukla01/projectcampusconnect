/**
 * Applications — TPO Portal  (PL9, PL10, PL11, PL12)
 * Select a drive → view all applications → shortlist / offer.
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@ctx/ToastContext';
import { placementApi } from '@/services/api';
import './Applications.css';

export default function Applications() {
  const showToast = useToast();
  const [drives,          setDrives]          = useState([]);
  const [selectedDriveId, setSelectedDriveId] = useState('');
  const [applications,    setApplications]    = useState([]);
  const [loading,         setLoading]         = useState(true);

  // Offer modal state
  const [offerModal,   setOfferModal]   = useState(false);
  const [offerStudent, setOfferStudent] = useState(null);
  const [ctcInput,     setCtcInput]     = useState('12');
  const [issuing,      setIssuing]      = useState(false);

  const fetchDrives = useCallback(async () => {
    const res = await placementApi.listDrives();
    const list = res?.drives || [];
    setDrives(list);
    if (list.length > 0) setSelectedDriveId(String(list[0].id));
    else setLoading(false);
  }, []);

  const fetchApplications = useCallback(async (driveId) => {
    setLoading(true);
    const res = await placementApi.getDriveApplications(driveId);
    setLoading(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    setApplications(res || []);
  }, []);

  useEffect(() => { fetchDrives(); }, [fetchDrives]);
  useEffect(() => {
    if (selectedDriveId) fetchApplications(selectedDriveId);
    else setApplications([]);
  }, [selectedDriveId, fetchApplications]);

  async function shortlist(studentId) {
    const res = await placementApi.bulkShortlist(selectedDriveId, [studentId]);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Student shortlisted.', 'success', 2500);
    fetchApplications(selectedDriveId);
  }

  async function issueOffer() {
    if (!offerStudent) return;
    setIssuing(true);
    const res = await placementApi.issueOffer(selectedDriveId, {
      student_id: offerStudent.student_id,
      ctc_lpa:    parseFloat(ctcInput) || 12,
    });
    setIssuing(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Offer letter issued!', 'success', 2500);
    setOfferModal(false);
    fetchApplications(selectedDriveId);
  }

  return (
    <div className="ap-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Application Pipeline</h1>
          <p className="page-sub">Review candidates, shortlist and issue offer letters</p>
        </div>
      </div>

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
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Loading applications…</div>
        ) : applications.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <p style={{ fontWeight: 600 }}>No applications for this drive</p>
            <p style={{ fontSize: '0.85rem' }}>Student applications will appear here once submitted.</p>
          </div>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Name</th><th>Roll No</th><th>Branch</th>
                  <th>CGPA</th><th>Applied On</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(a => (
                  <tr key={a.application_id}>
                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>{a.full_name}</td>
                    <td><code>{a.roll_no}</code></td>
                    <td>{a.branch}</td>
                    <td><strong>{a.cgpa}</strong></td>
                    <td style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                      {a.applied_at ? new Date(a.applied_at).toLocaleDateString() : '—'}
                    </td>
                    <td><span className="ad-badge ad-badge-info">{a.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {a.status === 'applied' && (
                          <button className="ad-btn ad-btn-primary"
                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem' }}
                            onClick={() => shortlist(a.student_id)}>
                            Shortlist
                          </button>
                        )}
                        {a.status === 'shortlisted' && (
                          <button className="ad-btn ad-btn-primary"
                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem', background: '#10b981' }}
                            onClick={() => { setOfferStudent(a); setCtcInput('12'); setOfferModal(true); }}>
                            Offer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Issue Offer Modal */}
      {offerModal && (
        <div className="modal-overlay" onClick={() => setOfferModal(false)}>
          <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Issue Offer Letter</h2>
              <button className="modal-close" onClick={() => setOfferModal(false)}>✕</button>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Offering to <strong>{offerStudent?.full_name}</strong> ({offerStudent?.roll_no})
            </p>
            <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
              CTC (LPA)
              <input type="number" step="0.5" value={ctcInput}
                onChange={e => setCtcInput(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.55rem',
                         borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                         border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
            </label>
            <div className="modal-footer" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="pd-btn pd-btn-outline" onClick={() => setOfferModal(false)}>Cancel</button>
              <button className="pd-btn pd-btn-primary" onClick={issueOffer} disabled={issuing}>
                {issuing ? 'Issuing…' : 'Issue Offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
