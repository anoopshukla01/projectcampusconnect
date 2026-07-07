import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './Mentorship.css';

const MENTORS = [
  { id:1, name:'Dr. Vikram Singh',   role:'Professor, CS Dept.',    expertise:['DSA','Compilers','Research'],    rating:4.9, sessions:48, available:true, img:'👨‍🏫' },
  { id:2, name:'Priya Gupta',        role:'SDE-2 at Google',        expertise:['System Design','DSA','OOP'],     rating:4.8, sessions:32, available:true, img:'👩‍💻' },
  { id:3, name:'Arjun Kapoor',       role:'PM at Razorpay',         expertise:['Product','Analytics','Strategy'],rating:4.7, sessions:21, available:false,img:'👨‍💼' },
  { id:4, name:'Dr. Sneha Menon',    role:'Research Scientist, IISc',expertise:['ML','NLP','CV'],                rating:5.0, sessions:15, available:true, img:'👩‍🔬' },
  { id:5, name:'Rohit Sharma',       role:'Startup Founder, EdTech', expertise:['Startups','Fundraising','MVP'],  rating:4.6, sessions:27, available:true, img:'🧑‍🚀' },
  { id:6, name:'Kavya Nair',         role:'Data Scientist at Amazon',expertise:['Python','ML','SQL'],            rating:4.8, sessions:38, available:false,img:'👩‍💻' },
];

export default function Mentorship() {
  const { user } = useAuth();
  const showToast = useToast();
  const isProf = user?.role === 'professor';

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

  // Student view
  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Mentorship</h1><p className="page-sub">Connect with industry experts & faculty mentors</p></div>
      </div>
      <div className="mentor-grid">
        {MENTORS.map(m=>(
          <div className="mentor-card" key={m.id}>
            <div className={`mentor-avail-dot${m.available?'':' offline'}`} title={m.available?'Available':'Unavailable'}/>
            <div className="mentor-avatar">{m.img}</div>
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
    </>
  );
}
