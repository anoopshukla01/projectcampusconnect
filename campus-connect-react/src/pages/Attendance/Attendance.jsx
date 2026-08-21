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
import { Save, Calculator } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { academicsApi } from '../../services/api';
import { StateContainer } from '../../components/StateContainer';
import GeofenceRadar from '../../components/Attendance/GeofenceRadar';
import LivePresenceStream from '../../components/Attendance/LivePresenceStream';
import StudentAttendanceDashboard from '../../components/student/attendance/StudentAttendanceDashboard';
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
  const { data: apiData, loading, error, isEmpty, refetch: refetchAttendance } = useApiData(
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
      const needed = Math.ceil((0.75 * sub.total - sub.attended) / 0.25);
      setCalcResult({ ok: false, text: `Can't skip any. Attend ${needed} more to reach 75%.` });
    }
  }

  // ── Professor: active class & roster state ──────────────────────────────────
  const [activeClassData, setActiveClassData] = useState(null);
  const [activeClassLoading, setActiveClassLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState(null);

  // Fetch active class on mount / when professor view active
  const fetchActiveClass = useCallback(() => {
    if (!isProfessor) return;
    setActiveClassLoading(true);
    academicsApi.getActiveClass()
      .then(res => {
        setActiveClassData(res);
        if (res?.active && res?.class?.slot_id) {
          setSelectedSlotId(res.class.slot_id);
        } else if (!res?.active && res?.reason === 'ambiguous' && res?.candidates?.length > 0) {
          setSelectedSlotId(res.candidates[0].slot_id);
        } else {
          setSelectedSlotId(null);
        }
      })
      .catch(() => {
        setActiveClassData({ active: false, reason: 'no_class_now' });
        setSelectedSlotId(null);
      })
      .finally(() => setActiveClassLoading(false));
  }, [isProfessor]);

  useEffect(() => {
    fetchActiveClass();
  }, [fetchActiveClass]);

  // Build roster endpoint with active slot_id
  const rosterEndpoint = useMemo(() => {
    if (!isProfessor) return null;
    if (!activeClassData) return null;
    if (!activeClassData.active && activeClassData.reason !== 'ambiguous') return null;
    return selectedSlotId ? `/academics/roster?slot_id=${selectedSlotId}` : '/academics/roster';
  }, [isProfessor, activeClassData, selectedSlotId]);

  const { data: rosterData, loading: rosterLoading, refetch: refetchRoster } = useApiData(
    rosterEndpoint,
    { students: [] },
  );
  const roster = useMemo(() => rosterData?.students || [], [rosterData]);
  const currentActiveClass = useMemo(() => rosterData?.active_class || activeClassData?.class, [rosterData, activeClassData]);

  // Local present/absent toggles keyed by roll_no
  const [present, setPresent] = useState({});

  const togglePresent = useCallback((roll) => {
    setPresent(prev => ({ ...prev, [roll]: !(prev[roll] ?? true) }));
  }, []);

  // Reset toggles when roster changes
  useEffect(() => { setPresent({}); }, [roster]);

  const [saving, setSaving] = useState(false);

  async function saveAttendance() {
    const presentRolls = roster
      .filter(s => present[s.roll_no] !== false)   // default = present
      .map(s => s.roll_no);

    setSaving(true);
    const res = await academicsApi.markAttendance({
      slot_id: selectedSlotId || undefined,
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
    const isNoClassNow = activeClassData && !activeClassData.active && activeClassData.reason === 'no_class_now';
    const isAmbiguous  = activeClassData && !activeClassData.active && activeClassData.reason === 'ambiguous';
    const activeClass  = currentActiveClass || (isAmbiguous && activeClassData.candidates ? activeClassData.candidates.find(c => c.slot_id === selectedSlotId) : null);

    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Attendance Portal</h1>
            <p className="page-sub">Mark daily attendance for your active classes</p>
          </div>
        </div>

        {activeClassLoading ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--clr-muted)' }}>Checking scheduled active classes…</p>
        ) : isNoClassNow ? (
          <div className="dash-card" style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: 'var(--clr-text)',
            padding: '1.5rem',
            borderRadius: '10px',
            marginBottom: '1.5rem',
          }}>
            <h3 style={{ color: '#ef4444', margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 600 }}>
              No Scheduled Class Active
            </h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--clr-muted)' }}>
              You have no class scheduled right now. Attendance can only be marked during your scheduled class window (including 15 min early and 2 hr grace period).
            </p>
          </div>
        ) : isAmbiguous ? (
          <div className="dash-card" style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            padding: '1.25rem',
            borderRadius: '10px',
            marginBottom: '1.5rem',
          }}>
            <h3 style={{ color: '#f59e0b', margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 600 }}>
              Multiple Active Classes Detected
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--clr-muted)' }}>
              Please select which class you are currently teaching:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {activeClassData.candidates.map(c => (
                <label key={c.slot_id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="active_slot_choice"
                    value={c.slot_id}
                    checked={selectedSlotId === c.slot_id}
                    onChange={() => setSelectedSlotId(c.slot_id)}
                  />
                  <span>
                    <strong>{c.course_name} ({c.course_code})</strong> — {c.branch}, Sem {c.semester} · {c.time_slot} (Room {c.room})
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {activeClass && (
          <div className="dash-card" style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            padding: '1rem 1.25rem',
            borderRadius: '10px',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--clr-primary)', fontWeight: 700, display: 'block' }}>
                Active Class Session
              </span>
              <strong style={{ fontSize: '1.1rem' }}>{activeClass.course_name} ({activeClass.course_code})</strong>
              <span style={{ color: 'var(--clr-muted)', marginLeft: '0.5rem', fontSize: '0.9rem' }}>
                — {activeClass.branch}, Sem {activeClass.semester} · {activeClass.time_slot} (Room {activeClass.room})
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="action-btn" onClick={refetchRoster} disabled={rosterLoading}>
                {rosterLoading ? 'Loading…' : 'Load Roster'}
              </button>
              <button className="action-btn" onClick={saveAttendance} disabled={saving || roster.length === 0}>
                {saving ? 'Saving…' : <><Save size={14} style={{ display: 'inline', marginRight: '4px' }} /> Save Attendance</>}
              </button>
            </div>
          </div>
        )}

        {activeClass && (
          <LivePresenceStream
            activeCourse={activeClass}
            activeRoom={activeClass.room || 'Room 302'}
            slotId={selectedSlotId}
            onSessionFinalized={refetchRoster}
          />
        )}

        {activeClass && (
          <section className="panel" aria-labelledby="rosterTitle">
            <div className="panel-header">
              <h2 className="panel-title" id="rosterTitle">
                Active Student Roster — {activeClass.course_name} ({activeClass.branch}, Sem {activeClass.semester})
              </h2>
            </div>

            {rosterLoading ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--clr-muted)' }}>Loading roster…</p>
            ) : roster.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--clr-muted)' }}>
                No students enrolled in this branch and semester.
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
        )}
      </>
    );
  }

  // ── Student render ─────────────────────────────────────────────────────────
  return (
    <div className="attendance-page-wrap">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Attendance & Presence Analytics</h1>
          <p className="page-sub">{user?.branch || 'General'} · Semester {user?.semester || 1} · Continuous GPS Dwell Tracker</p>
        </div>
      </div>

      <StudentAttendanceDashboard />
    </div>
  );
}
