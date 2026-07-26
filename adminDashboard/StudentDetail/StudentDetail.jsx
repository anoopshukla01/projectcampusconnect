/**
 * Admin — Student Detail Page
 *
 * Full access: all 6 sections visible and editable.
 * Every edit triggers a confirmation modal and logs to the Audit Log via S5.
 * Section-level "last edited by/at" metadata shown when available.
 *
 * Data fetched from S9 GET /students/<id>/detail.
 * Saves via S5 PATCH /students/<id> with edited_section tag.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User, BookOpen, FileText, ShieldCheck,
  Briefcase, Activity, ChevronDown, AlertTriangle,
  Edit3, Check, X, ArrowLeft, Calendar, Award
} from 'lucide-react';
import { studentsApi } from '@/services/api';
import { useToast } from '@ctx/ToastContext';
import '@admin/admin.shared.css';
import './StudentDetail.css';

// ─── Sensitive fields that require a confirmation modal before saving ─────────
const SENSITIVE_FIELDS = new Set([
  'fees_submitted', 'scholarship_details', 'quota_category',
  'active_backlogs', 'cgpa', 'is_active',
]);

// ─── Section definitions — icon, title, field keys ────────────────────────────
const SECTIONS = [
  {
    key: 'identity',
    icon: User,
    title: 'Identity & Basic Info',
    fields: ['full_name', 'roll_no', 'email', 'phone', 'branch', 'semester', 'batch_year', 'profile_photo_url'],
    editable: ['full_name', 'email', 'phone', 'profile_photo_url'],
  },
  {
    key: 'academic',
    icon: BookOpen,
    title: 'Academic Snapshot',
    fields: ['cgpa', 'attendance_pct', 'active_backlogs', 'profile_complete', 'dpdp_consent_given'],
    editable: ['cgpa', 'attendance_pct', 'active_backlogs'],
  },
  {
    key: 'admission',
    icon: Award,
    title: 'Admission Details',
    fields: ['entrance_exam_type', 'entrance_rank', 'quota_category', 'batch_year', 'college_name'],
    editable: ['entrance_exam_type', 'entrance_rank', 'quota_category'],
  },
  {
    key: 'admin_details',
    icon: ShieldCheck,
    title: 'Administrative Details',
    fields: ['fees_submitted', 'scholarship_details', 'hostel_address', 'home_address', 'parent_contact'],
    editable: ['fees_submitted', 'scholarship_details', 'hostel_address', 'home_address', 'parent_contact'],
  },
  {
    key: 'career',
    icon: Briefcase,
    title: 'Career / Placement',
    fields: ['linkedin_url', 'github_url', 'resume_url'],
    editable: ['linkedin_url', 'github_url', 'resume_url'],
  },
  {
    key: 'activity',
    icon: Activity,
    title: 'Platform Activity',
    fields: [],
    editable: [],
    custom: true, // rendered separately
  },
];

const FIELD_LABELS = {
  full_name: 'Full Name', roll_no: 'Roll Number', email: 'Email', phone: 'Phone',
  branch: 'Branch', semester: 'Semester', batch_year: 'Batch Year',
  profile_photo_url: 'Profile Photo URL', cgpa: 'CGPA', attendance_pct: 'Attendance %',
  active_backlogs: 'Active Backlogs', profile_complete: 'Profile Complete',
  dpdp_consent_given: 'DPDP Consent', entrance_exam_type: 'Entrance Exam',
  entrance_rank: 'Entrance Rank/Score', quota_category: 'Quota/Category',
  college_name: 'College', fees_submitted: 'Fees Submitted (₹)',
  scholarship_details: 'Scholarship', hostel_address: 'Hostel Address',
  home_address: 'Home Address', parent_contact: 'Parent Contact',
  linkedin_url: 'LinkedIn URL', github_url: 'GitHub URL', resume_url: 'Resume URL',
};

export default function AdminStudentDetail() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Section collapse state — all expanded by default
  const [collapsed, setCollapsed] = useState({});

  // Inline edit state — { fieldKey: draftValue }
  const [editing, setEditing] = useState({});
  const [editDraft, setEditDraft] = useState({});
  const [saving, setSaving] = useState(false);

  // Confirmation modal
  const [confirmState, setConfirmState] = useState(null); // { section, field, oldVal, newVal }

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await studentsApi.getDetail(studentId);
    if (res?.error) {
      setError(res.error);
    } else {
      setData(res);
    }
    setLoading(false);
  }, [studentId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // ── Toggle section collapse ──────────────────────────────────────────────
  const toggleSection = (key) =>
    setCollapsed(p => ({ ...p, [key]: !p[key] }));

  // ── Start inline edit ────────────────────────────────────────────────────
  const startEdit = (field, currentVal) => {
    setEditing(p => ({ ...p, [field]: true }));
    setEditDraft(p => ({ ...p, [field]: currentVal ?? '' }));
  };

  const cancelEdit = (field) => {
    setEditing(p => ({ ...p, [field]: false }));
  };

  // ── Save edit — with confirmation gate for sensitive fields ───────────────
  const requestSave = (section, field) => {
    const oldVal = data[field];
    const newVal = editDraft[field];
    if (String(oldVal ?? '') === String(newVal ?? '')) {
      cancelEdit(field);
      return;
    }
    if (SENSITIVE_FIELDS.has(field)) {
      setConfirmState({ section, field, oldVal, newVal });
    } else {
      commitSave(section, field, newVal);
    }
  };

  const commitSave = async (section, field, newVal) => {
    setSaving(true);
    setConfirmState(null);
    const payload = { [field]: newVal === '' ? null : newVal, edited_section: section };
    const res = await studentsApi.adminUpdate(studentId, payload);
    setSaving(false);
    if (res?.error) {
      showToast(res.error, 'error', 3500);
    } else {
      showToast(`${FIELD_LABELS[field] || field} updated.`, 'success', 2500);
      setEditing(p => ({ ...p, [field]: false }));
      setData(prev => ({
        ...prev,
        [field]: newVal === '' ? null : newVal,
        admin_edits_meta: {
          ...(prev?.admin_edits_meta || {}),
          [section]: { editor_name: 'You', edited_at: new Date().toISOString() },
        },
      }));
    }
  };

  // ── CGPA badge ────────────────────────────────────────────────────────────
  const cgpaBadgeClass = (val) => {
    const n = parseFloat(val);
    if (n >= 8.0) return 'sd-cgpa-badge sd-cgpa-high';
    if (n >= 6.0) return 'sd-cgpa-badge sd-cgpa-mid';
    return 'sd-cgpa-badge sd-cgpa-low';
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <div className="sd-spinner" aria-label="Loading student profile" />;
  if (error) return (
    <div className="sd-root">
      <div className="sd-empty">
        <AlertTriangle className="sd-empty-icon" />
        <p className="sd-empty-text">{error}</p>
        <button className="ad-btn ad-btn-outline" onClick={fetchDetail}>Retry</button>
      </div>
    </div>
  );
  if (!data) return null;

  const initials = (data.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="sd-root">
      {/* ── Confirmation Modal ─────────────────────────────────────────── */}
      {confirmState && (
        <div className="sd-confirm-overlay" role="dialog" aria-modal="true">
          <div className="sd-confirm-modal">
            <p className="sd-confirm-title">⚠️ Confirm Sensitive Edit</p>
            <p className="sd-confirm-sub">
              You are about to change a sensitive field on this student's record.
              This action will be written to the Audit Log.
            </p>
            <div className="sd-confirm-diff">
              <div className="sd-confirm-diff-row">
                <span>{FIELD_LABELS[confirmState.field] || confirmState.field}</span>
                <span>
                  <span className="sd-confirm-diff-old">{String(confirmState.oldVal ?? '—')}</span>
                  {' → '}
                  <span className="sd-confirm-diff-new">{String(confirmState.newVal ?? '—')}</span>
                </span>
              </div>
            </div>
            <div className="sd-confirm-actions">
              <button className="ad-btn ad-btn-outline" onClick={() => setConfirmState(null)}>
                Cancel
              </button>
              <button
                className="ad-btn ad-btn-primary"
                onClick={() => commitSave(confirmState.section, confirmState.field, confirmState.newVal)}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <button
            className="ad-btn ad-btn-outline"
            style={{ marginBottom: '.75rem' }}
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="page-title">Student Profile</h1>
          <p className="page-sub">Admin view — full access, all edits logged to Audit Log</p>
        </div>
        <span className={`ad-badge ${data.is_active !== false ? 'ad-badge-active' : 'ad-badge-inactive'}`}>
          {data.is_active !== false ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* ── Hero Strip ─────────────────────────────────────────────────── */}
      <div className="sd-hero">
        {data.profile_photo_url
          ? <img src={data.profile_photo_url} alt={data.full_name} className="sd-avatar" />
          : <div className="sd-avatar-placeholder" aria-label="Avatar">{initials}</div>
        }
        <div className="sd-hero-info">
          <p className="sd-hero-name">{data.full_name || '—'}</p>
          <p className="sd-hero-sub">{data.roll_no} · {data.branch} · Sem {data.semester}</p>
          <div className="sd-hero-chips">
            <span className="sd-hero-chip">{data.college_name || 'College'}</span>
            <span className="sd-hero-chip">Batch {data.batch_year}</span>
            {data.active_backlogs > 0 && (
              <span className="sd-hero-chip" style={{ background: 'rgba(239,68,68,.3)' }}>
                {data.active_backlogs} Backlog{data.active_backlogs > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        {data.cgpa != null && (
          <span className={cgpaBadgeClass(data.cgpa)} style={{ fontSize: '1.1rem', padding: '.35rem 1rem' }}>
            CGPA {parseFloat(data.cgpa).toFixed(2)}
          </span>
        )}
      </div>

      {/* ── Sections ─────────────────────────────────────────────────────── */}
      {SECTIONS.filter(s => !s.custom).map(section => {
        const Icon = section.icon;
        const meta = data.admin_edits_meta?.[section.key];
        const isOpen = !collapsed[section.key];

        return (
          <div key={section.key} className="sd-section">
            <div
              className="sd-section-header"
              onClick={() => toggleSection(section.key)}
              aria-expanded={isOpen}
              role="button"
            >
              <h2 className="sd-section-title">
                <Icon aria-hidden="true" />
                {section.title}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                {meta && (
                  <span className="sd-section-meta">
                    <Calendar size={11} style={{ marginRight: '.25rem', verticalAlign: 'middle' }} />
                    Edited by {meta.editor_name} · {new Date(meta.edited_at).toLocaleDateString()}
                  </span>
                )}
                <ChevronDown className={`sd-chevron ${isOpen ? 'open' : ''}`} size={16} />
              </div>
            </div>

            {isOpen && (
              <div className="sd-section-body">
                {section.fields.map(field => {
                  const label = FIELD_LABELS[field] || field;
                  const val = data[field];
                  const isEditing = editing[field];
                  const canEdit = section.editable.includes(field);
                  const isSensitive = SENSITIVE_FIELDS.has(field);

                  return (
                    <div key={field} className="sd-field">
                      <span className="sd-field-label">{label}</span>
                      {isEditing ? (
                        <div className="sd-editable-row">
                          {isSensitive && (
                            <span title="Sensitive field — edit will be confirmed" style={{ color: 'var(--clr-warning)', fontSize: '.8rem' }}>
                              ⚠️
                            </span>
                          )}
                          <input
                            className="sd-edit-input"
                            value={editDraft[field] ?? ''}
                            onChange={e => setEditDraft(p => ({ ...p, [field]: e.target.value }))}
                            autoFocus
                            aria-label={`Edit ${label}`}
                          />
                          <button
                            className="ad-btn ad-btn-primary"
                            style={{ padding: '.35rem .65rem' }}
                            onClick={() => requestSave(section.key, field)}
                            disabled={saving}
                            aria-label="Save"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            className="ad-btn ad-btn-outline"
                            style={{ padding: '.35rem .65rem' }}
                            onClick={() => cancelEdit(field)}
                            aria-label="Cancel"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="sd-editable-row">
                          <span className="sd-field-value">
                            {val == null || val === '' ? '—' : String(val)}
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
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Platform Activity (custom section) ──────────────────────────── */}
      <div className="sd-section">
        <div
          className="sd-section-header"
          onClick={() => toggleSection('activity')}
          aria-expanded={!collapsed['activity']}
          role="button"
        >
          <h2 className="sd-section-title">
            <Activity aria-hidden="true" />
            Platform Activity
          </h2>
          <ChevronDown className={`sd-chevron ${!collapsed['activity'] ? 'open' : ''}`} size={16} />
        </div>

        {!collapsed['activity'] && (
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Event registrations */}
            <div>
              <p className="sd-field-label" style={{ marginBottom: '.6rem' }}>Event Registrations</p>
              {data.platform_activity?.event_registrations?.length > 0 ? (
                <div className="sd-activity-list">
                  {data.platform_activity.event_registrations.map(r => (
                    <div key={r.event_id} className="sd-activity-item">
                      <div className="sd-activity-icon">
                        <Calendar size={15} aria-hidden="true" />
                      </div>
                      <div className="sd-activity-body">
                        <strong>{r.event_title}</strong>
                        {r.event_type && <span style={{ color: 'var(--text-secondary)', marginLeft: '.5rem', fontSize: '.75rem' }}>{r.event_type}</span>}
                      </div>
                      <span className="sd-activity-time">
                        {r.registered_at ? new Date(r.registered_at).toLocaleDateString() : '—'}
                      </span>
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
                      <span className={`ad-badge ${off.status === 'accepted' ? 'ad-badge-active' : off.status === 'pending' ? 'ad-badge-pending' : 'ad-badge-info'}`}>
                        {off.status}
                      </span>
                      {off.ctc && <span className="sd-offer-ctc">₹{off.ctc} LPA</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="sd-field-value" style={{ color: 'var(--text-secondary)' }}>No placement offers.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
