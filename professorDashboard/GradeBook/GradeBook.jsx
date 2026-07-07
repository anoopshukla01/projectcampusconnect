import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './GradeBook.css';

function getGradesForBranch(branch) {
  const b = (branch || '').toLowerCase();
  if (b.includes('electronics') || b.includes('communication')) return [
    { name: 'Signals & Systems',         code: 'EC3021', internal: 28, mid: 44, credits: 4, grade: 'A',  gp: 9 },
    { name: 'VLSI Design',               code: 'EC3031', internal: 24, mid: 40, credits: 4, grade: 'A+', gp: 10 },
    { name: 'VLSI Design Lab',           code: 'EC3032', internal: 18, mid: 28, credits: 2, grade: 'A',  gp: 9 },
    { name: 'Electromagnetic Waves',     code: 'EC3041', internal: 20, mid: 36, credits: 4, grade: 'B+', gp: 8 },
    { name: 'Digital Signal Processing', code: 'EC3051', internal: 26, mid: 42, credits: 4, grade: 'A',  gp: 9 },
    { name: 'DSP & Systems Lab',         code: 'EC3052', internal: 19, mid: 30, credits: 2, grade: 'A+', gp: 10 },
  ];
  if (b.includes('mechanical')) return [
    { name: 'Thermodynamics',         code: 'ME3011', internal: 22, mid: 38, credits: 4, grade: 'B+', gp: 8 },
    { name: 'Fluid Mechanics',        code: 'ME3021', internal: 20, mid: 34, credits: 4, grade: 'B',  gp: 7 },
    { name: 'Fluid Mechanics Lab',    code: 'ME3022', internal: 17, mid: 27, credits: 2, grade: 'B+', gp: 8 },
    { name: 'Kinematics of Machines', code: 'ME3031', internal: 25, mid: 40, credits: 4, grade: 'A',  gp: 9 },
    { name: 'Material Science',       code: 'ME3041', internal: 23, mid: 36, credits: 4, grade: 'B+', gp: 8 },
    { name: 'Machine Shop Practice',  code: 'ME3032', internal: 19, mid: 30, credits: 2, grade: 'A',  gp: 9 },
  ];
  return [
    { name: 'Computer networks',     code: 'CS3081', internal: 24, mid: 38, credits: 4, grade: 'A',  gp: 9 },
    { name: 'Software engineering',  code: 'CS3041', internal: 26, mid: 42, credits: 4, grade: 'A+', gp: 10 },
    { name: 'Database systems',      code: 'CS3051', internal: 20, mid: 34, credits: 4, grade: 'B+', gp: 8 },
    { name: 'Network & SE Lab',      code: 'CS3082', internal: 18, mid: 28, credits: 2, grade: 'A',  gp: 9 },
    { name: 'Theory of computation', code: 'CS3061', internal: 27, mid: 44, credits: 4, grade: 'A+', gp: 10 },
    { name: 'DBMS & Projects Lab',   code: 'CS3052', internal: 19, mid: 30, credits: 2, grade: 'A',  gp: 9 },
  ];
}

const GRADE_COLORS = { 'A+': '#15803d', 'A': '#1e40af', 'B+': '#6d28d9', 'B': '#854d0e', 'C': '#dc2626' };

const PROF_STUDENT_GRADES = [
  { roll: 'CS21B1042', name: 'Ananya Sharma', course: 'Computer networks', internal: 24, mid: 38, grade: 'A' },
  { roll: 'CS21B1087', name: 'Rahul Mehta', course: 'Computer networks', internal: 22, mid: 30, grade: 'B+' },
  { roll: 'CS21B1055', name: 'Sneha Roy', course: 'Computer networks', internal: 27, mid: 45, grade: 'A+' },
  { roll: 'CS21B1042', name: 'Ananya Sharma', course: 'Theory of computation', internal: 26, mid: 42, grade: 'A+' },
  { roll: 'CS21B1087', name: 'Rahul Mehta', course: 'Theory of computation', internal: 20, mid: 32, grade: 'B' }
];

