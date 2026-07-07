import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './Assignments.css';

function getAssignmentsForBranch(branch) {
  const b = (branch || '').toLowerCase();
  if (b.includes('communication') || b.includes('electronics')) return [
    { name: 'VLSI Full Adder Layout',           subject: 'VLSI Design',           due: 'Due Dec 01', points: '25 pts', status: 'pending',   desc: 'Design and simulate a full adder in Cadence Virtuoso.', attachment: 'vlsi_resources.zip' },
    { name: 'Signal Spectrum Analysis',         subject: 'Signals & Systems',      due: 'Due Dec 05', points: '20 pts', status: 'submitted', desc: 'Analyse the Fourier spectrum of the given signal.' },
    { name: 'OFDM Modulation Report',           subject: 'Digital Signal Processing', due: 'Due Dec 10', points: '30 pts', status: 'pending', desc: 'Write a comparative report on OFDM vs CDMA.', attachment: 'ofdm_ref.pdf' },
    { name: 'Antenna Design Project',           subject: 'Electromagnetic Waves',  due: 'Graded',     points: '40 pts', status: 'graded',   desc: 'Design a dipole antenna for 2.4 GHz.', grade: '36 / 40', feedback: 'Excellent work. Simulation results are accurate.' },
  ];
  if (b.includes('mechanical')) return [
    { name: 'Carnot Cycle Analysis Report',     subject: 'Thermodynamics',     due: 'Due Nov 28', points: '30 pts', status: 'pending',   desc: 'Calculate efficiency and P-V diagram for a Carnot cycle.', attachment: 'thermo_notes.pdf' },
    { name: 'Pipe Flow Simulation',             subject: 'Fluid Mechanics',    due: 'Due Dec 05', points: '25 pts', status: 'pending',   desc: 'Simulate turbulent pipe flow using ANSYS Fluent.' },
    { name: 'CAD Model of Gear Assembly',       subject: 'Engineering Design', due: 'Due Dec 08', points: '35 pts', status: 'submitted', desc: 'Model spur gear assembly in SolidWorks.' },
    { name: 'Stress Analysis using FEM',        subject: 'Solid Mechanics',    due: 'Graded',     points: '40 pts', status: 'graded',   desc: 'Perform FEM analysis on a cantilever beam.', grade: '38 / 40', feedback: 'Outstanding analysis with clear documentation.' },
  ];
  return [
    { name: 'Process Scheduling Simulation',    subject: 'Operating systems',     due: 'Due Nov 28', points: '25 pts', status: 'pending',   desc: 'Implement FCFS, SJF, and Round Robin schedulers in C.', attachment: 'os_starter_code.zip' },
    { name: 'TCP Congestion Control Report',    subject: 'Computer networks',     due: 'Due Dec 02', points: '30 pts', status: 'pending',   desc: 'Analyse TCP Reno and CUBIC congestion algorithms.' },
    { name: 'Turing Machine Construction',      subject: 'Theory of computation', due: 'Due Dec 05', points: '20 pts', status: 'submitted', desc: 'Construct a Turing machine for palindrome detection.', attachment: 'turing_template.docx' },
    { name: 'ER Diagram for Library System',    subject: 'Database systems',      due: 'Graded',     points: '35 pts', status: 'graded',   desc: 'Design and normalise an ER diagram for a library DB.', grade: '33 / 35', feedback: 'Great normalisation. Minor issue in the weak entity set.' },
    { name: 'REST API Backend Project',         subject: 'Software engineering',  due: 'Due Dec 12', points: '40 pts', status: 'pending',   desc: 'Build a REST API using Node.js, Express and PostgreSQL.' },
  ];
}

const PROF_SUBMISSIONS = [
  { studentName: 'Ananya Sharma', roll: 'CS21B1042', assignmentName: 'TCP Congestion Control Report', fileName: 'ananya_networks_report.pdf', status: 'pending', grade: '', feedback: '' },
  { studentName: 'Rahul Mehta', roll: 'CS21B1087', assignmentName: 'TCP Congestion Control Report', fileName: 'rahul_networks.zip', status: 'pending', grade: '', feedback: '' },
  { studentName: 'Sneha Roy', roll: 'CS21B1055', assignmentName: 'TCP Congestion Control Report', fileName: 'sneha_report.pdf', status: 'graded', grade: '28 / 30', feedback: 'Well written and structured.' }
];

