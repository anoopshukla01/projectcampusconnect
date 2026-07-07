import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './Attendance.css';

function getSubjectsForBranch(branch) {
  const b = (branch || '').toLowerCase();
  if (b.includes('communication') || b.includes('electronics')) return [
    { name: 'Signals & Systems',         code: 'EC3021', attended: 28, total: 30, pct: 93 },
    { name: 'VLSI Design',               code: 'EC3031', attended: 23, total: 25, pct: 92 },
    { name: 'VLSI Design Lab',           code: 'EC3032', attended: 10, total: 10, pct: 100 },
    { name: 'Electromagnetic Waves',     code: 'EC3041', attended: 21, total: 24, pct: 87 },
    { name: 'Digital Signal Processing', code: 'EC3051', attended: 23, total: 25, pct: 92 },
    { name: 'DSP & Systems Lab',         code: 'EC3052', attended:  9, total: 10, pct: 90  },
  ];
  if (b.includes('mechanical')) return [
    { name: 'Thermodynamics',         code: 'ME3011', attended: 22, total: 27, pct: 81 },
    { name: 'Fluid Mechanics',        code: 'ME3021', attended: 20, total: 25, pct: 80 },
    { name: 'Fluid Mechanics Lab',    code: 'ME3022', attended:  9, total: 10, pct: 90 },
    { name: 'Kinematics of Machines', code: 'ME3031', attended: 23, total: 30, pct: 76 },
    { name: 'Material Science',       code: 'ME3041', attended: 24, total: 30, pct: 80 },
    { name: 'Machine Shop Practice',  code: 'ME3032', attended:  8, total: 10, pct: 80 },
  ];
  return [
    { name: 'Computer networks',     code: 'CS3081', attended: 26, total: 30, pct: 86  },
    { name: 'Software engineering',  code: 'CS3041', attended: 23, total: 26, pct: 88  },
    { name: 'Database systems',      code: 'CS3051', attended: 21, total: 28, pct: 75  },
    { name: 'Network & SE Lab',      code: 'CS3082', attended: 10, total: 10, pct: 100 },
    { name: 'Theory of computation', code: 'CS3061', attended: 24, total: 25, pct: 96  },
    { name: 'DBMS & Projects Lab',   code: 'CS3052', attended:  8, total: 10, pct: 80  },
  ];
}

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

const PROF_ROSTER = [
  { roll: 'CS21B1042', name: 'Ananya Sharma', present: true },
  { roll: 'CS21B1087', name: 'Rahul Mehta', present: true },
  { roll: 'CS21B1055', name: 'Sneha Roy', present: false },
  { roll: 'CS21B1020', name: 'Arvind Swamy', present: true },
  { roll: 'CS21B1099', name: 'Kirti Sen', present: true }
];

export default function Attendance() {
  const { user }  = useAuth();
  const showToast = useToast();
  const isProf = user?.role === 'professor';

  // Student specific logic
  const subjects  = useMemo(() => getSubjectsForBranch(user?.branch), [user]);
  const totalAttended = subjects.reduce((s, x) => s + x.attended, 0);
  const totalClasses  = subjects.reduce((s, x) => s + x.total, 0);
  const overallPct    = Math.round((totalAttended / totalClasses) * 100);

  const [calcSub,  setCalcSub]  = useState(subjects[0]?.code || '');
  const [calcResult, setCalcResult] = useState(null);

  // Professor specific logic
  const [selectedClass, setSelectedClass] = useState('CS3081');
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState(PROF_ROSTER);

  function bunkOne() {
    const sub = subjects.find(s => s.code === calcSub);
    if (!sub) return;
    const newPct = Math.round((sub.attended / (sub.total + 1)) * 100);
    if (newPct >= 75) {
      setCalcResult({ ok: true, text: `Yes! Bunking drops from ${sub.pct}% → ${newPct}%, which is still safe.` });
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
      setCalcResult({ ok: true, text: `You can skip up to ${max} class(es). Attendance → ${Math.round((sub.attended / (sub.total + max)) * 100)}%.` });
    } else {
      const needed = Math.ceil(0.75 * sub.total - sub.attended);
      setCalcResult({ ok: false, text: `Can't skip any. Attend ${needed} more to reach 75%.` });
    }
    showToast('Max bunk calculated', 'info', 1200);
  }

  function toggleAttendance(roll) {
    setStudents(prev => prev.map(s => s.roll === roll ? { ...s, present: !s.present } : s));
  }

  function saveAttendance() {
    showToast('Attendance recorded and sync’d with student dashboards! 📝', 'success', 3000);
  }

  if (isProf) {
    const classes = user?.classes || [];
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Attendance Portal</h1>
            <p className="page-sub">Mark daily attendance for your active classes</p>
          </div>
        </div>

        <div className="roster-controls">
          <select
            className="class-selector"
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
          >
            {classes.map(c => (
              <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>

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

        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Active Student Roster – {selectedClass}</h2>
          </div>
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
                {students.map(s => (
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
        </section>
      </>
    );
  }

  // Student view
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-sub">{user?.branch} · Semester {user?.semester}</p>
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
          <p style={{ fontSize:'0.8rem', color:'var(--clr-muted)', marginBottom:'0.75rem' }}>Check if you can safely skip a class.</p>
          <label htmlFor="calcSubjectSelect" style={{ fontSize:'0.82rem', fontWeight:600, marginBottom:'0.35rem', display:'block' }}>Select subject</label>
          <select id="calcSubjectSelect" className="calc-select" value={calcSub} onChange={e => { setCalcSub(e.target.value); setCalcResult(null); }}>
            {subjects.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
          </select>
          <div className="calc-btns">
            <button className="calc-btn action-btn" onClick={bunkOne}>Can I bunk next?</button>
            <button className="calc-btn btn-secondary" onClick={bunkMax}>Max I can bunk</button>
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
                  <tr key={sub.code}>
                    <td className="subject-name-cell">{sub.name}</td>
                    <td className="code-cell"><code>{sub.code}</code></td>
                    <td>{sub.attended}</td>
                    <td>{sub.total}</td>
                    <td>
                      <div className="bar-wrap">
                        <div className="bar-fill" style={{ width: `${sub.pct}%`, background: status === 'safe' ? 'var(--clr-success)' : status === 'warning' ? 'var(--clr-warning)' : 'var(--clr-danger)' }} />
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
    </>
  );
}
