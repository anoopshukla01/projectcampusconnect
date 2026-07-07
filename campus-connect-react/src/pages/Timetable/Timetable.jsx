import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { StateContainer } from '../../components/StateContainer';
import './Timetable.css';

const WEEK_DAYS = [
  { key: 'Mon', label: 'Monday',    sub: 'Day 1' },
  { key: 'Tue', label: 'Tuesday',   sub: 'Day 2' },
  { key: 'Wed', label: 'Wednesday', sub: 'Day 3' },
  { key: 'Thu', label: 'Thursday',  sub: 'Day 4' },
  { key: 'Fri', label: 'Friday',    sub: 'Day 5' },
];

export default function Timetable() {
  const { user }   = useAuth();
  const showToast  = useToast();
  const [filter, setFilter]       = useState('all');
  const [mobileDay, setMobileDay] = useState('Mon');
  const isProf = user?.role === 'professor';

  const { data: apiData, loading, error, isEmpty } = useApiData('/api/v1/academics/timetable', { timetable: { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [] } });

  // Load custom timetable state to allow editing
  const [timetableData, setTimetableData] = useState({ Mon: [], Tue: [], Wed: [], Thu: [], Fri: [] });

  useEffect(() => {
    if (apiData?.timetable) {
      setTimetableData(apiData.timetable);
    }
  }, [apiData]);

  // Edit Modal State
  const [editModal, setEditModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [editForm, setEditForm] = useState({ time: '', room: '', day: '' });

  function handleExport() {
    showToast('Timetable PDF generated & downloading…', 'success', 3000);
  }

  function handleEditClick(dayKey, cls) {
    setEditingClass({ ...cls, dayKey });
    setEditForm({ time: cls.time, room: cls.room, day: dayKey });
    setEditModal(true);
  }

  function saveEdit(e) {
    e.preventDefault();
    if (!editingClass) return;

    setTimetableData(prev => {
      const updated = { ...prev };
      // Remove from old day
      updated[editingClass.dayKey] = updated[editingClass.dayKey].filter(c => c.id !== editingClass.id);
      // Add to new day (with updated values)
      const newClass = {
        ...editingClass,
        time: editForm.time,
        room: editForm.room
      };
      if (!updated[editForm.day]) {
        updated[editForm.day] = [];
      }
      updated[editForm.day].push(newClass);
      return updated;
    });

    setEditModal(false);
    showToast('Class details updated successfully! 📅', 'success', 2500);
  }

  const todayKey = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];

  return (
    <StateContainer loading={loading} error={error} isEmpty={isEmpty} emptyMessage="No timetable published for your section yet.">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{isProf ? 'Schedule & Meetings' : 'Timetable'}</h1>
          <p className="page-sub">
            {isProf ? `Instructor Portal · ${user?.name}` : `${user?.branch} · Semester ${user?.semester}`}
          </p>
        </div>
        <button className="action-btn" id="exportBtn" onClick={handleExport}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="15" height="15">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Schedule
        </button>
      </div>

      {/* Filter Chips */}
      <div className="filter-row" role="group" aria-label="Filter by class type">
        {['all','lecture','lab'].map(f => (
          <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All sessions' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
          </button>
        ))}
      </div>

      {/* Mobile Day Tabs */}
      <div className="day-tabs" role="tablist" aria-label="Select day">
        {WEEK_DAYS.map(d => (
          <button
            key={d.key}
            role="tab"
            aria-selected={mobileDay === d.key}
            className={`day-tab${mobileDay === d.key ? ' active' : ''}`}
            onClick={() => setMobileDay(d.key)}
          >
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
          const isToday   = day.key === todayKey;
          const isMobile  = day.key === mobileDay;

          return (
            <div key={day.key} className={`day-column${isToday ? ' today-col' : ''}${isMobile ? ' active-day-col' : ''}`}>
              <div className="day-header">
                <span className="day-title">{day.label}</span>
                <span className="day-subtitle">{isToday ? '📍 Today' : day.sub}</span>
              </div>
              <div className="classes-list">
                {classes.length > 0 ? classes.map((cls, i) => (
                  <div className="class-card" key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span className="class-time">{cls.time}</span>
                      {isProf && (
                        <button
                          className="edit-schedule-btn"
                          aria-label="Reschedule class"
                          onClick={() => handleEditClick(day.key, cls)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    <span className="class-name">{cls.name}</span>
                    <span className="class-meta">{cls.code} · {cls.room} · {cls.prof}</span>
                    <span className={`class-badge badge-${cls.type}`}>{cls.type}</span>
                  </div>
                )) : (
                  <div className="no-class-message">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

      {/* Edit Timetable Modal (Professor Only) */}
      {editModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setEditModal(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>Reschedule Session</h2>
              <button className="modal-close" onClick={() => setEditModal(false)}>✕</button>
            </div>
            <form onSubmit={saveEdit} className="sell-form">
              <div style={{ fontSize: '0.85rem', color: 'var(--clr-muted)', marginBottom: '0.5rem' }}>
                Course: <strong>{editingClass?.name} ({editingClass?.code})</strong>
              </div>
              <label>
                Day of Week
                <select value={editForm.day} onChange={e => setEditForm(p => ({ ...p, day: e.target.value }))}>
                  {WEEK_DAYS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </label>
              <label>
                Time Slot
                <input
                  required
                  value={editForm.time}
                  onChange={e => setEditForm(p => ({ ...p, time: e.target.value }))}
                  placeholder="e.g. 09:00 - 10:30"
                />
              </label>
              <label>
                Classroom / Meeting Room
                <input
                  required
                  value={editForm.room}
                  onChange={e => setEditForm(p => ({ ...p, room: e.target.value }))}
                  placeholder="e.g. LH-201 or Conf Room"
                />
              </label>
              <button type="submit" className="action-btn" style={{ width: '100%' }}>Save Changes</button>
            </form>
          </div>
        </div>
      )}
    </StateContainer>
  );
}
