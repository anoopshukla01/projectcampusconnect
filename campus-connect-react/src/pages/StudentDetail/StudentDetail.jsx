/**
 * Student — Self-View Profile Page
 * ================================
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
  Calendar, Check, X, Camera, Code, Plus
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
      <div style={{ marginBottom: '1rem' }}>
        <p className="sd-field-label" style={{ marginBottom: '.5rem', fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.45rem' }}>
          {group.map((s, i) => {
            const badge = PROF_BADGE[s.proficiency] || PROF_BADGE.beginner;
            const globalIdx = offset + i;
            return (
              <span key={globalIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem',
                background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)',
                borderRadius: '999px', padding: '.22rem .65rem', fontSize: '.8rem' }}>
                {s.name}
                <span className={badge.cls} style={{ fontSize: '.65rem', padding: '.1rem .4rem' }}>{badge.label}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(globalIdx)}
                  disabled={saving}
                  aria-label={`Remove ${s.name}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1,
                    color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                  <X size={11} />
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
      <div className="sd-section-header" style={{ cursor: 'default' }}>
        <h2 className="sd-section-title"><Code aria-hidden="true" /> Skills</h2>
      </div>
      <div style={{ padding: '1.25rem 1.5rem' }}>
        {(skills || []).length === 0 && !adding && (
          <p className="sd-field-value" style={{ color: 'var(--text-secondary)', marginBottom: '.75rem' }}>
            No skills added yet. Add technical and soft skills to strengthen your profile.
          </p>
        )}
        {renderGroup('Technical Skills', techSkills, 0)}
        {renderGroup('Soft Skills', softSkills, techSkills.length)}

        {adding ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', alignItems: 'center', marginTop: '.75rem' }}>
            <input
              className="sd-edit-input"
              style={{ minWidth: 140, maxWidth: 200 }}
              placeholder="Skill name"
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
              className="sd-edit-input"
              style={{ width: 120 }}
              aria-label="Category"
            >
              <option value="technical">Technical</option>
              <option value="soft">Soft</option>
            </select>
            <select
              value={newProf}
              onChange={e => setNewProf(e.target.value)}
              className="sd-edit-input"
              style={{ width: 140 }}
              aria-label="Proficiency"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <button type="button" className="ad-btn ad-btn-primary" style={{ padding: '.35rem .7rem' }}
              onClick={handleAdd} disabled={saving || !newName.trim()} aria-label="Add skill">
              <Check size={13} />
            </button>
            <button type="button" className="ad-btn ad-btn-outline" style={{ padding: '.35rem .7rem' }}
              onClick={() => { setAdding(false); setNewName(''); }} aria-label="Cancel">
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="ad-btn ad-btn-outline"
            style={{ marginTop: '.5rem', display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}
            onClick={() => setAdding(true)}
            disabled={saving || (skills || []).length >= 30}
            aria-label="Add a skill"
          >
            <Plus size={13} /> Add Skill
          </button>
        )}
      </div>
    </div>
  );
}

export default function StudentSelfView() {
  const { user } = useAuth();
  const showToast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Inline edit state
  const [editing, setEditing] = useState({});
  const [editDraft, setEditDraft] = useState({});
  const [savingField, setSavingField] = useState(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    const res = await studentsApi.getMe();
    if (res?.error) setError(res.error);
    else setData(res);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const startEdit = (field, val) => {
    if (!SELF_EDITABLE.has(field)) return;
    setEditing(p => ({ ...p, [field]: true }));
    setEditDraft(p => ({ ...p, [field]: val ?? '' }));
  };

  const cancelEdit = (field) => {
    setEditing(p => ({ ...p, [field]: false }));
    setEditDraft(p => {
      const copy = { ...p };
      delete copy[field];
      return copy;
    });
  };

  const handleDraftChange = (field, val) => {
    setEditDraft(p => ({ ...p, [field]: val }));
  };

  const saveField = async (field, overrideVal) => {
    const previousValue = data[field];
    const newVal = overrideVal !== undefined ? overrideVal : editDraft[field];

    if (String(previousValue ?? '') === String(newVal ?? '')) {
      cancelEdit(field);
      return;
    }

    const schema = FIELD_SCHEMAS[field];
    let formattedValue = newVal === '' ? null : newVal;
    if (schema?.type === 'number' && formattedValue !== null) {
      formattedValue = Number(formattedValue);
    }

    // Optimistic UI update
    setData(prev => ({ ...prev, [field]: formattedValue }));
    setEditing(p => ({ ...p, [field]: false }));
    setSavingField(field);

    const res = await studentsApi.updateSelf({ [field]: formattedValue });
    setSavingField(null);

    if (res?.error) {
      // Rollback
      setData(prev => ({ ...prev, [field]: previousValue }));
      showToast(res.error, 'error', 3500);
    } else {
      const label = schema?.label || field;
      showToast(`${label} updated successfully.`, 'success', 2500);
    }
  };

  if (loading) return <div className="sd-spinner" aria-label="Loading profile" />;
  if (error) return <div className="sd-empty"><p className="sd-empty-text">{error}</p></div>;
  if (!data) return null;

  const initials = (data.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const cgpaNum = parseFloat(data.cgpa);
  const cgpaClass = isNaN(cgpaNum) ? '' : cgpaNum >= 8 ? 'sd-cgpa-high' : cgpaNum >= 6 ? 'sd-cgpa-mid' : 'sd-cgpa-low';

  return (
    <div className="sd-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-sub">View and update your personal student profile</p>
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

      {/* Photo drag-and-drop uploader when active */}
      {editing['profile_photo_url'] && (
        <div className="sd-section">
          <div className="sd-section-header" style={{ cursor: 'default' }}>
            <h2 className="sd-section-title"><Camera aria-hidden="true" /> Update Profile Photo</h2>
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

      {/* Identity */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><User aria-hidden="true" /> Identity & Basic Info</h2>
        </div>
        <div className="sd-section-body">
          {['full_name','roll_no','email','phone','branch','semester','batch_year','college_name'].map(field => (
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

      {/* Academic — read-only */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><BookOpen aria-hidden="true" /> Academic Record <span style={{ fontSize: '.72rem', color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '.35rem' }}>(read-only)</span></h2>
        </div>
        <div className="sd-section-body">
          {['cgpa', 'attendance_pct', 'active_backlogs'].map(field => (
            <StudentDetailField
              key={field}
              field={field}
              value={data[field]}
              isEditing={false}
              draftValue={null}
              canEdit={false}
              saving={false}
              onStartEdit={() => {}}
              onCancelEdit={() => {}}
              onDraftChange={() => {}}
              onSave={() => {}}
            />
          ))}
        </div>
      </div>

      {/* Admission Details */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><Award aria-hidden="true" /> Admission Details</h2>
        </div>
        <div className="sd-section-body">
          {['entrance_exam_type','entrance_rank','quota_category','batch_year'].map(field => (
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

      {/* Administrative / Personal */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><Home aria-hidden="true" /> Personal & Administrative</h2>
        </div>
        <div className="sd-section-body">
          {['hostel_address','home_address','parent_contact','fees_submitted','scholarship_details'].map(field => (
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

      {/* Career */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><Briefcase aria-hidden="true" /> Career & Links</h2>
        </div>
        <div className="sd-section-body">
          {['linkedin_url','github_url','resume_url'].map(field => (
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

          <div className="sd-field sd-field-full" style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="sd-field-label" style={{ marginBottom: '0.5rem' }}>Recruiter Visibility (DPDP Consent)</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--clr-text)', cursor: 'pointer', marginBottom: '0.4rem' }}>
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
              Show GitHub link on resume & to recruiters
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--clr-text)', cursor: 'pointer' }}>
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
              Show LinkedIn link on resume & to recruiters
            </label>
          </div>
        </div>
      </div>

      {/* Skills */}
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
            showToast('Skills updated.', 'success', 2000);
            setData(prev => ({ ...prev, skills: updatedList }));
          }
        }}
      />

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
              <p className="sd-field-value sd-field-empty">No event registrations.</p>
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
  );
}
