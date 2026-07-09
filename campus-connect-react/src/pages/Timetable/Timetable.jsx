/**
 * Timetable — Student / Admin Portal
 *
 * Student: fetches branch+semester-scoped slots from backend.
 * Admin:   fetches all slots, can filter by branch & semester,
 *          and can create / delete any slot.
 *
 * Role is resolved from AuthContext (server-side JWT) — never from form input.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { academicsApi, apiDelete } from '../../services/api';
import { StateContainer } from '../../components/StateContainer';
import './Timetable.css';

const WEEK_DAYS = [
  { key: 'Mon', label: 'Monday',    sub: 'Day 1' },
  { key: 'Tue', label: 'Tuesday',   sub: 'Day 2' },
  { key: 'Wed', label: 'Wednesday', sub: 'Day 3' },
  { key: 'Thu', label: 'Thursday',  sub: 'Day 4' },
  { key: 'Fri', label: 'Friday',    sub: 'Day 5' },
  { key: 'Sat', label: 'Saturday',  sub: 'Day 6' },
];

const EMPTY_TIMETABLE = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };

const SLOT_TYPES = ['lecture', 'lab', 'seminar', 'extra'];

export default function Timetable() {
  const { user, isAdmin } = useAuth();
  const showToast = useToast();

  const [filter, setFilter]       = useState('all');
  const [mobileDay, setMobileDay] = useState('Mon');

  // Admin filter params (ignored for students — server handles scoping)
  const [adminBranch,   setAdminBranch]   = useState('');
  const [adminSemester, setAdminSemester] = useState('');

  // Build query path — admin can filter; student gets their own
  const queryParams = isAdmin
    ? (adminBranch   ? `?branch=${adminBranch}${adminSemester ? `&semester=${adminSemester}` : ''}` : '')
    : '';
  const endpoint = `/academics/timetable${queryParams}`;

  const { data: apiData, loading, error, isEmpty, refetch } = useApiData(
    endpoint,
    { timetable: EMPTY_TIMETABLE },
  );

  const [timetableData, setTimetableData] = useState(EMPTY_TIMETABLE);

  useEffect(() => {
    if (apiData?.timetable) setTimetableData(apiData.timetable);
  }, [apiData]);

  // ── Edit / Reschedule modal (admin only in this portal) ──────────────────
  const [editModal, setEditModal]     = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [editSaving,  setEditSaving]  = useState(false);
  const [editForm, setEditForm] = useState({
    day: 'Mon', time: '', name: '', code: '', room: '', professor_name: '',
    slot_type: 'lecture', branch: '', semester: '',
  });

  // ── Add-slot modal (admin only) ──────────────────────────────────────────
  const [addModal,   setAddModal]   = useState(false);
  const [addSaving,  setAddSaving]  = useState(false);
  const [addForm, setAddForm] = useState({
    day: 'Mon', time: '09:00 - 10:30', name: '', code: '', room: 'LH-101',
    professor_name: '', slot_type: 'lecture', branch: '', semester: '',
  });

  function openEdit(dayKey, slot) {
    setEditingSlot({ ...slot, dayKey });
    setEditForm({
      day:            dayKey,
      time:           slot.time,
      name:           slot.name,
      code:           slot.code,
      room:           slot.room,
      professor_name: slot.prof,
      slot_type:      slot.type,
      branch:         slot.branch || '',
      semester:       slot.semester || '',
    });
    setEditModal(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingSlot) return;
    setEditSaving(true);

    const result = await academicsApi.updateTimetableSlot(editingSlot.id, {
      day_of_week:    editForm.day,
      time_slot:      editForm.time,
      course_name:    editForm.name,
      course_code:    editForm.code,
      room:           editForm.room,
      professor_name: editForm.professor_name,
      slot_type:      editForm.slot_type,
      branch:         editForm.branch || null,
      semester:       editForm.semester ? Number(editForm.semester) : null,
    });

    setEditSaving(false);
    if (result?.error) {
      showToast(result.error, 'error');
    } else {
      showToast('Slot updated.', 'success', 2500);
      setEditModal(false);
      refetch();
    }
  }

  async function deleteSlot(slotId) {
    if (!window.confirm('Remove this timetable slot?')) return;
    const res = await apiDelete(`/academics/timetable/slots/${slotId}`);
    if (res?.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Slot removed.', 'success');
      refetch();
    }
  }

  async function saveAdd(e) {
    e.preventDefault();
    setAddSaving(true);
    const result = await academicsApi.saveTimetableSlot({
      day_of_week:    addForm.day,
      time_slot:      addForm.time,
      course_name:    addForm.name,
      course_code:    addForm.code || 'CS000',
      room:           addForm.room,
      professor_name: addForm.professor_name,
      slot_type:      addForm.slot_type,
      branch:         addForm.branch || null,
      semester:       addForm.semester ? Number(addForm.semester) : null,
    });    setAddSaving(false);
    if (result?.error) {
      showToast(result.error, 'error');
    } else {
      showToast('Slot added.', 'success', 2500);
      setAddModal(false);
      setAddForm({ day: 'Mon', time: '09:00 - 10:30', name: '', code: '', room: 'LH-101',
                   professor_name: '', slot_type: 'lecture', branch: '', semester: '' });
      refetch();
    }
  }

  const todayKey = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];

  return (
    <StateContainer loading={loading} error={error} isEmpty={isEmpty && !isAdmin}
                    emptyMessage="No timetable published for your section yet.">

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Timetable</h1>
          <p className="page-sub">
            {isAdmin
              ? 'Admin View — all branches'
              : `${user?.branch ?? ''} · Semester ${user?.semester ?? ''}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {isAdmin && (
            <>
              <select
                value={adminBranch}
                onChange={e => setAdminBranch(e.target.value)}
                className="filter-btn"
                aria-label="Filter by branch"
              >
                <option value="">All Branches</option>
                {['CSE','ECE','ME','CE','EE','IT'].map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <select
                value={adminSemester}
                onChange={e => setAdminSemester(e.target.value)}
                className="filter-btn"
                aria-label="Filter by semester"
              >
                <option value="">All Semesters</option>
                {[1,2,3,4,5,6,7,8].map(s => (
                  <option key={s} value={s}>Sem {s}</option>
                ))}
              </select>
              <button className="action-btn" onClick={() => setAddModal(true)}>
                + Add Slot
              </button>
            </>
          )}
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
      <div className="filter-row" role="group" aria-label="Filter by class type">
        {['all', 'lecture', 'lab', 'seminar', 'extra'].map(f => (
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
          const classes = (timetableData[day.key] || []).filter(c =>
            filter === 'all' || c.type === filter
          );
          const isToday  = day.key === todayKey;
          const isMobile = day.key === mobileDay;

          return (
            <div key={day.key}
              className={`day-column${isToday ? ' today-col' : ''}${isMobile ? ' active-day-col' : ''}`}>
              <div className="day-header">
                <span className="day-title">{day.label}</span>
                <span className="day-subtitle">{isToday ? '📍 Today' : day.sub}</span>
              </div>
              <div className="classes-list">
                {classes.length > 0 ? classes.map((cls) => (
                  <div className="class-card" key={cls.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span className="class-time">{cls.time}</span>
                      {isAdmin && (
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
                            onClick={() => deleteSlot(cls.id)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                 strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="class-name">{cls.name}</span>
                    <span className="class-meta">
                      {cls.code} · {cls.room} · {cls.prof}
                      {cls.branch && ` · ${cls.branch}`}
                      {cls.semester && ` Sem ${cls.semester}`}
                    </span>
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

      {/* ── Admin: Edit Slot Modal ─────────────────────────────────────────── */}
      {editModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true"
             onClick={e => e.target === e.currentTarget && setEditModal(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>Edit Timetable Slot</h2>
              <button className="modal-close" onClick={() => setEditModal(false)}>✕</button>
            </div>
            <form onSubmit={saveEdit} className="sell-form">
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
              <label>Course Name
                <input required value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
              </label>
              <label>Course Code
                <input value={editForm.code}
                  onChange={e => setEditForm(p => ({ ...p, code: e.target.value }))} />
              </label>
              <label>Room
                <input required value={editForm.room}
                  onChange={e => setEditForm(p => ({ ...p, room: e.target.value }))} />
              </label>
              <label>Professor Name
                <input value={editForm.professor_name}
                  onChange={e => setEditForm(p => ({ ...p, professor_name: e.target.value }))} />
              </label>
              <label>Type
                <select value={editForm.slot_type}
                  onChange={e => setEditForm(p => ({ ...p, slot_type: e.target.value }))}>
                  {SLOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label>Branch (optional)
                <input value={editForm.branch}
                  onChange={e => setEditForm(p => ({ ...p, branch: e.target.value }))}
                  placeholder="e.g. CSE" />
              </label>
              <label>Semester (optional)
                <input type="number" min="1" max="8" value={editForm.semester}
                  onChange={e => setEditForm(p => ({ ...p, semester: e.target.value }))} />
              </label>
              <button type="submit" className="action-btn" style={{ width: '100%' }} disabled={editSaving}>
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Admin: Add Slot Modal ─────────────────────────────────────────── */}
      {addModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true"
             onClick={e => e.target === e.currentTarget && setAddModal(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>Add Timetable Slot</h2>
              <button className="modal-close" onClick={() => setAddModal(false)}>✕</button>
            </div>
            <form onSubmit={saveAdd} className="sell-form">
              <label>Day
                <select value={addForm.day} onChange={e => setAddForm(p => ({ ...p, day: e.target.value }))}>
                  {WEEK_DAYS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </label>
              <label>Time Slot
                <input required value={addForm.time}
                  onChange={e => setAddForm(p => ({ ...p, time: e.target.value }))}
                  placeholder="09:00 - 10:30" />
              </label>
              <label>Course Name
                <input required value={addForm.name}
                  onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} />
              </label>
              <label>Course Code
                <input value={addForm.code}
                  onChange={e => setAddForm(p => ({ ...p, code: e.target.value }))} />
              </label>
              <label>Room
                <input required value={addForm.room}
                  onChange={e => setAddForm(p => ({ ...p, room: e.target.value }))} />
              </label>
              <label>Professor Name
                <input required value={addForm.professor_name}
                  onChange={e => setAddForm(p => ({ ...p, professor_name: e.target.value }))} />
              </label>
              <label>Type
                <select value={addForm.slot_type}
                  onChange={e => setAddForm(p => ({ ...p, slot_type: e.target.value }))}>
                  {SLOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label>Branch (optional)
                <input value={addForm.branch}
                  onChange={e => setAddForm(p => ({ ...p, branch: e.target.value }))}
                  placeholder="e.g. CSE" />
              </label>
              <label>Semester (optional)
                <input type="number" min="1" max="8" value={addForm.semester}
                  onChange={e => setAddForm(p => ({ ...p, semester: e.target.value }))} />
              </label>
              <button type="submit" className="action-btn" style={{ width: '100%' }} disabled={addSaving}>
                {addSaving ? 'Adding…' : 'Add Slot'}
              </button>
            </form>
          </div>
        </div>
      )}
    </StateContainer>
  );
}
