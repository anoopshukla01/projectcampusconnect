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
  Calendar, CheckCircle, Edit3, Check, X, Camera, Code, Plus
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
            <button className="ad-btn ad-btn-primary" style={{ padding: '.35rem .7rem' }}
              onClick={handleAdd} disabled={saving || !newName.trim()} aria-label="Add skill">
              <Check size={13} />
            </button>
            <button className="ad-btn ad-btn-outline" style={{ padding: '.35rem .7rem' }}
              onClick={() => { setAdding(false); setNewName(''); }} aria-label="Cancel">
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
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
              {val == null || val === '' ? (
                <span style={{ color: 'var(--text-secondary)', fontStyle: canEdit ? 'italic' : 'normal', fontSize: canEdit ? '.82rem' : 'inherit' }}>
                  {canEdit ? 'Not set (click ✏️ to add)' : '—'}
                </span>
              ) : String(val)}
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

      {/* Admission Details */}
      <div className="sd-section">
        <div className="sd-section-header" style={{ cursor: 'default' }}>
          <h2 className="sd-section-title"><Award aria-hidden="true" /> Admission Details</h2>
        </div>
        <div className="sd-section-body">
          {['entrance_exam_type','entrance_rank'].map(f => (
            <ReadField key={f} field={f} />
          ))}
          <div className="sd-field">
            <span className="sd-field-label">Category / Quota <span style={{ fontSize: '.68rem', color: 'var(--text-secondary)' }}>(read-only)</span></span>
            <span className="sd-field-value">{data.quota_category || '—'}</span>
          </div>
          <div className="sd-field">
            <span className="sd-field-label">Batch Year <span style={{ fontSize: '.68rem', color: 'var(--text-secondary)' }}>(read-only)</span></span>
            <span className="sd-field-value">{data.batch_year != null ? data.batch_year : '—'}</span>
          </div>
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

      {/* Skills */}
      <SkillsSection
        skills={data.skills}
        saving={saving}
        onUpdate={async (updatedList) => {
          setSaving(true);
          const res = await studentsApi.updateSelf({ skills: updatedList });
          setSaving(false);
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
