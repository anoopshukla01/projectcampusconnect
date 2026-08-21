/**
 * IDCardModal.jsx
 * ───────────────
 * Full-featured dialog that:
 *   • Shows a tabbed layout: [ID Preview] ↔ [Edit Photo]
 *   • Live-previews the ID card with any uploaded photo
 *   • Flip card between front (info) and back (QR code)
 *   • Downloads the front face as PNG using html-to-image
 *   • Copies a shareable profile link to clipboard
 *
 * Props
 * ─────
 *   isOpen         {boolean}  – controls visibility
 *   onClose        {fn}       – called when modal is dismissed
 *   user           {object}   – user data object (see MOCK_USERS below)
 *   onPhotoSave    {fn(url)}  – called after photo upload; parent persists
 *
 * Usage
 * ─────
 *   <IDCardModal
 *     isOpen={showCard}
 *     onClose={() => setShowCard(false)}
 *     user={currentUser}
 *     onPhotoSave={(url) => updateUserPhoto(url)}
 *   />
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { toPng } from 'html-to-image';
import {
  X, CreditCard, Camera, Download, Link2, CheckCircle,
  QrCode, Loader2
} from 'lucide-react';
import VirtualIDCard from './VirtualIDCard';
import ImageDropzone from './ImageDropzone';
import './IDCardModal.css';

// ── Sample mock data for all 4 roles ─────────────────────────────────────────
export const MOCK_USERS = {
  student: {
    role: 'student',
    name: 'Aarav Sharma',
    rollNo: 'CS2022047',
    branch: 'Computer Science & Engineering',
    batch: '2022–2026',
    year: '3rd Year',
    email: 'aarav.sharma@campusconnect.edu',
    phone: '+91 98765 43210',
    status: 'active',
    photo: null,
  },
  professor: {
    role: 'professor',
    name: 'Dr. Meera Iyer',
    facultyId: 'FAC-2018-112',
    department: 'Department of Computer Science',
    designation: 'Associate Professor',
    email: 'meera.iyer@campusconnect.edu',
    phone: '+91 91234 56789',
    office: 'Block B, Room 204',
    photo: null,
  },
  tpo: {
    role: 'tpo',
    name: 'Rajat Verma',
    officerId: 'TPO-2020-008',
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
    roleLevel: 'Super Admin',
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
  { id: 'photo',   label: 'Edit Photo', Icon: Camera   },
];

// ─────────────────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────────────────
export default function IDCardModal({ isOpen, onClose, user: userProp, onPhotoSave }) {
  const [activeTab,  setActiveTab]  = useState('preview');
  const [flipped,    setFlipped]    = useState(false);
  const [localUser,  setLocalUser]  = useState(userProp ?? MOCK_USERS.student);
  const [copied,     setCopied]     = useState(false);
  const [downloading, setDownloading] = useState(false);

  const cardRef = useRef(null);

  // Keep local user in sync if parent updates
  useEffect(() => {
    if (userProp) setLocalUser(userProp);
  }, [userProp]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const accent = ROLE_ACCENT[localUser?.role] ?? '#3b82f6';

  const displayName = localUser?.name || localUser?.full_name || 'Campus Member';
  const displayId = localUser?.rollNo ?? localUser?.roll_no ?? localUser?.systemId ?? localUser?.id ?? 'user';
  const photoUrl = localUser?.photo || localUser?.profile_photo_url;

  // ── Actions ───────────────────────────────────────────────────────────────

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
      // Target only the front face for download
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
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/profile/${displayId}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  }, [displayId]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
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
                />
              </div>

              {/* Action buttons */}
              <div className="idcm-actions">
                <button
                  className="idcm-action-btn"
                  style={{ '--ac': accent }}
                  onClick={() => setFlipped(f => !f)}
                  title={flipped ? 'Show front' : 'Show QR code'}
                >
                  <QrCode size={15} />
                  {flipped ? 'Front View' : 'QR Code'}
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
                </strong> ID card. Tap the card to flip.
              </p>
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
