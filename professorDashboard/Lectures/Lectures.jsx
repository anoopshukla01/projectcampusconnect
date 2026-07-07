import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './Lectures.css';

function getDataForBranch(branch, role) {
  const b = (branch || '').toLowerCase();
  if (role === 'professor') {
    return {
      syllabus: [
        { name: 'Computer networks',     code: 'CS3081', module: 'Module 4 of 5', progress: 80 },
        { name: 'Theory of computation', code: 'CS3061', module: 'Module 5 of 5', progress: 90 }
      ],
      recordings: [
        { id: 1, title: 'IP Addressing, Subnetting & CIDR Notation',       code: 'CS3081', prof: 'Dr. Sneha Patel', date: '2 days ago',  duration: '58:45', subject: 'Computer networks' },
        { id: 2, title: 'Pushdown Automata & Context Free Grammars',        code: 'CS3061', prof: 'Dr. Sneha Patel', date: '1 week ago',  duration: '52:30', subject: 'Theory of computation' },
        { id: 3, title: 'Routing Algorithms: Link State & Distance Vector', code: 'CS3081', prof: 'Dr. Sneha Patel', date: '1 week ago',  duration: '1:01:20', subject: 'Computer networks' }
      ]
    };
  }

  if (b.includes('communication') || b.includes('electronics')) return {
    syllabus: [
      { name: 'Signals & Systems',         code: 'EC3021', module: 'Module 3 of 5', progress: 65 },
      { name: 'VLSI Design',               code: 'EC3031', module: 'Module 4 of 5', progress: 80 },
      { name: 'Electromagnetic Waves',     code: 'EC3041', module: 'Module 2 of 5', progress: 45 },
      { name: 'Digital Signal Processing', code: 'EC3051', module: 'Module 5 of 5', progress: 95 },
    ],
    recordings: [
      { id: 1, title: 'Fourier Transform & Signal Spectrum Analysis',    code: 'EC3021', prof: 'Dr. Kavitha Menon', date: '2 days ago',  duration: '55:10', subject: 'Signals & Systems' },
      { id: 2, title: 'CMOS Inverter Design & Power Analysis',            code: 'EC3031', prof: 'Dr. Suresh Babu',   date: '3 days ago',  duration: '1:02:30', subject: 'VLSI Design' },
      { id: 3, title: 'Maxwell\'s Equations & Wave Propagation',         code: 'EC3041', prof: 'Dr. Kavitha Menon', date: '5 days ago',  duration: '48:00', subject: 'Electromagnetic Waves' },
      { id: 4, title: 'FIR vs IIR Filter Design Techniques',             code: 'EC3051', prof: 'Dr. Suresh Babu',   date: '1 week ago',  duration: '1:10:20', subject: 'Digital Signal Processing' },
      { id: 5, title: 'Z-Transform & Digital System Analysis',           code: 'EC3051', prof: 'Dr. Suresh Babu',   date: '1 week ago',  duration: '52:40', subject: 'Digital Signal Processing' },
    ],
  };

  if (b.includes('mechanical')) return {
    syllabus: [
      { name: 'Thermodynamics',         code: 'ME3011', module: 'Module 4 of 5', progress: 80 },
      { name: 'Fluid Mechanics',        code: 'ME3021', module: 'Module 3 of 5', progress: 60 },
      { name: 'Kinematics of Machines', code: 'ME3031', module: 'Module 5 of 5', progress: 95 },
      { name: 'Material Science',       code: 'ME3041', module: 'Module 2 of 5', progress: 40 },
    ],
    recordings: [
      { id: 1, title: 'Rankine Cycle & Steam Power Plants',              code: 'ME3011', prof: 'Dr. Ramesh Kumar', date: '2 days ago',  duration: '1:00:00', subject: 'Thermodynamics' },
      { id: 2, title: 'Bernoulli\'s Equation & Applications',           code: 'ME3021', prof: 'Dr. Anil Sharma',  date: '4 days ago',  duration: '52:15', subject: 'Fluid Mechanics' },
      { id: 3, title: 'Gear Trains & Planetary Mechanisms',             code: 'ME3031', prof: 'Dr. Ramesh Kumar', date: '5 days ago',  duration: '58:00', subject: 'Kinematics of Machines' },
      { id: 4, title: 'Crystal Structure & Imperfection in Solids',     code: 'ME3041', prof: 'Dr. Anil Sharma',  date: '1 week ago',  duration: '46:00', subject: 'Material Science' },
      { id: 5, title: 'Entropy Changes in Ideal Gas Cycles',            code: 'ME3011', prof: 'Dr. Ramesh Kumar', date: '2 weeks ago', duration: '59:20', subject: 'Thermodynamics' },
    ],
  };

  return {
    syllabus: [
      { name: 'Computer networks',     code: 'CS3081', module: 'Module 4 of 5', progress: 80 },
      { name: 'Software engineering',  code: 'CS3041', module: 'Module 3 of 5', progress: 65 },
      { name: 'Database systems',      code: 'CS3051', module: 'Module 4 of 5', progress: 75 },
      { name: 'Theory of computation', code: 'CS3061', module: 'Module 5 of 5', progress: 90 },
    ],
    recordings: [
      { id: 1, title: 'IP Addressing, Subnetting & CIDR Notation',       code: 'CS3081', prof: 'Dr. Sneha Patel',  date: '2 days ago',  duration: '58:45', subject: 'Computer networks' },
      { id: 2, title: 'Agile Methodologies & Scrum Framework',            code: 'CS3041', prof: 'Dr. Rohan Mehra',  date: '3 days ago',  duration: '1:05:10', subject: 'Software engineering' },
      { id: 3, title: 'Normalization: 1NF, 2NF, 3NF & BCNF',            code: 'CS3051', prof: 'Dr. Arjun Nair',   date: '5 days ago',  duration: '1:14:00', subject: 'Database systems' },
      { id: 4, title: 'Pushdown Automata & Context Free Grammars',        code: 'CS3061', prof: 'Dr. Sneha Patel',  date: '1 week ago',  duration: '52:30', subject: 'Theory of computation' },
      { id: 5, title: 'Routing Algorithms: Link State & Distance Vector', code: 'CS3081', prof: 'Dr. Sneha Patel',  date: '1 week ago',  duration: '1:01:20', subject: 'Computer networks' },
    ],
  };
}

