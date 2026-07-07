import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './Roster.css';

const MOCK_STUDENTS = [
  { roll: 'CS21B1042', name: 'Ananya Sharma', email: 'ananya@college.edu.in', branch: 'Computer science', attendance: '87%', status: 'Active' },
  { roll: 'CS21B1087', name: 'Rahul Mehta', email: 'rahul@college.edu.in', branch: 'Computer science', attendance: '72%', status: 'Warning' },
  { roll: 'CS21B1055', name: 'Sneha Roy', email: 'sneha@college.edu.in', branch: 'Computer science', attendance: '91%', status: 'Active' },
  { roll: 'CS21B1020', name: 'Arvind Swamy', email: 'arvind@college.edu.in', branch: 'Computer science', attendance: '82%', status: 'Active' },
  { roll: 'CS21B1099', name: 'Kirti Sen', email: 'kirti@college.edu.in', branch: 'Computer science', attendance: '68%', status: 'Warning' }
];

export default function Roster() {
  const { user } = useAuth();
  const showToast = useToast();
  const [selectedClass, setSelectedClass] = useState('CS3081');
  const [search, setSearch] = useState('');

  const classes = user?.classes || [];

  const filteredStudents = MOCK_STUDENTS.filter(s => {
    const query = search.toLowerCase();
    return s.name.toLowerCase().includes(query) || s.roll.toLowerCase().includes(query);
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Class Roster</h1>
          <p className="page-sub">View and manage students enrolled in your courses</p>
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
                <th>Name</th>
                <th>Email</th>
                <th>Branch</th>
                <th>Attendance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length > 0 ? (
                filteredStudents.map(student => (
                  <tr key={student.roll}>
                    <td><code>{student.roll}</code></td>
                    <td className="subject-name-cell">{student.name}</td>
                    <td>{student.email}</td>
                    <td>{student.branch}</td>
                    <td style={{ fontWeight: 600, color: parseInt(student.attendance) < 75 ? 'var(--clr-danger)' : 'var(--clr-text)' }}>
                      {student.attendance}
                    </td>
                    <td>
                      <span className={`status-pill ${student.status === 'Active' ? 'safe' : 'critical'}`}>
                        {student.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button className="action-btn" style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }} onClick={() => showToast(`Opening chat with ${student.name}…`, 'info', 1500)}>
                          Message
                        </button>
                        <button className="btn-secondary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }} onClick={() => showToast(`Viewing profile of ${student.name}…`, 'info', 1500)}>
                          View Profile
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--clr-muted)', padding: '2rem 0' }}>
                    No students found.
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
