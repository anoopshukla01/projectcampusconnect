import { X } from "lucide-react";
/**
 * Professor Timetable Portal
 *
 * Fetches only the professor's own slots from the backend.
 * Provides full CRUD: create slot, edit/reschedule, delete, add extra class.
 *
 * SECURITY:
 * - Uses /academics/timetable/professor (professor-scoped endpoint)
 * - Create slot course_code dropdown is populated from /professors/me/classes
 *   (no free-text — must be an assigned course to prevent data injection)
 * - 409 conflict returns free-slot list shown inline in the modal
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@ctx/AuthContext';
import { useToast } from '@ctx/ToastContext';
import { useApiData } from '@/hooks/useApiData';
import { academicsApi } from '@/services/api';
import { StateContainer } from '@/components/StateContainer';
import './Timetable.css';

const WEEK_DAYS = [
  { key: 'Mon', label: 'Monday',    sub: 'Day 1' },
  { key: 'Tue', label: 'Tuesday',   sub: 'Day 2' },
  { key: 'Wed', label: 'Wednesday', sub: 'Day 3' },
  { key: 'Thu', label: 'Thursday',  sub: 'Day 4' },
  { key: 'Fri', label: 'Friday',    sub: 'Day 5' },
  { key: 'Sat', label: 'Saturday',  sub: 'Extra' },
];

const EMPTY_TT = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
const SLOT_TYPES = ['lecture', 'lab', 'seminar', 'extra'];

let API_BASE = import.meta.env.VITE_API_BASE_URL || '';
if (API_BASE.includes('campusconnect-backend.onrender.com') || import.meta.env.PROD) {
  API_BASE = '';
}
if (!API_BASE) {
  API_BASE = '/api/v1';
}
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('access_token');
  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

export default function Timetable() {
  const { user } = useAuth();
  const showToast = useToast();

  const [filter, setFilter]       = useState('all');
  const [mobileDay, setMobileDay] = useState('Mon');

  // Use professor-specific timetable endpoint
  const { data: apiData, loading, error, refetch } = useApiData(
    '/academics/timetable/professor',
    { timetable: EMPTY_TT },
  );

  // Load assigned classes for the course_code dropdown
  const { data: classesData } = useApiData('/professors/me/classes', { classes: [] });
  const assignedClasses = classesData?.classes || [];

  const [slots, setSlots] = useState(EMPTY_TT);
  useEffect(() => {
    if (apiData?.timetable) setSlots(apiData.timetable);
  }, [apiData]);

  // ── Create Slot modal ──────────────────────────────────────────────────────
  const [createModal, setCreateModal] = useState(false);
  const [creating,    setCreating]    = useState(false);
  const [conflictSlots, setConflictSlots] = useState([]); // free slots on 409
  const [createForm, setCreateForm] = useState({
    day: 'Mon', time: '09:00 - 10:30', course_code: '', room: 'LH-101', slot_type: 'lecture',
  });

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setConflictSlots([]);
    try {
      const res = await apiFetch('/academics/timetable/professor/slots', {
        method: 'POST',
        body: JSON.stringify({
          course_code: createForm.course_code,
          day_of_week: createForm.day,
          time_slot:   createForm.time,
          room:        createForm.room,
          slot_type:   createForm.slot_type,
        }),
      });
      const body = await res.json();
      if (res.status === 409) {
        // Hard conflict — show free slots
        setConflictSlots(body.free_slots_today || []);
        showToast(`Slot conflict — ${body.error}`, 'error', 3000);
      } else if (!res.ok) {
        showToast(body.error || 'Failed to create slot', 'error');
      } else {
        showToast('Slot created.', 'success', 2500);
        setCreateModal(false);
        setCreateForm({ day: 'Mon', time: '09:00 - 10:30', course_code: assignedClasses[0]?.course_code || '', room: 'LH-101', slot_type: 'lecture' });
        setConflictSlots([]);
        refetch();
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setCreating(false);
    }
  }

  // ── Edit / Reschedule modal ────────────────────────────────────────────────
  const [editModal,  setEditModal]  = useState(false);
  const [editSlot,   setEditSlot]   = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [editForm, setEditForm] = useState({
    day: 'Mon', time: '', name: '', code: '', room: '', slot_type: 'lecture',
    branch: '', semester: '',
  });

  function openEdit(dayKey, cls) {
    setEditSlot({ ...cls, dayKey });
    setEditForm({
      day:       dayKey,
      time:      cls.time,
      name:      cls.name,
      code:      cls.code,
      room:      cls.room,
      slot_type: cls.type,
      branch:    cls.branch    || '',
      semester:  cls.semester  || '',
    });
    setEditModal(true);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setSaving(true);
    const res = await academicsApi.updateTimetableSlot(editSlot.id, {
      day_of_week: editForm.day,
      time_slot:   editForm.time,
      course_name: editForm.name,
      course_code: editForm.code,
      room:        editForm.room,
      slot_type:   editForm.slot_type,
      branch:      editForm.branch   || null,
      semester:    editForm.semester ? Number(editForm.semester) : null,
    });
    setSaving(false);
    if (res?.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Slot updated.', 'success', 2500);
      setEditModal(false);
      refetch();
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(slotId) {
    if (!window.confirm('Remove this slot from your schedule?')) return;
    const res = await academicsApi.deleteTimetableSlot(slotId);
    if (res?.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Slot removed.', 'success');
      refetch();
    }
  }

  // ── Extra class modal ──────────────────────────────────────────────────────
  const [extraModal,  setExtraModal]  = useState(false);
  const [addingExtra, setAddingExtra] = useState(false);
  const [extraForm, setExtraForm] = useState({
    day: 'Sat', time: '10:00 - 11:30', name: '', code: 'CS-EXTRA',
    room: 'LH-201', branch: '', semester: '',
  });

  async function handleAddExtra(e) {
    e.preventDefault();
    setAddingExtra(true);
    const res = await academicsApi.addExtraClass({
      day:      extraForm.day,
      time:     extraForm.time,
      name:     extraForm.name,
      code:     extraForm.code,
      room:     extraForm.room,
      branch:   extraForm.branch   || null,
      semester: extraForm.semester ? Number(extraForm.semester) : null,
    });
    setAddingExtra(false);
    if (res?.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Extra class scheduled.', 'success', 2500);
      setExtraModal(false);
      refetch();
    }
  }

  const todayKey = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];

  return (
    <StateContainer loading={loading} error={error} isEmpty={false}
                    emptyMessage="No classes scheduled yet.">

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Schedule &amp; Meetings</h1>
          <p className="page-sub">Instructor Portal · {user?.name}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="action-btn" onClick={() => setExtraModal(true)}>
            + Extra Class
          </button>
          <button className="action-btn" onClick={() => setCreateModal(true)}>
            + New Slot
          </button>
          <button className="action-btn" onClick={() => window.print()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="15" height="15">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="filter-row" role="group" aria-label="Filter by session type">
        {['all', ...SLOT_TYPES].map(f => (
          <button key={f}
            className={`filter-btn${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}>
            {f === 'all' ? 'All sessions' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
          </button>
        ))}
      </div>

      {/* Mobile Day Tabs */}
      <div className="day-tabs" role="tablist" aria-label="Select day">
        {WEEK_DAYS.map(d => (
          <button key={d.key} role="tab"
            aria-selected={mobileDay === d.key}
            className={`day-tab${mobileDay === d.key ? ' active' : ''}`}
            onClick={() => setMobileDay(d.key)}>
            {d.key}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="timetable-grid" id="timetableGridContainer">
        {WEEK_DAYS.map(day => {
          const classes = (slots[day.key] || []).filter(c =>
            filter === 'all' || c.type === filter
          );
          const isToday  = day.key === todayKey;
          const isMobile = day.key === mobileDay;

          return (
            <div key={day.key}
              className={`day-column${isToday ? ' today-col' : ''}${isMobile ? ' active-day-col' : ''}`}>
              <div className="day-header">
                <span className="day-title">{day.label}</span>
                <span className="day-subtitle">{isToday ? 'Today' : day.sub}</span>
              </div>
              <div className="classes-list">
                {classes.length > 0 ? classes.map(cls => (
                  <div className="class-card" key={cls.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span className="class-time">{cls.time}</span>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button className="edit-schedule-btn" aria-label="Edit slot"
                          onClick={() => openEdit(day.key, cls)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                               strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button className="edit-schedule-btn" aria-label="Delete slot"
                          style={{ color: 'var(--clr-danger, #ef4444)' }}
                          onClick={() => handleDelete(cls.id)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                               strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <span className="class-name">{cls.name}</span>
                    <span className="class-meta">{cls.code} · {cls.room}</span>
                    <span className={`class-badge badge-${cls.type}`}>{cls.type}</span>
                  </div>
                )) : (
                  <div className="no-class-message">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                    No classes
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Create Slot Modal ─────────────────────────────────────────────── */}
      {createModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true"
             onClick={e => e.target === e.currentTarget && setCreateModal(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>Add New Slot</h2>
              <button className="modal-close" onClick={() => { setCreateModal(false); setConflictSlots([]); }} aria-label="Close"><X size={16} aria-hidden="true" /></button>
            </div>
            <form onSubmit={handleCreate} className="sell-form">
              {/* Course selector — only assigned classes; no free-text */}
              <label>Course
                <select required value={createForm.course_code}
                  onChange={e => setCreateForm(p => ({ ...p, course_code: e.target.value }))}>
                  <option value="">Select assigned course…</option>
                  {assignedClasses.map(c => (
                    <option key={c.course_code} value={c.course_code}>
                      {c.course_name} ({c.course_code})
                    </option>
                  ))}
                </select>
              </label>
              <label>Day
                <select value={createForm.day} onChange={e => setCreateForm(p => ({ ...p, day: e.target.value }))}>
                  {WEEK_DAYS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </label>
              <label>Time Slot
                <input required value={createForm.time}
                  onChange={e => setCreateForm(p => ({ ...p, time: e.target.value }))}
                  placeholder="09:00 - 10:30" />
              </label>
              <label>Room
                <input required value={createForm.room}
                  onChange={e => setCreateForm(p => ({ ...p, room: e.target.value }))} />
              </label>
              <label>Type
                <select value={createForm.slot_type}
                  onChange={e => setCreateForm(p => ({ ...p, slot_type: e.target.value }))}>
                  {SLOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              {/* Conflict feedback */}
              {conflictSlots.length > 0 && (
                <div style={{ background: 'var(--clr-danger-alpha, rgba(239,68,68,.12))', border: '1px solid var(--clr-danger)', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.5rem' }}>
                  <p style={{ color: 'var(--clr-danger)', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                    Conflict! Free slots today:
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {conflictSlots.map(slot => (
                      <button key={slot} type="button"
                        style={{ background: 'var(--clr-accent-alpha)', color: 'var(--clr-accent)', border: '1px solid var(--clr-accent)', borderRadius: '999px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', cursor: 'pointer' }}
                        onClick={() => setCreateForm(p => ({ ...p, time: slot }))}>
                        {slot}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--clr-muted)', marginTop: '0.4rem' }}>Click a free slot to auto-fill.</p>
                </div>
              )}

              <button type="submit" className="action-btn" style={{ width: '100%' }} disabled={creating || !createForm.course_code}>
                {creating ? 'Creating…' : 'Create Slot'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Slot Modal ───────────────────────────────────────────────── */}
      {editModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true"
             onClick={e => e.target === e.currentTarget && setEditModal(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>Reschedule Session</h2>
              <button className="modal-close" onClick={() => setEditModal(false)} aria-label="Close"><X size={16} aria-hidden="true" /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="sell-form">
              <div style={{ fontSize: '0.85rem', color: 'var(--clr-muted)', marginBottom: '0.5rem' }}>
                Course: <strong>{editSlot?.name} ({editSlot?.code})</strong>
              </div>
              <label>Day
                <select value={editForm.day} onChange={e => setEditForm(p => ({ ...p, day: e.target.value }))}>
                  {WEEK_DAYS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </label>
              <label>Time Slot
                <input required value={editForm.time}
                  onChange={e => setEditForm(p => ({ ...p, time: e.target.value }))}
                  placeholder="09:00 - 10:30" />
              </label>
              <label>Classroom / Meeting Room
                <input required value={editForm.room}
                  onChange={e => setEditForm(p => ({ ...p, room: e.target.value }))} />
              </label>
              <label>Type
                <select value={editForm.slot_type}
                  onChange={e => setEditForm(p => ({ ...p, slot_type: e.target.value }))}>
                  {SLOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <button type="submit" className="action-btn" style={{ width: '100%' }} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Extra Class Modal ─────────────────────────────────────────────── */}
      {extraModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true"
             onClick={e => e.target === e.currentTarget && setExtraModal(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>Schedule Extra / Makeup Class</h2>
              <button className="modal-close" onClick={() => setExtraModal(false)} aria-label="Close"><X size={16} aria-hidden="true" /></button>
            </div>
            <form onSubmit={handleAddExtra} className="sell-form">
              <label>Day
                <select value={extraForm.day} onChange={e => setExtraForm(p => ({ ...p, day: e.target.value }))}>
                  {WEEK_DAYS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </label>
              <label>Time
                <input required value={extraForm.time}
                  onChange={e => setExtraForm(p => ({ ...p, time: e.target.value }))} />
              </label>
              <label>Course Name
                <input required value={extraForm.name}
                  onChange={e => setExtraForm(p => ({ ...p, name: e.target.value }))} />
              </label>
              <label>Room
                <input required value={extraForm.room}
                  onChange={e => setExtraForm(p => ({ ...p, room: e.target.value }))} />
              </label>
              <label>Branch (optional)
                <input value={extraForm.branch}
                  onChange={e => setExtraForm(p => ({ ...p, branch: e.target.value }))} />
              </label>
              <button type="submit" className="action-btn" style={{ width: '100%' }} disabled={addingExtra}>
                {addingExtra ? 'Scheduling…' : 'Schedule Class'}
              </button>
            </form>
          </div>
        </div>
      )}
    </StateContainer>
  );
}
