import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './Timetable.css';

const WEEK_DAYS = [
  { key: 'Mon', label: 'Monday',    sub: 'Day 1' },
  { key: 'Tue', label: 'Tuesday',   sub: 'Day 2' },
  { key: 'Wed', label: 'Wednesday', sub: 'Day 3' },
  { key: 'Thu', label: 'Thursday',  sub: 'Day 4' },
  { key: 'Fri', label: 'Friday',    sub: 'Day 5' },
];

function getTimetableForBranch(branch, role) {
  const b = (branch || '').toLowerCase();
  if (role === 'professor') {
    return {
      Mon: [
        { id: '1', time: '09:00 - 10:30', name: 'Computer networks',    code: 'CS3081', room: 'LH-201', prof: 'Dr. Sneha Patel', type: 'lecture' },
        { id: '2', time: '11:00 - 12:30', name: 'Faculty Senate Meeting', code: 'MEET',   room: 'Conf Room 1', prof: 'Director', type: 'seminar' }
      ],
      Tue: [
        { id: '3', time: '13:30 - 15:00', name: 'Theory of computation', code: 'CS3061', room: 'LH-201', prof: 'Dr. Sneha Patel', type: 'lecture' }
      ],
      Wed: [
        { id: '4', time: '09:00 - 10:30', name: 'Computer networks',    code: 'CS3081', room: 'LH-201', prof: 'Dr. Sneha Patel', type: 'lecture' }
      ],
      Thu: [
        { id: '5', time: '14:00 - 15:00', name: 'Research Lab Sync',    code: 'MEET',   room: 'Lab-2',       prof: 'Ph.D Students', type: 'seminar' }
      ],
      Fri: [
        { id: '6', time: '09:00 - 10:30', name: 'Theory of computation', code: 'CS3061', room: 'LH-201', prof: 'Dr. Sneha Patel', type: 'lecture' }
      ],
    };
  }

  if (b.includes('communication') || b.includes('electronics')) {
    return {
      Mon: [
        { id: 'ec-1', time: '10:00 - 11:30', name: 'Signals & Systems',         code: 'EC3021', room: 'LH-102', prof: 'Dr. Kavitha Menon', type: 'lecture' },
        { id: 'ec-2', time: '13:00 - 14:30', name: 'VLSI Design',               code: 'EC3031', room: 'LH-210', prof: 'Dr. Suresh Babu',   type: 'lecture' },
      ],
      Tue: [
        { id: 'ec-3', time: '09:00 - 10:30', name: 'Electromagnetic Waves',     code: 'EC3041', room: 'LH-102', prof: 'Dr. Kavitha Menon', type: 'lecture' },
        { id: 'ec-4', time: '11:00 - 12:30', name: 'Digital Signal Processing', code: 'EC3051', room: 'LH-210', prof: 'Dr. Suresh Babu',   type: 'lecture' },
      ],
      Wed: [
        { id: 'ec-5', time: '10:00 - 11:30', name: 'Signals & Systems',         code: 'EC3021', room: 'LH-102', prof: 'Dr. Kavitha Menon', type: 'lecture' },
        { id: 'ec-6', time: '14:00 - 17:00', name: 'VLSI Design Lab',           code: 'EC3032', room: 'Lab-5',  prof: 'Dr. Suresh Babu',   type: 'lab'     },
      ],
      Thu: [
        { id: 'ec-7', time: '09:00 - 10:30', name: 'Electromagnetic Waves',     code: 'EC3041', room: 'LH-102', prof: 'Dr. Kavitha Menon', type: 'lecture' },
        { id: 'ec-8', time: '11:00 - 12:30', name: 'Digital Signal Processing', code: 'EC3051', room: 'LH-210', prof: 'Dr. Suresh Babu',   type: 'lecture' },
      ],
      Fri: [
        { id: 'ec-9', time: '09:00 - 12:00', name: 'DSP & Systems Lab',         code: 'EC3052', room: 'Lab-6',  prof: 'Dr. Kavitha Menon', type: 'lab'     },
        { id: 'ec-10',time: '14:00 - 15:30', name: 'Semiconductor Seminar',     code: 'EC3081', room: 'Aud-1',  prof: 'Dr. Suresh Babu',   type: 'seminar' },
      ],
    };
  }
  if (b.includes('mechanical')) {
    return {
      Mon: [
        { id: 'me-1', time: '08:00 - 09:30', name: 'Thermodynamics',         code: 'ME3011', room: 'LH-401',    prof: 'Dr. Ramesh Kumar', type: 'lecture' },
        { id: 'me-2', time: '12:00 - 13:30', name: 'Fluid Mechanics',        code: 'ME3021', room: 'Lab-3',      prof: 'Dr. Anil Sharma',  type: 'lecture' },
      ],
      Tue: [
        { id: 'me-3', time: '09:00 - 10:30', name: 'Kinematics of Machines', code: 'ME3031', room: 'LH-402',    prof: 'Dr. Ramesh Kumar', type: 'lecture' },
        { id: 'me-4', time: '11:00 - 12:30', name: 'Material Science',       code: 'ME3041', room: 'LH-402',    prof: 'Dr. Anil Sharma',  type: 'lecture' },
      ],
      Wed: [
        { id: 'me-5', time: '08:00 - 09:30', name: 'Thermodynamics',         code: 'ME3011', room: 'LH-401',    prof: 'Dr. Ramesh Kumar', type: 'lecture' },
        { id: 'me-6', time: '14:00 - 17:00', name: 'Fluid Mechanics Lab',    code: 'ME3022', room: 'Lab-3',      prof: 'Dr. Anil Sharma',  type: 'lab'     },
      ],
      Thu: [
        { id: 'me-7', time: '09:00 - 10:30', name: 'Kinematics of Machines', code: 'ME3031', room: 'LH-402',    prof: 'Dr. Ramesh Kumar', type: 'lecture' },
        { id: 'me-8', time: '11:00 - 12:30', name: 'Material Science',       code: 'ME3041', room: 'LH-402',    prof: 'Dr. Anil Sharma',  type: 'lecture' },
      ],
      Fri: [
        { id: 'me-9', time: '09:00 - 12:00', name: 'Machine Shop Practice',  code: 'ME3032', room: 'Workshop-1', prof: 'Dr. Ramesh Kumar', type: 'lab'     },
        { id: 'me-10',time: '14:00 - 15:30', name: 'CAD/CAM Seminar',        code: 'ME3061', room: 'Aud-3',      prof: 'Dr. Anil Sharma',  type: 'seminar' },
      ],
    };
  }
  // Default: Computer Science
  return {
    Mon: [
      { id: 'cs-1', time: '09:00 - 10:30', name: 'Computer networks',         code: 'CS3081', room: 'LH-201', prof: 'Dr. Sneha Patel',  type: 'lecture' },
      { id: 'cs-2', time: '11:00 - 12:30', name: 'Software engineering',      code: 'CS3041', room: 'LH-108', prof: 'Dr. Rohan Mehra',  type: 'lecture' },
      { id: 'cs-3', time: '14:00 - 15:30', name: 'Database systems',          code: 'CS3051', room: 'LH-305', prof: 'Dr. Arjun Nair',   type: 'lecture' },
    ],
    Tue: [
      { id: 'cs-4', time: '09:00 - 12:00', name: 'Network & SE Lab',          code: 'CS3082', room: 'Lab-2',  prof: 'Dr. Sneha Patel',  type: 'lab'     },
      { id: 'cs-5', time: '13:30 - 15:00', name: 'Theory of computation',     code: 'CS3061', room: 'LH-201', prof: 'Dr. Sneha Patel',  type: 'lecture' },
    ],
    Wed: [
      { id: 'cs-6', time: '09:00 - 10:30', name: 'Computer networks',         code: 'CS3081', room: 'LH-201', prof: 'Dr. Sneha Patel',  type: 'lecture' },
      { id: 'cs-7', time: '11:00 - 12:30', name: 'Software engineering',      code: 'CS3041', room: 'LH-108', prof: 'Dr. Rohan Mehra',  type: 'lecture' },
      { id: 'cs-8', time: '15:00 - 16:30', name: 'Technical Writing Seminar', code: 'HS3011', room: 'Aud-2',  prof: 'Dr. Vikram Singh', type: 'seminar' },
    ],
    Thu: [
      { id: 'cs-9', time: '10:00 - 11:30', name: 'Database systems',          code: 'CS3051', room: 'LH-305', prof: 'Dr. Arjun Nair',  type: 'lecture' },
      { id: 'cs-10',time: '13:00 - 16:00', name: 'DBMS & Projects Lab',       code: 'CS3052', room: 'Lab-4',  prof: 'Dr. Arjun Nair',  type: 'lab'     },
    ],
    Fri: [
      { id: 'cs-11',time: '09:00 - 10:30', name: 'Theory of computation',     code: 'CS3061', room: 'LH-201', prof: 'Dr. Sneha Patel',  type: 'lecture' },
      { id: 'cs-12',time: '11:00 - 12:30', name: 'Cloud Computing',           code: 'CS4021', room: 'LH-108', prof: 'Dr. Vikram Singh', type: 'lecture' },
    ],
  };
}

export default function Timetable() {
  const { user }   = useAuth();
  const showToast  = useToast();
  const [filter, setFilter]       = useState('all');
  const [mobileDay, setMobileDay] = useState('Mon');
  const isProf = user?.role === 'professor';

  // Load custom timetable state to allow editing
  const [timetableData, setTimetableData] = useState(() => getTimetableForBranch(user?.branch, user?.role));

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
    <>
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
    </>
  );
}
