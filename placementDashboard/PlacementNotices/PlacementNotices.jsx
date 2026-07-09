/**
 * PlacementNotices — TPO Portal  (PL16)
 * Fetch, create placement notices from backend.
 */

import { useState, useCallback } from 'react';
import { useToast } from '@ctx/ToastContext';
import { placementApi } from '@/services/api';
import { useApiData } from '@/hooks/useApiData';
import './PlacementNotices.css';

export default function PlacementNotices() {
  const showToast = useToast();

  const { data: noticesData, loading, refetch } = useApiData(
    '/placement/notices',
    { notices: [] },
  );
  const notices = noticesData?.notices || [];

  const [showModal,       setShowModal]       = useState(false);
  const [posting,         setPosting]         = useState(false);
  const [audienceFilter,  setAudienceFilter]  = useState('All');
  const [form, setForm] = useState({ title: '', content: '', audience: 'All Students', pinned: false, urgent: false });

  async function postNotice() {
    if (!form.title.trim() || !form.content.trim()) {
      showToast('Title and content are required.', 'error'); return;
    }
    setPosting(true);
    const res = await placementApi.createNotice(form);
    setPosting(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Notice posted!', 'success');
    setShowModal(false);
    setForm({ title: '', content: '', audience: 'All Students', pinned: false, urgent: false });
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
    : notices.filter(n => n.audience === audienceFilter);

  const pinned  = filtered.filter(n => n.pinned);
  const regular = filtered.filter(n => !n.pinned);
  const displayed = [...pinned, ...regular];

  return (
    <div className="pn-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Placement Notice Board</h1>
          <p className="page-sub">Post targeted announcements to students and shortlisted groups</p>
        </div>
        <button className="pd-btn pd-btn-primary" onClick={() => setShowModal(true)}>
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
          {displayed.map(n => (
            <div key={n.id} className={`pn-notice${n.pinned ? ' pn-pinned' : ''}${n.urgent ? ' pn-urgent' : ''}`}>
              <div className="pn-notice-header">
                <div className="pn-title-row">
                  {n.pinned && <span className="pn-pin-badge">📌 Pinned</span>}
                  {n.urgent && <span className="pn-urgent-badge">🔴 Urgent</span>}
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
                <span className="pn-audience-chip">👥 {n.audience}</span>
                <span className="pn-time">
                  {n.created_at ? new Date(n.created_at).toLocaleDateString() : n.time || ''}
                </span>
              </div>
            </div>
          ))}
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
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <label className="co-field">
                <span className="co-label">Title *</span>
                <input className="co-input" placeholder="Notice title…"
                  value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </label>
              <label className="co-field">
                <span className="co-label">Content *</span>
                <textarea className="co-input pn-textarea" rows={5} placeholder="Write notice content…"
                  value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} />
              </label>
              <label className="co-field">
                <span className="co-label">Audience</span>
                <input className="co-input" placeholder="All Students, CS Branch, …"
                  value={form.audience} onChange={e => setForm(p => ({ ...p, audience: e.target.value }))} />
              </label>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
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
