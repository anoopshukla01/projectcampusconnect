/**
 * Drives — TPO Portal  (PL1–PL5)
 * Fetch, create, update, delete placement drives via placementApi.
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@ctx/ToastContext';
import { placementApi } from '@/services/api';
import './Drives.css';

const BLANK = {
  company_name: '', role_title: '', drive_type: 'Full-Time',
  batch_year: new Date().getFullYear(), cgpa_cutoff: 7.0,
  backlog_cutoff: 0, ctc_lpa: 12.0, stipend_monthly: 0,
  registration_deadline: '', description: '', location: '', skills_required: '',
};

export default function Drives() {
  const showToast = useToast();
  const [drives,     setDrives]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form,       setForm]       = useState(BLANK);
  const [submitting, setSubmitting] = useState(false);
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatus]   = useState('all');

  const fetchDrives = useCallback(async () => {
    setLoading(true);
    const res = await placementApi.listDrives();
    setLoading(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    setDrives(res?.drives || []);
  }, []);

  useEffect(() => { fetchDrives(); }, [fetchDrives]);

  function openCreate() { setForm(BLANK); setEditTarget(null); setShowModal(true); }
  function openEdit(d)  {
    setForm({
      company_name: d.company_name, role_title: d.role_title,
      drive_type: d.drive_type || 'Full-Time', batch_year: d.batch_year,
      cgpa_cutoff: d.cgpa_cutoff, backlog_cutoff: d.backlog_cutoff || 0,
      ctc_lpa: d.ctc_lpa || 0, stipend_monthly: d.stipend_monthly || 0,
      registration_deadline: d.registration_deadline || '',
      description: d.description || '', location: d.location || '',
      skills_required: d.skills_required || '',
    });
    setEditTarget(d.id);
    setShowModal(true);
  }

  async function saveDrive() {
    if (!form.company_name || !form.role_title) {
      showToast('Company name and role title are required.', 'error'); return;
    }
    setSubmitting(true);
    const res = editTarget
      ? await placementApi.updateDrive(editTarget, form)
      : await placementApi.createDrive(form);
    setSubmitting(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(editTarget ? 'Drive updated.' : `Drive for ${form.company_name} scheduled!`, 'success', 3000);
    setShowModal(false);
    fetchDrives();
  }

  async function deleteDrive(id, name) {
    if (!window.confirm(`Delete the ${name} drive?`)) return;
    const res = await placementApi.deleteDrive(id);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Drive deleted.', 'info');
    fetchDrives();
  }

  const filtered = drives.filter(d => {
    const q = search.toLowerCase();
    const matchQ = d.company_name?.toLowerCase().includes(q) || d.role_title?.toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || d.status === statusFilter;
    return matchQ && matchS;
  });

  return (
    <div className="dr-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Placement Drives</h1>
          <p className="page-sub">Schedule, manage and track all on-campus recruitment drives</p>
        </div>
        <button className="pd-btn pd-btn-primary" onClick={openCreate}>+ Schedule Drive</button>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <input className="lib-search" style={{ flex: 1, minWidth: '200px' }}
          placeholder="Search company or role…" value={search}
          onChange={e => setSearch(e.target.value)} />
        {['all','active','upcoming','completed','cancelled'].map(s => (
          <button key={s}
            className={`filter-btn${statusFilter === s ? ' active' : ''}`}
            onClick={() => setStatus(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="ad-card">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Loading drives…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <p style={{ fontWeight: 600 }}>No drives found</p>
            <p style={{ fontSize: '0.85rem' }}>Click "Schedule Drive" to create one.</p>
          </div>
        ) : (
          <div className="pd-table-wrap">
            <table className="pd-table">
              <thead>
                <tr>
                  <th>Company</th><th>Role</th><th>Type</th><th>CTC</th>
                  <th>Batch</th><th>CGPA</th><th>Deadline</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id}>
                    <td><strong>{d.company_name}</strong></td>
                    <td>{d.role_title}</td>
                    <td><span className="ad-badge ad-badge-info">{d.drive_type}</span></td>
                    <td className="pd-ctc">{d.ctc_lpa ? `₹${d.ctc_lpa} LPA` : '—'}</td>
                    <td>{d.batch_year}</td>
                    <td>≥ {d.cgpa_cutoff}</td>
                    <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {d.registration_deadline
                        ? new Date(d.registration_deadline).toLocaleDateString()
                        : 'Open'}
                    </td>
                    <td>
                      <span className={`pd-badge pd-badge-${d.status === 'active' ? 'upcoming' : 'completed'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="co-action-btn" title="Edit" onClick={() => openEdit(d)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                               strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button className="co-action-btn co-action-del" title="Delete"
                          onClick={() => deleteDrive(d.id, d.company_name)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                               strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14H6L5 6"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editTarget ? 'Edit Drive' : 'Schedule Placement Drive'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { key: 'company_name',  label: 'Company Name *',  placeholder: 'e.g. Google India' },
                { key: 'role_title',    label: 'Role Title *',     placeholder: 'e.g. Software Engineer' },
                { key: 'location',      label: 'Location',         placeholder: 'e.g. Bangalore' },
                { key: 'skills_required', label: 'Skills (comma-separated)', placeholder: 'Python, SQL, React' },
                { key: 'description',   label: 'Description',      placeholder: 'Drive details…', textarea: true },
              ].map(f => (
                <label key={f.key} style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  {f.label}
                  {f.textarea
                    ? <textarea rows={3} value={form[f.key]}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        style={{ width: '100%', marginTop: '0.3rem', padding: '0.55rem',
                                 borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                                 border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
                                 resize: 'vertical' }} />
                    : <input value={form[f.key]}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        style={{ display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.55rem',
                                 borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                                 border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
                  }
                </label>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { key: 'batch_year',   label: 'Batch Year', type: 'number' },
                  { key: 'cgpa_cutoff',  label: 'CGPA Cutoff', type: 'number', step: '0.1' },
                  { key: 'backlog_cutoff', label: 'Max Backlogs', type: 'number' },
                  { key: 'ctc_lpa',      label: 'CTC (LPA)', type: 'number', step: '0.5' },
                ].map(f => (
                  <label key={f.key} style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                    {f.label}
                    <input type={f.type} step={f.step} value={form[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))}
                      style={{ display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.55rem',
                               borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                               border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
                  </label>
                ))}
              </div>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Registration Deadline
                <input type="datetime-local" value={form.registration_deadline}
                  onChange={e => setForm(p => ({ ...p, registration_deadline: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.55rem',
                           borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                           border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
              </label>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Drive Type
                <select value={form.drive_type}
                  onChange={e => setForm(p => ({ ...p, drive_type: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.55rem',
                           borderRadius: 8, background: '#1e293b',
                           border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
                  {['Full-Time','Internship','Intern + FTE','Contract'].map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="modal-footer" style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="pd-btn pd-btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="pd-btn pd-btn-primary" onClick={saveDrive} disabled={submitting}>
                {submitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Schedule Drive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