export default function Lectures() {
  const { user }  = useAuth();
  const showToast = useToast();
  const [filter, setFilter] = useState('all');
  const isProf = user?.role === 'professor';

  const initialData = useMemo(() => getDataForBranch(user?.branch, user?.role), [user]);
  const [data, setData] = useState(initialData);

  // Upload modal states
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', code: 'CS3081', duration: '' });

  function handleUpload(e) {
    e.preventDefault();
    if (!uploadForm.title.trim()) return;

    const newRecording = {
      id: Date.now(),
      title: uploadForm.title.trim(),
      code: uploadForm.code,
      prof: user.name,
      date: 'Just now',
      duration: uploadForm.duration || 'N/A',
      subject: uploadForm.code === 'CS3081' ? 'Computer networks' : 'Theory of computation'
    };

    setData(prev => ({
      ...prev,
      recordings: [newRecording, ...prev.recordings]
    }));

    setUploadModal(false);
    setUploadForm({ title: '', code: 'CS3081', duration: '' });
    showToast('Lecture material uploaded successfully! 📁', 'success', 3000);
  }

  const filtered = filter === 'all'
    ? data.recordings
    : data.recordings.filter(r => r.code === filter);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isProf ? 'Lecture Management' : 'Lectures'}</h1>
          <p className="page-sub">{isProf ? 'Manage course syllabus progress and video files' : 'Recorded lectures & live sessions'}</p>
        </div>
        {isProf && (
          <button className="action-btn" onClick={() => setUploadModal(true)}>
            📤 Upload Material
          </button>
        )}
      </div>

      {/* Live Sessions */}
      {!isProf && user?.schedule?.length > 0 && (
        <section aria-labelledby="liveTitle">
          <h2 className="section-heading" id="liveTitle">🔴 Today's Live Sessions</h2>
          <div className="live-grid">
            {user.schedule.map((cls, i) => (
              <div className="live-card" key={i}>
                <div className="live-pulse-badge"><span className="live-dot" aria-hidden="true"/> Live</div>
                <span className="video-subject">{cls.code}</span>
                <h3 className="live-title">{cls.name}</h3>
                <p className="live-meta">{cls.time} · {cls.room}</p>
                <p className="live-meta">Instructor: {cls.prof}</p>
                <button className="action-btn live-join-btn" onClick={() => showToast('Opening live classroom…', 'info', 2000)}>Join Classroom</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Syllabus Progress */}
      <section className="panel" aria-labelledby="syllabusTitle">
        <div className="panel-header"><h2 className="panel-title" id="syllabusTitle">Syllabus Coverage</h2></div>
        <div className="syllabus-grid">
          {data.syllabus.map(s => (
            <div className="syllabus-card" key={s.code}>
              <span className="syllabus-name">{s.name} ({s.code})</span>
              <div className="syllabus-meta"><span>{s.module}</span><span style={{fontWeight:700}}>{s.progress}%</span></div>
              <div className="syllabus-bar"><div className="syllabus-bar-fill" style={{width:`${s.progress}%`}}/></div>
            </div>
          ))}
        </div>
      </section>

      {/* Recordings */}
      <section className="panel" aria-labelledby="recordingsTitle">
        <div className="panel-header"><h2 className="panel-title" id="recordingsTitle">Recent Materials & Recordings</h2></div>
        <div className="filter-row" style={{marginBottom:'1rem'}}>
          <button className={`filter-btn${filter==='all'?' active':''}`} onClick={()=>setFilter('all')}>All</button>
          {data.syllabus.map(s => (
            <button key={s.code} className={`filter-btn${filter===s.code?' active':''}`} onClick={()=>setFilter(s.code)}>{s.name}</button>
          ))}
        </div>
        <div className="recordings-list">
          {filtered.map(r => (
            <div className="recording-card" key={r.id}>
              <button className="play-btn" aria-label={`Play ${r.title}`} onClick={()=>showToast(`Playing: ${r.title}`, 'info', 2000)}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>
              <div className="recording-body">
                <span className="recording-subject">{r.subject}</span>
                <h3 className="recording-title">{r.title}</h3>
                <p className="recording-meta">{r.prof} · {r.date} · {r.duration}</p>
              </div>
              <button className="btn-dl" aria-label="Download" onClick={()=>showToast('Downloading lecture material…','success',2000)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="16" height="16">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Upload Modal (Professor Only) */}
      {uploadModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={e => e.target === e.currentTarget && setUploadModal(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <h2>Upload Lecture Material</h2>
              <button className="modal-close" onClick={() => setUploadModal(false)}>✕</button>
            </div>
            <form onSubmit={handleUpload} className="sell-form">
              <label>
                Topic / Lecture Title
                <input
                  required
                  value={uploadForm.title}
                  onChange={e => setUploadForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Subnetting & Supernetting Guide"
                />
              </label>
              <label>
                Course
                <select value={uploadForm.code} onChange={e => setUploadForm(p => ({ ...p, code: e.target.value }))}>
                  {data.syllabus.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                </select>
              </label>
              <label>
                Duration (Optional, e.g. 52:00)
                <input
                  value={uploadForm.duration}
                  onChange={e => setUploadForm(p => ({ ...p, duration: e.target.value }))}
                  placeholder="e.g. 45:30"
                />
              </label>
              <button type="submit" className="action-btn" style={{ width: '100%' }}>Upload Now</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
