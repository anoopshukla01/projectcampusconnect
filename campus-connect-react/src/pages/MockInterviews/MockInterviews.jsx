/**
 * Mock Interviews — Student Portal
 *
 * Tabs:
 *   • Available Sessions  — browse + book a slot
 *   • My Bookings         — status, feedback, score, room URL
 *
 * Book is idempotent — server handles duplicates gracefully.
 */

import { useState, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { careerApi } from '../../services/api';
import { StateContainer } from '../../components/StateContainer';
import './MockInterviews.css';

const DIFF_COLORS = { Easy: '#15803d', Medium: '#854d0e', Hard: '#b91c1c' };

const STATUS_BADGE = {
  pending:   { label: 'Pending',   color: '#92400e', bg: '#fef3c7' },
  completed: { label: 'Completed', color: '#065f46', bg: '#d1fae5' },
  no_show:   { label: 'No-Show',   color: '#7f1d1d', bg: '#fee2e2' },
};

export default function MockInterviews() {
  const showToast = useToast();
  const [tab,     setTab]     = useState('available'); // 'available' | 'bookings'
  const [booking, setBooking] = useState({});

  // Available sessions
  const { data: apiData, loading, error, isEmpty, refetch } = useApiData(
    '/career/mock-interviews',
    { sessions: [] },
  );
  const sessions = useMemo(() => apiData?.sessions || [], [apiData]);

  // My bookings
  const {
    data: myData,
    loading: myLoading,
    refetch: refetchMy,
  } = useApiData('/career/mock-interviews/me', { bookings: [] });
  const myBookings = useMemo(() => myData?.bookings || [], [myData]);

  async function handleBook(s) {
    if (s.booked) {
      showToast(`You're already booked for ${s.type}!`, 'info', 2000); return;
    }
    setBooking(p => ({ ...p, [s.id]: true }));
    const res = await careerApi.bookMockInterview(s.id);
    setBooking(p => ({ ...p, [s.id]: false }));

    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(
      res?.already_booked
        ? `Already booked for ${s.type}.`
        : `Mock interview booked: ${s.type} on ${s.slots}! 🎯`,
      'success', 3000,
    );
    refetch();
    refetchMy();
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mock Interviews</h1>
          <p className="page-sub">Practice real interview rounds with peer reviewers</p>
        </div>
        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`filter-btn${tab === 'available' ? ' active' : ''}`}
            onClick={() => setTab('available')}>
            Available Sessions
          </button>
          <button
            className={`filter-btn${tab === 'bookings' ? ' active' : ''}`}
            onClick={() => { setTab('bookings'); refetchMy(); }}>
            My Bookings {myBookings.length > 0 && `(${myBookings.length})`}
          </button>
        </div>
      </div>

      {/* Tips */}
      {tab === 'available' && (
        <div className="tips-grid">
          {[
            '🎯 Review core CS fundamentals before each session',
            '📝 Take notes and track your weak areas',
            '🔄 Re-book rounds you struggled with to improve',
            '💬 Request feedback from your interviewer after each session',
          ].map((tip, i) => (
            <div className="tip-card" key={i}><p>{tip}</p></div>
          ))}
        </div>
      )}

      {/* ── Tab: Available Sessions ── */}
      {tab === 'available' && (
        <section className="panel" aria-labelledby="sessionsTitle">
          <div className="panel-header">
            <h2 className="panel-title" id="sessionsTitle">Available Mock Sessions</h2>
          </div>
          <StateContainer loading={loading} error={error} isEmpty={isEmpty}
            emptyMessage="No mock interview slots scheduled yet. Check back soon!">
            <div className="mock-grid">
              {sessions.map(s => (
                <div className="mock-card" key={s.id}>
                  <div className="mock-icon">💻</div>
                  <div className="mock-body">
                    <h3 className="mock-type">{s.type}</h3>
                    <p className="mock-company">{s.company}</p>
                    <div className="mock-meta">
                      <span style={{ color: DIFF_COLORS[s.difficulty] || 'var(--clr-primary)', fontWeight: 700 }}>
                        {s.difficulty}
                      </span>
                      <span>{s.duration} min</span>
                      <span>📅 {s.slots}</span>
                    </div>
                  </div>
                  <button
                    className={`action-btn mock-book-btn${s.booked ? ' applied' : ''}`}
                    disabled={booking[s.id]}
                    onClick={() => handleBook(s)}>
                    {booking[s.id] ? '…' : s.booked ? 'Booked ✓' : 'Book Slot'}
                  </button>
                </div>
              ))}
            </div>
          </StateContainer>
        </section>
      )}

      {/* ── Tab: My Bookings ── */}
      {tab === 'bookings' && (
        <section className="panel" aria-labelledby="myBookingsTitle">
          <div className="panel-header">
            <h2 className="panel-title" id="myBookingsTitle">My Interview Bookings</h2>
          </div>
          {myLoading ? (
            <p style={{ padding: '1rem', color: 'var(--clr-muted)' }}>Loading your bookings…</p>
          ) : myBookings.length === 0 ? (
            <p style={{ padding: '1rem', color: 'var(--clr-muted)' }}>
              You haven't booked any mock interviews yet.
            </p>
          ) : (
            <div className="attend-table-wrap">
              <table className="attend-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Scheduled</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Feedback</th>
                    <th>Room</th>
                  </tr>
                </thead>
                <tbody>
                  {myBookings.map(b => {
                    const badge = STATUS_BADGE[b.status] || STATUS_BADGE.pending;
                    return (
                      <tr key={b.booking_id}>
                        <td>
                          <strong>{b.session_type || '—'}</strong>
                          <br/>
                          <span style={{ fontSize: '0.78rem', color: 'var(--clr-muted)' }}>
                            {b.company} · {b.difficulty}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{b.scheduled_at}</td>
                        <td>
                          <span style={{
                            background: badge.bg,
                            color: badge.color,
                            padding: '0.15rem 0.55rem',
                            borderRadius: '999px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                          }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                          {b.score != null ? `${b.score}/10` : '—'}
                        </td>
                        <td style={{ maxWidth: '220px', fontSize: '0.82rem', color: 'var(--clr-text)' }}>
                          {b.feedback || <span style={{ color: 'var(--clr-muted)' }}>Awaiting feedback</span>}
                        </td>
                        <td>
                          {b.room_url ? (
                            <a href={b.room_url} target="_blank" rel="noopener noreferrer"
                              className="action-btn"
                              style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem', textDecoration: 'none' }}>
                              Join Room 🔗
                            </a>
                          ) : (
                            <span style={{ color: 'var(--clr-muted)', fontSize: '0.82rem' }}>—</span>
                          )}
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
