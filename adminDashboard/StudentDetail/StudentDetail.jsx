/**
 * Admin — Student Detail Page
 * ===========================
 * Full access: all sections visible and modularly editable.
 * Every edit triggers confirmation for sensitive fields and logs to Audit Log via S5.
 * Driven by centralized field schema with type safety, custom input widgets,
 * optimistic updates, and error rollback.
 *
 * Data fetched from S9 GET /students/<id>/detail.
 * Saves via S5 PATCH /students/<id> with edited_section tag.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User, BookOpen, Award, ShieldCheck,
  Briefcase, Activity, ChevronDown, AlertTriangle,
  ArrowLeft, Calendar, Code, Camera
} from 'lucide-react';
import { studentsApi } from '@/services/api';
import { useToast } from '@ctx/ToastContext';
import '@admin/admin.shared.css';
import './StudentDetail.css';

import { FIELD_SCHEMAS, formatFieldValue } from './fieldSchema';
import StudentDetailField from './StudentDetailField';
import PhotoUploader from './PhotoUploader';

// ─── Section definitions — icon, title, field keys ────────────────────────────
const SECTIONS = [
  {
    key: 'identity',
    icon: User,
    title: 'Identity & Basic Info',
    fields: [
      'full_name', 'roll_no', 'email', 'phone',
      'branch', 'semester', 'batch_year', 'profile_photo_url'
    ],
    editable: [
      'full_name', 'roll_no', 'email', 'phone',
      'branch', 'semester', 'batch_year', 'profile_photo_url'
    ],
  },
  {
    key: 'academic',
    icon: BookOpen,
    title: 'Academic Snapshot',
    fields: [
      'cgpa', 'attendance_pct', 'active_backlogs',
      'profile_complete', 'dpdp_consent_given', 'is_active'
    ],
    editable: [
      'cgpa', 'attendance_pct', 'active_backlogs',
      'profile_complete', 'dpdp_consent_given', 'is_active'
    ],
  },
  {
    key: 'admission',
    icon: Award,
    title: 'Admission Details',
    fields: [
      'entrance_exam_type', 'entrance_rank', 'quota_category',
      'batch_year', 'college_name'
    ],
    editable: [
      'entrance_exam_type', 'entrance_rank', 'quota_category',
      'batch_year', 'college_name'
    ],
  },
  {
    key: 'admin_details',
    icon: ShieldCheck,
    title: 'Administrative Details',
    fields: [
      'fees_submitted', 'scholarship_details',
      'hostel_address', 'home_address', 'parent_contact'
    ],
    editable: [
      'fees_submitted', 'scholarship_details',
      'hostel_address', 'home_address', 'parent_contact'
    ],
  },
  {
    key: 'career',
    icon: Briefcase,
    title: 'Career / Placement',
    fields: ['linkedin_url', 'github_url', 'resume_url'],
    editable: ['linkedin_url', 'github_url', 'resume_url'],
    customSkills: true,
  },
  {
    key: 'activity',
    icon: Activity,
    title: 'Platform Activity',
    fields: [],
    editable: [],
    custom: true,
  },
];

export default function AdminStudentDetail() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Section collapse state — all expanded by default
  const [collapsed, setCollapsed] = useState({});

  // Inline edit state
  const [editing, setEditing] = useState({});
  const [editDraft, setEditDraft] = useState({});
  const [savingField, setSavingField] = useState(null);

  // Confirmation modal state: { section, field, oldVal, newVal }
  const [confirmState, setConfirmState] = useState(null);

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

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const toggleSection = (key) => {
    setCollapsed((p) => ({ ...p, [key]: !p[key] }));
  };

  const startEdit = (field, currentVal) => {
    setEditing((p) => ({ ...p, [field]: true }));
    setEditDraft((p) => ({ ...p, [field]: currentVal ?? '' }));
  };

  const cancelEdit = (field) => {
    setEditing((p) => ({ ...p, [field]: false }));
    setEditDraft((p) => {
      const copy = { ...p };
      delete copy[field];
      return copy;
    });
  };

  const handleDraftChange = (field, val) => {
    setEditDraft((p) => ({ ...p, [field]: val }));
  };

  const requestSave = (section, field, overrideVal) => {
    const oldVal = data[field];
    const newVal = overrideVal !== undefined ? overrideVal : editDraft[field];

    if (String(oldVal ?? '') === String(newVal ?? '')) {
      cancelEdit(field);
      return;
    }

    const schema = FIELD_SCHEMAS[field];
    if (schema?.sensitive) {
      setConfirmState({ section, field, oldVal, newVal });
    } else {
      commitSave(section, field, newVal);
    }
  };

  const commitSave = async (section, field, newVal) => {
    const previousValue = data[field];
    const schema = FIELD_SCHEMAS[field];

    let formattedValue = newVal === '' ? null : newVal;
    if (schema?.type === 'number' && formattedValue !== null) {
      formattedValue = Number(formattedValue);
    }

    // Optimistic local update
    setData((prev) => ({
      ...prev,
      [field]: formattedValue,
    }));
    setEditing((p) => ({ ...p, [field]: false }));
    setSavingField(field);
    setConfirmState(null);

    const payload = {
      [field]: formattedValue,
      edited_section: section,
    };

    const res = await studentsApi.adminUpdate(studentId, payload);
    setSavingField(null);

    if (res?.error) {
      // Rollback to previous value on API failure
      setData((prev) => ({
        ...prev,
        [field]: previousValue,
      }));
      showToast(res.error, 'error', 4000);
    } else {
      const fieldLabel = schema?.label || field;
      showToast(`${fieldLabel} updated successfully.`, 'success', 2500);
      setData((prev) => ({
        ...prev,
        admin_edits_meta: {
          ...(prev?.admin_edits_meta || {}),
          [section]: {
            editor_name: 'You (Admin)',
            edited_at: new Date().toISOString(),
          },
        },
      }));
    }
  };

  const cgpaBadgeClass = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '';
    if (n >= 8.0) return 'sd-cgpa-badge sd-cgpa-high';
    if (n >= 6.0) return 'sd-cgpa-badge sd-cgpa-mid';
    return 'sd-cgpa-badge sd-cgpa-low';
  };

  // ── Render States ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="sd-root">
        <div className="sd-spinner" aria-label="Loading student profile" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="sd-root">
        <div className="sd-empty">
          <AlertTriangle className="sd-empty-icon" />
          <p className="sd-empty-text">{error}</p>
          <button type="button" className="ad-btn ad-btn-outline" onClick={fetchDetail}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const initials = (data.full_name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="sd-root">
      {/* ── Confirmation Modal for Sensitive Edits ─────────────────────── */}
      {confirmState && (
        <div className="sd-confirm-overlay" role="dialog" aria-modal="true">
          <div className="sd-confirm-modal">
            <p className="sd-confirm-title">⚠️ Confirm Sensitive Edit</p>
            <p className="sd-confirm-sub">
              You are about to change a sensitive field on this student record. This modification
              will be permanently logged to the Admin Audit Log.
            </p>
            <div className="sd-confirm-diff">
              <div className="sd-confirm-diff-row">
                <span style={{ fontWeight: 600 }}>
                  {FIELD_SCHEMAS[confirmState.field]?.label || confirmState.field}:
                </span>
                <span>
                  <span className="sd-confirm-diff-old">
                    {formatFieldValue(confirmState.field, confirmState.oldVal)}
                  </span>
                  {' → '}
                  <span className="sd-confirm-diff-new">
                    {formatFieldValue(confirmState.field, confirmState.newVal)}
                  </span>
                </span>
              </div>
            </div>
            <div className="sd-confirm-actions">
              <button
                type="button"
                className="ad-btn ad-btn-outline"
                onClick={() => setConfirmState(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ad-btn ad-btn-primary"
                onClick={() => commitSave(confirmState.section, confirmState.field, confirmState.newVal)}
                disabled={Boolean(savingField)}
              >
                {savingField ? 'Saving…' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <button
            type="button"
            className="ad-btn ad-btn-outline"
            style={{ marginBottom: '.75rem' }}
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="page-title">Student Profile Management</h1>
          <p className="page-sub">Admin view — full record access, granular schema validation & audit-logged edits</p>
        </div>
        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}>
          <span className={`ad-badge ${data.is_active !== false ? 'ad-badge-active' : 'ad-badge-inactive'}`}>
            {data.is_active !== false ? 'Active Account' : 'Inactive Account'}
          </span>
        </div>
      </div>

      {/* ── Hero Strip ─────────────────────────────────────────────────── */}
      <div className="sd-hero">
        <div style={{ position: 'relative' }}>
          {data.profile_photo_url ? (
            <img src={data.profile_photo_url} alt={data.full_name} className="sd-avatar" />
          ) : (
            <div className="sd-avatar-placeholder" aria-label="Avatar">
              {initials}
            </div>
          )}
          <button
            type="button"
            onClick={() => startEdit('profile_photo_url', data.profile_photo_url)}
            className="sd-avatar-edit-btn"
            aria-label="Change student photo"
            title="Upload or change photo"
          >
            <Camera size={13} color="#fff" />
          </button>
        </div>

        <div className="sd-hero-info">
          <p className="sd-hero-name">{data.full_name || '—'}</p>
          <p className="sd-hero-sub">
            {data.roll_no || 'No Roll No'} · {data.branch || 'No Branch'} · Sem {data.semester || '—'}
          </p>
          <div className="sd-hero-chips">
            <span className="sd-hero-chip">{data.college_name || 'College'}</span>
            <span className="sd-hero-chip">Batch {data.batch_year || '—'}</span>
            {data.active_backlogs > 0 && (
              <span className="sd-hero-chip" style={{ background: 'rgba(239,68,68,.3)' }}>
                {data.active_backlogs} Backlog{data.active_backlogs > 1 ? 's' : ''}
              </span>
            )}
            {data.dpdp_consent_given ? (
              <span className="sd-hero-chip" style={{ background: 'rgba(34,197,94,.25)' }}>
                DPDP Consent ✓
              </span>
            ) : (
              <span className="sd-hero-chip" style={{ background: 'rgba(239,68,68,.25)' }}>
                DPDP Not Given
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

      {/* ── Photo Uploader Panel (when editing photo) ──────────────────── */}
      {editing['profile_photo_url'] && (
        <div className="sd-section">
          <div className="sd-section-header" style={{ cursor: 'default' }}>
            <h2 className="sd-section-title">
              <Camera aria-hidden="true" /> Update Student Profile Photo
            </h2>
          </div>
          <div style={{ padding: '1.25rem 1.5rem' }}>
            <PhotoUploader
              currentUrl={data.profile_photo_url}
              saving={savingField === 'profile_photo_url'}
              onSave={(newUrl) => requestSave('identity', 'profile_photo_url', newUrl)}
              onCancel={() => cancelEdit('profile_photo_url')}
            />
          </div>
        </div>
      )}

      {/* ── Configurable Schema-Driven Sections ────────────────────────── */}
      {SECTIONS.filter((s) => !s.custom).map((section) => {
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
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && toggleSection(section.key)}
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
                {section.fields
                  .filter((f) => f !== 'profile_photo_url') // Rendered in hero/modal
                  .map((field) => {
                    const schema = FIELD_SCHEMAS[field];
                    return (
                      <StudentDetailField
                        key={field}
                        field={field}
                        value={data[field]}
                        isEditing={Boolean(editing[field])}
                        draftValue={editDraft[field]}
                        canEdit={section.editable.includes(field)}
                        isSensitive={Boolean(schema?.sensitive)}
                        saving={savingField === field}
                        onStartEdit={startEdit}
                        onCancelEdit={cancelEdit}
                        onDraftChange={handleDraftChange}
                        onSave={(f, override) => requestSave(section.key, f, override)}
                      />
                    );
                  })}

                {/* Skills chips in Career Section */}
                {section.customSkills && (
                  <div className="sd-field sd-field-full" style={{ marginTop: '.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    <p className="sd-field-label" style={{ marginBottom: '.6rem' }}>
                      <Code size={13} style={{ verticalAlign: 'middle', marginRight: '.3rem' }} />
                      Reported Skills
                    </p>
                    {(data.skills || []).length === 0 ? (
                      <span className="sd-field-value sd-field-empty">No skills listed yet</span>
                    ) : (
                      ['technical', 'soft'].map((cat) => {
                        const group = (data.skills || []).filter((s) => s.category === cat);
                        if (!group.length) return null;
                        const PROF_BADGE = {
                          beginner: 'ad-badge ad-badge-info',
                          intermediate: 'ad-badge ad-badge-pending',
                          advanced: 'ad-badge ad-badge-active',
                        };
                        return (
                          <div key={cat} style={{ marginBottom: '.75rem' }}>
                            <p
                              className="sd-field-label"
                              style={{ fontSize: '.7rem', textTransform: 'uppercase', marginBottom: '.35rem' }}
                            >
                              {cat === 'technical' ? 'Technical Skills' : 'Soft Skills'}
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                              {group.map((s, i) => (
                                <span
                                  key={i}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '.3rem',
                                    background: 'rgba(255,255,255,.07)',
                                    border: '1px solid rgba(255,255,255,.1)',
                                    borderRadius: '999px',
                                    padding: '.2rem .6rem',
                                    fontSize: '.8rem',
                                  }}
                                >
                                  {s.name}
                                  <span
                                    className={PROF_BADGE[s.proficiency] || 'ad-badge ad-badge-info'}
                                    style={{ fontSize: '.63rem', padding: '.08rem .35rem' }}
                                  >
                                    {s.proficiency}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Platform Activity (Custom Section) ─────────────────────────── */}
      <div className="sd-section">
        <div
          className="sd-section-header"
          onClick={() => toggleSection('activity')}
          aria-expanded={!collapsed['activity']}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && toggleSection('activity')}
        >
          <h2 className="sd-section-title">
            <Activity aria-hidden="true" />
            Platform Activity & Outcomes
          </h2>
          <ChevronDown className={`sd-chevron ${!collapsed['activity'] ? 'open' : ''}`} size={16} />
        </div>

        {!collapsed['activity'] && (
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Event registrations */}
            <div>
              <p className="sd-field-label" style={{ marginBottom: '.6rem' }}>
                Event Registrations
              </p>
              {data.platform_activity?.event_registrations?.length > 0 ? (
                <div className="sd-activity-list">
                  {data.platform_activity.event_registrations.map((r) => (
                    <div key={r.event_id} className="sd-activity-item">
                      <div className="sd-activity-icon">
                        <Calendar size={15} aria-hidden="true" />
                      </div>
                      <div className="sd-activity-body">
                        <strong>{r.event_title}</strong>
                        {r.event_type && (
                          <span style={{ color: 'var(--text-secondary)', marginLeft: '.5rem', fontSize: '.75rem' }}>
                            {r.event_type}
                          </span>
                        )}
                      </div>
                      <span className="sd-activity-time">
                        {r.registered_at ? new Date(r.registered_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="sd-field-value sd-field-empty">No event registrations found.</p>
              )}
            </div>

            {/* Placement offers */}
            <div>
              <p className="sd-field-label" style={{ marginBottom: '.6rem' }}>
                Placement Offers & Drives
              </p>
              {data.placement_offers?.length > 0 ? (
                <div className="sd-offer-list">
                  {data.placement_offers.map((off, i) => (
                    <div key={i} className="sd-offer-card">
                      <div>
                        <div className="sd-offer-company">{off.company}</div>
                        <div className="sd-offer-role">{off.role}</div>
                      </div>
                      <span
                        className={`ad-badge ${
                          off.status === 'accepted'
                            ? 'ad-badge-active'
                            : off.status === 'pending'
                            ? 'ad-badge-pending'
                            : 'ad-badge-info'
                        }`}
                      >
                        {off.status}
                      </span>
                      {off.ctc && <span className="sd-offer-ctc">₹{off.ctc} LPA</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="sd-field-value sd-field-empty">No placement offers recorded.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
