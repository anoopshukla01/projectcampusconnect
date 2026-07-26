/**
 * Student — Self-View Profile Page
 *
 * Visible: all own fields including quota_category
 * Self-editable: personal email/phone, home address, parent contact, photo URL, socials, resume
 * Read-only: CGPA, backlogs, fees, scholarship, admission details
 *
 * Data via S9 GET /students/me (self) or studentsApi.getDetail(myId).
 * Updates via studentsApi.updateSelf() → S2 PATCH /students/me.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  User, BookOpen, Home, Briefcase, Award, Activity,
  Calendar, CheckCircle, Edit3, Check, X, Camera
} from 'lucide-react';
import { studentsApi } from '@/services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './StudentDetail.css';

const FIELD_LABELS = {
  full_name: 'Full Name', roll_no: 'Roll No', email: 'Email',
  phone: 'Phone Number', branch: 'Branch', semester: 'Semester',
  batch_year: 'Batch Year', cgpa: 'CGPA', attendance_pct: 'Attendance %',
  active_backlogs: 'Active Backlogs', hostel_address: 'Hostel Address',
  home_address: 'Home Address', parent_contact: 'Parent Contact',
  fees_submitted: 'Fees Submitted (₹)', scholarship_details: 'Scholarship Info',
  entrance_exam_type: 'Entrance Exam', entrance_rank: 'Entrance Rank/Score',
  quota_category: 'Category / Quota', linkedin_url: 'LinkedIn URL',
  github_url: 'GitHub URL', resume_url: 'Resume URL', profile_photo_url: 'Profile Photo URL',
  dpdp_consent_given: 'DPDP Consent', college_name: 'College',
};

// Fields a student is allowed to self-edit via PATCH /students/me
const SELF_EDITABLE = new Set([
  'phone', 'home_address', 'hostel_address', 'parent_contact',
  'linkedin_url', 'github_url', 'resume_url', 'profile_photo_url',
]);

export default function StudentSelfView() {
  const { user } = useAuth();
  const showToast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Inline edit state
  const [editing, setEditing] = useState({});
  const [editDraft, setEditDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    const res = await studentsApi.getMe();
    if (res?.error) setError(res.error);
    else setData(res);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const startEdit = (field, val) => {
    setEditing(p => ({ ...p, [field]: true }));
    setEditDraft(p => ({ ...p, [field]: val ?? '' }));
  };
  const cancelEdit = (field) => setEditing(p => ({ ...p, [field]: false }));

  const saveField = async (field) => {
    const newVal = editDraft[field];
    if (String(data[field] ?? '') === String(newVal ?? '')) { cancelEdit(field); return; }
    setSaving(true);
    const res = await studentsApi.updateSelf({ [field]: newVal === '' ? null : newVal });
    setSaving(false);
    if (res?.error) {
      showToast(res.error, 'error', 3500);
    } else {
      showToast(`${FIELD_LABELS[field] || field} updated.`, 'success', 2500);
      setData(prev => ({ ...prev, [field]: newVal === '' ? null : newVal }));
      setEditing(p => ({ ...p, [field]: false }));
    }
  };

  if (loading) return <div className="sd-spinner" aria-label="Loading profile" />;
  if (error) return <div className="sd-empty"><p className="sd-empty-text">{error}</p></div>;
  if (!data) return null;

  const initials = (data.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const ReadField = ({ field }) => {
    const label = FIELD_LABELS[field] || field;
    const val = data[field];
    const canEdit = SELF_EDITABLE.has(field);
    const isEditing = editing[field];

    return (
      <div className="sd-field">
        <span className="sd-field-label">{label}</span>
        {isEditing ? (
          <div className="sd-editable-row">
            <input
              className="sd-edit-input"
              value={editDraft[field] ?? ''}
              onChange={e => setEditDraft(p => ({ ...p, [field]: e.target.value }))}
              autoFocus
              aria-label={`Edit ${label}`}
            />
            <button className="ad-btn ad-btn-primary" style={{ padding: '.35rem .65rem' }}
              onClick={() => saveField(field)} disabled={saving} aria-label="Save">
              <Check size={13} />
            </button>
            <button className="ad-btn ad-btn-outline" style={{ padding: '.35rem .65rem' }}
              onClick={() => cancelEdit(field)} aria-label="Cancel">
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="sd-editable-row">
            <span className="sd-field-value">
              {val == null || val === '' ? <span style={{ color: 'var(--text-secondary)' }}>—</span> : String(val)}
            </span>
            {canEdit && (
              <button
                className="ad-btn ad-btn-outline"
                style={{ padding: '.25rem .5rem', marginLeft: 'auto', flexShrink: 0 }}
                onClick={() => startEdit(field, val)}
                aria-label={`Edit ${label}`}
              >
                <Edit3 size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const cgpaNum = parseFloat(data.cgpa);
  const cgpaClass = isNaN(cgpaNum) ? '' : cgpaNum >= 8 ? 'sd-cgpa-high' : cgpaNum >= 6 ? 'sd-cgpa-mid' : 'sd-cgpa-low';

  return (
    <div className="sd-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-sub">View and update your personal information</p>
        </div>
        <span className={`ad-badge ${data.profile_complete ? 'ad-badge-active' : 'ad-badge-pending'}`}>
          {data.profile_complete ? 'Profile Complete' : 'Incomplete Profile'}
        </span>
      </div>

      {/* Hero */}
      <div className="sd-hero">
        <div style={{ position: 'relative' }}>
          {data.profile_photo_url
            ? <img src={data.profile_photo_url} alt={data.full_name} className="sd-avatar" />
            : <div className="sd-avatar-placeholder" aria-label="Avatar">{initials}</div>
          }
          <button
            onClick={() => startEdit('profile_photo_url', data.profile_photo_url)}
            style={{
              position: 'absolute', bottom: 0, right: 0,
              background: 'var(--clr-secondary)', border: 'none', borderRadius: '50%',
              width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Change profile photo"
          >
            <Camera size={12} color="#fff" />
          </button>
        </div>
        <div className="sd-hero-info">
          <p className="sd-hero-name">{data.full_name}</p>
          <p className="sd-hero-sub">{data.roll_no} · {data.branch} · Sem {data.semester}</p>
          <div className="sd-hero-chips">
            {data.college_name && <span className="sd-hero-chip">{data.college_name}</span>}
            <span className="sd-hero-chip">Batch {data.batch_year}</span>
            {data.dpdp_consent_given
              ? <span className="sd-hero-chip" style={{ background: 'rgba(34,197,94,.25)' }}>DPDP Consent ✓</span>
              : <span className="sd-hero-chip" style={{ background: 'rgba(239,68,68,.25)' }}>DPDP Not Given</span>
            }
          </div>
        </div>
        {data.cgpa != null && (
          <span className={`sd-cgpa-badge ${cgpaClass}`} style={{ fontSize: '1.1rem', padding: '.35rem 1rem' }}>
            CGPA {parseFloat(data.cgpa).toFixed(2)}
          </span>
        )}
      </div>

      {/* Photo URL edit when active */}
      {editing['profile_photo_url'] && (
        <div className="sd-section" style={{ padding: '1rem 1.5rem' }}>
          <p className="sd-field-label">Profile Photo URL</p>
          <div className="sd-editable-row" style={{ marginTop: '.4rem' }}>
            <input
              className="sd-edit-input"
              value={editDraft['profile_photo_url'] ?? ''}
              onChange={e => setEditDraft(p => ({ ...p, profile_photo_url: e.target.value }))}
              placeholder="https://..."
              autoFocus
            />
            <button className="ad-btn ad-btn-primary" style={{ padding: '.35rem .65rem' }}
              onClick={() => saveField('profile_photo_url')} disabled={saving}>
              <Check size={13} />
            </button>
            <button className="ad-btn ad-btn-outline" style={{ padding: '.35rem .65rem' }}
              onClick={() => cancelEdit('profile_photo_url')}>
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Identity */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><User aria-hidden="true" /> Identity & Basic Info</h2>
        </div>
        <div className="sd-section-body">
          {['full_name','roll_no','email','phone','branch','semester','batch_year','college_name'].map(f => (
            <ReadField key={f} field={f} />
          ))}
        </div>
      </div>

      {/* Academic — read-only */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><BookOpen aria-hidden="true" /> Academic Record <span style={{ fontSize: '.72rem', color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '.35rem' }}>(read-only)</span></h2>
        </div>
        <div className="sd-section-body">
          <div className="sd-field">
            <span className="sd-field-label">CGPA</span>
            {data.cgpa != null
              ? <span className={`sd-cgpa-badge ${cgpaClass}`}>{parseFloat(data.cgpa).toFixed(2)}</span>
              : <span className="sd-field-value" style={{ color: 'var(--text-secondary)' }}>—</span>}
          </div>
          <ReadField field="attendance_pct" />
          <div className="sd-field">
            <span className="sd-field-label">Active Backlogs</span>
            <span className={`sd-cgpa-badge ${data.active_backlogs > 0 ? 'sd-cgpa-low' : 'sd-cgpa-high'}`}>
              {data.active_backlogs > 0 ? `${data.active_backlogs} Backlog(s)` : 'Clear ✓'}
            </span>
          </div>
        </div>
      </div>

      {/* Admission Details — read-only */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><Award aria-hidden="true" /> Admission Details <span style={{ fontSize: '.72rem', color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '.35rem' }}>(read-only)</span></h2>
        </div>
        <div className="sd-section-body">
          {['entrance_exam_type','entrance_rank','quota_category','batch_year'].map(f => (
            <ReadField key={f} field={f} />
          ))}
        </div>
      </div>

      {/* Administrative / Personal */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><Home aria-hidden="true" /> Personal & Administrative</h2>
        </div>
        <div className="sd-section-body">
          {['hostel_address','home_address','parent_contact'].map(f => (
            <ReadField key={f} field={f} />
          ))}
          {/* Fees / scholarship — read-only */}
          <div className="sd-field">
            <span className="sd-field-label">Fees Submitted (₹) <span style={{ fontSize: '.68rem', color: 'var(--text-secondary)' }}>(read-only)</span></span>
            <span className="sd-field-value">{data.fees_submitted != null ? `₹${data.fees_submitted.toLocaleString()}` : '—'}</span>
          </div>
          <div className="sd-field">
            <span className="sd-field-label">Scholarship <span style={{ fontSize: '.68rem', color: 'var(--text-secondary)' }}>(read-only)</span></span>
            <span className="sd-field-value">{data.scholarship_details || '—'}</span>
          </div>
        </div>
      </div>

      {/* Career */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><Briefcase aria-hidden="true" /> Career & Links</h2>
        </div>
        <div className="sd-section-body">
          {['linkedin_url','github_url','resume_url'].map(f => (
            <ReadField key={f} field={f} />
          ))}
        </div>
      </div>

      {/* Platform Activity */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><Activity aria-hidden="true" /> Platform Activity</h2>
        </div>
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Event registrations */}
          <div>
            <p className="sd-field-label" style={{ marginBottom: '.6rem' }}>Event Registrations</p>
            {data.platform_activity?.event_registrations?.length > 0 ? (
              <div className="sd-activity-list">
                {data.platform_activity.event_registrations.map(r => (
                  <div key={r.event_id} className="sd-activity-item">
                    <div className="sd-activity-icon"><Calendar size={15} /></div>
                    <div className="sd-activity-body">
                      <strong>{r.event_title}</strong>
                      {r.event_type && <span style={{ color: 'var(--text-secondary)', marginLeft: '.4rem', fontSize: '.75rem' }}>{r.event_type}</span>}
                    </div>
                    <span className="sd-activity-time">{r.registered_at ? new Date(r.registered_at).toLocaleDateString() : '—'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="sd-field-value" style={{ color: 'var(--text-secondary)' }}>No event registrations.</p>
            )}
          </div>

          {/* Placement offers */}
          <div>
            <p className="sd-field-label" style={{ marginBottom: '.6rem' }}>Placement Offers</p>
            {data.placement_offers?.length > 0 ? (
              <div className="sd-offer-list">
                {data.placement_offers.map((off, i) => (
                  <div key={i} className="sd-offer-card">
                    <div>
                      <div className="sd-offer-company">{off.company}</div>
                      <div className="sd-offer-role">{off.role}</div>
                    </div>
                    <span className={`ad-badge ${off.status === 'accepted' ? 'ad-badge-active' : 'ad-badge-pending'}`}>{off.status}</span>
                    {off.ctc && <span className="sd-offer-ctc">₹{off.ctc} LPA</span>}
                    {off.offer_date && (
                      <span style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                        {new Date(off.offer_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="sd-field-value" style={{ color: 'var(--text-secondary)' }}>No placement offers yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
