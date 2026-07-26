/**
 * TPO (Placement Cell) — Student Detail Page (Read-Only)
 *
 * Visible sections: Identity, Academic Snapshot, Career/Placement, TPO Events
 * Hidden: Administrative Details, Fees, Scholarship, Home Address, Parent Contact, Quota
 *
 * Data via S9 GET /students/<id>/detail — server applies masking.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User, BookOpen, Briefcase, Calendar, ArrowLeft,
  AlertTriangle, Award, TrendingUp, CheckCircle
} from 'lucide-react';
import { studentsApi } from '@/services/api';
import '@admin/admin.shared.css';
import './StudentDetail.css';

const FIELD_LABELS = {
  full_name: 'Full Name', roll_no: 'Roll No', email: 'Email', phone: 'Phone',
  branch: 'Branch', semester: 'Semester', batch_year: 'Batch Year',
  cgpa: 'CGPA', attendance_pct: 'Attendance %', active_backlogs: 'Active Backlogs',
  dpdp_consent_given: 'DPDP Consent', linkedin_url: 'LinkedIn', github_url: 'GitHub',
  resume_url: 'Resume', college_name: 'College',
  entrance_exam_type: 'Entrance Exam', entrance_rank: 'Entrance Rank/Score',
};

export default function TPOStudentDetail() {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    const res = await studentsApi.getDetail(studentId);
    if (res?.error) setError(res.error);
    else setData(res);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

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
  const cgpaNum = parseFloat(data.cgpa);
  const cgpaClass = isNaN(cgpaNum) ? '' : cgpaNum >= 8 ? 'sd-cgpa-high' : cgpaNum >= 6 ? 'sd-cgpa-mid' : 'sd-cgpa-low';

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
      {/* Back */}
      <div className="page-header">
        <div>
          <button className="ad-btn ad-btn-outline" style={{ marginBottom: '.75rem' }} onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="page-title">Student Profile</h1>
          <p className="page-sub">Placement Cell view — read-only</p>
        </div>
        <span className="ad-badge ad-badge-info" style={{ alignSelf: 'flex-start' }}>TPO View</span>
      </div>

      {/* Hero */}
      <div className="sd-hero">
        <div className="sd-avatar-placeholder" aria-label="Avatar">{initials}</div>
        <div className="sd-hero-info">
          <p className="sd-hero-name">{data.full_name}</p>
          <p className="sd-hero-sub">{data.roll_no} · {data.branch} · Sem {data.semester}</p>
          <div className="sd-hero-chips">
            <span className="sd-hero-chip">{data.college_name}</span>
            <span className="sd-hero-chip">Batch {data.batch_year}</span>
            {!data.dpdp_consent_given && (
              <span className="sd-hero-chip" style={{ background: 'rgba(239,68,68,.25)' }}>No DPDP Consent</span>
            )}
          </div>
        </div>
        {data.cgpa != null && (
          <span className={`sd-cgpa-badge ${cgpaClass}`} style={{ fontSize: '1.1rem', padding: '.35rem 1rem' }}>
            CGPA {parseFloat(data.cgpa).toFixed(2)}
          </span>
        )}
      </div>

      {/* Identity */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><User aria-hidden="true" /> Identity & Basic Info</h2>
        </div>
        <div className="sd-section-body">
          {['full_name','roll_no','email','phone','branch','semester','batch_year','college_name'].map(f => (
            <ReadField key={f} label={FIELD_LABELS[f]} value={data[f]} />
          ))}
        </div>
      </div>

      {/* Academic Snapshot */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><BookOpen aria-hidden="true" /> Academic Snapshot</h2>
        </div>
        <div className="sd-section-body">
          <div className="sd-field">
            <span className="sd-field-label">CGPA</span>
            {data.cgpa != null
              ? <span className={`sd-cgpa-badge ${cgpaClass}`}>{parseFloat(data.cgpa).toFixed(2)}</span>
              : <span className="sd-field-value" style={{ color: 'var(--text-secondary)' }}>—</span>}
          </div>
          <ReadField label="Attendance %" value={data.attendance_pct != null ? `${data.attendance_pct}%` : null} />
          <div className="sd-field">
            <span className="sd-field-label">Active Backlogs</span>
            <span className={`sd-cgpa-badge ${data.active_backlogs > 0 ? 'sd-cgpa-low' : 'sd-cgpa-high'}`}>
              {data.active_backlogs > 0 ? `${data.active_backlogs} Backlog(s)` : 'Clear'}
            </span>
          </div>
          <div className="sd-field">
            <span className="sd-field-label">DPDP Consent</span>
            <span className={`sd-cgpa-badge ${data.dpdp_consent_given ? 'sd-cgpa-high' : 'sd-cgpa-low'}`}>
              {data.dpdp_consent_given ? 'Given' : 'Not Given'}
            </span>
          </div>
          <ReadField label="Entrance Exam" value={data.entrance_exam_type} />
          <ReadField label="Entrance Rank/Score" value={data.entrance_rank} />
          {/* quota_category is intentionally omitted for TPO — server masks it */}
        </div>
      </div>

      {/* Career / Placement */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><Briefcase aria-hidden="true" /> Career / Placement</h2>
        </div>
        <div className="sd-section-body">
          {['linkedin_url','github_url','resume_url'].map(f => (
            <div key={f} className="sd-field">
              <span className="sd-field-label">{FIELD_LABELS[f]}</span>
              {data[f]
                ? <a href={data[f]} target="_blank" rel="noreferrer" className="sd-field-value" style={{ color: 'var(--clr-secondary)', wordBreak: 'break-all' }}>{data[f]}</a>
                : <span className="sd-field-value" style={{ color: 'var(--text-secondary)' }}>—</span>
              }
            </div>
          ))}
        </div>

        {/* Offers */}
        {data.placement_offers?.length > 0 && (
          <div style={{ padding: '0 1.5rem 1.25rem' }}>
            <p className="sd-field-label" style={{ marginBottom: '.6rem' }}>Placement Offers</p>
            <div className="sd-offer-list">
              {data.placement_offers.map((off, i) => (
                <div key={i} className="sd-offer-card">
                  <div>
                    <div className="sd-offer-company">{off.company}</div>
                    <div className="sd-offer-role">{off.role}</div>
                  </div>
                  <span className={`ad-badge ${off.status === 'accepted' ? 'ad-badge-active' : 'ad-badge-pending'}`}>
                    {off.status}
                  </span>
                  {off.ctc && <span className="sd-offer-ctc">₹{off.ctc} LPA</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TPO Events */}
      {data.platform_activity?.event_registrations?.length > 0 && (
        <div className="sd-section">
          <div className="sd-section-header" style={{ cursor: 'default' }}>
            <h2 className="sd-section-title"><Calendar aria-hidden="true" /> Placement Events</h2>
          </div>
          <div style={{ padding: '1.25rem 1.5rem' }}>
            <div className="sd-activity-list">
              {data.platform_activity.event_registrations.map(r => (
                <div key={r.event_id} className="sd-activity-item">
                  <div className="sd-activity-icon">
                    <CheckCircle size={15} aria-hidden="true" />
                  </div>
                  <div className="sd-activity-body">{r.event_title}</div>
                  <span className="sd-activity-time">
                    {r.registered_at ? new Date(r.registered_at).toLocaleDateString() : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
