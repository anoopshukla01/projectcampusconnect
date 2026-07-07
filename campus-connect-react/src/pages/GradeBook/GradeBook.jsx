import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { StateContainer } from '../../components/StateContainer';
import './GradeBook.css';

const GRADE_COLORS = {
  'A+': '#15803d',
  'A':  '#1e40af',
  'B+': '#6d28d9',
  'B':  '#854d0e',
  'C':  '#dc2626',
  'D':  '#b45309',
  'F':  '#991b1b',
};

export default function GradeBook() {
  const { user }  = useAuth();
  const showToast = useToast();
  const isProf    = user?.role === 'professor';

  // ── Student view data ──────────────────────────────────────────────────────
  const { data: apiData, loading, error, isEmpty } = useApiData(
    '/api/v1/academics/grades',
    { grades: [], cgpa: '--', total_credits: 0 }
  );

  const grades       = useMemo(() => apiData?.grades || [], [apiData]);
  const totalCredits = apiData?.total_credits || 0;
  const cgpa         = apiData?.cgpa || '--';

  // ── Professor view data ────────────────────────────────────────────────────
  const {
    data: profData,
    loading: profLoading,
    error: profError
  } = useApiData(
    isProf ? '/api/v1/professors/grades' : null,
    { student_grades: [], classes: [] }
  );

  const [selectedClass, setSelectedClass] = useState('');
  const [search,        setSearch]        = useState('');

  const profClasses = useMemo(() => profData?.classes || user?.classes || [], [profData, user]);
  const allStudentGrades = useMemo(() => profData?.student_grades || [], [profData]);

  const filteredGrades = useMemo(() => {
    return allStudentGrades.filter(g => {
      const matchesClass = !selectedClass || g.class_code === selectedClass;
      const query = search.toLowerCase();
      const matchesSearch = !query ||
        (g.name  && g.name.toLowerCase().includes(query)) ||
        (g.roll  && g.roll.toLowerCase().includes(query));
      return matchesClass && matchesSearch;
    });
  }, [allStudentGrades, selectedClass, search]);

  // ── Professor view ─────────────────────────────────────────────────────────
  if (isProf) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Gradebook Portal</h1>
            <p className="page-sub">Monitor student grades and performance reports</p>
          </div>
        </div>

        <div className="roster-controls">
          {profClasses.length > 0 ? (
            <select
              className="class-selector"
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
            >
              <option value="">— All classes —</option>
              {profClasses.map(c => (
                <option key={c.code || c} value={c.code || c}>
                  {c.name ? `${c.name} (${c.code})` : c}
                </option>
              ))}
            </select>
          ) : null}

          <div className="lib-search-wrap" style={{ flex: 1 }}>
            <svg className="lib-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
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
            {profLoading ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--clr-muted)' }}>Loading grades…</p>
            ) : profError ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--clr-danger)' }}>
                Couldn't load grades. Is the backend running?
              </p>
            ) : filteredGrades.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--clr-muted)' }}>
                No grade records yet. Grades appear once you publish them.
              </p>
            ) : (
              <table className="attend-table">
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Student Name</th>
                    <th>Internal (30)</th>
                    <th>Mid-Sem (50)</th>
                    <th>Final Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGrades.map((g, idx) => (
                    <tr key={g.id || idx}>
                      <td><code>{g.roll}</code></td>
                      <td className="subject-name-cell">{g.name}</td>
                      <td>{g.internal ?? '—'}</td>
                      <td>{g.mid ?? '—'}</td>
                      <td>
                        <span
                          className="grade-pill"
                          style={{
                            background: `${GRADE_COLORS[g.grade] || '#4b5563'}22`,
                            color: GRADE_COLORS[g.grade] || '#4b5563'
                          }}
                        >
                          {g.grade || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </>
    );
  }

  // ── Student view ───────────────────────────────────────────────────────────
  return (
    <StateContainer loading={loading} error={error} isEmpty={isEmpty} emptyMessage="No grades published yet for this semester. Check back after your exams.">
      <div className="page-header">
        <div>
          <h1 className="page-title">Grade Book</h1>
          <p className="page-sub">Semester {user?.semester || 1} · {user?.branch || 'General'}</p>
        </div>
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
          <span className="grade-stat-val">{grades.filter(g => (g.gp || 0) >= 9).length}</span>
          <span className="grade-stat-label">A / A+ Grades</span>
        </div>
        <div className="grade-stat-card">
          <span className="grade-stat-val">{grades.filter(g => (g.gp || 10) < 7).length}</span>
          <span className="grade-stat-label">Below B</span>
        </div>
      </div>

      {/* Grade Table */}
      <section className="panel" aria-labelledby="gradeTableTitle">
        <div className="panel-header">
          <h2 className="panel-title" id="gradeTableTitle">Subject-wise Grades</h2>
        </div>
        <div className="attend-table-wrap">
          <table className="attend-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Code</th>
                <th>Internal (30)</th>
                <th>Mid-Sem (50)</th>
                <th>Credits</th>
                <th>Grade</th>
                <th>GP</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g, idx) => (
                <tr key={g.id || g.code || idx}>
                  <td className="subject-name-cell">{g.name}</td>
                  <td><code>{g.code}</code></td>
                  <td>{g.internal ?? '—'}</td>
                  <td>{g.mid ?? '—'}</td>
                  <td>{g.credits ?? '—'}</td>
                  <td>
                    <span
                      className="grade-pill"
                      style={{
                        background: `${GRADE_COLORS[g.grade] || '#3b82f6'}22`,
                        color: GRADE_COLORS[g.grade] || '#3b82f6'
                      }}
                    >
                      {g.grade || '—'}
                    </span>
                  </td>
                  <td><strong>{g.gp ?? '—'}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </StateContainer>
  );
}
