import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { StateContainer } from '../../components/StateContainer';
import './Mentorship.css';

export default function Mentorship() {
  const { user } = useAuth();
  const showToast = useToast();
  const isProf = user?.role === 'professor';

  const { data: apiData, loading, error, isEmpty } = useApiData('/api/v1/career/mentors', { mentors: [] });
  const mentors = useMemo(() => apiData?.mentors || [], [apiData]);

  // Student specific mentorship request state
  const [requested, setRequested] = useState(new Set());

  // Professor specific mentorship requests state
  const [profRequests, setProfRequests] = useState(() => user?.mentorshipRequests || []);

  function handleRequest(m) {
    if(requested.has(m.id)){ showToast(`Request already sent to ${m.name}`,'info',2000); return; }
    if(!m.available){ showToast(`${m.name} is currently unavailable. Try again later.`,'info',2500); return; }
    setRequested(p=>new Set([...p,m.id]));
    showToast(`Mentorship request sent to ${m.name}! 🎓`, 'success', 3000);
  }

  function handleAction(reqId, action) {
    const req = profRequests.find(r => r.id === reqId);
    setProfRequests(prev => prev.filter(r => r.id !== reqId));
    if (action === 'accept') {
      showToast(`Accepted mentorship request from ${req.studentName}! 🤝`, 'success', 3000);
    } else {
      showToast(`Declined mentorship request from ${req.studentName}.`, 'info', 2000);
    }
  }

  if (isProf) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Mentorship Requests</h1>
            <p className="page-sub">Review and manage student mentorship requests</p>
          </div>
        </div>

        {profRequests.length > 0 ? (
          <div className="mentor-grid">
            {profRequests.map(req => (
              <div className="mentor-card" key={req.id} style={{ alignItems: 'flex-start', textAlign: 'left' }}>
                <div className="mentor-avatar" style={{ alignSelf: 'center', marginBottom: '0.5rem' }}>👨‍🎓</div>
                <div className="mentor-info" style={{ alignItems: 'flex-start', width: '100%' }}>
                  <h3 className="mentor-name">{req.studentName}</h3>
                  <p className="mentor-role">Roll: {req.roll}</p>
                  <p className="mentor-role" style={{ color: 'var(--clr-text)', fontWeight: 500, marginTop: '0.25rem' }}>
                    Topic: <strong>{req.topic}</strong>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: 'auto' }}>
                  <button className="action-btn" style={{ flex: 1 }} onClick={() => handleAction(req.id, 'accept')}>
                    Accept
                  </button>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => handleAction(req.id, 'decline')}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="lib-empty">No pending mentorship requests.</div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Mentorship</h1><p className="page-sub">Connect with industry experts & faculty mentors</p></div>
      </div>
      <StateContainer loading={loading} error={error} isEmpty={isEmpty} emptyMessage="No mentors are currently registered on the platform.">
        <div className="mentor-grid">
          {mentors.map(m=>(
            <div className="mentor-card" key={m.id}>
              <div className={`mentor-avail-dot${m.available?'':' offline'}`} title={m.available?'Available':'Unavailable'}/>
              <div className="mentor-avatar">{m.img || '👨‍🏫'}</div>
              <div className="mentor-info">
                <h3 className="mentor-name">{m.name}</h3>
                <p className="mentor-role">{m.role}</p>
                <div className="mentor-tags">{m.expertise.map(e=><span key={e} className="intern-tag">{e}</span>)}</div>
                <div className="mentor-stats">
                  <span>⭐ {m.rating}</span>
                  <span>🗓 {m.sessions} sessions</span>
                  <span className={m.available?'avail-text':'unavail-text'}>{m.available?'Available':'Unavailable'}</span>
                </div>
              </div>
              <button className={`action-btn mentor-req-btn${requested.has(m.id)?' applied':''}`} onClick={()=>handleRequest(m)}>
                {requested.has(m.id)?'Requested ✓':'Request Session'}
              </button>
            </div>
          ))}
        </div>
      </StateContainer>
    </>
  );
}
