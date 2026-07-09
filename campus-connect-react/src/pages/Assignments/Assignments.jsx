/**
 * Assignments — Student & Professor Portal
 *
 * Student: fetches assignments for their branch, submits via API.
 * Professor: fetches their assignments, loads submissions per assignment,
 *            grades/gives feedback via API.
 *
 * Role sourced from AuthContext (JWT) — never from form input.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { academicsApi } from '../../services/api';
import { StateContainer } from '../../components/StateContainer';
import './Assignments.css';

const FILTERS = ['all', 'pending', 'submitted', 'graded'];

// ── Shared upload icon ─────────────────────────────────────────────────────
const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

export default function Assignments() {
  const { user, isProfessor } = useAuth();
  const showToast = useToast();

  // ── Shared: fetch assignments (role-scoped server-side) ────────────────────
  const { data: apiData, loading, error, isEmpty, refetch, setData } = useApiData(
    '/academics/assignments',
    { assignments: [] },
  );
  const assignments = useMemo(() => apiData?.assignments || [], [apiData]);

  // ── Student state ──────────────────────────────────────────────────────────
  const [filter,   setFilter]   = useState('all');
  const [selected, setSelected] = useState(null);
  const [dragover, setDragover] = useState(false);
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() =>
    filter === 'all' ? assignments : assignments.filter(a => a.status === filter),
    [filter, assignments],
  );

  function handleFileChange(files) {
    if (files?.[0]) setFileName(files[0].name);
  }

  async function handleStudentSubmit(e) {
    e.preventDefault();
    if (!selected) return;
    if (!fileName) { showToast('Select a file to submit.', 'info'); return; }
    setSubmitting(true);
    const res = await academicsApi.submitAssignment(selected.id, { file_name: fileName });
    setSubmitting(false);
    if (res?.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Submitted ${fileName} successfully!`, 'success', 3000);
      setFileName('');
      // Optimistic update so UI reflects submitted immediately
      setData(prev => ({
        ...prev,
        assignments: (prev?.assignments || []).map(a =>
          a.id === selected.id ? { ...a, status: 'submitted' } : a,
        ),
      }));
      setSelected(prev => ({ ...prev, status: 'submitted' }));
    }
  }

  // ── Professor state ────────────────────────────────────────────────────────
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions,        setSubmissions]        = useState([]);
  const [subsLoading,        setSubsLoading]        = useState(false);
  const [selectedSub,        setSelectedSub]        = useState(null);
  const [gradeInput,         setGradeInput]         = useState('');
  const [feedbackInput,      setFeedbackInput]      = useState('');
  const [grading,            setGrading]            = useState(false);

  // Professor: create new assignment modal state
  const [createModal, setCreateModal] = useState(false);
  const [creating,    setCreating]    = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', subject: '', branch: '', due_date: '', points: '25 pts',
    description: '',
  });

  // Load submissions when professor selects an assignment
  useEffect(() => {
    if (!selectedAssignment) { setSubmissions([]); return; }
    setSubsLoading(true);
    academicsApi.listSubmissions(selectedAssignment.id)
      .then(res => setSubmissions(res?.submissions || []))
      .finally(() => setSubsLoading(false));
  }, [selectedAssignment]);

  const pendingSubCount = useMemo(
    () => submissions.filter(s => s.status === 'submitted').length,
    [submissions],
  );

  async function handleGradeSubmit(e) {
    e.preventDefault();
    if (!selectedSub || !gradeInput) return;
    setGrading(true);
    const res = await academicsApi.gradeSubmission(selectedSub.id, {
      grade: gradeInput, feedback: feedbackInput,
    });
    setGrading(false);
    if (res?.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Graded ${selectedSub.student_name}!`, 'success', 3000);
      setSubmissions(prev => prev.map(s =>
        s.id === selectedSub.id
          ? { ...s, status: 'graded', grade: gradeInput, feedback: feedbackInput }
          : s,
      ));
      setSelectedSub(prev => ({ ...prev, status: 'graded', grade: gradeInput, feedback: feedbackInput }));
    }
  }

  async function handleCreateAssignment(e) {
    e.preventDefault();
    setCreating(true);
    const res = await academicsApi.createAssignment(createForm);
    setCreating(false);
    if (res?.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Assignment posted.', 'success', 2500);
      setCreateModal(false);
      setCreateForm({ title: '', subject: '', branch: '', due_date: '', points: '25 pts', description: '' });
      refetch();
    }
  }

  // ── Professor render ───────────────────────────────────────────────────────
  if (isProfessor) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Grading Zone</h1>
            <p className="page-sub">
              {selectedAssignment
                ? `${pendingSubCount} submissions pending evaluation`
                : `${assignments.length} assignment(s) posted`}
            </p>
          </div>
          <button className="action-btn" onClick={() => setCreateModal(true)}>
            + New Assignment
          </button>
        </div>

        <div className="assign-layout">
          {/* Left: assignment list */}
          <section className="panel assign-list-panel" aria-label="Assignments">
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--clr-border)',
                          fontSize: '0.78rem', fontWeight: 700, color: 'var(--clr-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Your Assignments
            </div>
            {loading ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--clr-muted)' }}>Loading…</p>
            ) : (
              <ul role="list" style={{ listStyle: 'none' }}>
                {assignments.map(a => (
                  <li key={a.id}>
                    <button
                      className={`assign-card${selectedAssignment?.id === a.id ? ' selected' : ''}`}
                      onClick={() => { setSelectedAssignment(a); setSelectedSub(null); }}>
                      <div className="card-subject-row">
                        <span className="card-subject">{a.subject}</span>
                        <span className="card-pts">{a.submissions ?? 0} subs</span>
                      </div>
                      <span className="card-title">{a.name}</span>
                      <div className="card-due-row">
                        <span className="card-due">{a.branch || 'All branches'}</span>
                        <span className="card-due">Due {a.due}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Middle: submission list */}
          <section className="panel assign-list-panel" aria-label="Submissions">
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--clr-border)',
                          fontSize: '0.78rem', fontWeight: 700, color: 'var(--clr-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Submissions
            </div>
            {!selectedAssignment ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--clr-muted)', fontSize: '0.85rem' }}>
                Select an assignment
              </p>
            ) : subsLoading ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--clr-muted)' }}>Loading…</p>
            ) : (
              <ul role="list" style={{ listStyle: 'none' }}>
                {submissions.length === 0 ? (
                  <li style={{ padding: '2rem', textAlign: 'center', color: 'var(--clr-muted)', fontSize: '0.85rem' }}>
                    No submissions yet.
                  </li>
                ) : submissions.map(sub => (
                  <li key={sub.id}>
                    <button
                      className={`assign-card${selectedSub?.id === sub.id ? ' selected' : ''}`}
                      onClick={() => { setSelectedSub(sub); setGradeInput(sub.grade || ''); setFeedbackInput(sub.feedback || ''); }}>
                      <div className="card-subject-row">
                        <span className="card-subject"><code>{sub.roll_no}</code></span>
                        <span className={`status-badge ${sub.status}`}>{sub.status}</span>
                      </div>
                      <span className="card-title">{sub.student_name}</span>
                      <div className="card-due-row">
                        <span className="card-due">{sub.file_name}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Right: grading panel */}
          <section className="panel assign-detail-panel" aria-label="Evaluate submission">
            {!selectedSub ? (
              <div className="detail-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <p>Select a submission to evaluate</p>
              </div>
            ) : (
              <>
                <div className="detail-header">
                  <span className="detail-subject"><code>{selectedSub.roll_no}</code></span>
                  <span className={`status-badge ${selectedSub.status}`}>{selectedSub.status}</span>
                </div>
                <h2 className="detail-title">{selectedSub.student_name}</h2>
                <p className="detail-points" style={{ color: 'var(--clr-text)' }}>
                  File: {selectedSub.file_name}
                </p>
                {selectedSub.status === 'graded' && (
                  <div className="graded-section" style={{ marginBottom: '1rem' }}>
                    <div className="grade-score">{selectedSub.grade}</div>
                    <p className="grade-feedback">{selectedSub.feedback}</p>
                  </div>
                )}
                <form className="submit-section" onSubmit={handleGradeSubmit}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                    {selectedSub.status === 'graded' ? 'Update Grade' : 'Submit Grade & Feedback'}
                  </h3>
                  <label htmlFor="gradeVal"
                    style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Grade (e.g. 28 / 30)
                  </label>
                  <input id="gradeVal" type="text" required className="calc-select"
                    style={{ marginBottom: '0.75rem' }}
                    value={gradeInput} onChange={e => setGradeInput(e.target.value)}
                    placeholder="e.g. 27 / 30" />
                  <label htmlFor="feedbackText"
                    style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                    Feedback
                  </label>
                  <textarea id="feedbackText" rows="3" className="calc-select"
                    value={feedbackInput} onChange={e => setFeedbackInput(e.target.value)}
                    placeholder="Constructive evaluation notes…"
                    style={{ resize: 'vertical', width: '100%', marginBottom: '1rem' }} />
                  <button type="submit" className="action-btn submit-btn" style={{ width: '100%' }}
                    disabled={grading}>
                    {grading ? 'Saving…' : 'Submit Grade'}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>

        {/* Create Assignment Modal */}
        {createModal && (
          <div className="modal-overlay" role="dialog" aria-modal="true"
               onClick={e => e.target === e.currentTarget && setCreateModal(false)}>
            <div className="modal-box">
              <div className="modal-header">
                <h2>New Assignment</h2>
                <button className="modal-close" onClick={() => setCreateModal(false)}>✕</button>
              </div>
              <form onSubmit={handleCreateAssignment} className="sell-form">
                <label>Title
                  <input required value={createForm.title}
                    onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))} />
                </label>
                <label>Subject
                  <input required value={createForm.subject}
                    onChange={e => setCreateForm(p => ({ ...p, subject: e.target.value }))} />
                </label>
                <label>Branch (optional)
                  <input value={createForm.branch} placeholder="e.g. CSE"
                    onChange={e => setCreateForm(p => ({ ...p, branch: e.target.value }))} />
                </label>
                <label>Due Date
                  <input required type="date" value={createForm.due_date}
                    onChange={e => setCreateForm(p => ({ ...p, due_date: e.target.value }))} />
                </label>
                <label>Points
                  <input value={createForm.points}
                    onChange={e => setCreateForm(p => ({ ...p, points: e.target.value }))} />
                </label>
                <label>Description
                  <textarea rows="3" value={createForm.description}
                    onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                    style={{ resize: 'vertical', width: '100%' }} />
                </label>
                <button type="submit" className="action-btn" style={{ width: '100%' }} disabled={creating}>
                  {creating ? 'Posting…' : 'Post Assignment'}
                </button>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Student render ─────────────────────────────────────────────────────────
  return (
    <StateContainer loading={loading} error={error} isEmpty={isEmpty}
      emptyMessage="No assignments posted yet.">
      <div className="page-header">
        <div>
          <h1 className="page-title">Assignments</h1>
          <p className="page-sub">{assignments.filter(a => a.status === 'pending').length} pending</p>
        </div>
      </div>

      <div className="filter-row">
        {FILTERS.map(f => (
          <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="assign-layout">
        {/* List */}
        <section className="panel assign-list-panel" aria-label="Assignment list">
          <ul role="list" style={{ listStyle: 'none' }}>
            {filtered.length ? filtered.map(a => (
              <li key={a.id || a.name}>
                <button
                  className={`assign-card${selected?.id === a.id ? ' selected' : ''}`}
                  onClick={() => { setSelected(a); setFileName(''); }}>
                  <div className="card-subject-row">
                    <span className="card-subject">{a.subject}</span>
                    <span className={`status-badge ${a.status}`}>{a.status}</span>
                  </div>
                  <span className="card-title">{a.name}</span>
                  <div className="card-due-row">
                    <span className="card-due">{a.due}</span>
                    <span className="card-pts">{a.points}</span>
                  </div>
                </button>
              </li>
            )) : (
              <li style={{ padding: '2rem', textAlign: 'center', color: 'var(--clr-muted)', fontSize: '0.85rem' }}>
                No assignments match this filter.
              </li>
            )}
          </ul>
        </section>

        {/* Detail */}
        <section className="panel assign-detail-panel" aria-label="Assignment details">
          {!selected ? (
            <div className="detail-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <p>Select an assignment to view details</p>
            </div>
          ) : (
            <>
              <div className="detail-header">
                <span className="detail-subject">{selected.subject}</span>
                <span className={`status-badge ${selected.status}`}>{selected.status}</span>
              </div>
              <h2 className="detail-title">{selected.name}</h2>
              <p className="detail-points">{selected.points}</p>
              <p className="detail-instructions">{selected.desc}</p>

              {selected.attachment && (
                <div className="attachment-section">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  <a href="#" onClick={e => { e.preventDefault();
                    showToast(`Downloading ${selected.attachment}…`, 'info', 2000); }}>
                    {selected.attachment}
                  </a>
                </div>
              )}

              {selected.status === 'graded' ? (
                <div className="graded-section">
                  <div className="grade-score">{selected.grade}</div>
                  <p className="grade-feedback">{selected.feedback}</p>
                </div>
              ) : (
                <form className="submit-section" onSubmit={handleStudentSubmit} noValidate>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                    {selected.status === 'submitted' ? 'Resubmit Work' : 'Submit Assignment'}
                  </h3>
                  <div
                    className={`drop-zone${dragover ? ' dragover' : ''}`}
                    role="button" tabIndex="0" aria-label="Upload file"
                    onClick={() => document.getElementById('fileInput').click()}
                    onKeyDown={e => e.key === 'Enter' && document.getElementById('fileInput').click()}
                    onDragOver={e => { e.preventDefault(); setDragover(true); }}
                    onDragLeave={() => setDragover(false)}
                    onDrop={e => { e.preventDefault(); setDragover(false); handleFileChange(e.dataTransfer.files); }}>
                    <UploadIcon />
                    <span>
                      {fileName ? `Selected: ${fileName}`
                        : selected.status === 'submitted'
                        ? 'Drop to replace or click to browse'
                        : 'Drag & drop or click to browse'}
                    </span>
                  </div>
                  <input type="file" id="fileInput" hidden onChange={e => handleFileChange(e.target.files)} />
                  <button type="submit" className="submit-btn action-btn"
                    style={{ width: '100%', marginTop: '0.75rem' }} disabled={submitting}>
                    {submitting ? 'Submitting…'
                      : selected.status === 'submitted' ? 'Resubmit Work' : 'Submit Assignment'}
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </StateContainer>
  );
}
