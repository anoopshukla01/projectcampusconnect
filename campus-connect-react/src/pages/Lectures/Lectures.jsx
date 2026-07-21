/**
 * Lectures — Student & Professor Portal
 *
 * Student:   view recordings scoped to their branch + live syllabus progress.
 * Professor: upload new recording, update syllabus progress %, view own uploads.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Upload, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { careerApi } from '../../services/api';
import { StateContainer } from '../../components/StateContainer';
import './Lectures.css';

export default function Lectures() {
  const { user, isProfessor } = useAuth();
  const showToast = useToast();

  const [filter, setFilter]           = useState('all');
  const [uploadModal, setUploadModal] = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [uploadForm, setUploadForm]   = useState({
    title: '', subject: '', code: '', duration: '', url: '', branch: '',
  });
  const [progressForm, setProgressForm] = useState({});
  const [savingProgress, setSavingProgress] = useState({});

  const { data: apiData, loading, error, isEmpty, refetch } = useApiData(
    '/career/lectures',
    { recordings: [], syllabus: [] },
  );

  const [data, setData] = useState({ recordings: [], syllabus: [] });
  useEffect(() => { if (apiData) setData(apiData); }, [apiData]);

  const filtered = useMemo(() =>
    filter === 'all'
      ? data.recordings
      : data.recordings.filter(r => r.code === filter),
    [data.recordings, filter],
  );

  // ── Upload (professor) ────────────────────────────────────────────────────
  async function handleUpload(e) {
    e.preventDefault();
    if (!uploadForm.title || !uploadForm.subject) {
      showToast('Title and subject are required.', 'error'); return;
    }
    setUploading(true);
    const res = await careerApi.uploadLecture({
      title:   uploadForm.title,
      subject: uploadForm.subject,
      code:    uploadForm.code    || undefined,
      duration:uploadForm.duration|| undefined,
      url:     uploadForm.url     || undefined,
      branch:  uploadForm.branch  || undefined,
    });
    setUploading(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Lecture uploaded!', 'success', 3000);
    setUploadModal(false);
    setUploadForm({ title: '', subject: '', code: '', duration: '', url: '', branch: '' });
    refetch();
  }

  // ── Update syllabus progress (professor) ──────────────────────────────────
  async function handleProgressUpdate(s) {
    const pct = progressForm[s.code];
    if (pct === undefined || pct === '') return;
    setSavingProgress(p => ({ ...p, [s.code]: true }));
    const res = await careerApi.updateSyllabusProgress(s.code, s.name, Number(pct), undefined);
    setSavingProgress(p => ({ ...p, [s.code]: false }));
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(`Progress updated for ${s.name}.`, 'success');
    setProgressForm(p => ({ ...p, [s.code]: '' }));
    refetch();
  }

  return (
    <StateContainer loading={loading} error={error} isEmpty={isEmpty && !isProfessor}
      emptyMessage="No recorded lectures or syllabus progress mapped yet.">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isProfessor ? 'Lecture Management' : 'Lectures'}</h1>
          <p className="page-sub">
            {isProfessor
              ? `${data.recordings.length} recording${data.recordings.length !== 1 ? 's' : ''} · ${data.syllabus.length} courses`
              : 'Recorded lectures & live sessions'}
          </p>
        </div>
        {isProfessor && (
          <button className="action-btn" onClick={() => setUploadModal(true)}>
            <Upload size={14} style={{ display: 'inline', marginRight: '4px' }} /> Upload Recording
          </button>
        )}
      </div>

      {/* Syllabus Progress */}
      {data.syllabus.length > 0 && (
        <section className="panel" aria-labelledby="syllabusTitle">
          <div className="panel-header">
            <h2 className="panel-title" id="syllabusTitle">Syllabus Coverage</h2>
          </div>
          <div className="syllabus-grid">
            {data.syllabus.map(s => (
              <div className="syllabus-card" key={s.code}>
                <span className="syllabus-name">{s.name} ({s.code})</span>
                <div className="syllabus-meta">
                  <span>{s.module}</span>
                  <span style={{ fontWeight: 700 }}>{s.progress}%</span>
                </div>
                <div className="syllabus-bar">
                  <div className="syllabus-bar-fill" style={{ width: `${s.progress}%` }} />
                </div>
                {isProfessor && (
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                    <input
                      type="number" min="0" max="100"
                      placeholder="New %"
                      value={progressForm[s.code] || ''}
                      onChange={e => setProgressForm(p => ({ ...p, [s.code]: e.target.value }))}
                      style={{ flex: 1, padding: '0.3rem 0.5rem', borderRadius: 6,
                               background: 'var(--clr-surface)', border: '1px solid var(--clr-border)',
                               color: 'var(--clr-text)', fontSize: '0.8rem' }} />
                    <button className="action-btn"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                      disabled={savingProgress[s.code]}
                      onClick={() => handleProgressUpdate(s)}>
                      {savingProgress[s.code] ? '…' : 'Update'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recordings */}
      <section className="panel" aria-labelledby="recordingsTitle">
        <div className="panel-header">
          <h2 className="panel-title" id="recordingsTitle">
            {isProfessor ? 'Uploaded Recordings' : 'Recent Materials & Recordings'}
          </h2>
        </div>
        {data.syllabus.length > 0 && (
          <div className="filter-row" style={{ marginBottom: '1rem' }}>
            <button className={`filter-btn${filter === 'all' ? ' active' : ''}`}
              onClick={() => setFilter('all')}>All</button>
            {data.syllabus.map(s => (
              <button key={s.code}
                className={`filter-btn${filter === s.code ? ' active' : ''}`}
                onClick={() => setFilter(s.code)}>
                {s.name}
              </button>
            ))}
          </div>
        )}
        {filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--clr-muted)', padding: '1.5rem 0', fontSize: '0.85rem' }}>
            No recordings yet.
            {isProfessor && ' Upload your first lecture above.'}
          </p>
        ) : (
          <div className="recordings-list">
            {filtered.map(r => (
              <div className="recording-card" key={r.id}>
                <button className="play-btn" aria-label={`Play ${r.title}`}
                  onClick={() => {
                    if (r.url) window.open(r.url, '_blank', 'noopener');
                    else showToast(`Playing: ${r.title}`, 'info', 2000);
                  }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                </button>
                <div className="recording-body">
                  <span className="recording-subject">{r.subject}</span>
                  <h3 className="recording-title">{r.title}</h3>
                  <p className="recording-meta">
                    {r.prof} · {r.date}
                    {r.duration ? ` · ${r.duration}` : ''}
                  </p>
                </div>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer"
                    className="btn-dl" aria-label="Open recording">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upload Modal */}
      {uploadModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true"
             onClick={e => e.target === e.currentTarget && setUploadModal(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>Upload Lecture Recording</h2>
              <button className="modal-close" onClick={() => setUploadModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleUpload} className="sell-form">
              <label>
                Title *
                <input required value={uploadForm.title}
                  onChange={e => setUploadForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Subnetting &amp; Supernetting" />
              </label>
              <label>
                Subject *
                <input required value={uploadForm.subject}
                  onChange={e => setUploadForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder="e.g. Computer Networks" />
              </label>
              <label>
                Course Code
                <input value={uploadForm.code}
                  onChange={e => setUploadForm(p => ({ ...p, code: e.target.value }))}
                  placeholder="e.g. CS3081" />
              </label>
              <label>
                Video URL (YouTube / Drive)
                <input value={uploadForm.url}
                  onChange={e => setUploadForm(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://…" />
              </label>
              <label>
                Duration (optional)
                <input value={uploadForm.duration}
                  onChange={e => setUploadForm(p => ({ ...p, duration: e.target.value }))}
                  placeholder="e.g. 45:30" />
              </label>
              <label>
                Branch (optional — blank = all branches)
                <input value={uploadForm.branch}
                  onChange={e => setUploadForm(p => ({ ...p, branch: e.target.value }))}
                  placeholder="e.g. CSE" />
              </label>
              <button type="submit" className="action-btn" style={{ width: '100%' }}
                disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload Recording'}
              </button>
            </form>
          </div>
        </div>
      )}
    </StateContainer>
  );
}
