/**
 * IDCardModal.jsx
 * ───────────────
 * Full-featured dialog that:
 *   • Shows a tabbed layout: [ID Card] ↔ [Edit Info] ↔ [Edit Photo] ↔ [Scan QR]
 *   • Live-previews the ID card with branch, college, year, and position
 *   • Allows users to customize and save their own card details directly
 *   • Flip card between front (info) and back (QR code)
 *   • Downloads the front face as PNG using html-to-image
 *   • Copies a shareable profile link to clipboard
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { toPng } from 'html-to-image';
import {
  X, CreditCard, Camera, Download, Link2, CheckCircle,
  QrCode, Loader2, Scan, Edit3, Save, Building2,
  GraduationCap, Briefcase, ShieldCheck, Check
} from 'lucide-react';
import VirtualIDCard from './VirtualIDCard';
import ImageDropzone from './ImageDropzone';
import QRScannerView from './QRScannerView';
import { useAuth } from '../../context/AuthContext';
import { studentsApi, professorsApi } from '../../services/api';
import './IDCardModal.css';

// ── Sample mock data for all 4 roles ─────────────────────────────────────────
export const MOCK_USERS = {
  student: {
    role: 'student',
    name: 'Aarav Sharma',
    rollNo: 'CS2022047',
    college: 'Campus Connect University',
    branch: 'Computer Science & Engineering',
    batch: '2022–2026',
    year: '3rd Year',
    position: 'Class Representative',
    email: 'aarav.sharma@campusconnect.edu',
    phone: '+91 98765 43210',
    status: 'active',
    photo: null,
  },
  professor: {
    role: 'professor',
    name: 'Dr. Meera Iyer',
    facultyId: 'FAC-2018-112',
    college: 'Campus Connect University',
    department: 'Department of Computer Science',
    designation: 'Associate Professor',
    position: 'Head of Department',
    email: 'meera.iyer@campusconnect.edu',
    phone: '+91 91234 56789',
    office: 'Block B, Room 204',
    photo: null,
  },
  tpo: {
    role: 'tpo',
    name: 'Rajat Verma',
    officerId: 'TPO-2020-008',
    college: 'Campus Connect University',
    department: 'Training & Placement Cell',
    position: 'Placement Officer',
    email: 'rajat.verma@campusconnect.edu',
    phone: '+91 87654 32109',
    photo: null,
  },
  admin: {
    role: 'admin',
    name: 'Sunita Nair',
    adminId: 'ADM-ROOT-001',
    college: 'Campus Connect University',
    roleLevel: 'Super Admin',
    position: 'Chief Administrator',
    email: 'sunita.nair@campusconnect.edu',
    phone: '+91 99887 76655',
    photo: null,
  },
};

const ROLE_ACCENT = {
  student:   '#3b82f6',
  professor: '#7c3aed',
  tpo:       '#059669',
  admin:     '#dc2626',
};

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'preview', label: 'ID Card', Icon: CreditCard },
  { id: 'edit',    label: 'Edit Info', Icon: Edit3    },
  { id: 'photo',   label: 'Edit Photo', Icon: Camera   },
  { id: 'scan',    label: 'Scan QR', Icon: Scan       },
];

// ─────────────────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────────────────
export default function IDCardModal({ isOpen, onClose, user: userProp, onPhotoSave }) {
  const { updateUser } = useAuth?.() || {};
  const [activeTab,  setActiveTab]  = useState('preview');
  const [flipped,    setFlipped]    = useState(false);
  const [localUser,  setLocalUser]  = useState(userProp ?? MOCK_USERS.student);
  const [copied,     setCopied]     = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState({
    name: '',
    rollNo: '',
    college: '',
    branch: '',
    year: '',
    position: '',
    phone: '',
    email: '',
  });

  const cardRef = useRef(null);

  // Helper to build normalized form state from any user object
  const initFormData = useCallback((u) => {
    if (!u) return;
    const isProf = u.role === 'professor';
    setFormData({
      name: u.name || u.full_name || '',
      rollNo: u.rollNo || u.roll_no || u.facultyId || u.employee_id || (u.id ? `STU-${String(u.id).slice(0, 8).toUpperCase()}` : ''),
      college: u.college_name || u.college || 'Campus Connect University',
      branch: u.branch || u.department || (isProf ? 'Department of Computer Science' : 'Computer Science & Engineering'),
      year: u.year || (u.semester ? `Semester ${u.semester}` : '3rd Year'),
      position: u.position || u.delegated_role || (u.isCR ? 'Class Representative' : u.isCS ? 'Core Committee' : u.isPC ? 'Placement Lead' : ''),
      phone: u.phone || '',
      email: u.email || '',
    });
  }, []);

  // Sync when userProp changes
  useEffect(() => {
    if (userProp) {
      setLocalUser(userProp);
      initFormData(userProp);
    }
  }, [userProp, initFormData]);

  // Fetch live fresh profile data from backend whenever modal opens
  useEffect(() => {
    if (!isOpen) return;

    async function loadFreshProfile() {
      try {
        const role = userProp?.role || localUser?.role || 'student';
        let res = null;
        if (role === 'student') {
          res = await studentsApi.getMe();
        } else if (role === 'professor') {
          res = await professorsApi.getMe();
        }

        if (res && !res.error) {
          const sem = res.semester;
          const semToYear = {
            1: '1st Year', 2: '1st Year',
            3: '2nd Year', 4: '2nd Year',
            5: '3rd Year', 6: '3rd Year',
            7: '4th Year', 8: '4th Year',
          };
          const yearText = semToYear[sem] ?? (sem ? `Semester ${sem}` : null);
          const enriched = {
            ...(userProp || {}),
            name: res.full_name || userProp?.name || localUser?.name,
            rollNo: res.roll_no || userProp?.rollNo || userProp?.roll_no || localUser?.rollNo,
            roll_no: res.roll_no || userProp?.roll_no || localUser?.roll_no,
            college_name: res.college_name || userProp?.college_name || userProp?.college || 'Campus Connect University',
            college: res.college_name || userProp?.college || 'Campus Connect University',
            branch: res.branch || userProp?.branch || 'Computer Science & Engineering',
            department: res.department || res.branch || userProp?.department || userProp?.branch,
            year: yearText || userProp?.year || '3rd Year',
            semester: sem ?? userProp?.semester,
            batch_year: res.batch_year ?? userProp?.batch_year,
            position: userProp?.position || (res.delegated_role === 'CLASS_REPRESENTATIVE' ? 'Class Representative' : res.delegated_role === 'CORE_STUDENT' ? 'Core Committee' : res.delegated_role === 'PLACEMENT_COORDINATOR' ? 'Placement Lead' : null),
            delegated_role: res.delegated_role || userProp?.delegated_role,
            phone: res.phone || userProp?.phone || localUser?.phone,
            email: res.email || userProp?.email || localUser?.email,
            photo: res.profile_photo_url || userProp?.photo || userProp?.profile_photo_url || localUser?.photo,
          };
          setLocalUser(enriched);
          initFormData(enriched);
        }
      } catch (err) {
        console.warn('Live profile fetch skipped:', err);
      }
    }

    loadFreshProfile();
  }, [isOpen, userProp, initFormData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const accent = ROLE_ACCENT[localUser?.role] ?? '#3b82f6';
  const displayName = localUser?.name || localUser?.full_name || 'Campus Member';
  const photoUrl = localUser?.photo || localUser?.profile_photo_url;

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handlePhotoChange = useCallback((dataURL) => {
    setLocalUser(prev => ({ ...prev, photo: dataURL, profile_photo_url: dataURL }));
  }, []);

  const handlePhotoSave = useCallback(() => {
    onPhotoSave?.(localUser?.photo || localUser?.profile_photo_url);
    setActiveTab('preview');
  }, [localUser, onPhotoSave]);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const frontFace = cardRef.current.querySelector('.vic-front');
      const target = frontFace ?? cardRef.current;
      const dataURL = await toPng(target, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      const cleanName = displayName.replace(/\s+/g, '-').toLowerCase();
      link.download = `campus-connect-id-${cleanName || 'card'}.png`;
      link.href = dataURL;
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  }, [displayName]);

  const handleCopyLink = useCallback(() => {
    const origin = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://campusconnect.edu';
    const id = localUser?.rollNo ?? localUser?.roll_no ?? localUser?.systemId ?? localUser?.id ?? '';
    const shareUrl = `${origin}/profile/${encodeURIComponent(id)}`;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }, [localUser]);

  // Save customized details
  const handleSaveDetails = async (e) => {
    if (e) e.preventDefault();
    setSavingDetails(true);
    try {
      const updated = {
        ...localUser,
        name: formData.name,
        full_name: formData.name,
        rollNo: formData.rollNo,
        roll_no: formData.rollNo,
        college_name: formData.college,
        college: formData.college,
        branch: formData.branch,
        department: formData.branch,
        year: formData.year,
        position: formData.position || null,
        phone: formData.phone,
        email: formData.email || localUser?.email,
      };

      setLocalUser(updated);
      if (updateUser) {
        await updateUser(updated);
      }

      // Try persisting to backend if student profile endpoint is available
      if (localUser?.role === 'student' || !localUser?.role) {
        await studentsApi.updateSelf({
          full_name: formData.name,
          branch: formData.branch,
          phone: formData.phone,
        }).catch(() => {});
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setActiveTab('preview');
      }, 500);
    } catch (err) {
      console.error('Failed to save ID card details:', err);
    } finally {
      setSavingDetails(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay idcm-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Virtual ID Card"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-box idcm-box">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="modal-header idcm-header">
          <div className="idcm-header-left">
            <div className="idcm-header-icon" style={{ background: `${accent}18`, color: accent }}>
              <CreditCard size={18} />
            </div>
            <div>
              <h2 className="idcm-title">Virtual ID Card</h2>
              <p className="idcm-subtitle">{displayName}</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* ── Tab bar ────────────────────────────────────────────── */}
        <div className="idcm-tabs">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`idcm-tab ${activeTab === id ? 'idcm-tab--active' : ''}`}
              style={activeTab === id ? { color: accent, borderBottomColor: accent } : {}}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab content ────────────────────────────────────────── */}
        <div className="idcm-body">

          {/* ──────── PREVIEW TAB ──────────────────────────────── */}
          {activeTab === 'preview' && (
            <div className="idcm-preview-tab">
              {/* Card */}
              <div className="idcm-card-stage">
                <VirtualIDCard
                  user={localUser}
                  flipped={flipped}
                  onFlip={() => setFlipped(f => !f)}
                  cardRef={cardRef}
                  onDownload={handleDownload}
                  onOpenScanner={() => setActiveTab('scan')}
                />
              </div>

              {/* Action buttons */}
              <div className="idcm-actions">
                <button
                  className="idcm-action-btn"
                  style={{ '--ac': accent }}
                  onClick={() => setActiveTab('edit')}
                  title="Customize ID Card Details"
                >
                  <Edit3 size={15} />
                  Edit Details
                </button>

                <button
                  className="idcm-action-btn"
                  style={{ '--ac': accent }}
                  onClick={() => setActiveTab('scan')}
                  title="Scan a Member QR Code"
                >
                  <Scan size={15} />
                  Scan QR
                </button>

                <button
                  className="idcm-action-btn"
                  style={{ '--ac': accent }}
                  onClick={() => setFlipped(f => !f)}
                  title={flipped ? 'Show front' : 'Show QR code'}
                >
                  <QrCode size={15} />
                  {flipped ? 'Front View' : 'My QR'}
                </button>

                <button
                  className="idcm-action-btn"
                  style={{ '--ac': accent }}
                  onClick={handleDownload}
                  disabled={downloading}
                  title="Download as PNG"
                >
                  {downloading
                    ? <Loader2 size={15} className="idcm-spin" />
                    : <Download size={15} />
                  }
                  {downloading ? 'Exporting…' : 'Download PNG'}
                </button>

                <button
                  className={`idcm-action-btn ${copied ? 'idcm-action-btn--copied' : ''}`}
                  style={{ '--ac': accent }}
                  onClick={handleCopyLink}
                  title="Copy profile link"
                >
                  {copied ? <CheckCircle size={15} /> : <Link2 size={15} />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>

              {/* Role hint */}
              <p className="idcm-role-hint">
                Showing <strong style={{ color: accent }}>
                  {localUser?.role ? (localUser.role.charAt(0).toUpperCase() + localUser.role.slice(1)) : 'Student'}
                </strong> ID card. Tap "Edit Details" to customize branch, college, year, and position.
              </p>
            </div>
          )}

          {/* ──────── EDIT INFO TAB ────────────────────────────── */}
          {activeTab === 'edit' && (
            <div className="idcm-edit-tab">
              <h3 className="idcm-section-title">Edit Card Information</h3>
              <p className="idcm-section-desc">
                Customize your own College, Branch, Year, and Position to be printed on your digital ID card.
              </p>

              <form onSubmit={handleSaveDetails} className="idcm-edit-grid">
                <div className="idcm-form-group">
                  <label className="idcm-form-label">
                    Full Name
                  </label>
                  <input
                    type="text"
                    className="idcm-form-input"
                    value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Anoop Shukla"
                    required
                  />
                </div>

                <div className="idcm-form-group">
                  <label className="idcm-form-label">
                    Roll No / Member ID
                  </label>
                  <input
                    type="text"
                    className="idcm-form-input"
                    value={formData.rollNo}
                    onChange={(e) => setFormData(p => ({ ...p, rollNo: e.target.value }))}
                    placeholder="e.g. CS2022047 or STU-1024"
                    required
                  />
                </div>

                <div className="idcm-form-group idcm-form-group--full">
                  <label className="idcm-form-label">
                    <Building2 size={14} style={{ color: accent }} />
                    College / Institute
                  </label>
                  <input
                    type="text"
                    className="idcm-form-input"
                    value={formData.college}
                    onChange={(e) => setFormData(p => ({ ...p, college: e.target.value }))}
                    placeholder="e.g. Campus Connect Institute of Technology"
                    required
                  />
                </div>

                <div className="idcm-form-group">
                  <label className="idcm-form-label">
                    <GraduationCap size={14} style={{ color: accent }} />
                    Branch / Department
                  </label>
                  <input
                    type="text"
                    className="idcm-form-input"
                    value={formData.branch}
                    onChange={(e) => setFormData(p => ({ ...p, branch: e.target.value }))}
                    placeholder="e.g. Computer Science & Engineering"
                    required
                  />
                </div>

                <div className="idcm-form-group">
                  <label className="idcm-form-label">
                    Year / Academic Level
                  </label>
                  <input
                    type="text"
                    className="idcm-form-input"
                    value={formData.year}
                    onChange={(e) => setFormData(p => ({ ...p, year: e.target.value }))}
                    placeholder="e.g. 3rd Year / Semester 5"
                    required
                  />
                </div>

                <div className="idcm-form-group idcm-form-group--full">
                  <label className="idcm-form-label">
                    <ShieldCheck size={14} style={{ color: accent }} />
                    Position / Delegated Role (Optional)
                  </label>
                  <input
                    type="text"
                    className="idcm-form-input"
                    value={formData.position}
                    onChange={(e) => setFormData(p => ({ ...p, position: e.target.value }))}
                    placeholder="e.g. Class Representative, Placement Lead, Tech Club Head"
                  />
                  <span className="idcm-form-hint">Any honorary or delegated position you hold on campus</span>
                </div>

                <div className="idcm-form-group">
                  <label className="idcm-form-label">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    className="idcm-form-input"
                    value={formData.phone}
                    onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                  />
                </div>

                <div className="idcm-form-group">
                  <label className="idcm-form-label">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="idcm-form-input"
                    value={formData.email}
                    onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                    placeholder="student@campusconnect.edu"
                    disabled
                  />
                </div>

                <div className="idcm-photo-footer idcm-form-group--full" style={{ marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setActiveTab('preview')}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={savingDetails}
                    style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)` }}
                  >
                    {savingDetails ? (
                      <Loader2 size={15} className="idcm-spin" />
                    ) : saveSuccess ? (
                      <Check size={15} />
                    ) : (
                      <Save size={15} />
                    )}
                    {savingDetails ? 'Saving…' : saveSuccess ? 'Saved!' : 'Save & Update Card'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ──────── SCAN TAB ─────────────────────────────────── */}
          {activeTab === 'scan' && (
            <div className="idcm-scan-tab">
              <QRScannerView accent={accent} />
            </div>
          )}

          {/* ──────── PHOTO TAB ────────────────────────────────── */}
          {activeTab === 'photo' && (
            <div className="idcm-photo-tab">
              <div className="idcm-photo-layout">
                {/* Dropzone */}
                <div className="idcm-dropzone-col">
                  <h3 className="idcm-section-title">Upload Profile Photo</h3>
                  <p className="idcm-section-desc">
                    Upload a clear, front-facing photo for your ID card. Use a 1:1 square crop for best results.
                  </p>
                  <ImageDropzone
                    currentImage={photoUrl}
                    name={displayName}
                    accent={accent}
                    onImageChange={handlePhotoChange}
                  />
                </div>

                {/* Mini live preview */}
                <div className="idcm-mini-preview-col">
                  <h3 className="idcm-section-title">Live Preview</h3>
                  <div className="idcm-mini-preview">
                    <div className="idcm-mini-avatar-wrap">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt="Preview"
                          className="idcm-mini-avatar-img"
                        />
                      ) : (
                        <div
                          className="idcm-mini-avatar-placeholder"
                          style={{
                            background: `linear-gradient(135deg, ${accent} 0%, ${accent}aa 100%)`,
                          }}
                        >
                          {(displayName || 'CC').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span
                        className="idcm-mini-role-dot"
                        style={{ background: accent }}
                      />
                    </div>
                    <p className="idcm-mini-name">{displayName}</p>
                    <p className="idcm-mini-role" style={{ color: accent }}>
                      {localUser?.role ? (localUser.role.charAt(0).toUpperCase() + localUser.role.slice(1)) : 'Student'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="idcm-photo-footer">
                <button
                  className="btn-secondary"
                  onClick={() => setActiveTab('preview')}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)` }}
                  onClick={handlePhotoSave}
                >
                  Save Photo & Preview
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
