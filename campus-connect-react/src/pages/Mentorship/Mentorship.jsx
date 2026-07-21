/**
 * Mentorship — Student & Professor Portal
 *
 * Student:   browse mentors, send request (idempotent), see existing requests.
 * Professor: view incoming requests, accept or decline each one.
 *
 * Role enforced server-side.
 */

import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { careerApi } from '../../services/api';
import { StateContainer } from '../../components/StateContainer';
import { GraduationCap, User, Calendar, X, Check } from 'lucide-react';
import './Mentorship.css';

export default function Mentorship() {
  const { user, isProfessor } = useAuth();
  const showToast = useToast();

  // ── Student: mentor list ───────────────────────────────────────────────────
  const { data: mentorData, loading, error, isEmpty, refetch } = useApiData(
    '/career/mentors',
    { mentors: [] },
  );
  const mentors = useMemo(() => mentorData?.mentors || [], [mentorData]);

  const [requesting, setRequesting] = useState({});
  const [topicModal, setTopicModal] = useState(null); // mentor object or null
  const [topicInput, setTopicInput] = useState('');

  async function handleRequest(mentor) {
    if (mentor.requested) {
      showToast(`Request already sent to ${mentor.name}.`, 'info', 2000); return;
    }
    if (!mentor.available) {
      showToast(`${mentor.name} is currently unavailable.`, 'info', 2500); return;
    }
    setTopicModal(mentor);
    setTopicInput('');
  }

  async function submitRequest(e) {
    e.preventDefault();
    if (!topicModal) return;
    setRequesting(p => ({ ...p, [topicModal.id]: true }));
    const res = await careerApi.requestMentorship(topicModal.id, { topic: topicInput });
    setRequesting(p => ({ ...p, [topicModal.id]: false }));
    setTopicModal(null);
    if (res?.error && !res?.already_requested) {
      showToast(res.error, 'error'); return;
    }
    showToast(`Mentorship request sent to ${topicModal.name}! 🎓`, 'success', 3000);
    refetch();
  }

  // ── Professor: incoming requests ──────────────────────────────────────────
  const { data: reqData, loading: reqLoading, refetch: refetchReqs } = useApiData(
    isProfessor ? '/career/mentors/requests' : null,
    { requests: [] },
  );
  const profRequests = useMemo(() => reqData?.requests || [], [reqData]);
  const [responding, setResponding] = useState({});

  async function handleAction(reqId, studentName, action) {
    setResponding(p => ({ ...p, [reqId]: true }));
    const res = await careerApi.respondToMentorshipRequest(reqId, action);
    setResponding(p => ({ ...p, [reqId]: false }));
    if (res?.error) { showToast(res.error, 'error'); return; }
    showToast(
      action === 'accept'
        ? `Accepted request from ${studentName}! 🤝`
        : `Declined request from ${studentName}.`,
      action === 'accept' ? 'success' : 'info',
      3000,
    );
    refetchReqs();
  }

  // ── Professor view ─────────────────────────────────────────────────────────
  if (isProfessor) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Mentorship Requests</h1>
            <p className="page-sub">
              {reqLoading ? 'Loading…' : `${profRequests.length} pending request${profRequests.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {reqLoading ? (
          <p style={{ textAlign: 'center', color: 'var(--clr-muted)', padding: '3rem' }}>Loading…</p>
        ) : profRequests.length === 0 ? (
          <div className="lib-empty">No pending mentorship requests.</div>
        ) : (
          <div className="mentor-grid">
            {profRequests.map(req => (
              <div className="mentor-card" key={req.id} style={{ alignItems: 'flex-start', textAlign: 'left' }}>
                <div className="mentor-avatar" style={{ alignSelf: 'center', marginBottom: '0.5rem' }}><GraduationCap size={24} aria-hidden="true" /></div>
                <div className="mentor-info" style={{ alignItems: 'flex-start', width: '100%' }}>
                  <h3 className="mentor-name">{req.student_name}</h3>
                  <p className="mentor-role">Roll: {req.roll}</p>
                  <p className="mentor-role" style={{ color: 'var(--clr-text)', fontWeight: 500, marginTop: '0.25rem' }}>
                    Topic: <strong>{req.topic}</strong>
                  </p>
                  {req.message && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--clr-muted)', marginTop: '0.25rem' }}>
                      {req.message}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: 'auto' }}>
                  <button className="action-btn" style={{ flex: 1 }}
                    disabled={responding[req.id]}
                    onClick={() => handleAction(req.id, req.student_name, 'accept')}>
                    {responding[req.id] ? '…' : 'Accept'}
                  </button>
                  <button className="btn-secondary" style={{ flex: 1 }}
                    disabled={responding[req.id]}
                    onClick={() => handleAction(req.id, req.student_name, 'decline')}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  // ── Student view ───────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mentorship</h1>
          <p className="page-sub">Connect with faculty &amp; industry mentors</p>
        </div>
      </div>

      <StateContainer loading={loading} error={error} isEmpty={isEmpty}
        emptyMessage="No mentors registered yet. Check back soon.">
        <div className="mentor-grid">
          {mentors.map(m => (
            <div className="mentor-card" key={m.id}>
              <div className={`mentor-avail-dot${m.available ? '' : ' offline'}`}
                   title={m.available ? 'Available' : 'Unavailable'} />
              <div className="mentor-avatar"><User size={24} aria-hidden="true" /></div>
              <div className="mentor-info">
                <h3 className="mentor-name">{m.name}</h3>
                <p className="mentor-role">{m.role}</p>
                <div className="mentor-tags">
                  {(m.expertise || []).map(e => (
                    <span key={e} className="intern-tag">{e.trim()}</span>
                  ))}
                </div>
                <div className="mentor-stats">
                  <span>⭐ {m.rating}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Calendar size={14} aria-hidden="true" /> {m.sessions} sessions</span>
                  <span className={m.available ? 'avail-text' : 'unavail-text'}>
                    {m.available ? 'Available' : 'Unavailable'}
                  </span>
                </div>
              </div>
              <button
                className={`action-btn mentor-req-btn${m.requested ? ' applied' : ''}`}
                disabled={requesting[m.id]}
                onClick={() => handleRequest(m)}>
                {requesting[m.id] ? '…' : m.requested ? 'Requested' : 'Request Session'}
              </button>
            </div>
          ))}
        </div>
      </StateContainer>

      {/* Topic modal */}
      {topicModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true"
             onClick={e => e.target === e.currentTarget && setTopicModal(null)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>Request Session — {topicModal.name}</h2>
              <button className="modal-close" onClick={() => setTopicModal(null)} aria-label="Close"><X size={16} aria-hidden="true" /></button>
            </div>
            <form onSubmit={submitRequest} className="sell-form">
              <label>
                What would you like to discuss? *
                <input required value={topicInput}
                  onChange={e => setTopicInput(e.target.value)}
                  placeholder="e.g. Career guidance, DSA prep, research opportunities" />
              </label>
              <button type="submit" className="action-btn" style={{ width: '100%' }}
                disabled={requesting[topicModal.id]}>
                {requesting[topicModal.id] ? 'Sending…' : 'Send Request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
