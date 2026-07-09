/**
 * Mock Interviews — Student Portal
 *
 * Browse active sessions, book a slot (idempotent — server handles duplicates).
 * Shows already-booked state from server response.
 */

import { useState, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { careerApi } from '../../services/api';
import { StateContainer } from '../../components/StateContainer';
import './MockInterviews.css';

const DIFF_COLORS = { Easy: '#15803d', Medium: '#854d0e', Hard: '#b91c1c' };

export default function MockInterviews() {
  const showToast = useToast();
  const [booking, setBooking] = useState({});

  const { data: apiData, loading, error, isEmpty, refetch } = useApiData(
    '/career/mock-interviews',
    { sessions: [] },
  );
  const sessions = useMemo(() => apiData?.sessions || [], [apiData]);

  async function handleBook(s) {
    if (s.booked) {
      showToast(`You're already booked for ${s.type}!`, 'info', 2000); return;
    }
    setBooking(p => ({ ...p, [s.id]: true }));
    const res = await careerApi.bookMockInterview(s.id);
    setBooking(p => ({ ...p, [s.id]: false }));

    if (res?.error) {
      showToast(res.error, 'error'); return;
    }
    showToast(
      res?.already_booked
        ? `Already booked for ${s.type}.`
        : `Mock interview booked: ${s.type} on ${s.slots}! 🎯`,
      'success', 3000,
    );
    refetch(); // refresh booked state from server
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mock Interviews</h1>
          <p className="page-sub">Practice real interview rounds with peer reviewers</p>
        </div>
      </div>

      {/* Tips */}
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
                    <span style={{
                      color: DIFF_COLORS[s.difficulty] || 'var(--clr-primary)',
                      fontWeight: 700,
                    }}>
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
    </>
  );
}
