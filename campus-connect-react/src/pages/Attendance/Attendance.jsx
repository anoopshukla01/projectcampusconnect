import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { StateContainer } from '../../components/StateContainer';
import './Attendance.css';

function CircleProgress({ pct }) {
  const stroke = pct < 75 ? 'var(--clr-danger)' : pct < 80 ? 'var(--clr-warning)' : 'var(--clr-primary)';
  return (
    <svg viewBox="0 0 36 36" className="circle-svg" aria-hidden="true">
      <path d="M18 2a16 16 0 0 1 0 32 16 16 0 0 1 0-32" fill="none" stroke="var(--clr-border)" strokeWidth="3.8"/>
      <path d="M18 2a16 16 0 0 1 0 32 16 16 0 0 1 0-32" fill="none" stroke={stroke} strokeWidth="3.8"
        strokeDasharray={`${pct}, 100`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.7s ease' }}/>
    </svg>
  );
}

export default function Attendance() {
  const { user }  = useAuth();
  const showToast = useToast();
  const isProf = user?.role === 'professor';

  // ── Student data ───────────────────────────────────────────────────────────
  const { data: apiData, loading, error, isEmpty } = useApiData(
    '/api/v1/academics/attendance',
    { subjects: [] }
  );

  const subjects = useMemo(() => apiData?.subjects || [], [apiData]);
  const totalAttended = subjects.reduce((s, x) => s + (x.attended || 0), 0);
  const totalClasses  = subjects.reduce((s, x) => s + (x.total || 0), 0);
  const overallPct    = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;

  const [calcSub,    setCalcSub]    = useState('');
  const [calcResult, setCalcResult] = useState(null);

  function bunkOne() {
    const sub = subjects.find(s => s.code === calcSub);
    if (!sub) return;
    const newPct = Math.round((sub.attended / (sub.total + 1)) * 100);
    if (newPct >= 75) {
      setCalcResult({ ok: true,  text: `Yes! Bunking drops from ${sub.pct}% → ${newPct}%, which is still safe.` });
    } else {
      setCalcResult({ ok: false, text: `No! Bunking would drop to ${newPct}%, below the 75% threshold.` });
    }
    showToast('Bunk check done', 'info', 1200);
  }

  function bunkMax() {
    const sub = subjects.find(s => s.code === calcSub);
    if (!sub) return;
    let max = 0;
    while (Math.round((sub.attended / (sub.total + max + 1)) * 100) >= 75) max++;
    if (max > 0) {
      setCalcResult({ ok: true,  text: `You can skip up to ${max} class(es). Attendance → ${Math.round((sub.attended / (sub.total + max)) * 100)}%.` });
    } else {
      const needed = Math.ceil(0.75 * sub.total - sub.attended);
      setCalcResult({ ok: false, text: `Can't skip any. Attend ${needed} more to reach 75%.` });
    }
    showToast('Max bunk calculated', 'info', 1200);
  }

  // ── Professor view ─────────────────────────────────────────────────────────
  const {
    data: profData,
    loading: profLoading,
    error: profError
  } = useApiData(
    isProf ? '/api/v1/professors/attendance' : null,
    { roster: [], classes: [] }
  );

  const [selectedClass,   setSelectedClass]   = useState('');
  const [attendanceDate,  setAttendanceDate]   = useState(() => new Date().toISOString().split('T')[0]);
  const [rosterState,     setRosterState]      = useState({});  // roll → boolean

  const profClasses = useMemo(() => profData?.classes || user?.classes || [], [profData, user]);
  const profRoster  = useMemo(() => {
    const base = profData?.roster || [];
    // merge server-side data with local toggle state
    return base.map(s => ({ ...s, present: rosterState[s.roll] ?? s.present ?? true }));
  }, [profData, rosterState]);

  function toggleAttendance(roll) {
    setRosterState(prev => ({ ...prev, [roll]: !(prev[roll] ?? true) }));
  }

  function saveAttendance() {
    showToast("Attendance recorded and synced with student dashboards! 📝", 'success', 3000);
  }

  if (isProf) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Attendance Portal</h1>
            <p className="page-sub">Mark daily attendance for your active classes</p>
          </div>
        </div>

        <div className="roster-controls">
          {profClasses.length > 0 ? (
            <select
              className="class-selector"
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
            >
              <option value="">— Select class —</option>
              {profClasses.map(c => (
                <option key={c.code || c} value={c.code || c}>
                  {c.name ? `${c.name} (${c.code})` : c}
                </option>
              ))}
            </select>
          ) : (
            <p style={{ color: 'var(--clr-muted)', fontSize: '0.875rem' }}>
              No classes assigned yet.
            </p>
          )}

          <input
            type="date"
            className="class-selector"
            style={{ padding: '0.5rem 0.75rem' }}
            value={attendanceDate}
            onChange={e => setAttendanceDate(e.target.value)}
          />

          <button className="action-btn" onClick={saveAttendance}>
            💾 Save Attendance
          </button>
        </div>

        <section className="panel" aria-labelledby="rosterTitle">
          <div className="panel-header">
            <h2 className="panel-title" id="rosterTitle">
              Active Student Roster{selectedClass ? ` – ${selectedClass}` : ''}
            </h2>
          </div>

          {profLoading ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--clr-muted)' }}>Loading roster…</p>
          ) : profError ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--clr-danger)' }}>
              Couldn't load roster. Is the backend running?
            </p>
          ) : profRoster.length === 0 ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--clr-muted)' }}>
              No students found for this class. Students will appear once enrolled.
            </p>
          ) : (
            <div className="attend-table-wrap">
              <table className="attend-table">
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Student Name</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {profRoster.map(s => (
                    <tr key={s.roll}>
                      <td><code>{s.roll}</code></td>
                      <td className="subject-name-cell">{s.name}</td>
                      <td>
                        <span className={`status-pill ${s.present ? 'safe' : 'critical'}`}>
                          {s.present ? 'Present' : 'Absent'}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`action-btn ${s.present ? 'btn-secondary' : ''}`}
                          style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                          onClick={() => toggleAttendance(s.roll)}
                        >
                          Mark {s.present ? 'Absent' : 'Present'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>
    );
  }

  // ── Student view ───────────────────────────────────────────────────────────
  return (
    <StateContainer loading={loading} error={error} isEmpty={isEmpty} emptyMessage="Attendance tracking hasn't started yet. Check back once your classes begin.">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-sub">{user?.branch || 'General'} · Semester {user?.semester || 1}</p>
        </div>
      </div>

      {/* Summary row */}
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
            <p className={`summary-sub${overallPct < 75 ? ' danger-alert' : ''}`} id="summarySubText">
              {overallPct >= 75
                ? `Safe · ${overallPct - 75}% above the 75% minimum`
                : `Critical! Below 75%. Attend ${Math.ceil(0.75 * totalClasses - totalAttended)} classes to recover.`}
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
          <label htmlFor="calcSubjectSelect" style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>
            Select subject
          </label>
          <select
            id="calcSubjectSelect"
            className="calc-select"
            value={calcSub}
            onChange={e => { setCalcSub(e.target.value); setCalcResult(null); }}
          >
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
                <th>Subject</th>
                <th>Code</th>
                <th>Attended</th>
                <th>Total</th>
                <th>Percentage</th>
                <th>Status</th>
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
                          background: status === 'safe' ? 'var(--clr-success)' : status === 'warning' ? 'var(--clr-warning)' : 'var(--clr-danger)'
                        }} />
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
