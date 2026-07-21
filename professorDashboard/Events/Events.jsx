import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import './Events.css';

const CATS = ['all', 'hackathon', 'workshop', 'fest', 'general'];

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

const APPROVAL_BADGE = {
  pending:  { label: ' Pending Approval', color: 'var(--clr-warning)' },
  approved: { label: ' Approved', color: 'var(--clr-success)' },
  rejected: { label: ' Rejected', color: 'var(--clr-danger)' },
  live:     { label: ' Live', color: 'var(--clr-success)' },
};

export default function Events() {
  const showToast = useToast();
  const [tab, setTab]   = useState('browse');   // 'browse' | 'my-events' | 'create'
  const [cat, setCat]   = useState('all');
  const [creating, setCreating] = useState(false);

  // Browse: approved/live events only (server filters for professors)
  const { data: browseData, refetch: refetchBrowse } = useApiData(
    '/community/events', { events: [] }
  );

  // My Events (professor's own submissions)
  const { data: myData, refetch: refetchMyEvents } = useApiData(
    tab === 'my-events' ? '/community/events/my-events' : null,
    { events: [] }
  );

  // Assigned classes for class scope dropdown
  const { data: classesData } = useApiData('/professors/me/classes', { classes: [] });
  const assignedClasses = classesData?.classes || [];

  const browseEvents = browseData?.events || [];
  const myEvents     = myData?.events     || [];

  const filteredBrowse = cat === 'all'
    ? browseEvents
    : browseEvents.filter(e => e.tag === cat);

  // Create form
  const [form, setForm] = useState({
    title: '', event_type: 'general', date_time: '', venue: '',
    description: '', class_course_code: '',
  });

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await apiFetch('/community/events', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (res.ok) {
        showToast(
          body.approval_status === 'pending'
            ? ' Event submitted — awaiting Admin approval'
            : ' Event created!',
          'success', 3000
        );
        setForm({ title: '', event_type: 'general', date_time: '', venue: '', description: '', class_course_code: '' });
        setTab('my-events');
        refetchMyEvents();
      } else {
        showToast(body.error || 'Failed to create event', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Campus Events</h1>
          <p className="page-sub">Browse events or submit your own for approval</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`filter-btn ${tab === 'browse' ? 'active' : ''}`} onClick={() => setTab('browse')}>Browse</button>
          <button className={`filter-btn ${tab === 'my-events' ? 'active' : ''}`} onClick={() => setTab('my-events')}>My Events</button>
          <button className="action-btn" onClick={() => setTab('create')}>+ Create Event</button>
        </div>
      </div>

      {/* ── Browse Tab ── */}
      {tab === 'browse' && (
        <>
          <div className="filter-row">
            {CATS.map(c => (
              <button key={c} className={`filter-btn${cat === c ? ' active' : ''}`} onClick={() => setCat(c)}>
                {c === 'all' ? 'All Events' : c.charAt(0).toUpperCase() + c.slice(1) + 's'}
              </button>
            ))}
          </div>
          <div className="events-grid" id="eventsGrid">
            {filteredBrowse.length === 0 ? (
              <p style={{ color: 'var(--clr-muted)', textAlign: 'center', padding: '2rem' }}>No events found.</p>
            ) : filteredBrowse.map(ev => (
              <div className="event-full-card" key={ev.id}>
                <div className={`event-banner ${ev.tag}`} aria-hidden="true">
                  <span className="event-banner-icon">{ev.tag === 'hackathon' ? '' : ev.tag === 'workshop' ? '' : ''}</span>
                </div>
                <div className="event-card-body">
                  <h3 className="event-full-title">{ev.name || ev.title}</h3>
                  <div className="event-details">
                    <span> {ev.meta || ev.date_time}</span>
                    <span>{ev.venue}</span>
                  </div>
                  {ev.desc && <p style={{ fontSize: '0.82rem', color: 'var(--clr-muted)', marginTop: '0.5rem' }}>{ev.desc}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── My Events Tab ── */}
      {tab === 'my-events' && (
        <section className="panel">
          <h2 style={{ marginBottom: '1rem', fontSize: '1rem' }}>My Event Submissions</h2>
          {myEvents.length === 0 ? (
            <p style={{ color: 'var(--clr-muted)', textAlign: 'center', padding: '2rem' }}>
              No events submitted yet. <button className="link-btn" onClick={() => setTab('create')}>Create one →</button>
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {myEvents.map(ev => {
                const badge = APPROVAL_BADGE[ev.approval_status] || APPROVAL_BADGE.pending;
                return (
                  <div key={ev.id} className="class-page-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem' }}>
                    <div>
                      <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.2rem' }}>{ev.title}</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--clr-muted)' }}>
                        {ev.event_type} · {ev.date_time} · {ev.venue}
                      </p>
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.8rem', color: badge.color, whiteSpace: 'nowrap' }}>
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Create Event Tab ── */}
      {tab === 'create' && (
        <section className="panel">
          <h2 style={{ marginBottom: '1rem', fontSize: '1rem' }}>
            Create Event
            <span style={{ marginLeft: '0.75rem', fontSize: '0.78rem', color: 'var(--clr-warning)', fontWeight: 400 }}>
               Professor-created events require Admin approval before going live
            </span>
          </h2>
          <form onSubmit={handleCreate} className="sell-form" style={{ maxWidth: '520px' }}>
            <label>Event Title
              <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </label>
            <label>Type
              <select value={form.event_type} onChange={e => setForm(p => ({ ...p, event_type: e.target.value }))}>
                {['general', 'hackathon', 'workshop', 'fest', 'seminar', 'sports'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </label>
            <label>Date &amp; Time
              <input required value={form.date_time} onChange={e => setForm(p => ({ ...p, date_time: e.target.value }))}
                placeholder="e.g. Dec 15, 2025 · 10:00 AM" />
            </label>
            <label>Venue
              <input required value={form.venue} onChange={e => setForm(p => ({ ...p, venue: e.target.value }))}
                placeholder="e.g. Lecture Hall 201" />
            </label>
            <label>Class Scope (optional — leave blank for all students)
              <select value={form.class_course_code} onChange={e => setForm(p => ({ ...p, class_course_code: e.target.value }))}>
                <option value="">All students (global event)</option>
                {assignedClasses.map(c => (
                  <option key={c.course_code} value={c.course_code}>
                    {c.course_name} ({c.course_code}) — Sem {c.semester}
                  </option>
                ))}
              </select>
            </label>
            <label>Description
              <textarea rows={3} value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Optional — details about the event" />
            </label>
            <button type="submit" className="action-btn" style={{ width: '100%' }} disabled={creating}>
              {creating ? 'Submitting…' : 'Submit for Approval'}
            </button>
          </form>
        </section>
      )}
    </>
  );
}
