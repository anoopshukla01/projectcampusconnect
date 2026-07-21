import { X } from "lucide-react";
/**
 * Drives — TPO Portal (PL1–PL5, PL17)
 * Manage recruitment drives and schedule interview slots awaiting Admin approval.
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@ctx/ToastContext';
import { placementApi } from '@/services/api';
import './Drives.css';

const BLANK = {
  company_name: '', role_title: '', drive_type: 'Full-Time',
  batch_year: new Date().getFullYear(), cgpa_cutoff: 7.0,
  backlog_cutoff: 0, ctc_lpa: 12.0, stipend_monthly: 0,
  registration_deadline: '', description: '', location: '', skills_required: '',
  rounds: 3
};

const SCHED_BLANK = {
  student_id: '', day_of_week: 'Monday', time_slot: '09:00 AM - 10:30 AM', room: 'LH-101'
};

const TIME_SLOTS = [
  '09:00 AM - 10:30 AM',
  '11:00 AM - 12:30 PM',
  '02:00 PM - 03:30 PM',
  '04:00 PM - 05:30 PM'
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Drives() {
  const showToast = useToast();
  const [activeTab,    setActiveTab]    = useState('drives'); // 'drives' or 'scheduling'
  const [drives,       setDrives]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [form,         setForm]         = useState(BLANK);
  const [submitting,   setSubmitting]   = useState(false);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatus]       = useState('all');

  // Interview Scheduling State
  const [selectedDriveId, setSelectedDriveId] = useState('');
  const [bookings,        setBookings]        = useState([]);
  const [eligibleStudents,setEligibleStudents]= useState([]);
  const [showSchedModal,  setShowSchedModal]  = useState(false);
  const [schedForm,       setSchedForm]       = useState(SCHED_BLANK);
  const [loadingSched,    setLoadingSched]    = useState(false);

  const fetchDrives = useCallback(async () => {
    setLoading(true);
    const res = await placementApi.listDrives();
    setLoading(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    const driveList = res?.drives || [];
    setDrives(driveList);
    if (driveList.length > 0 && !selectedDriveId) {
      setSelectedDriveId(driveList[0].id);
    }
  }, [selectedDriveId, showToast]);

  useEffect(() => { fetchDrives(); }, [fetchDrives]);

  // Fetch bookings for the selected drive
  const fetchBookings = useCallback(async (driveId) => {
    if (!driveId) return;
    setLoadingSched(true);
    try {
      const res = await fetch(`/api/v1/placement/drives/${driveId}/bookings`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (e) {
      showToast('Failed to load bookings.', 'error');
    }
    setLoadingSched(false);
  }, [showToast]);

  // Fetch eligible students for the selected drive
  const fetchEligibleStudents = useCallback(async (driveId) => {
    if (!driveId) return;
    try {
      const res = await fetch(`/api/v1/placement/drives/${driveId}/eligible`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setEligibleStudents(data.students || []);
      if (data.students?.length > 0) {
        setSchedForm(prev => ({ ...prev, student_id: data.students[0].student_id }));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'scheduling' && selectedDriveId) {
      fetchBookings(selectedDriveId);
      fetchEligibleStudents(selectedDriveId);
    }
  }, [activeTab, selectedDriveId, fetchBookings, fetchEligibleStudents]);

  function openCreate() { setForm(BLANK); setEditTarget(null); setShowModal(true); }
  function openEdit(d)  {
    setForm({
      company_name: d.company_name, role_title: d.role_title,
      drive_type: d.drive_type || 'Full-Time', batch_year: d.batch_year,
      cgpa_cutoff: d.cgpa_cutoff, backlog_cutoff: d.backlog_cutoff || 0,
      ctc_lpa: d.ctc_lpa || 0, stipend_monthly: d.stipend_monthly || 0,
      registration_deadline: d.registration_deadline || '',
      description: d.description || '', location: d.location || '',
      skills_required: d.skills_required || '',
      rounds: d.rounds || 3
    });
    setEditTarget(d.id);
    setShowModal(true);
  }

  async function saveDrive() {
    if (!form.company_name || !form.role_title) {
      showToast('Company name and role title are required.', 'error'); return;
    }
    setSubmitting(true);
    const res = editTarget
      ? await placementApi.updateDrive(editTarget, form)
      : await placementApi.createDrive(form);
    setSubmitting(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(editTarget ? 'Drive updated.' : `Drive for ${form.company_name} scheduled!`, 'success', 3000);
    setShowModal(false);
    fetchDrives();
  }

  async function deleteDrive(id, name) {
    if (!window.confirm(`Delete the ${name} drive?`)) return;
    const res = await placementApi.deleteDrive(id);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Drive deleted.', 'info');
    fetchDrives();
  }

  async function saveBooking() {
    if (!schedForm.student_id) {
      showToast('Please select a student.', 'error'); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/placement/drives/${selectedDriveId}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          student_id: schedForm.student_id,
          day_of_week: schedForm.day_of_week,
          time_slot: schedForm.time_slot,
          room: schedForm.room
        })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to book slot.', 'error');
      } else {
        showToast(data.message || 'Interview scheduled!', 'success');
        setShowSchedModal(false);
        fetchBookings(selectedDriveId);
      }
    } catch (e) {
      showToast('Network error scheduling interview.', 'error');
    }
    setSubmitting(false);
  }

  async function cancelBooking(id) {
    if (!window.confirm('Cancel this interview booking?')) return;
    try {
      const res = await fetch(`/api/v1/placement/drives/bookings/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        showToast('Booking cancelled.', 'info');
        fetchBookings(selectedDriveId);
      } else {
        showToast('Failed to cancel booking.', 'error');
      }
    } catch (e) {
      showToast('Error cancelling booking.', 'error');
    }
  }

  const filtered = drives.filter(d => {
    const q = search.toLowerCase();
    const matchQ = d.company_name?.toLowerCase().includes(q) || d.role_title?.toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || d.status === statusFilter;
    return matchQ && matchS;
  });

  return (
    <div className="dr-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Placement Drives</h1>
          <p className="page-sub">Schedule, manage and track all recruitment drives</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`pd-btn ${activeTab === 'drives' ? 'pd-btn-primary' : 'pd-btn-outline'}`}
            onClick={() => setActiveTab('drives')}>Drives List</button>
          <button className={`pd-btn ${activeTab === 'scheduling' ? 'pd-btn-primary' : 'pd-btn-outline'}`}
            onClick={() => setActiveTab('scheduling')}>Interview Scheduling</button>
        </div>
      </div>

      {activeTab === 'drives' ? (
        <>
          {/* Controls */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <input className="lib-search" style={{ flex: 1, minWidth: '200px' }}
              placeholder="Search company or role…" value={search}
              onChange={e => setSearch(e.target.value)} />
            <button className="pd-btn pd-btn-primary" onClick={openCreate}>+ Schedule Drive</button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
            {['all','active','upcoming','completed','cancelled'].map(s => (
              <button key={s}
                className={`filter-btn${statusFilter === s ? ' active' : ''}`}
                onClick={() => setStatus(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <div className="ad-card">
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Loading drives…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ fontWeight: 600 }}>No drives found</p>
                <p style={{ fontSize: '0.85rem' }}>Click "Schedule Drive" to create one.</p>
              </div>
            ) : (
              <div className="pd-table-wrap">
                <table className="pd-table">
                  <thead>
                    <tr>
                      <th>Company</th><th>Role</th><th>Type</th><th>CTC</th>
                      <th>Rounds</th><th>CGPA</th><th>Deadline</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(d => (
                      <tr key={d.id}>
                        <td><strong>{d.company_name}</strong></td>
                        <td>{d.role_title}</td>
                        <td><span className="ad-badge ad-badge-info">{d.drive_type}</span></td>
                        <td className="pd-ctc">{d.ctc_lpa ? `₹${d.ctc_lpa} LPA` : '—'}</td>
                        <td>{d.rounds || 3}</td>
                        <td>≥ {d.cgpa_cutoff}</td>
                        <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          {d.registration_deadline
                            ? new Date(d.registration_deadline).toLocaleDateString()
                            : 'Open'}
                        </td>
                        <td>
                          <span className={`pd-badge pd-badge-${d.status === 'active' ? 'upcoming' : 'completed'}`}>
                            {d.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button className="co-action-btn" title="Edit" onClick={() => openEdit(d)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                   strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button className="co-action-btn co-action-del" title="Delete"
                              onClick={() => deleteDrive(d.id, d.company_name)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                   strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14H6L5 6"/>
                              </svg>
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
        </>
      ) : (
        <>
          {/* Interview Scheduling Tab View */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'block', marginBottom: '0.4rem' }}>Select Drive:</label>
              <select className="co-input" style={{ width: '100%', maxWidth: '360px', background: '#1e293b' }}
                value={selectedDriveId} onChange={e => setSelectedDriveId(e.target.value)}>
                {drives.map(d => (
                  <option key={d.id} value={d.id}>{d.company_name} — {d.role_title}</option>
                ))}
              </select>
            </div>
            <button className="pd-btn pd-btn-primary" style={{ marginTop: '1.4rem' }}
              onClick={() => {
                if (eligibleStudents.length === 0) {
                  showToast('No eligible students found to book slots.', 'warning');
                }
                setShowSchedModal(true);
              }}>
              + Book Interview Slot
            </button>
          </div>

          <div className="ad-card">
            {loadingSched ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Loading interview bookings…</div>
            ) : bookings.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ fontWeight: 600 }}>No interview slots booked for this drive</p>
                <p style={{ fontSize: '0.85rem' }}>Click "Book Interview Slot" to assign a room and time.</p>
              </div>
            ) : (
              <div className="pd-table-wrap">
                <table className="pd-table">
                  <thead>
                    <tr>
                      <th>Student</th><th>Roll No</th><th>Day</th><th>Time Slot</th><th>Room</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map(b => (
                      <tr key={b.id}>
                        <td><strong>{b.student_name}</strong></td>
                        <td>{b.roll_no}</td>
                        <td>{b.day}</td>
                        <td>{b.time}</td>
                        <td><span className="ad-badge ad-badge-info">{b.room}</span></td>
                        <td>
                          <span className={`pd-badge pd-badge-pending`}>
                            {b.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          <button className="co-action-btn co-action-del" title="Cancel Booking"
                            onClick={() => cancelBooking(b.id)}>
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editTarget ? 'Edit Drive' : 'Schedule Placement Drive'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)} aria-label="Close"><X size={16} aria-hidden="true" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { key: 'company_name',  label: 'Company Name *',  placeholder: 'e.g. Google India' },
                { key: 'role_title',    label: 'Role Title *',     placeholder: 'e.g. Software Engineer' },
                { key: 'location',      label: 'Location',         placeholder: 'e.g. Bangalore' },
                { key: 'skills_required', label: 'Skills (comma-separated)', placeholder: 'Python, SQL, React' },
                { key: 'description',   label: 'Description',      placeholder: 'Drive details…', textarea: true },
              ].map(f => (
                <label key={f.key} style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  {f.label}
                  {f.textarea
                    ? <textarea rows={3} value={form[f.key] || ''}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        style={{ width: '100%', marginTop: '0.3rem', padding: '0.55rem',
                                 borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                                  border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
                                 resize: 'vertical' }} />
                    : <input value={form[f.key] || ''}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        style={{ display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.55rem',
                                 borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                                 border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
                  }
                </label>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { key: 'batch_year',   label: 'Batch Year', type: 'number' },
                  { key: 'cgpa_cutoff',  label: 'CGPA Cutoff', type: 'number', step: '0.1' },
                  { key: 'backlog_cutoff', label: 'Max Backlogs', type: 'number' },
                  { key: 'ctc_lpa',      label: 'CTC (LPA)', type: 'number', step: '0.5' },
                  { key: 'rounds',       label: 'Selection Rounds', type: 'number' },
                ].map(f => (
                  <label key={f.key} style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                    {f.label}
                    <input type={f.type} step={f.step} value={form[f.key] || ''}
                      onChange={e => setForm(p => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))}
                      style={{ display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.55rem',
                               borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                               border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
                  </label>
                ))}
              </div>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Registration Deadline
                <input type="datetime-local" value={form.registration_deadline || ''}
                  onChange={e => setForm(p => ({ ...p, registration_deadline: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.55rem',
                           borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                           border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
              </label>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Drive Type
                <select value={form.drive_type || 'Full-Time'}
                  onChange={e => setForm(p => ({ ...p, drive_type: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.55rem',
                           borderRadius: 8, background: '#1e293b',
                           border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
                  {['Full-Time','Internship','Intern + FTE','Contract'].map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="modal-footer" style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="pd-btn pd-btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="pd-btn pd-btn-primary" onClick={saveDrive} disabled={submitting}>
                {submitting ? 'Saving…' : editTarget ? 'Save Changes' : 'Schedule Drive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Book Interview Modal */}
      {showSchedModal && (
        <div className="modal-overlay" onClick={() => setShowSchedModal(false)}>
          <div className="modal-box" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Book Interview Slot</h2>
              <button className="modal-close" onClick={() => setShowSchedModal(false)} aria-label="Close"><X size={16} aria-hidden="true" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Eligible Student *
                <select className="co-input" style={{ background: '#1e293b', width: '100%', marginTop: '0.3rem' }}
                  value={schedForm.student_id}
                  onChange={e => setSchedForm(p => ({ ...p, student_id: e.target.value }))}>
                  {eligibleStudents.length === 0 && <option value="">No eligible students found</option>}
                  {eligibleStudents.map(s => (
                    <option key={s.student_id} value={s.student_id}>{s.full_name} ({s.roll_no}) — Rank {s.rank}</option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Interview Day *
                <select className="co-input" style={{ background: '#1e293b', width: '100%', marginTop: '0.3rem' }}
                  value={schedForm.day_of_week}
                  onChange={e => setSchedForm(p => ({ ...p, day_of_week: e.target.value }))}>
                  {DAYS.map(d => <option key={d}>{d}</option>)}
                </select>
              </label>

              <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Time Slot *
                <select className="co-input" style={{ background: '#1e293b', width: '100%', marginTop: '0.3rem' }}
                  value={schedForm.time_slot}
                  onChange={e => setSchedForm(p => ({ ...p, time_slot: e.target.value }))}>
                  {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
                </select>
              </label>

              <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Venue / Room *
                <input className="co-input" style={{ width: '100%', marginTop: '0.3rem' }}
                  placeholder="e.g. Room 102" value={schedForm.room}
                  onChange={e => setSchedForm(p => ({ ...p, room: e.target.value }))} />
              </label>
            </div>
            <div className="modal-footer" style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="pd-btn pd-btn-outline" onClick={() => setShowSchedModal(false)}>Cancel</button>
              <button className="pd-btn pd-btn-primary" onClick={saveBooking} disabled={submitting}>
                {submitting ? 'Scheduling…' : 'Schedule Interview'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
