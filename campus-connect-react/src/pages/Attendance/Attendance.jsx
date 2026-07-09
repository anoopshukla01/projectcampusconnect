/**
 * Attendance — Student & Professor Portal
 *
 * Student: reads own attendance per subject; bunk calculator.
 * Professor: loads live roster via /academics/roster, marks attendance
 *            per subject/session, saves via /academics/attendance/mark.
 *
 * Role sourced from AuthContext (JWT) — never from form input.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { academicsApi } from '../../services/api';
import { StateContainer } from '../../components/StateContainer';
import './Attendance.css';

function CircleProgress({ pct }) {
  const stroke = pct < 75 ? 'var(--clr-danger)' : pct < 80 ? 'var(--clr-warning)' : 'var(--clr-primary)';
  return (
    <svg viewBox="0 0 36 36" className="circle-svg" aria-hidden="true">
      <path d="M18 2a16 16 0 0 1 0 32 16 16 0 0 1 0-32"
            fill="none" stroke="var(--clr-border)" strokeWidth="3.8"/>
      <path d="M18 2a16 16 0 0 1 0 32 16 16 0 0 1 0-32"
            fill="none" stroke={stroke} strokeWidth="3.8"
            strokeDasharray={`${pct}, 100`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.7s ease' }}/>
    </svg>
  );
}

export default function Attendance() {
  const { user, isProfessor } = useAuth();
  const showToast = useToast();

  // ── Student data ───────────────────────────────────────────────────────────
  const { data: apiData, loading, error, isEmpty } = useApiData(
    '/academics/attendance',
    { subjects: [] },
  );
  const subjects = useMemo(() => apiData?.subjects || [], [apiData]);
  const totalAttended = subjects.reduce((s, x) => s + (x.attended || 0), 0);
  const totalClasses  = subjects.reduce((s, x) => s + (x.total   || 0), 0);
  const overallPct    = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;

  const [calcSub, setCalcSub]       = useState('');
  const [calcResult, setCalcResult] = useState(null);

  function bunkOne() {
    const sub = subjects.find(s => s.code === calcSub);
    if (!sub) return;
    const newPct = Math.round((sub.attended / (sub.total + 1)) * 100);
    setCalcResult(newPct >= 75
      ? { ok: true,  text: `Yes! Drops from ${sub.pct}% → ${newPct}% — still safe.` }
      : { ok: false, text: `No! Would drop to ${newPct}%, below 75% threshold.` });
  }

  function bunkMax() {
    const sub = subjects.find(s => s.code === calcSub);
    if (!sub) return;
    let max = 0;
    while (Math.round((sub.attended / (sub.total + max + 1)) * 100) >= 75) max++;
    if (max > 0) {
      setCalcResult({ ok: true, text: `Can skip up to ${max} class(es). → ${Math.round((sub.attended / (sub.total + max)) * 100)}%.` });
    } else {
      const needed = Math.ceil(0.75 * sub.total - sub.attended);
      setCalcResult({ ok: false, text: `Can't skip any. Attend ${needed} more to reach 75%.` });
    }
  }

  // ── Professor: roster state ────────────────────────────────────────────────
  const [branch,   setBranch]   = useState('');
  const [semester, setSemester] = useState('');
  const [subject,  setSubject]  = useState('');
  const [subCode,  setSubCode]  = useState('');

  // Build roster endpoint with current filters
  const rosterEndpoint = useMemo(() => {
    if (!isProfessor) return null;
    const params = new URLSearchParams();
    if (branch)   params.set('branch',   branch);
    if (semester) params.set('semester', semester);
    const qs = params.toString();
    return qs ? `/academics/roster?${qs}` : '/academics/roster';
  }, [isProfessor, branch, semester]);

  const { data: rosterData, loading: rosterLoading, refetch: refetchRoster } = useApiData(
    rosterEndpoint,
    { students: [] },
  );
  const roster = useMemo(() => rosterData?.students || [], [rosterData]);

  // Local present/absent toggles keyed by roll_no
  const [present, setPresent] = useState({});

  const togglePresent = useCallback((roll) => {
    setPresent(prev => ({ ...prev, [roll]: !(prev[roll] ?? true) }));
  }, []);

  // Reset toggles when roster changes
  useEffect(() => { setPresent({}); }, [roster]);

  const [saving, setSaving] = useState(false);

  async function saveAttendance() {
    if (!subject || !subCode) {
      showToast('Enter subject name and code before saving.', 'info');
      return;
    }
    const presentRolls = roster
      .filter(s => present[s.roll_no] !== false)   // default = present
      .map(s => s.roll_no);

    setSaving(true);
    const res = await academicsApi.markAttendance({
      subject_name:    subject,
      subject_code:    subCode,
      branch:          branch  || undefined,
      semester:        semester ? Number(semester) : undefined,
      present_roll_nos: presentRolls,
    });
    setSaving(false);

    if (res?.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Attendance saved for ${roster.length} students. ✅`, 'success', 3000);
      refetchRoster();
    }
  }

  // ── Professor render ───────────────────────────────────────────────────────
  if (isProfessor) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Attendance Portal</h1>
            <p className="page-sub">Mark daily attendance for your active classes</p>
          </div>
        </div>

        {/* Controls */}
        <div className="roster-controls" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <input className="class-selector" placeholder="Branch (e.g. CSE)"
            value={branch} onChange={e => setBranch(e.target.value)} style={{ width: '120px' }} />
          <select className="class-selector" value={semester}
            onChange={e => setSemester(e.target.value)}>
            <option value="">All Sems</option>
            {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
          </select>
          <input className="class-selector" placeholder="Subject name"
            value={subject} onChange={e => setSubject(e.target.value)} style={{ flex: 1, minWidth: '140px' }} />
          <input className="class-selector" placeholder="Subject code"
            value={subCode} onChange={e => setSubCode(e.target.value)} style={{ width: '110px' }} />
          <button className="action-btn" onClick={refetchRoster}>
            Load Roster
          </button>
          <button className="action-btn" onClick={saveAttendance} disabled={saving || roster.length === 0}>
            {saving ? 'Saving…' : '💾 Save Attendance'}
          </button>
        </div>

        <section className="panel" aria-labelledby="rosterTitle">
          <div className="panel-header">
            <h2 className="panel-title" id="rosterTitle">
              Active Student Roster
              {branch ? ` — ${branch}` : ''}
              {semester ? ` · Sem ${semester}` : ''}
            </h2>
          </div>

          {rosterLoading ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--clr-muted)' }}>Loading roster…</p>
          ) : roster.length === 0 ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--clr-muted)' }}>
              No students found. Set branch/semester and click Load Roster.
            </p>
          ) : (
            <div className="attend-table-wrap">
              <table className="attend-table">
                <thead>
                  <tr><th>Roll No</th><th>Student Name</th><th>CGPA</th><th>Status</th><th>Toggle</th></tr>
                </thead>
                <tbody>
                  {roster.map(s => {
                    const isPresent = present[s.roll_no] !== false;
                    return (
                      <tr key={s.roll_no}>
                        <td><code>{s.roll_no}</code></td>
                        <td className="subject-name-cell">{s.name}</td>
                        <td>{s.cgpa ?? '—'}</td>
                        <td>
                          <span className={`status-pill ${isPresent ? 'safe' : 'critical'}`}>
                            {isPresent ? 'Present' : 'Absent'}
                          </span>
                        </td>
                        <td>
                          <button
                            className={`action-btn ${isPresent ? 'btn-secondary' : ''}`}
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                            onClick={() => togglePresent(s.roll_no)}>
                            Mark {isPresent ? 'Absent' : 'Present'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
    );
  }

  // ── Student render ─────────────────────────────────────────────────────────
  return (
    <StateContainer loading={loading} error={error} isEmpty={isEmpty}
      emptyMessage="Attendance tracking hasn't started yet. Check back once your classes begin.">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-sub">{user?.branch || 'General'} · Semester {user?.semester || 1}</p>
        </div>
      </div>

      <div className="attend-top-row">
        {/* Circle Summary */}
        <section className="panel summary-card" aria-labelledby="summaryTitle">
          <div className="circle-wrap">
            <CircleProgress pct={overallPct} />
            <div className="circle-center">
              <span className="circle-pct" id="summaryPctText">{overallPct}%</span>
              <span className="circle-label">overall</span>
            </div>
          </div>
          <div className="summary-info">
            <h2 className="summary-title" id="summaryTitle">Overall Attendance</h2>
            <p className={`summary-sub${overallPct < 75 ? ' danger-alert' : ''}`}>
              {overallPct >= 75
                ? `Safe · ${overallPct - 75}% above the 75% minimum`
                : `Critical! Below 75%. Attend ${Math.ceil(0.75 * totalClasses - totalAttended)} more.`}
            </p>
            <p className="summary-detail">{totalAttended} / {totalClasses} classes attended</p>
          </div>
        </section>

        {/* Bunk Calculator */}
        <section className="panel calc-card" aria-labelledby="calcTitle">
          <h2 className="panel-title" id="calcTitle">🧮 Bunk Calculator</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--clr-muted)', marginBottom: '0.75rem' }}>
            Check if you can safely skip a class.
          </p>
          <label htmlFor="calcSubjectSelect"
            style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>
            Select subject
          </label>
          <select id="calcSubjectSelect" className="calc-select" value={calcSub}
            onChange={e => { setCalcSub(e.target.value); setCalcResult(null); }}>
            <option value="">— Pick a subject —</option>
            {subjects.map(s => (
              <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
            ))}
          </select>
          <div className="calc-btns">
            <button className="calc-btn action-btn" onClick={bunkOne} disabled={!calcSub}>Can I bunk next?</button>
            <button className="calc-btn btn-secondary" onClick={bunkMax} disabled={!calcSub}>Max I can bunk</button>
          </div>
          {calcResult && (
            <div className={`calc-result${calcResult.ok ? ' ok' : ' no'}`} role="status" aria-live="polite">
              {calcResult.text}
            </div>
          )}
        </section>
      </div>

      {/* Subject Table */}
      <section className="panel" aria-labelledby="subjectTableTitle">
        <div className="panel-header">
          <h2 className="panel-title" id="subjectTableTitle">Subject-wise Breakdown</h2>
        </div>
        <div className="attend-table-wrap">
          <table className="attend-table" role="table">
            <thead>
              <tr>
                <th>Subject</th><th>Code</th><th>Attended</th>
                <th>Total</th><th>Percentage</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(sub => {
                const status = sub.pct >= 85 ? 'safe' : sub.pct >= 75 ? 'warning' : 'critical';
                const label  = sub.pct >= 85 ? 'Safe' : sub.pct >= 75 ? 'Low' : 'Critical';
                return (
                  <tr key={sub.code || sub.id}>
                    <td className="subject-name-cell">{sub.name}</td>
                    <td className="code-cell"><code>{sub.code}</code></td>
                    <td>{sub.attended}</td>
                    <td>{sub.total}</td>
                    <td>
                      <div className="bar-wrap">
                        <div className="bar-fill" style={{
                          width: `${sub.pct}%`,
                          background: status === 'safe' ? 'var(--clr-success)'
                                    : status === 'warning' ? 'var(--clr-warning)'
                                    : 'var(--clr-danger)',
                        }}/>
                        <span className="bar-pct">{sub.pct}%</span>
                      </div>
                    </td>
                    <td><span className={`status-pill ${status}`}>{label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </StateContainer>
  );
}
