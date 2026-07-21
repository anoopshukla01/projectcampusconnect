/**
 * E-Library — Student / Professor / Admin Portal
 *
 * Student:   browse approved resources, download (increments counter).
 * Professor/Admin: additionally see pending uploads, approve them, upload new,
 *                  delete any resource.
 *
 * Upload flow:  professor uploads → auto-approved.
 *               student uploads   → goes to pending queue → professor approves.
 *
 * Role enforced server-side; never sent in request body.
 */

import { useState, useMemo } from 'react';
import { Trash2, X, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { libraryApi } from '../../services/api';
import { StateContainer } from '../../components/StateContainer';
import './ELibrary.css';

const GENRES  = ['all', 'cs', 'ece', 'maths', 'general', 'book', 'paper', 'slides'];
const RES_TYPES = ['book', 'paper', 'slides', 'reference', 'other'];

const BLANK = { title: '', author: '', subject: '', resource_type: 'book', description: '', file_url: '' };

export default function ELibrary() {
  const { user, isProfessor, isAdmin } = useAuth();
  const showToast = useToast();

  const canManage = isProfessor || isAdmin;

  // Approved resources (all users)
  const { data: libData, loading, error, isEmpty, refetch } = useApiData(
    '/community/elibrary',
    { resources: [] },
  );
  const books = useMemo(() => libData?.resources || [], [libData]);

  // Pending resources (professor/admin only)
  const { data: pendingData, refetch: refetchPending } = useApiData(
    canManage ? '/community/elibrary/pending' : null,
    { resources: [] },
  );
  const pending = useMemo(() => pendingData?.resources || [], [pendingData]);

  const [genre,  setGenre]  = useState('all');
  const [search, setSearch] = useState('');
  const [modal,  setModal]  = useState(false);
  const [form,   setForm]   = useState(BLANK);
  const [uploading,  setUploading]  = useState(false);
  const [approving,  setApproving]  = useState({});
  const [deleting,   setDeleting]   = useState({});
  const [downloading, setDownloading] = useState({});

  const filtered = useMemo(() => {
    let list = books;
    if (genre !== 'all') list = list.filter(b => (b.type || b.resource_type) === genre);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(b => b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q));
    }
    return list;
  }, [books, genre, search]);

  // ── Upload ────────────────────────────────────────────────────────────────
  async function handleUpload(e) {
    e.preventDefault();
    if (!form.title || !form.subject) { showToast('Title and subject are required.', 'error'); return; }
    setUploading(true);
    const res = await libraryApi.uploadResource(form);
    setUploading(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    const msg = res.approved
      ? `"${form.title}" added to the library!`
      : `"${form.title}" uploaded — pending approval.`;
    showToast(msg, 'success', 3000);
    setModal(false);
    setForm(BLANK);
    refetch();
    if (canManage) refetchPending();
  }

  // ── Approve ───────────────────────────────────────────────────────────────
  async function handleApprove(id, title) {
    setApproving(p => ({ ...p, [id]: true }));
    const res = await libraryApi.approveResource(id);
    setApproving(p => ({ ...p, [id]: false }));
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(`"${title}" approved and published!`, 'success', 3000);
    refetch();
    refetchPending();
  }

  // ── Reject (delete pending) ───────────────────────────────────────────────
  async function handleReject(id, title) {
    const res = await libraryApi.deleteResource(id);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(`"${title}" rejected and removed.`, 'info');
    refetchPending();
  }

  // ── Delete approved resource ──────────────────────────────────────────────
  async function handleDelete(id, title) {
    if (!window.confirm(`Delete "${title}" from the library?`)) return;
    setDeleting(p => ({ ...p, [id]: true }));
    const res = await libraryApi.deleteResource(id);
    setDeleting(p => ({ ...p, [id]: false }));
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Resource removed.', 'info');
    refetch();
  }

  // ── Download ──────────────────────────────────────────────────────────────
  async function handleDownload(id, title) {
    setDownloading(p => ({ ...p, [id]: true }));
    const res = await libraryApi.downloadResource(id);
    setDownloading(p => ({ ...p, [id]: false }));
    if (res?.error) { showToast(res.error, 'error'); return; }
    if (res?.file_url) {
      window.open(res.file_url, '_blank', 'noopener');
    } else {
      showToast(`"${title}" — no file attached yet.`, 'info');
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{canManage ? 'E-Library Control Panel' : 'E-Library'}</h1>
          <p className="page-sub">
            {canManage
              ? `${pending.length} pending approval · ${books.length} published`
              : `Digital catalogue · ${books.length} resources`}
          </p>
        </div>
        <button className="action-btn" onClick={() => setModal(true)}>
          {canManage ? '+ Add Resource' : '+ Upload'}
        </button>
      </div>

      {/* Pending Approvals (professor/admin) */}
      {canManage && pending.length > 0 && (
        <section className="panel" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-header">
            <h2 className="panel-title">Pending Uploads — Review Required</h2>
          </div>
          <div className="attend-table-wrap">
            <table className="attend-table">
              <thead>
                <tr><th>Title</th><th>Subject</th><th>Type</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {pending.map(r => (
                  <tr key={r.id}>
                    <td className="subject-name-cell"><strong>{r.title}</strong></td>
                    <td>{r.subject}</td>
                    <td><span className="filter-btn" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>{r.type}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button className="action-btn"
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                          disabled={approving[r.id]}
                          onClick={() => handleApprove(r.id, r.title)}>
                          {approving[r.id] ? '…' : 'Approve'}
                        </button>
                        <button className="btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                          onClick={() => handleReject(r.id, r.title)}>
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Search + Genre Filter */}
      <div className="lib-controls">
        <div className="lib-search-wrap">
          <svg className="lib-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input className="lib-search" type="search"
            placeholder="Search by title or author…"
            value={search} onChange={e => setSearch(e.target.value)}
            aria-label="Search resources" />
        </div>
        <div className="filter-row">
          {GENRES.map(g => (
            <button key={g}
              className={`filter-btn${genre === g ? ' active' : ''}`}
              onClick={() => setGenre(g)}>
              {g === 'all' ? 'All' : g.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <StateContainer loading={loading} error={error} isEmpty={isEmpty && !canManage}
        emptyMessage="No resources in the library yet.">
        <div className="lib-grid" id="libraryGrid">
          {filtered.length === 0 ? (
            <div className="lib-empty">No matching resources found.</div>
          ) : (
            filtered.map(book => (
              <div className="book-card" key={book.id}>
                <div className="avail-indicator available">Available</div>
                <div className="book-cover" aria-hidden="true">
                  <span>{(book.title || 'XX').slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="book-info">
                  <h3 className="book-title">{book.title}</h3>
                  <p className="book-author">{book.author}</p>
                  <p className="book-year">{book.type || book.resource_type || 'Resource'}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexDirection: 'column' }}>
                  <button className="listing-btn"
                    disabled={downloading[book.id]}
                    onClick={() => handleDownload(book.id, book.title)}>
                    {downloading[book.id] ? '…' : <><Download size={14} style={{ display: 'inline', marginRight: '4px' }} /> Download</>}
                  </button>
                  {canManage && (
                    <button
                      style={{ background: 'none', border: 'none', color: 'var(--clr-danger, #ef4444)',
                               cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      disabled={deleting[book.id]}
                      onClick={() => handleDelete(book.id, book.title)}>
                      {deleting[book.id] ? '…' : <><Trash2 size={14} /> Remove</>}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </StateContainer>

      {/* Upload / Add Modal */}
      {modal && (
        <div className="modal-overlay" role="dialog" aria-modal="true"
             onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>{canManage ? 'Add Library Resource' : 'Upload Resource'}</h2>
              <button className="modal-close" onClick={() => setModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleUpload} className="sell-form">
              <label>
                Title *
                <input required value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Computer Networks — Tanenbaum" />
              </label>
              <label>
                Author
                <input value={form.author}
                  onChange={e => setForm(p => ({ ...p, author: e.target.value }))}
                  placeholder="e.g. Andrew S. Tanenbaum" />
              </label>
              <label>
                Subject *
                <input required value={form.subject}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder="e.g. Computer Networks" />
              </label>
              <label>
                Type
                <select value={form.resource_type}
                  onChange={e => setForm(p => ({ ...p, resource_type: e.target.value }))}>
                  {RES_TYPES.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
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
                  Your upload will be visible after professor approval.
                </p>
              )}
              <button type="submit" className="action-btn" style={{ width: '100%' }}
                disabled={uploading}>
                {uploading ? 'Uploading…' : canManage ? 'Add to Library' : 'Submit for Review'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
