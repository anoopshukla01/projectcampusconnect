/**
 * Notes & PYQs — Student / Professor / Admin Portal
 *
 * Student:   browse approved notes, download (counter incremented),
 *            upload own notes (goes to pending approval).
 * Professor/Admin: see pending uploads, approve/reject, upload directly
 *                  (auto-approved), delete any note.
 *
 * Role enforced server-side.
 */

import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { libraryApi } from '../../services/api';
import { StateContainer } from '../../components/StateContainer';
import './Notes.css';

const TYPES = ['all', 'notes', 'slides', 'pyq'];
const TYPE_LABELS = { notes: 'Notes', slides: 'Slides', pyq: 'PYQ Papers' };
const NOTE_ICONS  = { notes: '📄', slides: '📊', pyq: '📋' };

const BLANK = { title: '', subject: '', note_type: 'notes', branch: '', semester: '', description: '', file_url: '' };

export default function Notes() {
  const { user, isProfessor, isAdmin } = useAuth();
  const showToast = useToast();

  const canManage = isProfessor || isAdmin;

  const [type,  setType]  = useState('all');
  const [modal, setModal] = useState(false);
  const [form,  setForm]  = useState(BLANK);
  const [uploading,   setUploading]   = useState(false);
  const [approving,   setApproving]   = useState({});
  const [deleting,    setDeleting]    = useState({});
  const [downloading, setDownloading] = useState({});

  // Approved notes (all)
  const { data: apiData, loading, error, isEmpty, refetch } = useApiData(
    '/community/notes',
    { notes: [] },
  );
  const allNotes = useMemo(() => apiData?.notes || [], [apiData]);

  // Pending notes (professor/admin)
  const { data: pendingData, refetch: refetchPending } = useApiData(
    canManage ? '/community/notes/pending' : null,
    { notes: [] },
  );
  const pending = useMemo(() => pendingData?.notes || [], [pendingData]);

  const filtered = useMemo(() =>
    type === 'all' ? allNotes : allNotes.filter(n => (n.type || n.note_type) === type),
    [allNotes, type],
  );

  // ── Upload ────────────────────────────────────────────────────────────────
  async function handleUpload(e) {
    e.preventDefault();
    if (!form.title || !form.subject) { showToast('Title and subject are required.', 'error'); return; }
    setUploading(true);
    const res = await libraryApi.uploadNote({
      title:       form.title,
      subject:     form.subject,
      note_type:   form.note_type,
      branch:      form.branch || undefined,
      semester:    form.semester ? Number(form.semester) : undefined,
      description: form.description,
      file_url:    form.file_url,
    });
    setUploading(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    const msg = res.approved
      ? `"${form.title}" published!`
      : `"${form.title}" uploaded — pending professor approval.`;
    showToast(msg, 'success', 3000);
    setModal(false);
    setForm(BLANK);
    refetch();
    if (canManage) refetchPending();
  }

  // ── Approve ───────────────────────────────────────────────────────────────
  async function handleApprove(id, title) {
    setApproving(p => ({ ...p, [id]: true }));
    const res = await libraryApi.approveNote(id);
    setApproving(p => ({ ...p, [id]: false }));
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(`"${title}" approved and published!`, 'success', 3000);
    refetch();
    refetchPending();
  }

  async function handleReject(id, title) {
    const res = await libraryApi.deleteNote(id);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(`"${title}" rejected.`, 'info');
    refetchPending();
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id, title) {
    if (!window.confirm(`Delete "${title}"?`)) return;
    setDeleting(p => ({ ...p, [id]: true }));
    const res = await libraryApi.deleteNote(id);
    setDeleting(p => ({ ...p, [id]: false }));
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Note removed.', 'info');
    refetch();
  }

  // ── Download ──────────────────────────────────────────────────────────────
  async function handleDownload(id, title) {
    setDownloading(p => ({ ...p, [id]: true }));
    const res = await libraryApi.downloadNote(id);
    setDownloading(p => ({ ...p, [id]: false }));
    if (res?.error) { showToast(res.error, 'error'); return; }
    if (res?.file_url) {
      window.open(res.file_url, '_blank', 'noopener');
    } else {
      showToast(`"${title}" — no file URL attached yet.`, 'info');
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{canManage ? 'Study Resources — Approvals' : 'Notes & PYQs'}</h1>
          <p className="page-sub">
            {canManage
              ? `${pending.length} pending review · ${allNotes.length} published`
              : 'Peer-shared study resources'}
          </p>
        </div>
        <button className="action-btn" onClick={() => setModal(true)}>
          {canManage ? '+ Publish Note' : '+ Upload'}
        </button>
      </div>

      {/* Pending Approvals (professor/admin) */}
      {canManage && pending.length > 0 && (
        <section className="panel" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-header">
            <h2 className="panel-title">Pending Student Uploads</h2>
          </div>
          <div className="notes-list">
            {pending.map(p => (
              <div className="note-card" key={p.id}>
                <div className="note-icon-wrap">{NOTE_ICONS[p.type || p.note_type] || '📄'}</div>
                <div className="note-body">
                  <span className="note-subject">{p.subject}</span>
                  <h3 className="note-title">{p.title}</h3>
                  <p className="note-meta">by {p.author}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button className="action-btn"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    disabled={approving[p.id]}
                    onClick={() => handleApprove(p.id, p.title)}>
                    {approving[p.id] ? '…' : 'Approve'}
                  </button>
                  <button className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => handleReject(p.id, p.title)}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Type Filter */}
      <div className="filter-row">
        {TYPES.map(t => (
          <button key={t}
            className={`filter-btn${type === t ? ' active' : ''}`}
            onClick={() => setType(t)}>
            {t === 'all' ? 'All' : TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <StateContainer loading={loading} error={error} isEmpty={isEmpty && !canManage}
        emptyMessage="No study resources yet. Be the first to share one!">
        <div className="notes-list">
          {filtered.map(n => (
            <div className="note-card" key={n.id}>
              <div className="note-icon-wrap">
                {NOTE_ICONS[n.type || n.note_type] || '📄'}
              </div>
              <div className="note-body">
                <span className="note-subject">{n.subject}</span>
                <h3 className="note-title">{n.title}</h3>
                <p className="note-meta">
                  by {n.author || n.uploader}
                  {n.downloads ? ` · ${n.downloads} downloads` : ''}
                  {n.date ? ` · ${n.date}` : ''}
                </p>
              </div>
              <span className={`note-type-badge ${n.type || n.note_type}`}>
                {TYPE_LABELS[n.type || n.note_type] || 'Notes'}
              </span>
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <button className="btn-dl" aria-label="Download"
                  disabled={downloading[n.id]}
                  onClick={() => handleDownload(n.id, n.title)}>
                  {downloading[n.id] ? '…' : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  )}
                </button>
                {canManage && (
                  <button
                    style={{ background: 'none', border: 'none',
                             color: 'var(--clr-danger, #ef4444)', cursor: 'pointer', fontSize: '0.9rem' }}
                    disabled={deleting[n.id]}
                    onClick={() => handleDelete(n.id, n.title)}>
                    {deleting[n.id] ? '…' : '🗑'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </StateContainer>

      {/* Upload Modal */}
      {modal && (
        <div className="modal-overlay" role="dialog" aria-modal="true"
             onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>{canManage ? 'Publish Study Material' : 'Upload Resource'}</h2>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleUpload} className="sell-form">
              <label>
                Title *
                <input required value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. OSI Model Notes" />
              </label>
              <label>
                Subject *
                <input required value={form.subject}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder="e.g. Computer Networks" />
              </label>
              <label>
                Type
                <select value={form.note_type}
                  onChange={e => setForm(p => ({ ...p, note_type: e.target.value }))}>
                  {TYPES.filter(t => t !== 'all').map(t => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </label>
              <label>
                Branch (optional)
                <input value={form.branch}
                  onChange={e => setForm(p => ({ ...p, branch: e.target.value }))}
                  placeholder="e.g. CSE" />
              </label>
              <label>
                Semester (optional)
                <input type="number" min="1" max="8" value={form.semester}
                  onChange={e => setForm(p => ({ ...p, semester: e.target.value }))} />
              </label>
              <label>
                File URL (Google Drive / OneDrive link)
                <input value={form.file_url}
                  onChange={e => setForm(p => ({ ...p, file_url: e.target.value }))}
                  placeholder="https://drive.google.com/…" />
              </label>
              <label>
                Description
                <textarea rows={2} value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description…"
                  style={{ resize: 'vertical', width: '100%' }} />
              </label>
              {!canManage && (
                <p style={{ fontSize: '0.8rem', color: 'var(--clr-muted)', margin: '0.25rem 0' }}>
                  Your note will appear after professor approval.
                </p>
              )}
              <button type="submit" className="action-btn" style={{ width: '100%' }}
                disabled={uploading}>
                {uploading ? 'Uploading…' : canManage ? 'Publish Material' : 'Submit for Review'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
