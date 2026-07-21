import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Classes.css';

export default function Classes() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const classes = user?.classes || [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Classes</h1>
          <p className="page-sub">Department of {user?.department || 'Computer Science'}</p>
        </div>
      </div>

      <div className="classes-grid">
        {classes.map(cls => (
          <div className="class-page-card" key={cls.code}>
            <div className="class-card-header">
              <span className="class-code">{cls.code}</span>
              <span className="student-count-badge"> {cls.students} Enrolled</span>
            </div>
            <h2 className="class-name-large">{cls.name}</h2>
            <p className="class-card-desc">B.Tech Semester 6 · Section A</p>
            <div className="class-card-actions">
              <button className="action-btn" onClick={() => navigate('/timetable')}>View Schedule</button>
              <button className="btn-secondary" onClick={() => navigate('/roster')}>View Roster</button>
              <button className="btn-secondary" onClick={() => navigate('/assignments')}>Grading Zone</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