const FILTERS = ['all', 'pending', 'submitted', 'graded'];

export default function Assignments() {
  const { user }  = useAuth();
  const showToast = useToast();
  const isProf = user?.role === 'professor';

  // Student states
  const [filter, setFilter]   = useState('all');
  const [selected, setSelected] = useState(null);
  const [dragover, setDragover] = useState(false);
  const [fileName, setFileName] = useState('');
  const [assignments, setAssignments] = useState(() => getAssignmentsForBranch(user?.branch));

  // Professor states
  const [submissions, setSubmissions] = useState(PROF_SUBMISSIONS);
  const [selectedSub, setSelectedSub] = useState(null);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');

  const filtered = useMemo(() =>
    filter === 'all' ? assignments : assignments.filter(a => a.status === filter),
    [filter, assignments]);

  function handleFileChange(files) {
    if (files && files[0]) setFileName(files[0].name);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!selected) return;
    if (!fileName && selected.status === 'pending') {
      showToast('Please select a file to submit!', 'info', 2000);
      return;
    }
    setAssignments(prev => prev.map(a =>
      a.name === selected.name ? { ...a, status: 'submitted' } : a
    ));
    setSelected(a => ({ ...a, status: 'submitted' }));
    showToast(`Successfully submitted ${fileName || 'your work'}!`, 'success', 3500);
    setFileName('');
  }

  function submitGrade(e) {
    e.preventDefault();
    if (!selectedSub) return;
    setSubmissions(prev => prev.map(s =>
      s.roll === selectedSub.roll && s.assignmentName === selectedSub.assignmentName
        ? { ...s, status: 'graded', grade: gradeInput, feedback: feedbackInput }
        : s
    ));
    setSelectedSub(prev => ({ ...prev, status: 'graded', grade: gradeInput, feedback: feedbackInput }));
    showToast(`Grade submitted for ${selectedSub.studentName}! 🎓`, 'success', 3000);
  }

  const pendingCount = assignments.filter(a => a.status === 'pending').length;

  if (isProf) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Grading Zone</h1>
            <p className="page-sub">{submissions.filter(s => s.status === 'pending').length} submissions pending evaluation</p>
          </div>
        </div>

        <div className="assign-layout">
          {/* List */}
          <section className="panel assign-list-panel" aria-label="Submissions list">
            <ul role="list" style={{ listStyle: 'none' }}>
              {submissions.map((sub, i) => (
                <li key={i}>
                  <button
                    className={`assign-card${selectedSub?.roll === sub.roll ? ' selected' : ''}`}
                    onClick={() => { setSelectedSub(sub); setGradeInput(sub.grade); setFeedbackInput(sub.feedback); }}
                  >
                    <div className="card-subject-row">
                      <span className="card-subject">Roll {sub.roll}</span>
                      <span className={`status-badge ${sub.status}`}>{sub.status}</span>
                    </div>
                    <span className="card-title">{sub.studentName}</span>
                    <div className="card-due-row">
                      <span className="card-due" style={{ color: 'var(--clr-text-2)' }}>{sub.assignmentName}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Details & Grading Form */}
          <section className="panel assign-detail-panel" aria-label="Evaluate submission">
            {!selectedSub ? (
              <div className="detail-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <p>Select a student submission to evaluate</p>
              </div>
            ) : (
              <>
                <div className="detail-header">
                  <span className="detail-subject">Roll {selectedSub.roll}</span>
                  <span className={`status-badge ${selectedSub.status}`}>{selectedSub.status}</span>
                </div>
                <h2 className="detail-title">{selectedSub.studentName}</h2>
                <p className="detail-points" style={{ color: 'var(--clr-text)' }}>Assignment: {selectedSub.assignmentName}</p>

                <div className="attachment-section" style={{ cursor: 'pointer' }} onClick={() => showToast('Opening submission file preview…', 'info', 2000)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  <a href="#" onClick={e => e.preventDefault()}>{selectedSub.fileName}</a>
                </div>

                <form className="submit-section" onSubmit={submitGrade}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>Submit Grade & Feedback</h3>
                  <label htmlFor="gradeVal" style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Grade Score (e.g. 28 / 30)</label>
                  <input
                    id="gradeVal"
                    type="text"
                    required
                    className="calc-select"
                    style={{ marginBottom: '0.75rem' }}
                    value={gradeInput}
                    onChange={e => setGradeInput(e.target.value)}
                    placeholder="e.g. 27 / 30"
                  />

                  <label htmlFor="feedbackText" style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Feedback Comment</label>
                  <textarea
                    id="feedbackText"
                    rows="3"
                    className="calc-select"
                    value={feedbackInput}
                    onChange={e => setFeedbackInput(e.target.value)}
                    placeholder="Write constructive evaluation notes…"
                    style={{ resize: 'vertical', width: '100%', marginBottom: '1rem' }}
                  />

                  <button type="submit" className="action-btn submit-btn" style={{ width: '100%' }}>
                    Submit Grade & Feedbacks
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </>
    );
  }

  // Student view
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Assignments</h1>
          <p className="page-sub">{pendingCount} pending assignments</p>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="filter-row">
        {FILTERS.map(f => (
          <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`}
            data-filter={f} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Split Panel */}
      <div className="assign-layout">
        {/* List */}
        <section className="panel assign-list-panel" aria-label="Assignment list">
          <ul id="assignListContainer" role="list" style={{ listStyle:'none' }}>
            {filtered.length ? filtered.map(a => (
              <li key={a.name}>
                <button
                  className={`assign-card${selected?.name === a.name ? ' selected' : ''}`}
                  onClick={() => { setSelected(a); setFileName(''); }}
                >
                  <div className="card-subject-row">
                    <span className="card-subject">{a.subject}</span>
                    <span className={`status-badge ${a.status}`}>{a.status}</span>
                  </div>
                  <span className="card-title">{a.name}</span>
                  <div className="card-due-row">
                    <span className="card-due">{a.due}</span>
                    <span className="card-pts">{a.points}</span>
                  </div>
                </button>
              </li>
            )) : (
              <li style={{ padding:'2rem', textAlign:'center', color:'var(--clr-muted)', fontSize:'0.85rem' }}>
                No assignments match the filter.
              </li>
            )}
          </ul>
        </section>

        {/* Detail Panel */}
        <section className="panel assign-detail-panel" id="assignDetailPanel" aria-label="Assignment details">
          {!selected ? (
            <div className="detail-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              <p>Select an assignment to view details</p>
            </div>
          ) : (
            <>
              <div className="detail-header">
                <span className="detail-subject">{selected.subject}</span>
                <span className={`status-badge ${selected.status}`}>{selected.status}</span>
              </div>
              <h2 className="detail-title">{selected.name}</h2>
              <p className="detail-points">{selected.points}</p>
              <p className="detail-instructions">{selected.desc}</p>

              {selected.attachment && (
                <div className="attachment-section">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  <a href="#" onClick={e => { e.preventDefault(); showToast(`Downloading ${selected.attachment}…`, 'info', 2000); }}>
                    {selected.attachment}
                  </a>
                </div>
              )}

              {selected.status === 'graded' ? (
                <div className="graded-section">
                  <div className="grade-score">{selected.grade}</div>
                  <p className="grade-feedback">{selected.feedback}</p>
                </div>
              ) : (
                <form className="submit-section" id="submitForm" onSubmit={handleSubmit} noValidate>
                  <h3 style={{ fontSize:'0.85rem', fontWeight:700, marginBottom:'0.5rem' }}>
                    {selected.status === 'submitted' ? 'Resubmit Work' : 'Submit Assignment'}
                  </h3>
                  <div
                    className={`drop-zone${dragover ? ' dragover' : ''}`}
                    id="dropZone"
                    role="button"
                    tabIndex="0"
                    aria-label="Upload file"
                    onClick={() => document.getElementById('fileInput').click()}
                    onKeyDown={e => e.key === 'Enter' && document.getElementById('fileInput').click()}
                    onDragOver={e => { e.preventDefault(); setDragover(true); }}
                    onDragLeave={() => setDragover(false)}
                    onDrop={e => { e.preventDefault(); setDragover(false); handleFileChange(e.dataTransfer.files); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span id="dropText">
                      {fileName ? `Selected: ${fileName}` : selected.status === 'submitted' ? 'Drop to replace or click to browse' : 'Drag & drop or click to browse'}
                    </span>
                  </div>
                  <input
                    type="file" id="fileInput" hidden
                    onChange={e => handleFileChange(e.target.files)}
                  />
                  <button type="submit" className="submit-btn action-btn" style={{ width:'100%', marginTop:'0.75rem' }}>
                    {selected.status === 'submitted' ? 'Resubmit Work' : 'Submit Assignment'}
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
