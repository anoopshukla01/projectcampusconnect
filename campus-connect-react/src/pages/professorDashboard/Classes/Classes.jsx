import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useApiData } from '../../../hooks/useApiData';
import './Classes.css';

export default function Classes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expandedCode, setExpandedCode] = useState(null);

  const { data, loading, error } = useApiData('/professors/me/classes', { classes: [] });
  const classes = data?.classes || [];

  // Fetch roster for expanded class
  const { data: rosterData, loading: rosterLoading } = useApiData(
    expandedCode ? `/professors/me/classes/${expandedCode}/roster` : null,
    { students: [], total_students: 0 }
  );

  const handleExpandClass = (code) => {
    setExpandedCode(prev => prev === code ? null : code);
  };

  if (loading) return (
    <div className="loading-state" style={{ textAlign: 'center', padding: '3rem', color: 'var(--clr-muted)' }}>
      <p>Loading your classes…</p>
    </div>
  );

  if (error) return (
    <div className="error-state" style={{ textAlign: 'center', padding: '3rem', color: 'var(--clr-danger)' }}>
      <p>Failed to load classes. Please refresh.</p>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Classes</h1>
          <p className="page-sub">Department of {user?.department || 'Computer Science'}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ background: 'var(--clr-accent-alpha)', color: 'var(--clr-accent)', borderRadius: '999px', padding: '0.25rem 0.75rem', fontSize: '0.8rem', fontWeight: 600 }}>
            {classes.length} {classes.length === 1 ? 'Class' : 'Classes'} Assigned
          </span>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--clr-muted)' }}>
          <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📚</p>
          <p>No classes assigned yet. Contact Admin to set up your class assignments.</p>
        </div>
      ) : (
        <div className="classes-grid">
          {classes.map(cls => (
            <div className="class-page-card" key={cls.course_code}>
              <div className="class-card-header">
                <span className="class-code">{cls.course_code}</span>
                <span className="student-count-badge">
                  Sem {cls.semester} · {cls.branch}
                </span>
              </div>
              <h2 className="class-name-large">{cls.course_name}</h2>
              <p className="class-card-desc">Academic Year: {cls.academic_year || '2025-26'}</p>

              {/* Inline roster preview */}
              {expandedCode === cls.course_code && (
                <div className="class-roster-preview" style={{ marginTop: '1rem', borderTop: '1px solid var(--clr-border)', paddingTop: '1rem' }}>
                  {rosterLoading ? (
                    <p style={{ color: 'var(--clr-muted)', fontSize: '0.85rem' }}>Loading roster…</p>
                  ) : (
                    <>
                      <p style={{ fontSize: '0.82rem', color: 'var(--clr-muted)', marginBottom: '0.5rem' }}>
                        {rosterData?.total_students || 0} students enrolled
                      </p>
                      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {(rosterData?.students || []).slice(0, 5).map(s => (
                          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--clr-border)', fontSize: '0.82rem' }}>
                            <span><code style={{ fontSize: '0.75rem' }}>{s.roll_no}</code> {s.full_name}</span>
                            <span style={{ color: parseFloat(s.attendance_pct) < 75 ? 'var(--clr-danger)' : 'var(--clr-success)' }}>
                              {s.attendance_pct ?? '—'}% att · CGPA {s.cgpa ?? '—'}
                            </span>
                          </div>
                        ))}
                        {(rosterData?.students?.length || 0) > 5 && (
                          <p style={{ fontSize: '0.78rem', color: 'var(--clr-muted)', marginTop: '0.5rem' }}>
                            +{rosterData.students.length - 5} more → <button className="link-btn" onClick={() => navigate('/roster')}>View Full Roster</button>
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="class-card-actions" style={{ marginTop: '1rem' }}>
                <button
                  className="action-btn"
                  onClick={() => handleExpandClass(cls.course_code)}
                >
                  {expandedCode === cls.course_code ? 'Hide Roster' : 'Quick Roster'}
                </button>
                <button className="btn-secondary" onClick={() => navigate('/timetable')}>Schedule</button>
                <button className="btn-secondary" onClick={() => navigate('/roster')}>Full Roster</button>
                <button className="btn-secondary" onClick={() => navigate('/assignments')}>Grading Zone</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
