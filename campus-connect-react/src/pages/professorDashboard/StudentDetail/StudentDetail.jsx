/**
 * Professor — Student Detail Page (Read-Only, Course-Scoped)
 *
 * Visible: Identity, Academic Snapshot scoped to professor's own course
 * (grade + attendance per course code), Admin Detail (request-gated via existing flow)
 * Hidden: Admission Details, Career/Placement, Platform Activity
 *
 * Data via S9 GET /students/<id>/detail (server enforces class-assignment IDOR guard).
 * Admin access request reuses the existing Roster.jsx request flow.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User, BookOpen, Home, ArrowLeft, AlertTriangle,
  Lock, Clock, Unlock
} from 'lucide-react';
import { studentsApi } from '@/services/api';
import { useToast } from '../../../context/ToastContext';
import '@admin/admin.shared.css';
import './StudentDetail.css';

let API_BASE = import.meta.env.VITE_API_BASE_URL || '';
if (API_BASE.includes('campusconnect-backend.onrender.com') || import.meta.env.PROD) API_BASE = '';
if (!API_BASE) API_BASE = '/api/v1';

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

export default function ProfStudentDetail() {
  const { courseCode, sid } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requesting, setRequesting] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    const res = await studentsApi.getDetail(sid);
    if (res?.error) setError(res.error);
    else setData(res);
    setLoading(false);
  }, [sid]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleRequestAccess = async () => {
    setRequesting(true);
    try {
      const res = await apiFetch('/professors/me/admin-detail-request', {
        method: 'POST',
        body: JSON.stringify({ student_id: sid, reason: 'Academic/welfare follow-up' }),
      });
      const body = await res.json();
      if (res.ok) {
        showToast('Access request submitted. You will be notified on approval.', 'success', 3000);
        fetchDetail(); // re-fetch to pick up any updated admin_access_granted flag
      } else {
        showToast(body.error || 'Request failed', 'error', 2500);
      }
    } catch {
      showToast('Network error — try again', 'error', 2000);
    } finally {
      setRequesting(false);
    }
  };

  if (loading) return <div className="sd-spinner" aria-label="Loading student profile" />;
  if (error) return (
    <div className="sd-empty">
      <AlertTriangle className="sd-empty-icon" />
      <p className="sd-empty-text">{error}</p>
      <button className="ad-btn ad-btn-outline" onClick={fetchDetail}>Retry</button>
    </div>
  );
  if (!data) return null;

  const initials = (data.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const adminGranted = data.admin_access_granted === true;

  const ReadField = ({ label, value }) => (
    <div className="sd-field">
      <span className="sd-field-label">{label}</span>
      <span className="sd-field-value">
        {value == null || value === '' ? <span style={{ color: 'var(--text-secondary)' }}>—</span> : String(value)}
      </span>
    </div>
  );

  return (
    <div className="sd-root">
      <div className="page-header">
        <div>
          <button className="ad-btn ad-btn-outline" style={{ marginBottom: '.75rem' }} onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Back to Roster
          </button>
          <h1 className="page-title">Student Profile</h1>
          <p className="page-sub">
            {courseCode ? `${courseCode} — ` : ''}Professor view · Academic data shown for your courses only
          </p>
        </div>
      </div>

      {/* Hero */}
      <div className="sd-hero">
        <div className="sd-avatar-placeholder" aria-label="Avatar">{initials}</div>
        <div className="sd-hero-info">
          <p className="sd-hero-name">{data.full_name}</p>
          <p className="sd-hero-sub">{data.roll_no} · {data.branch} · Sem {data.semester}</p>
          <div className="sd-hero-chips">
            <span className="sd-hero-chip">Batch {data.batch_year}</span>
            {data.active_backlogs > 0 && (
              <span className="sd-hero-chip" style={{ background: 'rgba(239,68,68,.3)' }}>
                {data.active_backlogs} Backlog{data.active_backlogs > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        {data.cgpa != null && (
          <span className={`sd-cgpa-badge ${parseFloat(data.cgpa) >= 8 ? 'sd-cgpa-high' : parseFloat(data.cgpa) >= 6 ? 'sd-cgpa-mid' : 'sd-cgpa-low'}`}
            style={{ fontSize: '1.1rem', padding: '.35rem 1rem' }}>
            CGPA {parseFloat(data.cgpa).toFixed(2)}
          </span>
        )}
      </div>

      {/* Identity */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><User aria-hidden="true" /> Identity</h2>
        </div>
        <div className="sd-section-body">
          {['full_name','roll_no','branch','semester','batch_year'].map(f => (
            <ReadField key={f} label={f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} value={data[f]} />
          ))}
        </div>
      </div>

      {/* Academic Snapshot — scoped to professor's courses */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><BookOpen aria-hidden="true" /> Academic Snapshot (Your Courses)</h2>
        </div>
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Overall metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
            <ReadField label="Overall CGPA" value={data.cgpa != null ? parseFloat(data.cgpa).toFixed(2) : null} />
            <ReadField label="Attendance %" value={data.attendance_pct != null ? `${data.attendance_pct}%` : null} />
            <ReadField label="Active Backlogs" value={data.active_backlogs ?? 0} />
          </div>

          {/* Per-course grades */}
          {data.course_grades?.length > 0 && (
            <div>
              <p className="sd-field-label" style={{ marginBottom: '.6rem' }}>Grades (Your Course)</p>
              <div className="attend-table-wrap">
                <table className="attend-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Internal</th>
                      <th>Mid-Sem</th>
                      <th>Grade</th>
                      <th>Grade Point</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.course_grades.map(g => (
                      <tr key={g.course_code}>
                        <td><code>{g.course_code}</code></td>
                        <td>{g.internal_marks ?? '—'}</td>
                        <td>{g.mid_sem_marks ?? '—'}</td>
                        <td style={{ fontWeight: 700 }}>{g.grade ?? '—'}</td>
                        <td>{g.grade_point ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Per-course attendance */}
          {data.course_attendance?.length > 0 && (
            <div>
              <p className="sd-field-label" style={{ marginBottom: '.6rem' }}>Attendance (Your Course)</p>
              <div className="attend-table-wrap">
                <table className="attend-table">
                  <thead>
                    <tr><th>Subject</th><th>Attended</th><th>Total</th><th>%</th></tr>
                  </thead>
                  <tbody>
                    {data.course_attendance.map(a => (
                      <tr key={a.subject_code}>
                        <td><code>{a.subject_code}</code></td>
                        <td>{a.attended}</td>
                        <td>{a.total}</td>
                        <td style={{ fontWeight: 700, color: a.pct < 75 ? 'var(--clr-danger)' : 'var(--clr-success)' }}>
                          {a.pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Administrative Details — request-gated */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title">
            {adminGranted ? <Unlock size={17} /> : <Lock size={17} />}
            Administrative Details
            {adminGranted
              ? <span className="ad-badge ad-badge-active" style={{ marginLeft: '.5rem', fontSize: '.7rem' }}>Access Granted</span>
              : <span className="ad-badge ad-badge-pending" style={{ marginLeft: '.5rem', fontSize: '.7rem' }}>Request Required</span>
            }
          </h2>
        </div>

        <div style={{ padding: '1.25rem 1.5rem' }}>
          {adminGranted ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
              <ReadField label="Hostel Address" value={data.hostel_address !== '***' ? data.hostel_address : null} />
              <ReadField label="Home Address" value={data.home_address} />
              <ReadField label="Parent Contact" value={data.parent_contact} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', alignItems: 'flex-start' }}>
              <div className="sd-sensitive-banner">
                <Lock size={15} />
                Administrative details (hostel address, parent contact) are restricted.
                Request admin-level access for academic/welfare follow-up.
              </div>
              <button
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}
                disabled={requesting}
                onClick={handleRequestAccess}
              >
                {requesting ? <><Clock size={14} /> Submitting…</> : <><Unlock size={14} /> Request Access</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
