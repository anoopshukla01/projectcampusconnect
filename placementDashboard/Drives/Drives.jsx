import { useState, useEffect } from 'react';
import { useToast } from '@ctx/ToastContext';
import './Drives.css';

const BLANK_DRIVE = {
  company_name: '',
  role_title: '',
  drive_type: 'Full-Time',
  batch_year: 2026,
  cgpa_cutoff: 7.0,
  max_backlogs: 0,
  ctc_lpa: 12.0,
  stipend_monthly: 0,
  registration_deadline: '2026-12-31T23:59:00',
  description: ''
};

export default function Drives() {
  const showToast = useToast();
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(BLANK_DRIVE);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDrives();
  }, []);

  async function fetchDrives() {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/placement/drives', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setDrives(data.drives || []);
      } else {
        showToast(data.error || 'Failed to fetch placement drives.', 'error', 3000);
      }
    } catch {
      showToast('Network error fetching placement drives.', 'error', 3000);
    } finally {
      setLoading(false);
    }
  }

  async function saveDrive() {
    if (!form.company_name || !form.role_title) {
      showToast('Company Name and Role Title are required.', 'error', 2500);
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/placement/drives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Drive for ${form.company_name} scheduled successfully!`, 'success', 3000);
        setShowModal(false);
        setForm(BLANK_DRIVE);
        fetchDrives();
      } else {
        showToast(data.error || 'Failed to create drive.', 'error', 3000);
      }
    } catch {
      showToast('Error creating placement drive.', 'error', 3000);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dr-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Placement Drives</h1>
          <p className="page-sub">Schedule, manage and track all on-campus and off-campus recruitment drives</p>
        </div>
        <button className="pd-btn pd-btn-primary" onClick={() => setShowModal(true)}>
          + Schedule New Drive
        </button>
      </div>

      <div className="ad-card" style={{ marginTop: '1.5rem' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <div className="ad-spinner" style={{ margin: '0 auto 1rem auto' }} />
            Loading placement drives…
          </div>
        ) : drives.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No placement drives scheduled</p>
            <p style={{ fontSize: '0.85rem' }}>Click "Schedule New Drive" above to create an active recruitment drive.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {drives.map(d => (
              <div key={d.id} className="ad-card" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{d.company_name}</h3>
                  <span className="ad-badge ad-badge-success">{d.drive_type}</span>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#818cf8', fontWeight: 600, marginBottom: '0.75rem' }}>{d.role_title}</div>
                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div><strong>Batch:</strong> {d.batch_year}</div>
                  <div><strong>CGPA Cutoff:</strong> {d.cgpa_cutoff}</div>
                  <div><strong>Package:</strong> ₹{d.ctc_lpa} LPA</div>
                  <div><strong>Deadline:</strong> {d.registration_deadline ? new Date(d.registration_deadline).toLocaleDateString() : 'Open'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="ad-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="ad-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '90%' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', color: '#fff' }}>Schedule Placement Drive</h2>

            <div className="field" style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.3rem' }}>Company Name</label>
              <input
                className="ad-input"
                placeholder="e.g. Google India"
                value={form.company_name}
                onChange={e => setForm({ ...form, company_name: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
              />
            </div>

            <div className="field" style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.3rem' }}>Role Title</label>
              <input
                className="ad-input"
                placeholder="e.g. Software Engineer L3"
                value={form.role_title}
                onChange={e => setForm({ ...form, role_title: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.3rem' }}>Batch Year</label>
                <input
                  type="number"
                  value={form.batch_year}
                  onChange={e => setForm({ ...form, batch_year: parseInt(e.target.value) || 2026 })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.3rem' }}>CGPA Cutoff</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.cgpa_cutoff}
                  onChange={e => setForm({ ...form, cgpa_cutoff: parseFloat(e.target.value) || 7.0 })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.3rem' }}>CTC (LPA)</label>
                <input
                  type="number"
                  step="0.5"
                  value={form.ctc_lpa}
                  onChange={e => setForm({ ...form, ctc_lpa: parseFloat(e.target.value) || 12.0 })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.3rem' }}>Drive Type</label>
                <select
                  value={form.drive_type}
                  onChange={e => setForm({ ...form, drive_type: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                >
                  <option value="Full-Time">Full-Time</option>
                  <option value="Internship">Internship</option>
                  <option value="Intern + FTE">Intern + FTE</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="ad-btn ad-btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="ad-btn ad-btn-primary" onClick={saveDrive} disabled={submitting}>
                {submitting ? 'Scheduling…' : 'Schedule Drive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
