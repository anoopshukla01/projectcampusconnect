import { useState, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { StateContainer } from '../../components/StateContainer';
import './Events.css';

const CATS = ['all','hackathon','workshop','fest'];
const TAG_COLORS = { hackathon:'#7e22ce', workshop:'#1e40af', fest:'#b45309', talk:'#0f766e' };

export default function Events() {
  const showToast = useToast();
  const [cat, setCat]    = useState('all');

  const { data: apiData, loading, error, isEmpty } = useApiData('/api/v1/community/events', { events: [] });
  const [registeredIds, setRegisteredIds] = useState([]);

  const events = useMemo(() => apiData?.events || [], [apiData]);

  const filtered = cat==='all' ? events : events.filter(e=>(e.tag || e.category)===cat);

  function handleRegister(id, title) {
    if (registeredIds.includes(id)) { showToast(`You've already registered for "${title}".`,'info',2500); return; }
    setRegisteredIds(p => [...p, id]);
    showToast(`🎉 Registered for "${title}"!`,'success',3000);
  }

  return (
    <StateContainer loading={loading} error={error} isEmpty={isEmpty} emptyMessage="No campus events scheduled yet.">
      <div className="page-header">
        <div><h1 className="page-title">Campus Events</h1><p className="page-sub">{registeredIds.length} events registered</p></div>
      </div>
      <div className="filter-row">
        {CATS.map(c=><button key={c} className={`filter-btn${cat===c?' active':''}`} onClick={()=>setCat(c)}>{c==='all'?'All Events':c.charAt(0).toUpperCase()+c.slice(1)+'s'}</button>)}
      </div>
      <div className="events-grid" id="eventsGrid">
        {filtered.map(ev=>(
          <div className="event-full-card" key={ev.id}>
            <div className="event-full-header">
              <span className="event-tag" style={{ background: TAG_COLORS[ev.tag || ev.category] || '#1e40af', color: '#fff' }}>{(ev.tag || ev.category || 'Event').toUpperCase()}</span>
              <span className="event-spots">{ev.spots || 'Open'}</span>
            </div>
            <h2 className="event-full-name">{ev.name || ev.title}</h2>
            <p className="event-organizer">{ev.organizer || 'Campus Connect'}</p>
            <div className="event-details">
              <span>📅 {ev.meta || ev.date}</span>
              <span>📍 {ev.venue || ev.location}</span>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--clr-muted)', margin: '0.5rem 0 1rem 0' }}>{ev.desc}</p>
            <button className={`action-btn${registeredIds.includes(ev.id) ? ' btn-secondary' : ''}`} style={{ width:'100%' }} onClick={()=>handleRegister(ev.id, ev.name || ev.title)}>
              {registeredIds.includes(ev.id) ? 'Registered ✓' : 'Register Now'}
            </button>
          </div>
        ))}
      </div>
    </StateContainer>
  );
}
