import { useState } from 'react';
import { useToast } from '@ctx/ToastContext';
import './PlacementNotices.css';

const AUDIENCES = ['All Students', 'CS Branch', 'EC Branch', 'ME Branch', 'Shortlisted — Google', 'Shortlisted — TCS'];

const INITIAL_NOTICES = [
  { id: 1, title: 'Google On-Campus Drive — Dec 10', content: 'Google will be conducting an on-campus placement drive on December 10, 2024. Eligible branches: CS, EC. Reporting time: 8:30 AM. Venue: Seminar Hall. Carry all documents.', audience: 'CS Branch', time: '2h ago', pinned: true, urgent: true },
  { id: 2, title: 'Pre-placement Talk — Amazon', content: 'Amazon will conduct a pre-placement orientation session on December 16, 2024 via Zoom. All eligible students (CS, EC — CGPA ≥ 7.0) are requested to register using the link shared in the portal.', audience: 'CS Branch', time: '5h ago', pinned: false, urgent: false },
  { id: 3, title: 'TCS NQT Results Declared', content: 'TCS NQT results have been declared. Shortlisted students will be notified via email. The technical interview round is scheduled for November 28. Check the applications tracker for your status.', audience: 'Shortlisted — TCS', time: '1d ago', pinned: true, urgent: false },
  { id: 4, title: 'Resume Submission Deadline', content: 'All final-year students must submit their updated resumes to the placement portal by November 30, 2024. Resumes submitted after the deadline will not be shared with recruiters.', audience: 'All Students', time: '2d ago', pinned: false, urgent: true },
  { id: 5, title: 'Mock Interview Sessions', content: 'The placement cell will conduct mock technical and HR interview sessions on December 2–4. Register your slots via the placement portal. Batches of 5 students per slot.', audience: 'All Students', time: '3d ago', pinned: false, urgent: false },
];

export default function PlacementNotices() {
  const showToast = useToast();
  const [notices, setNotices] = useState(INITIAL_NOTICES);
  const [showModal, setShowModal] = useState(false);
  const [audienceFilter, setAudienceFilter] = useState('All');
  const [form, setForm] = useState({ title: '', content: '', audience: 'All Students', pinned: false, urgent: false });

  const filtered = audienceFilter === 'All'
    ? notices
    : notices.filter(n => n.audience === audienceFilter);

  const pinned = filtered.filter(n => n.pinned);
  const regular = filtered.filter(n => !n.pinned);
  const displayed = [...pinned, ...regular];

  function postNotice() {
    if (!form.title.trim() || !form.content.trim()) { showToast('Title and content are required', 'error'); return; }
    setNotices(prev => [{ ...form, id: Date.now(), time: 'Just now' }, ...prev]);
    showToast('Notice posted!', 'success');
    setShowModal(false);
    setForm({ title: '', content: '', audience: 'All Students', pinned: false, urgent: false });
  }

  function togglePin(id) {
    setNotices(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  }

  function deleteNotice(id) {
    setNotices(prev => prev.filter(n => n.id !== id));
    showToast('Notice removed', 'info');
  }

  return (
    <div className="pn-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Placement Notice Board</h1>
          <p className="page-sub">Post targeted announcements to students, branches or shortlisted groups</p>
        </div>
        <button className="pd-btn pd-btn-primary" onClick={() => setShowModal(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Post Notice
        </button>
      </div>

      {/* Audience Filter */}
      <div className="co-sector-tabs">
        <button className={`co-sector-tab${audienceFilter === 'All' ? ' active' : ''}`} onClick={() => setAudienceFilter('All')}>All</button>
        {AUDIENCES.map(a => (
          <button key={a} className={`co-sector-tab${audienceFilter === a ? ' active' : ''}`} onClick={() => setAudienceFilter(a)}>{a}</button>
        ))}
      </div>

      {/* Notices */}
      <div className="pn-list">
        {displayed.map(n => (
          <div key={n.id} className={`pn-notice${n.pinned ? ' pn-pinned' : ''}${n.urgent ? ' pn-urgent' : ''}`}>
            <div className="pn-notice-header">
              <div className="pn-title-row">
                {n.pinned && <span className="pn-pin-badge">📌 Pinned</span>}
                {n.urgent && <span className="pn-urgent-badge">🔴 Urgent</span>}
                <h3 className="pn-title">{n.title}</h3>
              </div>
              <div className="pn-actions">
                <button className="co-action-btn" title={n.pinned ? 'Unpin' : 'Pin'} onClick={() => togglePin(n.id)}>
                  📌
                </button>
                <button className="co-action-btn co-action-del" title="Delete" onClick={() => deleteNotice(n.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            </div>
            <p className="pn-content">{n.content}</p>
            <div className="pn-meta">
              <span className="pn-audience-chip">👥 {n.audience}</span>
              <span className="pn-time">{n.time}</span>
            </div>
          </div>
        ))}
        {displayed.length === 0 && (
          <div className="co-empty" style={{ padding: '3rem' }}>No notices for this audience.</div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2>Post New Notice</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
              <div className="co-field">
                <label className="co-label">Title *</label>
                <input className="co-input" placeholder="Notice title…" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="co-field">
                <label className="co-label">Content *</label>
                <textarea className="co-input pn-textarea" placeholder="Write notice content…" value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={5} />
              </div>
              <div className="co-field">
                <label className="co-label">Target Audience</label>
                <select className="co-input" value={form.audience} onChange={e => setForm(p => ({ ...p, audience: e.target.value }))}>
                  {AUDIENCES.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <label className="pn-checkbox-label">
                  <input type="checkbox" checked={form.pinned} onChange={e => setForm(p => ({ ...p, pinned: e.target.checked }))} />
                  Pin notice
                </label>
                <label className="pn-checkbox-label">
                  <input type="checkbox" checked={form.urgent} onChange={e => setForm(p => ({ ...p, urgent: e.target.checked }))} />
                  Mark as urgent
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="pd-btn pd-btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="pd-btn pd-btn-primary" onClick={postNotice}>Post Notice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
