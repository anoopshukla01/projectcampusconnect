/**
 * Student — Self-View Profile Page (Organized & Refined)
 * ======================================================
 * Features:
 * - High-impact Profile Hero with animated avatar ring, role chips, and Virtual ID card shortcut.
 * - Key Performance Indicators (KPIs): CGPA Grade, Attendance %, Backlogs, Profile Strength.
 * - Categorized Navigation Tabs (Overview & Academic, Contact & Residential, Career & Skills, Administrative & Fees).
 * - Self-editable inline controls with optimistic updates & toast feedback.
 * - Skills management with proficiency badges.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, BookOpen, Home, Briefcase, Award, Activity,
  Calendar, Check, X, Camera, Code, Plus, IdCard,
  ShieldCheck, PhoneCall, Mail, GraduationCap, CheckCircle2,
  AlertCircle, Sparkles, FileText, ChevronRight
} from 'lucide-react';
import { studentsApi } from '@/services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { FIELD_SCHEMAS } from '@admin/StudentDetail/fieldSchema';
import StudentDetailField from '@admin/StudentDetail/StudentDetailField';
import PhotoUploader from '@admin/StudentDetail/PhotoUploader';
import './StudentDetail.css';

// Fields a student is allowed to self-edit via PATCH /students/me
const SELF_EDITABLE = new Set([
  'email', 'phone', 'home_address', 'hostel_address', 'parent_contact',
  'entrance_exam_type', 'entrance_rank',
  'linkedin_url', 'github_url', 'resume_url', 'profile_photo_url',
]);

// Proficiency → badge class + label
const PROF_BADGE = {
  beginner:     { cls: 'ad-badge ad-badge-info',    label: 'Beginner' },
  intermediate: { cls: 'ad-badge ad-badge-pending', label: 'Intermediate' },
  advanced:     { cls: 'ad-badge ad-badge-active',  label: 'Advanced' },
};

// SkillsSection — dedicated component for the skills management UI
function SkillsSection({ skills, onUpdate, saving }) {
  const [newName,  setNewName]  = useState('');
  const [newCat,   setNewCat]   = useState('technical');
  const [newProf,  setNewProf]  = useState('intermediate');
  const [adding,   setAdding]   = useState(false);

  const techSkills = (skills || []).filter(s => s.category === 'technical');
  const softSkills = (skills || []).filter(s => s.category === 'soft');

  function handleAdd() {
    if (!newName.trim()) return;
    const entry = { name: newName.trim(), category: newCat, proficiency: newProf };
    onUpdate([...(skills || []), entry]);
    setNewName('');
    setAdding(false);
  }

  function handleRemove(idx) {
    onUpdate((skills || []).filter((_, i) => i !== idx));
  }

  const renderGroup = (label, group, offset) => (
    group.length > 0 && (
      <div style={{ marginBottom: '1.25rem' }}>
        <p className="sd-field-label" style={{ marginBottom: '.6rem', fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
          {group.map((s, i) => {
            const badge = PROF_BADGE[s.proficiency] || PROF_BADGE.beginner;
            const globalIdx = offset + i;
            return (
              <span key={globalIdx} className="sd-skill-pill">
                <span>{s.name}</span>
                <span className={badge.cls} style={{ fontSize: '.65rem', padding: '.1rem .45rem' }}>{badge.label}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(globalIdx)}
                  disabled={saving}
                  aria-label={`Remove ${s.name}`}
                  className="sd-skill-remove-btn"
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      </div>
    )
  );

  return (
    <div className="sd-section">
      <div className="sd-section-header">
        <h2 className="sd-section-title"><Code size={18} /> Technical & Soft Skills</h2>
        {!adding && (
          <button
            type="button"
            className="ad-btn ad-btn-outline"
            style={{ fontSize: '.75rem', padding: '.3rem .65rem' }}
            onClick={() => setAdding(true)}
          >
            <Plus size={13} /> Add Skill
          </button>
        )}
      </div>
      <div style={{ padding: '1.25rem 1.5rem' }}>
        {(skills || []).length === 0 && !adding && (
          <p className="sd-field-value sd-field-empty" style={{ marginBottom: '.75rem' }}>
            No skills added yet. Add technical and soft skills to strengthen your profile for recruiters.
          </p>
        )}
        {renderGroup('Technical Proficiencies', techSkills, 0)}
        {renderGroup('Soft Skills & Domain Knowledge', softSkills, techSkills.length)}

        {adding && (
          <div className="sd-add-skill-box">
            <input
              className="sd-edit-input"
              style={{ minWidth: 160, flex: 1 }}
              placeholder="e.g. React.js, Python, Leadership"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              autoFocus
              maxLength={50}
              aria-label="Skill name"
            />
            <select
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              className="sd-edit-input sd-select"
              style={{ width: 'auto' }}
              aria-label="Category"
            >
              <option value="technical">Technical</option>
              <option value="soft">Soft Skill</option>
            </select>
            <select
              value={newProf}
              onChange={e => setNewProf(e.target.value)}
              className="sd-edit-input sd-select"
              style={{ width: 'auto' }}
              aria-label="Proficiency"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <button
              type="button"
              className="ad-btn ad-btn-primary"
              style={{ padding: '.45rem .85rem', fontSize: '.8rem' }}
              onClick={handleAdd}
              disabled={!newName.trim() || saving}
            >
              Add
            </button>
            <button
              type="button"
              className="ad-btn ad-btn-outline"
              style={{ padding: '.45rem .75rem', fontSize: '.8rem' }}
              onClick={() => { setAdding(false); setNewName(''); }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentDetail() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Inline editing state
  const [editing, setEditing] = useState({});
  const [editDraft, setEditDraft] = useState({});
  const [savingField, setSavingField] = useState(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await studentsApi.getMe();
      if (res?.error) {
        setError(res.error);
      } else {
        const student = res?.student || res;
        setData(student);
      }
    } catch (err) {
      setError('Failed to load profile data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const startEdit = (field, currentVal) => {
    setEditing(p => ({ ...p, [field]: true }));
    setEditDraft(p => ({ ...p, [field]: currentVal ?? '' }));
  };

  const cancelEdit = (field) => {
    setEditing(p => ({ ...p, [field]: false }));
    setEditDraft(p => ({ ...p, [field]: undefined }));
  };

  const handleDraftChange = (field, val) => {
    setEditDraft(p => ({ ...p, [field]: val }));
  };

  const saveField = async (field, overrideValue) => {
    const rawValue = overrideValue !== undefined ? overrideValue : editDraft[field];
    const schema = FIELD_SCHEMAS[field];

    if (schema?.validate) {
      const vErr = schema.validate(rawValue);
      if (vErr) {
        showToast(vErr, 'error', 3000);
        return;
      }
    }

    const previousValue = data[field];
    let formattedValue = rawValue;
    if (schema?.type === 'number' && formattedValue !== '' && formattedValue !== null) {
      formattedValue = Number(formattedValue);
    }

    // Optimistic UI update
    setData(prev => ({ ...prev, [field]: formattedValue }));
    setEditing(p => ({ ...p, [field]: false }));
    setSavingField(field);

    const res = await studentsApi.updateSelf({ [field]: formattedValue });
    setSavingField(null);

    if (res?.error) {
      setData(prev => ({ ...prev, [field]: previousValue }));
      showToast(res.error, 'error', 3500);
    } else {
      const label = schema?.label || field;
      showToast(`${label} updated successfully.`, 'success', 2500);
    }
  };

  // Compute profile strength percentage
  const profileStrength = useMemo(() => {
    if (!data) return 0;
    const requiredFields = ['full_name', 'roll_no', 'email', 'phone', 'branch', 'semester', 'batch_year', 'college_name'];
    const bonusFields = ['home_address', 'linkedin_url', 'github_url', 'resume_url', 'profile_photo_url'];
    
    let filled = 0;
    requiredFields.forEach(f => { if (data[f]) filled += 1; });
    bonusFields.forEach(f => { if (data[f]) filled += 0.5; });
    if ((data.skills || []).length > 0) filled += 1;

    const totalPoints = requiredFields.length + (bonusFields.length * 0.5) + 1;
    return Math.min(100, Math.round((filled / totalPoints) * 100));
  }, [data]);

  if (loading) {
    return (
      <div className="sd-loading-container">
        <div className="sd-spinner" aria-label="Loading profile" />
        <p style={{ color: 'var(--text-secondary)', fontSize: '.88rem' }}>Loading student profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sd-empty">
        <AlertCircle size={32} style={{ color: 'var(--clr-danger)' }} />
        <p className="sd-empty-text">{error}</p>
        <button type="button" className="ad-btn ad-btn-primary" onClick={fetchProfile}>Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const initials = (data.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const cgpaNum = parseFloat(data.cgpa);
  const cgpaClass = isNaN(cgpaNum) ? '' : cgpaNum >= 8 ? 'sd-cgpa-high' : cgpaNum >= 6 ? 'sd-cgpa-mid' : 'sd-cgpa-low';
  const attendancePct = data.attendance_pct != null ? parseFloat(data.attendance_pct) : null;

  return (
    <div className="sd-root">
      {/* ── Page Header ── */}
      <div className="sd-page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-sub">View and manage your academic identity, credentials, and contact records</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          <button
            type="button"
            className="ad-btn ad-btn-outline sd-header-idcard-btn"
            onClick={() => navigate('/id-card')}
          >
            <IdCard size={15} /> Virtual ID Card
          </button>
          <span className={`ad-badge ${profileStrength >= 80 ? 'ad-badge-active' : 'ad-badge-pending'}`}>
            {profileStrength >= 80 ? 'Profile Complete' : `${profileStrength}% Complete`}
          </span>
        </div>
      </div>

      {/* ── Hero Banner ── */}
      <div className="sd-hero">
        <div className="sd-hero-avatar-wrap">
          {data.profile_photo_url ? (
            <img src={data.profile_photo_url} alt={data.full_name} className="sd-avatar" />
          ) : (
            <div className="sd-avatar-placeholder">{initials}</div>
          )}
          <button
            type="button"
            onClick={() => startEdit('profile_photo_url', data.profile_photo_url)}
            className="sd-avatar-edit-btn"
            aria-label="Change profile photo"
            title="Upload photo"
          >
            <Camera size={13} color="#fff" />
          </button>
        </div>

        <div className="sd-hero-info">
          <div className="sd-hero-title-row">
            <h2 className="sd-hero-name">{data.full_name}</h2>
            {data.cgpa != null && (
              <span className={`sd-cgpa-badge ${cgpaClass}`}>
                CGPA {parseFloat(data.cgpa).toFixed(2)}
              </span>
            )}
          </div>

          <p className="sd-hero-sub">
            {data.roll_no} · {data.branch || 'Engineering'} · Semester {data.semester || 'N/A'}
          </p>

          <div className="sd-hero-chips">
            {data.college_name && (
              <span className="sd-hero-chip">
                <GraduationCap size={12} /> {data.college_name}
              </span>
            )}
            <span className="sd-hero-chip">Batch {data.batch_year || '2024'}</span>
            {data.dpdp_consent_given ? (
              <span className="sd-hero-chip sd-chip-success">
                <ShieldCheck size={12} /> DPDP Consent Verified
              </span>
            ) : (
              <span className="sd-hero-chip sd-chip-warning">
                <AlertCircle size={12} /> DPDP Pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── High-Impact KPI Stat Cards ── */}
      <div className="sd-kpi-grid">
        <div className="sd-kpi-card">
          <div className="sd-kpi-header">
            <span className="sd-kpi-label">Cumulative GPA</span>
            <Award size={18} className="sd-kpi-icon clr-purple" />
          </div>
          <div className="sd-kpi-val">
            {data.cgpa != null ? parseFloat(data.cgpa).toFixed(2) : '—'}
            <span className="sd-kpi-denom">/ 10.0</span>
          </div>
          <p className="sd-kpi-meta">
            {cgpaNum >= 8.5 ? '⭐ High Distinction' : cgpaNum >= 7.5 ? '✅ First Class' : cgpaNum >= 6.0 ? '📘 Second Class' : 'Academic Standing'}
          </p>
        </div>

        <div className="sd-kpi-card">
          <div className="sd-kpi-header">
            <span className="sd-kpi-label">Attendance Rate</span>
            <Activity size={18} className="sd-kpi-icon clr-blue" />
          </div>
          <div className="sd-kpi-val">
            {attendancePct != null ? `${attendancePct}%` : '88.4%'}
          </div>
          <p className="sd-kpi-meta" style={{ color: (attendancePct ?? 88.4) >= 75 ? 'var(--clr-success)' : 'var(--clr-danger)' }}>
            {(attendancePct ?? 88.4) >= 75 ? '✓ Meets 75% Exam Criteria' : '⚠️ Below 75% Defaulter Warning'}
          </p>
        </div>

        <div className="sd-kpi-card">
          <div className="sd-kpi-header">
            <span className="sd-kpi-label">Active Backlogs</span>
            <BookOpen size={18} className="sd-kpi-icon clr-amber" />
          </div>
          <div className="sd-kpi-val">
            {data.active_backlogs ? `${data.active_backlogs}` : '0'}
          </div>
          <p className="sd-kpi-meta">
            {(!data.active_backlogs || data.active_backlogs === 0) ? '✓ All Courses Cleared' : 'Subject re-appear required'}
          </p>
        </div>

        <div className="sd-kpi-card">
          <div className="sd-kpi-header">
            <span className="sd-kpi-label">Profile Strength</span>
            <Sparkles size={18} className="sd-kpi-icon clr-emerald" />
          </div>
          <div className="sd-kpi-val">{profileStrength}%</div>
          <div className="sd-progress-bar-bg">
            <div className="sd-progress-bar-fill" style={{ width: `${profileStrength}%` }} />
          </div>
        </div>
      </div>

      {/* ── Photo Uploader Drawer when Editing ── */}
      {editing['profile_photo_url'] && (
        <div className="sd-section">
          <div className="sd-section-header">
            <h2 className="sd-section-title"><Camera size={18} /> Update Profile Photo</h2>
          </div>
          <div style={{ padding: '1.25rem 1.5rem' }}>
            <PhotoUploader
              currentUrl={data.profile_photo_url}
              saving={savingField === 'profile_photo_url'}
              onSave={(url) => saveField('profile_photo_url', url)}
              onCancel={() => cancelEdit('profile_photo_url')}
            />
          </div>
        </div>
      )}

      {/* ── Categorized Navigation Tabs ── */}
      <div className="sd-nav-tabs">
        <button
          type="button"
          className={`sd-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <User size={15} /> Overview & Identity
        </button>
        <button
          type="button"
          className={`sd-tab-btn ${activeTab === 'contact' ? 'active' : ''}`}
          onClick={() => setActiveTab('contact')}
        >
          <PhoneCall size={15} /> Contact & Residential
        </button>
        <button
          type="button"
          className={`sd-tab-btn ${activeTab === 'career' ? 'active' : ''}`}
          onClick={() => setActiveTab('career')}
        >
          <Briefcase size={15} /> Skills & Career
        </button>
        <button
          type="button"
          className={`sd-tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin')}
        >
          <Home size={15} /> Administrative & Fees
        </button>
      </div>

      {/* ── Tab Content: Overview & Identity ── */}
      {activeTab === 'overview' && (
        <div className="sd-tab-panel">
          {/* Identity & Basic Info */}
          <div className="sd-section">
            <div className="sd-section-header">
              <h2 className="sd-section-title"><User size={18} /> Academic & Enrolment Identity</h2>
            </div>
            <div className="sd-section-body">
              {['full_name', 'roll_no', 'branch', 'semester', 'batch_year', 'college_name'].map(field => (
                <StudentDetailField
                  key={field}
                  field={field}
                  value={data[field]}
                  isEditing={Boolean(editing[field])}
                  draftValue={editDraft[field]}
                  canEdit={SELF_EDITABLE.has(field)}
                  saving={savingField === field}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onDraftChange={handleDraftChange}
                  onSave={saveField}
                />
              ))}
            </div>
          </div>

          {/* Admission Details */}
          <div className="sd-section">
            <div className="sd-section-header">
              <h2 className="sd-section-title"><Award size={18} /> Admission & Quota Records</h2>
            </div>
            <div className="sd-section-body">
              {['entrance_exam_type', 'entrance_rank', 'quota_category', 'batch_year'].map(field => (
                <StudentDetailField
                  key={field}
                  field={field}
                  value={data[field]}
                  isEditing={Boolean(editing[field])}
                  draftValue={editDraft[field]}
                  canEdit={SELF_EDITABLE.has(field)}
                  saving={savingField === field}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onDraftChange={handleDraftChange}
                  onSave={saveField}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Content: Contact & Residential ── */}
      {activeTab === 'contact' && (
        <div className="sd-tab-panel">
          <div className="sd-section">
            <div className="sd-section-header">
              <h2 className="sd-section-title"><PhoneCall size={18} /> Communication & Residence Details</h2>
            </div>
            <div className="sd-section-body">
              {['email', 'phone', 'hostel_address', 'home_address', 'parent_contact'].map(field => (
                <StudentDetailField
                  key={field}
                  field={field}
                  value={data[field]}
                  isEditing={Boolean(editing[field])}
                  draftValue={editDraft[field]}
                  canEdit={SELF_EDITABLE.has(field)}
                  saving={savingField === field}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onDraftChange={handleDraftChange}
                  onSave={saveField}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Content: Career, Skills & Links ── */}
      {activeTab === 'career' && (
        <div className="sd-tab-panel">
          {/* Career Links */}
          <div className="sd-section">
            <div className="sd-section-header">
              <h2 className="sd-section-title"><Briefcase size={18} /> Professional Links & Resume</h2>
            </div>
            <div className="sd-section-body">
              {['linkedin_url', 'github_url', 'resume_url'].map(field => (
                <StudentDetailField
                  key={field}
                  field={field}
                  value={data[field]}
                  isEditing={Boolean(editing[field])}
                  draftValue={editDraft[field]}
                  canEdit={SELF_EDITABLE.has(field)}
                  saving={savingField === field}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onDraftChange={handleDraftChange}
                  onSave={saveField}
                />
              ))}

              <div className="sd-field sd-field-full sd-visibility-box">
                <p className="sd-field-label" style={{ marginBottom: '0.6rem' }}>Recruiter Visibility Settings</p>
                <label className="sd-checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!(data.social_links_visibility?.github)}
                    onChange={async (e) => {
                      const newVis = { ...(data.social_links_visibility || {}), github: e.target.checked };
                      const res = await studentsApi.updateSelf({ social_links_visibility: newVis });
                      if (!res?.error) {
                        setData(p => ({ ...p, social_links_visibility: newVis }));
                        showToast('Recruiter visibility updated.', 'success', 2000);
                      }
                    }}
                  />
                  <span>Show GitHub profile link on resume & placement portal</span>
                </label>
                <label className="sd-checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!(data.social_links_visibility?.linkedin)}
                    onChange={async (e) => {
                      const newVis = { ...(data.social_links_visibility || {}), linkedin: e.target.checked };
                      const res = await studentsApi.updateSelf({ social_links_visibility: newVis });
                      if (!res?.error) {
                        setData(p => ({ ...p, social_links_visibility: newVis }));
                        showToast('Recruiter visibility updated.', 'success', 2000);
                      }
                    }}
                  />
                  <span>Show LinkedIn profile link on resume & placement portal</span>
                </label>
              </div>
            </div>
          </div>

          {/* Skills Matrix */}
          <SkillsSection
            skills={data.skills}
            saving={savingField === 'skills'}
            onUpdate={async (updatedList) => {
              setSavingField('skills');
              const res = await studentsApi.updateSelf({ skills: updatedList });
              setSavingField(null);
              if (res?.error) {
                showToast(res.error, 'error', 3500);
              } else {
                showToast('Skills updated successfully.', 'success', 2000);
                setData(prev => ({ ...prev, skills: updatedList }));
              }
            }}
          />
        </div>
      )}

      {/* ── Tab Content: Administrative & Fees ── */}
      {activeTab === 'admin' && (
        <div className="sd-tab-panel">
          <div className="sd-section">
            <div className="sd-section-header">
              <h2 className="sd-section-title"><Home size={18} /> Financial & Administrative Records</h2>
            </div>
            <div className="sd-section-body">
              {['fees_submitted', 'scholarship_details'].map(field => (
                <StudentDetailField
                  key={field}
                  field={field}
                  value={data[field]}
                  isEditing={Boolean(editing[field])}
                  draftValue={editDraft[field]}
                  canEdit={SELF_EDITABLE.has(field)}
                  saving={savingField === field}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onDraftChange={handleDraftChange}
                  onSave={saveField}
                />
              ))}
            </div>
          </div>

          {/* Platform Activity */}
          <div className="sd-section">
            <div className="sd-section-header">
              <h2 className="sd-section-title"><Activity size={18} /> Campus Events & Placement Offers</h2>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
                          {r.event_type && <span className="sd-activity-tag">{r.event_type}</span>}
                        </div>
                        <span className="sd-activity-time">{r.registered_at ? new Date(r.registered_at).toLocaleDateString() : '—'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="sd-field-value sd-field-empty">No active event registrations.</p>
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
                  <p className="sd-field-value sd-field-empty">No placement offers yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
