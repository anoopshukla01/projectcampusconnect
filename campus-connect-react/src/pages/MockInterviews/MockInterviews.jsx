import { useState, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { StateContainer } from '../../components/StateContainer';
import './MockInterviews.css';

const DIFF_COLORS = { Easy:'#15803d', Medium:'#854d0e', Hard:'#b91c1c' };

export default function MockInterviews() {
  const showToast = useToast();
  const [booked, setBooked] = useState(new Set());

  const { data: apiData, loading, error, isEmpty } = useApiData('/api/v1/career/mock-interviews', { sessions: [] });
  const sessions = useMemo(() => apiData?.sessions || [], [apiData]);

  function handleBook(s) {
    if(booked.has(s.id)){ showToast(`You're already booked for ${s.type}!`,'info',2000); return; }
    setBooked(p=>new Set([...p,s.id]));
    showToast(`Mock interview booked: ${s.type} on ${s.slots}!`,'success',3000);
  }

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Mock Interviews</h1><p className="page-sub">Practice real interview rounds with peer reviewers</p></div>
      </div>

      {/* Tips */}
      <div className="tips-grid">
        {['🎯 Review your core CS fundamentals before each session','📝 Take notes and track your weak areas','🔄 Re-book rounds you struggled with to improve','💬 Request feedback from your interviewer after each session'].map((tip,i)=>(
          <div className="tip-card" key={i}><p>{tip}</p></div>
        ))}
      </div>

      {/* Sessions */}
      <section className="panel" aria-labelledby="sessionsTitle">
        <div className="panel-header"><h2 className="panel-title" id="sessionsTitle">Available Mock Sessions</h2></div>
        <StateContainer loading={loading} error={error} isEmpty={isEmpty} emptyMessage="No mock interview slots scheduled yet. check back soon!">
          <div className="mock-grid">
            {sessions.map(s=>(
              <div className="mock-card" key={s.id}>
                <div className="mock-icon">💻</div>
                <div className="mock-body">
                  <h3 className="mock-type">{s.type}</h3>
                  <p className="mock-company">{s.company}</p>
                  <div className="mock-meta">
                    <span style={{color:DIFF_COLORS[s.difficulty] || 'var(--clr-primary)',fontWeight:700}}>{s.difficulty}</span>
                    <span>{s.duration} min</span>
                    <span>📅 {s.slots}</span>
                  </div>
                </div>
                <button className={`action-btn mock-book-btn${booked.has(s.id)?' applied':''}`} onClick={()=>handleBook(s)}>
                  {booked.has(s.id)?'Booked ✓':'Book Slot'}
                </button>
              </div>
            ))}
          </div>
        </StateContainer>
      </section>
    </>
  );
}