export default function GradeBook() {
  const { user } = useAuth();
  const isProf = user?.role === 'professor';

  // Student specific logic
  const grades = useMemo(() => getGradesForBranch(user?.branch), [user]);
  const totalCredits = useMemo(() => grades.reduce((s, g) => s + g.credits, 0), [grades]);
  const totalPoints = useMemo(() => grades.reduce((s, g) => s + (g.gp * g.credits), 0), [grades]);
  const cgpa = useMemo(() => (totalPoints / totalCredits).toFixed(2), [totalPoints, totalCredits]);

  // Professor specific logic
  const [selectedClass, setSelectedClass] = useState('CS3081');
  const [search, setSearch] = useState('');

  const filteredGrades = PROF_STUDENT_GRADES.filter(g => {
    const query = search.toLowerCase();
    const courseCode = selectedClass === 'CS3081' ? 'computer networks' : 'theory of computation';
    return g.course.toLowerCase() === courseCode && (g.name.toLowerCase().includes(query) || g.roll.toLowerCase().includes(query));
  });

  if (isProf) {
    const classes = user?.classes || [];
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Gradebook Portal</h1>
            <p className="page-sub">Monitor student grades and performance reports</p>
          </div>
        </div>

        <div className="roster-controls">
          <select
            className="class-selector"
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
          >
            {classes.map(c => (
              <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>

          <div className="lib-search-wrap" style={{ flex: 1 }}>
            <svg className="lib-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              className="lib-search"
              type="search"
              placeholder="Search student by name or roll number…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <section className="panel">
          <div className="attend-table-wrap">
            <table className="attend-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Internal Marks (30)</th>
                  <th>Mid-Sem Marks (50)</th>
                  <th>Final Grade</th>
                </tr>
              </thead>
              <tbody>
                {filteredGrades.length > 0 ? (
                  filteredGrades.map((g, idx) => (
                    <tr key={idx}>
                      <td><code>{g.roll}</code></td>
                      <td className="subject-name-cell">{g.name}</td>
                      <td>{g.internal}</td>
                      <td>{g.mid}</td>
                      <td>
                        <span className="grade-pill" style={{ background: `${GRADE_COLORS[g.grade] || '#4b5563'}22`, color: GRADE_COLORS[g.grade] || '#4b5563' }}>
                          {g.grade}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--clr-muted)', padding: '2rem 0' }}>
                      No grade records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  // Student view
  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Grade Book</h1><p className="page-sub">Semester {user?.semester} · {user?.branch}</p></div>
      </div>

      {/* CGPA Summary */}
      <div className="grades-summary-row">
        <div className="grade-stat-card">
          <span className="grade-stat-val">{cgpa}</span>
          <span className="grade-stat-label">Current CGPA</span>
        </div>
        <div className="grade-stat-card">
          <span className="grade-stat-val">{totalCredits}</span>
          <span className="grade-stat-label">Credits Earned</span>
        </div>
        <div className="grade-stat-card">
          <span className="grade-stat-val">{grades.filter(g => g.gp >= 9).length}</span>
          <span className="grade-stat-label">A / A+ Grades</span>
        </div>
        <div className="grade-stat-card">
          <span className="grade-stat-val">{grades.filter(g => g.gp < 7).length}</span>
          <span className="grade-stat-label">Below B</span>
        </div>
      </div>

      {/* Grade Table */}
      <section className="panel" aria-labelledby="gradeTableTitle">
        <div className="panel-header"><h2 className="panel-title" id="gradeTableTitle">Subject-wise Grades</h2></div>
        <div className="attend-table-wrap">
          <table className="attend-table">
            <thead><tr><th>Subject</th><th>Code</th><th>Internal (30)</th><th>Mid-Sem (50)</th><th>Credits</th><th>Grade</th><th>GP</th></tr></thead>
            <tbody>
              {grades.map(g => (
                <tr key={g.code}>
                  <td className="subject-name-cell">{g.name}</td>
                  <td><code>{g.code}</code></td>
                  <td>{g.internal}</td>
                  <td>{g.mid}</td>
                  <td>{g.credits}</td>
                  <td><span className="grade-pill" style={{ background: `${GRADE_COLORS[g.grade]}22`, color: GRADE_COLORS[g.grade] }}>{g.grade}</span></td>
                  <td><strong>{g.gp}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
