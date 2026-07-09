/**
 * Events — Student / Professor / Admin Portal
 *
 * Student:   browse + register / unregister
 * Professor & Admin: additionally create / edit / delete events
 *
 * Role enforced server-side; we only gate the UI for convenience.
 */

import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { communityApi } from '../../services/api';
import { StateContainer } from '../../components/StateContainer';
import './Events.css';

const CATS = ['all', 'hackathon', 'workshop', 'fest', 'talk', 'general'];
const TAG_COLORS = {
  hackathon: '#7e22ce', workshop: '#1e40af', fest: '#b45309',
  talk: '#0f766e', general: '#374151',
};

const BLANK_EVENT = {
  title: '', event_type: 'hackathon', date_time: '',
  venue: '', description: '',
};

export default function Events() {
  const { user, isProfessor, isAdmin } = useAuth();
  const showToast = useToast();

  const [cat, setCat] = useState('all');

  const { data: apiData, loading, error, isEmpty, refetch } = useApiData(
    '/community/events',
    { events: [] },
  );
  const events = useMemo(() => apiData?.events || [], [apiData]);

  // Local registration state (optimistic — backend just acks)
  const [registeredIds, setRegisteredIds] = useState([]);
  const [registering,   setRegistering]   = useState({});

  // Create / Edit modal
  const [modal,      setModal]      = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form,       setForm]       = useState(BLANK_EVENT);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState({});

  const canManage = isProfessor || isAdmin;

  const filtered = useMemo(() =>
    cat === 'all' ? events : events.filter(e => (e.tag || e.category || e.event_type) === cat),
    [events, cat],
  );

  // ── Register / Unregister ─────────────────────────────────────────────────
  async function handleRegister(ev) {
    if (registeredIds.includes(ev.id)) {
      setRegistering(p => ({ ...p, [ev.id]: true }));
      await communityApi.unregisterFromEvent(ev.id);
      setRegistering(p => ({ ...p, [ev.id]: false }));
      setRegisteredIds(p => p.filter(id => id !== ev.id));
      showToast(`Unregistered from "${ev.name || ev.title}".`, 'info');
    } else {
      setRegistering(p => ({ ...p, [ev.id]: true }));
      const res = await communityApi.registerForEvent(ev.id);
      setRegistering(p => ({ ...p, [ev.id]: false }));
      if (res?.error) { showToast(res.error, 'error'); return; }
      setRegisteredIds(p => [...p, ev.id]);
      showToast(`🎉 Registered for "${ev.name || ev.title}"!`, 'success', 3000);
    }
  }

  // ── Create / Edit ─────────────────────────────────────────────────────────
  function openCreate() { setForm(BLANK_EVENT); setEditTarget(null); setModal(true); }
  function openEdit(ev) {
    setForm({
      title:       ev.name  || ev.title       || '',
      event_type:  ev.tag   || ev.event_type  || 'general',
      date_time:   ev.meta  || ev.date_time   || ev.date || '',
      venue:       ev.venue || ev.location    || '',
      description: ev.desc  || ev.description || '',
    });
    setEditTarget(ev.id);
    setModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title || !form.date_time) {
      showToast('Title and date/time are required.', 'error'); return;
    }
    setSaving(true);
    const res = editTarget
      ? await communityApi.updateEvent(editTarget, form)
      : await communityApi.createEvent(form);
    setSaving(false);
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(editTarget ? 'Event updated.' : 'Event created!', 'success', 2500);
    setModal(false);
    refetch();
  }

  async function handleDelete(evId, title) {
    if (!window.confirm(`Delete event "${title}"?`)) return;
    setDeleting(p => ({ ...p, [evId]: true }));
    const res = await communityApi.deleteEvent(evId);
    setDeleting(p => ({ ...p, [evId]: false }));
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast('Event deleted.', 'info');
    refetch();
  }

  return (
    <StateContainer loading={loading} error={error} isEmpty={isEmpty && !canManage}
      emptyMessage="No campus events scheduled yet.">

      <div className="page-header">
        <div>
          <h1 className="page-title">Campus Events</h1>
          <p className="page-sub">{registeredIds.length} registered · {events.length} total</p>
        </div>
        {canManage && (
          <button className="action-btn" onClick={openCreate}>+ Create Event</button>
        )}
      </div>

      {/* Category filter */}
      <div className="filter-row">
        {CATS.map(c => (
          <button key={c}
            className={`filter-btn${cat === c ? ' active' : ''}`}
            onClick={() => setCat(c)}>
            {c === 'all' ? 'All Events' : c.charAt(0).toUpperCase() + c.slice(1) + 's'}
          </button>
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <p style={{ textAlign: 'center', color: 'var(--clr-muted)', padding: '2rem' }}>
          No events in this category.
        </p>
      )}

      <div className="events-grid" id="eventsGrid">
        {filtered.map(ev => {
          const typeKey = ev.tag || ev.event_type || ev.category || 'general';
          const isReg   = registeredIds.includes(ev.id);
          return (
            <div className="event-full-card" key={ev.id}>
              <div className="event-full-header">
                <span className="event-tag"
                  style={{ background: TAG_COLORS[typeKey] || '#374151', color: '#fff' }}>
                  {typeKey.toUpperCase()}
                </span>
                {canManage && (
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button className="edit-schedule-btn" aria-label="Edit event"
                      onClick={() => openEdit(ev)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                           strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button className="edit-schedule-btn" aria-label="Delete event"
                      style={{ color: 'var(--clr-danger, #ef4444)' }}
                      disabled={deleting[ev.id]}
                      onClick={() => handleDelete(ev.id, ev.name || ev.title)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                           strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              <h2 className="event-full-name">{ev.name || ev.title}</h2>
              <div className="event-details">
                <span>📅 {ev.meta || ev.date_time || ev.date}</span>
                <span>📍 {ev.venue || ev.location}</span>
              </div>
              {ev.desc || ev.description ? (
                <p style={{ fontSize: '0.825rem', color: 'var(--clr-muted)', margin: '0.5rem 0 1rem' }}>
                  {ev.desc || ev.description}
                </p>
              ) : <div style={{ flex: 1 }} />}

              <button
                className={`action-btn${isReg ? ' btn-secondary' : ''}`}
                style={{ width: '100%' }}
                disabled={registering[ev.id]}
                onClick={() => handleRegister(ev)}>
                {registering[ev.id] ? '…'
                  : isReg ? 'Registered ✓'
                  : 'Register Now'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="modal-overlay" role="dialog" aria-modal="true"
             onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>{editTarget ? 'Edit Event' : 'Create Event'}</h2>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="sell-form">
              <label>
                Title *
                <input required value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Hackathon Hyperion 5.0" />
              </label>
              <label>
                Type
                <select value={form.event_type}
                  onChange={e => setForm(p => ({ ...p, event_type: e.target.value }))}>
                  {CATS.filter(c => c !== 'all').map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </label>
              <label>
                Date &amp; Time *
                <input required value={form.date_time}
                  onChange={e => setForm(p => ({ ...p, date_time: e.target.value }))}
                  placeholder="e.g. Dec 15 · 5:00 PM" />
              </label>
              <label>
                Venue
                <input value={form.venue}
                  onChange={e => setForm(p => ({ ...p, venue: e.target.value }))}
                  placeholder="e.g. Main Auditorium" />
              </label>
              <label>
                Description
                <textarea rows={3} value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Event details…"
                  style={{ resize: 'vertical', width: '100%' }} />
              </label>
              <button type="submit" className="action-btn" style={{ width: '100%' }}
                disabled={saving}>
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Event'}
              </button>
            </form>
          </div>
        </div>
      )}
    </StateContainer>
  );
}
