import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { StateContainer } from '../../components/StateContainer';
import './Lectures.css';

export default function Lectures() {
  const { user }  = useAuth();
  const showToast = useToast();
  const [filter, setFilter] = useState('all');
  const isProf = user?.role === 'professor';

  const { data: apiData, loading, error, isEmpty } = useApiData('/api/v1/career/lectures', { recordings: [], syllabus: [] });

  const [data, setData] = useState({ recordings: [], syllabus: [] });

  useEffect(() => {
    if (apiData) {
      setData(apiData);
    }
  }, [apiData]);

  // Upload modal states
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', code: 'CS3081', duration: '' });

  function handleUpload(e) {
    e.preventDefault();
    if (!uploadForm.title.trim()) return;

    const newRecording = {
      id: Date.now().toString(),
      title: uploadForm.title.trim(),
      code: uploadForm.code,
      prof: user.name || 'Professor',
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

  const filtered = useMemo(() => {
    return filter === 'all'
      ? data.recordings
      : data.recordings.filter(r => r.code === filter);
  }, [data.recordings, filter]);

  return (
    <StateContainer loading={loading} error={error} isEmpty={isEmpty} emptyMessage="No recorded lectures or syllabus progress mapped yet.">
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
    </StateContainer>
  );
}
