import { useState, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useApiData } from '../../../hooks/useApiData';
import './Roster.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  return res;
}

export default function Roster() {
  const { user } = useAuth();
  const showToast = useToast();

  const [selectedClass, setSelectedClass] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [order, setOrder] = useState('asc');
  const [requestingFor, setRequestingFor] = useState(null); // student id being requested
  const [expandedStudent, setExpandedStudent] = useState(null);

  // Load assigned classes
  const { data: classesData } = useApiData('/professors/me/classes', { classes: [] });
  const classes = classesData?.classes || [];

  // Set first class as default once loaded
  const activeCode = selectedClass || (classes[0]?.course_code ?? '');

  // Load roster for active class
  const { data: rosterData, loading, error, refetch } = useApiData(
    activeCode ? `/professors/me/classes/${activeCode}/roster?search=${encodeURIComponent(search)}&sort_by=${sortBy}&order=${order}` : null,
    { students: [], total_students: 0 }
  );
  const students = rosterData?.students || [];

  // Load pending admin detail requests
  const { data: reqData, refetch: refetchRequests } = useApiData(
    '/professors/me/admin-detail-requests',
    { requests: [] }
  );
  const pendingRequests = new Set(
    (reqData?.requests || [])
      .filter(r => r.status === 'pending')
      .map(r => r.student_id)
  );
  const approvedRequests = new Set(
    (reqData?.requests || [])
      .filter(r => r.status === 'approved')
      .map(r => r.student_id)
  );

  const handleRequestAccess = useCallback(async (studentId, studentName) => {
    setRequestingFor(studentId);
    try {
      const res = await apiFetch('/professors/me/admin-detail-request', {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId, reason: 'Academic/welfare follow-up' }),
      });
      const body = await res.json();
      if (res.ok) {
        showToast(`Access request submitted for ${studentName}`, 'success', 2500);
        refetchRequests();
      } else {
        showToast(body.error || 'Request failed', 'error', 2500);
      }
    } catch {
      showToast('Network error — try again', 'error', 2000);
    } finally {
      setRequestingFor(null);
    }
  }, [showToast, refetchRequests]);

  const toggleSort = (col) => {
    if (sortBy === col) {
      setOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setOrder('asc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span style={{ opacity: 0.3, fontSize: '0.7rem' }}>⇅</span>;
    return <span style={{ fontSize: '0.7rem', color: 'var(--clr-accent)' }}>{order === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Class Roster</h1>
          <p className="page-sub">
            {rosterData?.course_name
              ? `${rosterData.course_name} (${activeCode}) · Sem ${rosterData?.semester} · ${rosterData?.branch}`
              : 'Select a class to view enrolled students'}
          </p>
        </div>
        <span style={{ background: 'var(--clr-accent-alpha)', color: 'var(--clr-accent)', borderRadius: '999px', padding: '0.25rem 0.75rem', fontSize: '0.8rem', fontWeight: 600 }}>
          {rosterData?.total_students ?? 0} Students
        </span>
      </div>

      <div className="roster-controls">
        {/* Class selector */}
        <select
          className="class-selector"
          value={activeCode}
          onChange={e => { setSelectedClass(e.target.value); setExpandedStudent(null); }}
        >
          {classes.length === 0 && <option value="">No classes assigned</option>}
          {classes.map(c => (
            <option key={c.course_code} value={c.course_code}>
              {c.course_name} ({c.course_code})
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="lib-search-wrap" style={{ flex: 1 }}>
          <svg className="lib-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="lib-search"
            type="search"
            placeholder="Search by name or roll number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <section className="panel">
        {loading && (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--clr-muted)' }}>Loading roster…</p>
        )}
        {error && !loading && (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--clr-danger)' }}>
            Failed to load roster. <button className="link-btn" onClick={refetch}>Retry</button>
          </p>
        )}
        {!loading && !error && (
          <div className="attend-table-wrap">
            <table className="attend-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Name <SortIcon col="name" />
                  </th>
                  <th onClick={() => toggleSort('cgpa')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    CGPA <SortIcon col="cgpa" />
                  </th>
                  <th onClick={() => toggleSort('attendance')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Attendance <SortIcon col="attendance" />
                  </th>
                  <th>Backlogs</th>
                  <th>Admin Details</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.length > 0 ? students.map(student => (
                  <>
                    <tr key={student.id} onClick={() => setExpandedStudent(p => p === student.id ? null : student.id)} style={{ cursor: 'pointer' }}>
                      <td><code>{student.roll_no}</code></td>
                      <td className="subject-name-cell">{student.full_name}</td>
                      <td style={{ fontWeight: 600, color: parseFloat(student.cgpa) < 5 ? 'var(--clr-danger)' : 'var(--clr-text)' }}>
                        {student.cgpa ?? '—'}
                      </td>
                      <td style={{ fontWeight: 600, color: parseFloat(student.attendance_pct) < 75 ? 'var(--clr-danger)' : 'var(--clr-success)' }}>
                        {student.attendance_pct != null ? `${student.attendance_pct}%` : '—'}
                      </td>
                      <td>
                        {student.active_backlogs > 0
                          ? <span className="status-pill critical">{student.active_backlogs} Backlog{student.active_backlogs > 1 ? 's' : ''}</span>
                          : <span className="status-pill safe">Clear</span>
                        }
                      </td>
                      {/* Admin-detail column — masked unless access granted */}
                      <td>
                        {student.admin_access_granted || approvedRequests.has(student.id) ? (
                          <span style={{ fontSize: '0.78rem', color: 'var(--clr-text)' }}>
                            🏠 {student.hostel_address !== '***' ? student.hostel_address : 'N/A'}
                          </span>
                        ) : pendingRequests.has(student.id) ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--clr-warning)', fontWeight: 600 }}>
                            ⏳ Pending
                          </span>
                        ) : (
                          <button
                            className="btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                            disabled={requestingFor === student.id}
                            onClick={e => { e.stopPropagation(); handleRequestAccess(student.id, student.full_name); }}
                            title="Request access to administrative details"
                          >
                            {requestingFor === student.id ? '…' : '🔓 Request'}
                          </button>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            className="btn-secondary"
                            style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                            onClick={e => { e.stopPropagation(); setExpandedStudent(p => p === student.id ? null : student.id); }}
                          >
                            {expandedStudent === student.id ? 'Close' : 'Details'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Inline expanded row */}
                    {expandedStudent === student.id && (
                      <tr key={`${student.id}-expanded`} style={{ background: 'var(--clr-surface-2)' }}>
                        <td colSpan="7" style={{ padding: '1rem 1.5rem' }}>
                          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                            <div>
                              <strong>Roll No:</strong> {student.roll_no}<br/>
                              <strong>Branch:</strong> {student.branch}<br/>
                              <strong>Semester:</strong> {student.semester}<br/>
                              <strong>Batch:</strong> {student.batch_year}
                            </div>
                            <div>
                              <strong>CGPA:</strong> {student.cgpa ?? '—'}<br/>
                              <strong>Attendance:</strong> {student.attendance_pct != null ? `${student.attendance_pct}%` : '—'}<br/>
                              <strong>Active Backlogs:</strong> {student.active_backlogs ?? 0}
                            </div>
                            <div>
                              <strong>Hostel Address:</strong><br/>
                              <span style={{ color: student.hostel_address === '***' ? 'var(--clr-muted)' : 'var(--clr-text)' }}>
                                {student.hostel_address === '***'
                                  ? '*** Restricted — Request access to view'
                                  : (student.hostel_address || 'Not provided')}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--clr-muted)', padding: '2rem 0' }}>
                      {activeCode ? 'No students found.' : 'Select a class to view the roster.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
