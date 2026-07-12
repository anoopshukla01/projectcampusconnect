import { useState, useEffect } from 'react';
import { adminApi } from '@/services/api';
import { useToast } from '@ctx/ToastContext';
import './AttendanceTimetableOversight.css';
import '../admin.shared.css';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BRANCHES = ['CSE', 'ECE', 'ME', 'CE', 'IT', 'EE'];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function AttendanceTimetableOversight() {
  const showToast = useToast();
  const [activeTab, setActiveTab] = useState('timetable');
  const [loading, setLoading] = useState(false);

  // Timetable Oversight State
  const [slots, setSlots] = useState({ Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] });
  const [filterBranch, setFilterBranch] = useState('CSE');
  const [filterSemester, setFilterSemester] = useState(4);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSlot, setNewSlot] = useState({
    day_of_week: 'Mon',
    time_slot: '09:00 - 10:30',
    room: '',
    course_name: '',
    course_code: '',
    professor_name: '',
    branch: 'CSE',
    semester: 4,
    slot_type: 'lecture',
  });

  // TPO Booking State
  const [bookings, setBookings] = useState([]);

  // Attendance State (Professor check-ins)
  const [professors, setProfessors] = useState([]);

  useEffect(() => {
    if (activeTab === 'timetable') {
      fetchTimetable();
    } else if (activeTab === 'bookings') {
      fetchBookings();
    } else if (activeTab === 'attendance') {
      fetchProfessorsAttendance();
    }
  }, [activeTab, filterBranch, filterSemester]);

  // ── Timetable API calls ───────────────────────────────────────────────────
  async function fetchTimetable() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/academics/timetable?branch=${filterBranch}&semester=${filterSemester}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.timetable || { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] });
      } else {
        showToast('Failed to fetch timetable slots.', 'error');
      }
    } catch (err) {
      showToast('Network error fetching timetable.', 'error');
    }
    setLoading(false);
  }

  async function handleAddSlot(e) {
    e.preventDefault();
    if (!newSlot.course_name || !newSlot.course_code || !newSlot.room || !newSlot.professor_name) {
      showToast('Please fill out all slot details.', 'warning');
      return;
    }
    try {
      await adminApi.createTimetableSlot({
        ...newSlot,
        semester: parseInt(newSlot.semester),
        role: 'student',
      });
      showToast('Timetable slot created successfully.', 'success');
      setShowAddModal(false);
      fetchTimetable();
      setNewSlot({
        day_of_week: 'Mon',
        time_slot: '09:00 - 10:30',
        room: '',
        course_name: '',
        course_code: '',
        professor_name: '',
        branch: filterBranch,
        semester: filterSemester,
        slot_type: 'lecture',
      });
    } catch (err) {
      showToast(err.message || 'Failed to create slot.', 'error');
    }
  }

  async function handleDeleteSlot(slotId) {
    if (!window.confirm('Are you sure you want to delete this timetable slot?')) return;
    try {
      await adminApi.deleteTimetableSlot(slotId);
      showToast('Slot deleted.', 'success');
      fetchTimetable();
    } catch (err) {
      showToast(err.message || 'Failed to delete slot.', 'error');
    }
  }

  // ── Bookings API calls ────────────────────────────────────────────────────
  async function fetchBookings() {
    setLoading(true);
    try {
      const res = await adminApi.getTimetableBookings();
      setBookings(res.timetable_bookings || []);
    } catch (err) {
      showToast(err.message || 'Failed to load bookings.', 'error');
    }
    setLoading(false);
  }

  async function handleApproveBooking(id) {
    try {
      await adminApi.approveTimetableBooking(id);
      showToast('Interview booking approved and slot scheduled.', 'success');
      fetchBookings();
    } catch (err) {
      showToast(err.message || 'Failed to approve booking.', 'error');
    }
  }

  async function handleRejectBooking(id) {
    if (!window.confirm('Are you sure you want to reject this interview slot booking?')) return;
    try {
      await adminApi.rejectTimetableBooking(id);
      showToast('Booking rejected.', 'success');
      fetchBookings();
    } catch (err) {
      showToast(err.message || 'Failed to reject booking.', 'error');
    }
  }

  // ── Professor Attendance API calls ─────────────────────────────────────────
  async function fetchProfessorsAttendance() {
    setLoading(true);
    try {
      const res = await adminApi.getProfessorAttendance();
      setProfessors(res.professors || []);
    } catch (err) {
      showToast(err.message || 'Failed to load professor check-in logs.', 'error');
    }
    setLoading(false);
  }

  async function handleMarkCheckin(professorId, status) {
    try {
      await adminApi.markProfessorCheckin({ professor_id: professorId, status });
      showToast(`Professor status marked as ${status}.`, 'success');
      fetchProfessorsAttendance();
    } catch (err) {
      showToast(err.message || 'Failed to update attendance.', 'error');
    }
  }

  return (
    <div className="ad-root attendance-timetable-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance & Timetable Oversight</h1>
          <p className="page-sub">Admin schedule oversight, TPO drive approvals, and professor check-in tracking.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-nav-wrapper">
        <button
          className={`tab-nav-btn ${activeTab === 'timetable' ? 'active' : ''}`}
          onClick={() => setActiveTab('timetable')}
        >
          Master Timetable
        </button>
        <button
          className={`tab-nav-btn ${activeTab === 'bookings' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
          TPO Interview Bookings
          {bookings.length > 0 && <span className="badge-count-pill">{bookings.length}</span>}
        </button>
        <button
          className={`tab-nav-btn ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          Professor Attendance
        </button>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-spinner-wrapper">
          <div className="ad-spinner"></div>
          <span>Syncing academic records…</span>
        </div>
      )}

      {/* ── TAB CONTENT: MASTER TIMETABLE ── */}
      {!loading && activeTab === 'timetable' && (
        <div className="timetable-tab-content">
          <div className="ad-card control-filters-card">
            <div className="filter-controls-flex">
              <div className="filter-group">
                <label>Branch</label>
                <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="filter-group">
                <label>Semester</label>
                <select value={filterSemester} onChange={e => setFilterSemester(parseInt(e.target.value))}>
                  {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
              <button className="pd-btn pd-btn-primary add-slot-trigger-btn" onClick={() => setShowAddModal(true)}>
                + Create Master Slot
              </button>
            </div>
          </div>

          <div className="timetable-board-grid">
            {DAYS.map(day => (
              <div className="timetable-day-column" key={day}>
                <h3 className="timetable-day-header">{day}</h3>
                <div className="timetable-slots-stack">
                  {!slots[day] || slots[day].length === 0 ? (
                    <p className="no-slots-placeholder">No slots scheduled.</p>
                  ) : (
                    slots[day].map(s => (
                      <div className={`timetable-slot-item slot-type-${s.slot_type}`} key={s.id}>
                        <div className="slot-time">{s.time_slot}</div>
                        <div className="slot-name" title={s.course_name}>{s.course_name}</div>
                        <div className="slot-code-room">
                          <span className="slot-code">{s.course_code}</span>
                          <span className="slot-room">📍 {s.room}</span>
                        </div>
                        <div className="slot-prof">👤 {s.professor_name}</div>
                        <button className="slot-delete-btn" onClick={() => handleDeleteSlot(s.id)} title="Delete Slot">✕</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: TPO INTERVIEW BOOKINGS ── */}
      {!loading && activeTab === 'bookings' && (
        <div className="bookings-tab-content">
          <div className="ad-card">
            <div className="ad-card-header">
              <h2 className="ad-card-title">Placement Drive & Interview Bookings</h2>
            </div>
            {bookings.length === 0 ? (
              <div className="empty-state-layout">
                <span className="empty-icon">📅</span>
                <p>No pending interview timetable booking requests.</p>
              </div>
            ) : (
              <div className="ad-table-wrap">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Student</th>
                      <th>Roll No</th>
                      <th>Date / Day</th>
                      <th>Time Slot</th>
                      <th>Venue / Room</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map(b => (
                      <tr key={b.id}>
                        <td><strong>{b.company_name}</strong></td>
                        <td>{b.student_name}</td>
                        <td><code className="roll-pill">{b.student_roll}</code></td>
                        <td>{b.day_of_week}</td>
                        <td><span className="time-badge">{b.time_slot}</span></td>
                        <td>📍 {b.room}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button className="pd-btn pd-btn-sm pd-btn-success" onClick={() => handleApproveBooking(b.id)}>
                              Approve
                            </button>
                            <button className="pd-btn pd-btn-sm pd-btn-outline-danger" onClick={() => handleRejectBooking(b.id)}>
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: PROFESSOR ATTENDANCE ── */}
      {!loading && activeTab === 'attendance' && (
        <div className="attendance-tab-content">
          <div className="ad-card">
            <div className="ad-card-header">
              <h2 className="ad-card-title">Today's Faculty Check-In & Attendance log</h2>
            </div>
            {professors.length === 0 ? (
              <div className="empty-state-layout">
                <p>No faculty members approved in the system.</p>
              </div>
            ) : (
              <div className="ad-table-wrap">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Faculty Member</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th>Check-in Status</th>
                      <th>Check-in Time</th>
                      <th style={{ textAlign: 'right' }}>Mark Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {professors.map(p => (
                      <tr key={p.professor_id}>
                        <td><strong>{p.full_name}</strong></td>
                        <td>{p.department}</td>
                        <td>{p.designation}</td>
                        <td>
                          <span className={`status-badge-pill status-${p.status.toLowerCase()}`}>
                            {p.status}
                          </span>
                        </td>
                        <td>{p.check_in_time ? new Date(p.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                            <button
                              className="pd-btn pd-btn-sm pd-btn-success"
                              onClick={() => handleMarkCheckin(p.professor_id, 'Present')}
                            >
                              Present
                            </button>
                            <button
                              className="pd-btn pd-btn-sm pd-btn-warning"
                              onClick={() => handleMarkCheckin(p.professor_id, 'Late')}
                            >
                              Late
                            </button>
                            <button
                              className="pd-btn pd-btn-sm pd-btn-outline-danger"
                              onClick={() => handleMarkCheckin(p.professor_id, 'Absent')}
                            >
                              Absent
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CREATE MASTER TIMETABLE SLOT MODAL ── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create Master Timetable Slot</h2>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddSlot}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Day of Week</label>
                  <select
                    value={newSlot.day_of_week}
                    onChange={e => setNewSlot({ ...newSlot, day_of_week: e.target.value })}
                  >
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Time Slot</label>
                  <select
                    value={newSlot.time_slot}
                    onChange={e => setNewSlot({ ...newSlot, time_slot: e.target.value })}
                  >
                    <option value="09:00 - 10:30">09:00 - 10:30</option>
                    <option value="10:45 - 12:15">10:45 - 12:15</option>
                    <option value="13:00 - 14:30">13:00 - 14:30</option>
                    <option value="14:45 - 16:15">14:45 - 16:15</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Course Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Advanced Operating Systems"
                    value={newSlot.course_name}
                    onChange={e => setNewSlot({ ...newSlot, course_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Course Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS402"
                    value={newSlot.course_code}
                    onChange={e => setNewSlot({ ...newSlot, course_code: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Room / Lab</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LH-301 or Lab 4"
                    value={newSlot.room}
                    onChange={e => setNewSlot({ ...newSlot, room: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Professor Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Ramesh Kumar"
                    value={newSlot.professor_name}
                    onChange={e => setNewSlot({ ...newSlot, professor_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Branch</label>
                  <select
                    value={newSlot.branch}
                    onChange={e => setNewSlot({ ...newSlot, branch: e.target.value })}
                  >
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Semester</label>
                  <select
                    value={newSlot.semester}
                    onChange={e => setNewSlot({ ...newSlot, semester: parseInt(e.target.value) })}
                  >
                    {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Slot Type</label>
                <select
                  value={newSlot.slot_type}
                  onChange={e => setNewSlot({ ...newSlot, slot_type: e.target.value })}
                >
                  <option value="lecture">Lecture</option>
                  <option value="lab">Laboratory</option>
                  <option value="extra">Extra / Makeup Class</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="pd-btn pd-btn-outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="pd-btn pd-btn-primary">
                  Save Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
