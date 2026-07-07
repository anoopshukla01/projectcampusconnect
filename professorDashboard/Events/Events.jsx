import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import './Events.css';

const EVENTS_DATA = [
  { id:1, title:'Hackathon Hyperion 4.0', organizer:'E-CELL & INNOVATION HUB', date:'Dec 04-05, 2026', time:'09:00 AM onwards', location:'Central Computing Lab-2', category:'hackathon', spots:'12 teams remaining' },
  { id:2, title:'TechSpark 2026: Annual Technical Fest', organizer:'STUDENT ACADEMIC COUNCIL', date:'Dec 08-10, 2026', time:'10:00 AM – 06:00 PM', location:'Main Campus Auditorium', category:'fest', spots:'Public Entry' },
  { id:3, title:'Deep Learning & NLP Masterclass', organizer:'DEPT. OF COMPUTER SCIENCE', date:'Nov 29, 2026', time:'11:00 AM – 02:00 PM', location:'Lecture Hall 201', category:'workshop', spots:'45/80 seats filled' },
  { id:4, title:'Cultural Odyssey: Fusion Music Night', organizer:'CAMPUS CULTURAL CLUB', date:'Dec 12, 2026', time:'06:00 PM – 09:30 PM', location:'Open Air Theatre (OAT)', category:'fest', spots:'Passes required' },
  { id:5, title:'UI/UX Design Sprint & Portfolio Review', organizer:'DESIGN CIRCLE', date:'Dec 02, 2026', time:'02:00 PM – 05:00 PM', location:'Seminar Room-3', category:'workshop', spots:'12 seats remaining' },
];

const CATS = ['all','hackathon','workshop','fest'];
const TAG_COLORS = { hackathon:'#7e22ce', workshop:'#1e40af', fest:'#b45309', talk:'#0f766e' };

export default function Events() {
  const showToast = useToast();
  const [cat, setCat]    = useState('all');
  const [events, setEvents] = useState(EVENTS_DATA.map(e=>({...e,registered:false})));

  const filtered = cat==='all' ? events : events.filter(e=>e.category===cat);

  function handleRegister(id) {
    const ev = events.find(e=>e.id===id);
    if (ev.registered) { showToast(`You've already registered for "${ev.title}".`,'info',2500); return; }
    setEvents(p=>p.map(e=>e.id===id?{...e,registered:true}:e));
    showToast(`🎉 Registered for "${ev.title}"!`,'success',3000);
  }

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Campus Events</h1><p className="page-sub">{events.filter(e=>e.registered).length} events registered</p></div>
      </div>
      <div className="filter-row">
        {CATS.map(c=><button key={c} className={`filter-btn${cat===c?' active':''}`} onClick={()=>setCat(c)}>{c==='all'?'All Events':c.charAt(0).toUpperCase()+c.slice(1)+'s'}</button>)}
      </div>
      <div className="events-grid" id="eventsGrid">
        {filtered.map(ev=>(
          <div className="event-full-card" key={ev.id}>
            <div className={`event-banner ${ev.category}`} aria-hidden="true">
              <span className="event-banner-icon">{ev.category==='hackathon'?'⚡':ev.category==='workshop'?'🎓':'🎉'}</span>
            </div>
            <div className="event-card-body">
              <div className="event-org">{ev.organizer}</div>
              <h3 className="event-full-title">{ev.title}</h3>
              <div className="event-details">
                <span>📅 {ev.date}</span>
                <span>🕐 {ev.time}</span>
                <span>📍 {ev.location}</span>
                <span>💺 {ev.spots}</span>
              </div>
              <button className={`event-btn${ev.registered?' registered':''}`} onClick={()=>handleRegister(ev.id)}>
                {ev.registered ? 'Registered ✓' : 'Register Now'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
