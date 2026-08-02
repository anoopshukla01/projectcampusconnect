import { useState } from 'react';
import { X } from "lucide-react";
import { useToast } from '@ctx/ToastContext';
import { placementApi } from '@/services/api';
import { useApiData } from '@/hooks/useApiData';
import { useBranches } from '@/hooks/useBranches';
import './PlacementNotices.css';

const DEFAULT_BRANCHES = ['CSE', 'ECE', 'MECH', 'EEE', 'CIVIL', 'IT'];

const BLANK_FORM = {
  title: '',
  content: '',
  target_audience: 'students',
  target_branch: 'all',
  target_semester: 'all',
  pinned: false,
  urgent: false,
};

export default function PlacementNotices() {
  const showToast = useToast();
  const { branches: dbBranches } = useBranches();

  const branchOptions = (dbBranches && dbBranches.length > 0)
    ? dbBranches.map(b => b.code || b.name)
    : DEFAULT_BRANCHES;

  const { data: noticesData, loading, refetch } = useApiData(
    '/placement/notices',
    { notices: [] },
  );
  const notices = noticesData?.notices || [];

  const [showModal, setShowModal] = useState(false);
  const [posting, setPosting] = useState(false);
  const [audienceFilter, setAudienceFilter] = useState('All');
  const [form, setForm] = useState(BLANK_FORM);
  const [errors, setErrors] = useState({});

  async function postNotice() {
    const newErrors = {};
    if (!form.title.trim()) {
      newErrors.title = 'Title is required.';
    }
    if (!form.content.trim()) {
      newErrors.content = 'Content is required.';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setPosting(true);

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      target_audience: form.target_audience,
      target_branch: form.target_branch === 'all' ? null : form.target_branch,
      target_semester: form.target_semester === 'all' ? null : parseInt(form.target_semester, 10),
      is_pinned: form.pinned,
      is_urgent: form.urgent,
      pinned: form.pinned,
      urgent: form.urgent,
    };

    const res = await placementApi.createNotice(payload);
    setPosting(false);
    if (res?.error) {
      setErrors({ server: res.error });
      showToast(res.error, 'error');
      return;
    }
    showToast('Notice posted!', 'success');
    setShowModal(false);
    setForm(BLANK_FORM);
    refetch();
  }

  async function deleteNotice(id) {
    const res = await placementApi.deleteNotice?.(id) || {};
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Notice removed.', 'info');
    refetch();
  }

  const audiences = ['All', 'All Students', ...new Set(notices.map(n => n.audience).filter(Boolean))];

  const filtered = audienceFilter === 'All'
    ? notices
    : notices.filter(n => n.audience === audienceFilter || n.target_branch === audienceFilter);

  const pinned  = filtered.filter(n => n.pinned || n.is_pinned);
  const regular = filtered.filter(n => !(n.pinned || n.is_pinned));
  const displayed = [...pinned, ...regular];

  return (
    <div className="pn-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Placement Notice Board</h1>
          <p className="page-sub">Post targeted announcements to students and shortlisted groups</p>
        </div>
        <button className="pd-btn pd-btn-primary" onClick={() => { setForm(BLANK_FORM); setErrors({}); setShowModal(true); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Post Notice
        </button>
      </div>

      {/* Audience Filter */}
      <div className="co-sector-tabs" style={{ flexWrap: 'wrap' }}>
        {audiences.map(a => (
          <button key={a} className={`co-sector-tab${audienceFilter === a ? ' active' : ''}`}
            onClick={() => setAudienceFilter(a)}>{a}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Loading notices…</div>
      ) : (
        <div className="pn-list">
          {displayed.map(n => {
            const isP = n.pinned || n.is_pinned;
            const isU = n.urgent || n.is_urgent;
            return (
              <div key={n.id} className={`pn-notice${isP ? ' pn-pinned' : ''}${isU ? ' pn-urgent' : ''}`}>
                <div className="pn-notice-header">
                  <div className="pn-title-row">
                    {isP && <span className="pn-pin-badge">Pinned</span>}
                    {isU && <span className="pn-urgent-badge">Urgent</span>}
                    <h3 className="pn-title">{n.title}</h3>
                  </div>
                  <div className="pn-actions">
                    <button className="co-action-btn co-action-del" title="Delete"
                      onClick={() => deleteNotice(n.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                           strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="pn-content">{n.content}</p>
                <div className="pn-meta">
                  <span className="pn-audience-chip">{n.audience || 'All Students'}</span>
                  <span className="pn-time">
                    {n.created_at ? new Date(n.created_at).toLocaleDateString() : n.time || ''}
                  </span>
                </div>
              </div>
            );
          })}
          {displayed.length === 0 && (
            <div className="co-empty" style={{ padding: '3rem' }}>No notices yet.</div>
          )}
        </div>
      )}

      {/* Post Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Post New Notice</h2>
              <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Close"><X size={16} aria-hidden="true" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {errors.server && (
                <div className="pn-inline-error">{errors.server}</div>
              )}
              <label className="co-field">
                <span className="co-label">Title *</span>
                <input
                  className={`co-input ${errors.title ? 'is-invalid' : ''}`}
                  placeholder="Notice title…"
                  value={form.title}
                  onChange={e => {
                    setForm(p => ({ ...p, title: e.target.value }));
                    if (errors.title) setErrors(p => ({ ...p, title: null }));
                  }}
                />
                {errors.title && <span className="pn-field-error">{errors.title}</span>}
              </label>

              <label className="co-field">
                <span className="co-label">Content *</span>
                <textarea
                  className={`co-input pn-textarea ${errors.content ? 'is-invalid' : ''}`}
                  rows={4}
                  placeholder="Write notice content…"
                  value={form.content}
                  onChange={e => {
                    setForm(p => ({ ...p, content: e.target.value }));
                    if (errors.content) setErrors(p => ({ ...p, content: null }));
                  }}
                />
                {errors.content && <span className="pn-field-error">{errors.content}</span>}
              </label>

              {/* Structured Audience Selector */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                <label className="co-field">
                  <span className="co-label">Target Audience</span>
                  <select
                    className="co-input"
                    value={form.target_audience}
                    onChange={e => setForm(p => ({ ...p, target_audience: e.target.value }))}
                  >
                    <option value="everyone">Everyone</option>
                    <option value="students">Students Only</option>
                    <option value="professors">Professors Only</option>
                  </select>
                </label>

                <label className="co-field">
                  <span className="co-label">Branch</span>
                  <select
                    className="co-input"
                    value={form.target_branch}
                    onChange={e => setForm(p => ({ ...p, target_branch: e.target.value }))}
                  >
                    <option value="all">All Branches</option>
                    {branchOptions.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </label>

                <label className="co-field">
                  <span className="co-label">Semester</span>
                  <select
                    className="co-input"
                    value={form.target_semester}
                    onChange={e => setForm(p => ({ ...p, target_semester: e.target.value }))}
                  >
                    <option value="all">All Semesters</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
                <label className="pn-checkbox-label">
                  <input type="checkbox" checked={form.pinned}
                    onChange={e => setForm(p => ({ ...p, pinned: e.target.checked }))} />
                  Pin notice
                </label>
                <label className="pn-checkbox-label">
                  <input type="checkbox" checked={form.urgent}
                    onChange={e => setForm(p => ({ ...p, urgent: e.target.checked }))} />
                  Mark urgent
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="pd-btn pd-btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="pd-btn pd-btn-primary" onClick={postNotice} disabled={posting}>
                {posting ? 'Posting…' : 'Post Notice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
