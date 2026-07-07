import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './Notes.css';

const DEFAULT_NOTES = [
  { id:1, subject:'Computer networks',     title:'OSI vs TCP/IP Model – Comparison',  type:'notes',  uploader:'Dr. Sneha Patel',  size:'1.2 MB', date:'Nov 22', icon:'📄', approved: true },
  { id:2, subject:'Software engineering',  title:'Module 3: Agile & Scrum Slides',     type:'slides', uploader:'Dr. Rohan Mehra',  size:'4.5 MB', date:'Nov 20', icon:'📊', approved: true },
  { id:3, subject:'Database systems',      title:'PYQ 2024 – DBMS End Semester Paper', type:'pyq',    uploader:'Faculty Upload',   size:'890 KB', date:'Nov 18', icon:'📋', approved: true },
  { id:4, subject:'Theory of computation', title:'Regular Expressions Quick Reference', type:'notes',  uploader:'Ananya Sharma',    size:'340 KB', date:'Nov 15', icon:'📄', approved: true },
  { id:5, subject:'Software engineering',  title:'PYQ 2023 – SE End Semester Paper',   type:'pyq',    uploader:'Faculty Upload',   size:'1.1 MB', date:'Nov 12', icon:'📋', approved: true },
  { id:6, subject:'Computer networks',     title:'Routing Algorithms Cheat Sheet',     type:'notes',  uploader:'Rahul Mehta',      size:'260 KB', date:'Nov 10', icon:'📄', approved: true },
];

const PENDING_NOTES = [
  { id:101, subject:'Computer networks',     title:'Subnetting Practice Worksheet',    type:'notes',  uploader:'Rahul Mehta',      size:'410 KB', date:'Today',   icon:'📄', approved: false },
  { id:102, subject:'Theory of computation', title:'DFA Minimization Step-by-Step Guide',type:'notes',  uploader:'Ananya Sharma',    size:'1.5 MB', date:'Yesterday',icon:'📄', approved: false }
];

const TYPES = ['all','notes','slides','pyq'];
const TYPE_LABELS = { notes:'Notes', slides:'Slides', pyq:'PYQ Papers' };

export default function Notes() {
  const { user } = useAuth();
  const showToast = useToast();
  const isProf = user?.role === 'professor';

  const [type, setType]     = useState('all');
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState({ title:'', subject:'', type:'notes', desc:'' });

  // Resources state
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [pending, setPending] = useState(PENDING_NOTES);

  const filtered = type==='all' ? notes : notes.filter(n=>n.type===type);

  function handleUpload(e) {
    e.preventDefault();
    const newNote = {
      id: Date.now(),
      subject: form.subject,
      title: form.title,
      type: form.type,
      uploader: user.name || 'Professor',
      size: '1.4 MB',
      date: 'Just now',
      icon: form.type === 'slides' ? '📊' : form.type === 'pyq' ? '📋' : '📄',
      approved: true
    };
    setNotes(prev => [newNote, ...prev]);
    setModal(false);
    setForm({title:'',subject:'',type:'notes',desc:''});
    showToast(`"${form.title}" published officially! 📄`,'success',3000);
  }

  function handleApprove(id, action) {
    const item = pending.find(p => p.id === id);
    setPending(prev => prev.filter(p => p.id !== id));
    if (action === 'approve') {
      setNotes(prev => [{ ...item, approved: true, date: 'Just now' }, ...prev]);
      showToast(`Approved and published "${item.title}"!`, 'success', 3000);
    } else {
      showToast(`Rejected "${item.title}".`, 'info', 2000);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isProf ? 'Study Resources approvals' : 'Notes & PYQs'}</h1>
          <p className="page-sub">{isProf ? `${pending.length} uploads pending review` : 'Peer-shared study resources'}</p>
        </div>
        <button className="action-btn" onClick={()=>setModal(true)}>{isProf ? '+ Publish Note' : '+ Upload'}</button>
      </div>

      {isProf && pending.length > 0 && (
        <section className="panel" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-header">
            <h2 className="panel-title">Pending Student Uploads for Review</h2>
          </div>
          <div className="notes-list">
            {pending.map(p => (
              <div className="note-card" key={p.id}>
                <div className="note-icon-wrap">{p.icon}</div>
                <div className="note-body">
                  <span className="note-subject">{p.subject}</span>
                  <h3 className="note-title">{p.title}</h3>
                  <p className="note-meta">Uploaded by {p.uploader} · {p.size} · {p.date}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button className="action-btn" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }} onClick={() => handleApprove(p.id, 'approve')}>
                    Approve
                  </button>
                  <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }} onClick={() => handleApprove(p.id, 'reject')}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="filter-row">
        {TYPES.map(t=><button key={t} className={`filter-btn${type===t?' active':''}`} onClick={()=>setType(t)}>{t==='all'?'All':TYPE_LABELS[t]}</button>)}
      </div>
      <div className="notes-list">
        {filtered.map(n=>(
          <div className="note-card" key={n.id}>
            <div className="note-icon-wrap">{n.icon}</div>
            <div className="note-body">
              <span className="note-subject">{n.subject}</span>
              <h3 className="note-title">{n.title}</h3>
              <p className="note-meta">by {n.uploader} · {n.size} · {n.date}</p>
            </div>
            <span className={`note-type-badge ${n.type}`}>{TYPE_LABELS[n.type]}</span>
            <button className="btn-dl" aria-label="Download" onClick={()=>showToast(`Downloading "${n.title}"…`,'success',2000)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal-box">
            <div className="modal-header"><h2>{isProf ? 'Publish Study Material' : 'Upload Resource'}</h2><button className="modal-close" onClick={()=>setModal(false)}>✕</button></div>
            <form onSubmit={handleUpload} className="sell-form">
              <label>Title<input required value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="e.g. OSI Model Notes"/></label>
              <label>Subject<input required value={form.subject} onChange={e=>setForm(p=>({...p,subject:e.target.value}))} placeholder="e.g. Computer Networks"/></label>
              <label>Type<select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>{TYPES.filter(t=>t!=='all').map(t=><option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</select></label>
              <label>Description<textarea rows="3" value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))} placeholder="Brief description…"/></label>
              <div className="drop-zone" style={{cursor:'pointer'}} onClick={()=>showToast('File browser opened…','info',1000)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="20" height="20"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>Click to select file</span>
              </div>
              <button type="submit" className="action-btn" style={{width:'100%'}}>{isProf ? 'Publish Material' : 'Upload Resource'}</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
