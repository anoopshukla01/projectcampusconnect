/**
 * VirtualIDCard.jsx
 * ─────────────────
 * Renders a digital ID badge for any Campus Connect role.
 * Supports front/back flip, QR code generation, and PDF/PNG export.
 *
 * Props
 * ─────
 *   user      {object}  – user data object (see MOCK_USERS for shape)
 *   flipped   {boolean} – controlled flip state
 *   onFlip    {fn}      – toggle flip callback
 *   onDownload{fn}      – parent handles download (passes card ref)
 *   cardRef   {ref}     – forwarded ref used by html-to-image
 */

import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  User, Mail, Phone, MapPin, BadgeCheck, Building2,
  GraduationCap, Briefcase, ShieldCheck, RotateCcw,
  Download, Link2, Calendar, MessageSquare, Scan
} from 'lucide-react';
import './VirtualIDCard.css';

// ── Role colour tokens ────────────────────────────────────────────────────────
const ROLE_META = {
  student: {
    label: 'Student',
    accent: '#3b82f6',
    accentSoft: '#dbeafe',
    gradient: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 60%, #60a5fa 100%)',
    icon: GraduationCap,
  },
  professor: {
    label: 'Faculty',
    accent: '#7c3aed',
    accentSoft: '#ede9fe',
    gradient: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 60%, #a78bfa 100%)',
    icon: Briefcase,
  },
  tpo: {
    label: 'Training & Placement',
    accent: '#059669',
    accentSoft: '#d1fae5',
    gradient: 'linear-gradient(135deg, #065f46 0%, #059669 60%, #34d399 100%)',
    icon: Briefcase,
  },
  admin: {
    label: 'Administrator',
    accent: '#dc2626',
    accentSoft: '#fee2e2',
    gradient: 'linear-gradient(135deg, #991b1b 0%, #dc2626 60%, #f87171 100%)',
    icon: ShieldCheck,
  },
};

// ── System ID / Roll No Formatter ─────────────────────────────────────────────
function formatSystemId(id, role = 'student') {
  if (!id) return role === 'professor' ? 'FAC-2026-001' : 'CS2026-001';
  const str = String(id).trim();
  // If it is a raw UUID, transform it into a collegiate roll number format
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(str) || str.length > 25) {
    const cleanHash = str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const prefix = role === 'professor' ? 'FAC-2026' : role === 'admin' ? 'ADM-2026' : role === 'tpo' ? 'TPO-2026' : 'CS2026';
    return `${prefix}-${cleanHash.slice(0, 4)}`;
  }
  return str;
}

// ── Build Chat QR payload ──────────────────────────────────────────────────
function buildQRPayload(user) {
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://campusconnect.edu';
  const userId = user?.id ?? user?.user_id ?? user?.studentId ?? '';
  const email = user?.email ?? '';
  const name = user?.name ?? user?.full_name ?? 'Campus Member';
  const role = user?.role ?? 'student';
  const rawSysId = user?.systemId ?? user?.rollNo ?? user?.roll_no ?? user?.facultyId ?? user?.employee_id ?? user?.officerId ?? user?.adminId ?? user?.id ?? '';
  const sysId = formatSystemId(rawSysId, role);

  const params = new URLSearchParams();
  if (userId) params.set('userId', String(userId));
  if (email) params.set('email', String(email));
  if (name) params.set('name', String(name));
  if (role) params.set('role', String(role));
  if (sysId) params.set('sysId', String(sysId));

  return `${origin}/chats?${params.toString()}`;
}

function Field({ Icon, label, value, accent }) {
  if (!value) return null;
  return (
    <div className="vic-field">
      <span className="vic-field-icon" style={{ color: accent }}>
        <Icon size={13} />
      </span>
      <span className="vic-field-label">{label}</span>
      <span className="vic-field-value">{value}</span>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    active:   { label: 'Active',   cls: 'success' },
    inactive: { label: 'Inactive', cls: 'danger'  },
    alumni:   { label: 'Alumni',   cls: 'warning' },
    pending:  { label: 'Pending',  cls: 'muted'   },
  };
  const s = map[status?.toLowerCase()] ?? map.active;
  return <span className={`vic-status vic-status-${s.cls}`}>{s.label}</span>;
}

function StudentFields({ user, accent }) {
  const rawRoll = user?.rollNo ?? user?.roll_no ?? user?.id ?? '';
  const roll = formatSystemId(rawRoll, 'student');
  const college = user?.college_name || user?.college || 'Campus Connect University';
  const branch = user?.branch || user?.department || 'Computer Science & Engineering';
  const yearText = user?.year || (user?.semester ? `Semester ${user.semester}` : null) || (user?.batch_year ? `Batch ${user.batch_year}` : '3rd Year');
  const position = user?.position || user?.delegated_role || user?.delegatedRole || (user?.isCR ? 'Class Representative' : user?.isCS ? 'Core Committee' : user?.isPC ? 'Placement Lead' : null);

  return (
    <>
      <Field Icon={BadgeCheck}    label="Roll No"   value={roll} accent={accent} />
      <Field Icon={Building2}     label="College"   value={college} accent={accent} />
      <Field Icon={Building2}     label="Branch"    value={branch} accent={accent} />
      <Field Icon={GraduationCap} label="Year"      value={yearText} accent={accent} />
      {position && <Field Icon={ShieldCheck} label="Position"  value={position} accent={accent} />}
      <Field Icon={Mail}          label="Email"     value={user?.email} accent={accent} />
      <Field Icon={Phone}         label="Phone"     value={user?.phone} accent={accent} />
    </>
  );
}

function ProfessorFields({ user, accent }) {
  const rawFac = user?.facultyId ?? user?.employee_id ?? user?.id ?? '';
  const facId = formatSystemId(rawFac, 'professor');
  const college = user?.college_name || user?.college || 'Campus Connect University';
  const dept = user?.department || user?.branch || 'Department of Computer Science';
  const desig = user?.designation || user?.position || 'Assistant Professor';

  return (
    <>
      <Field Icon={BadgeCheck} label="Faculty ID"   value={facId} accent={accent} />
      <Field Icon={Building2}  label="College"      value={college} accent={accent} />
      <Field Icon={Building2}  label="Department"   value={dept} accent={accent} />
      <Field Icon={Briefcase}  label="Designation"  value={desig} accent={accent} />
      <Field Icon={Mail}       label="Email"        value={user?.email} accent={accent} />
      <Field Icon={Phone}      label="Contact"      value={user?.phone} accent={accent} />
      <Field Icon={MapPin}     label="Office"       value={user?.office} accent={accent} />
    </>
  );
}

function TpoFields({ user, accent }) {
  const officerId = user?.officerId ?? user?.employee_id ?? (user?.id ? `TPO-${String(user.id).slice(0, 8).toUpperCase()}` : null);
  const college = user?.college_name || user?.college || 'Campus Connect College';
  const dept = user?.department || 'Training & Placement Cell';
  const pos = user?.position || user?.designation || 'Placement Officer';

  return (
    <>
      <Field Icon={BadgeCheck} label="Officer ID"  value={officerId} accent={accent} />
      <Field Icon={Building2}  label="College"     value={college} accent={accent} />
      <Field Icon={Building2}  label="Department"  value={dept} accent={accent} />
      <Field Icon={Briefcase}  label="Position"    value={pos} accent={accent} />
      <Field Icon={Mail}       label="Email"       value={user?.email} accent={accent} />
      <Field Icon={Phone}      label="Direct Line" value={user?.phone} accent={accent} />
    </>
  );
}

function AdminFields({ user, accent }) {
  const adminId = user?.adminId ?? (user?.id ? `ADM-${String(user.id).slice(0, 8).toUpperCase()}` : 'ADM-ROOT-001');
  const college = user?.college_name || user?.college || 'Campus Connect System';
  const roleLvl = user?.roleLevel || user?.position || 'Super Administrator';

  return (
    <>
      <Field Icon={BadgeCheck}  label="Admin ID"    value={adminId} accent={accent} />
      <Field Icon={Building2}   label="Institution" value={college} accent={accent} />
      <Field Icon={ShieldCheck} label="Role Level"  value={roleLvl} accent={accent} />
      <Field Icon={Mail}        label="Email"       value={user?.email} accent={accent} />
      <Field Icon={Phone}       label="Contact"     value={user?.phone} accent={accent} />
    </>
  );
}

const FIELD_SETS = {
  student:   StudentFields,
  professor: ProfessorFields,
  tpo:       TpoFields,
  admin:     AdminFields,
};

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────
export default function VirtualIDCard({ user, flipped, onFlip, onDownload, cardRef, onOpenScanner }) {
  const navigate = useNavigate();
  const role = user?.role ?? 'student';
  const meta = ROLE_META[role] ?? ROLE_META.student;
  const RoleIcon = meta.icon;
  const FieldSet = FIELD_SETS[role] ?? StudentFields;
  const fullName = user?.name ?? user?.full_name ?? 'Campus Member';
  const initials = fullName.slice(0, 2).toUpperCase();
  const qrPayload = buildQRPayload(user ?? {});
  const rawId =
    user?.rollNo ?? user?.roll_no ?? user?.facultyId ?? user?.employee_id ?? user?.officerId ?? user?.adminId ?? user?.id;
  const systemId = formatSystemId(rawId, role);
  const photo = user?.photo || user?.profile_photo_url;
  const collegeName = user?.college_name || user?.college || 'Campus Connect University';
  const branchName = user?.branch || user?.department || (role === 'student' ? 'Computer Science & Engineering' : '');
  const positionTitle = user?.position || user?.delegated_role || user?.delegatedRole || (user?.isCR ? 'Class Representative' : user?.isCS ? 'Core Committee' : user?.isPC ? 'Placement Lead' : user?.designation || user?.roleLevel || null);

  const delegatedRole =
    user?.delegated_role ||
    user?.delegatedRole ||
    (user?.isCR ? 'CLASS_REPRESENTATIVE' : user?.isCS ? 'CORE_STUDENT' : user?.isPC ? 'PLACEMENT_COORDINATOR' : null);

  const delegatedBadge = {
    CLASS_REPRESENTATIVE: { label: 'Class Representative', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.18)', border: 'rgba(168, 85, 247, 0.45)', icon: '👑' },
    CORE_STUDENT:         { label: 'Core Committee',       color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.18)', border: 'rgba(56, 189, 248, 0.45)', icon: '⚡' },
    PLACEMENT_COORDINATOR:{ label: 'Placement Lead',       color: '#34d399', bg: 'rgba(52, 211, 153, 0.18)', border: 'rgba(52, 211, 153, 0.45)', icon: '💼' },
  }[delegatedRole];

  return (
    <div className="vic-scene" ref={cardRef}>
      <div className={`vic-card ${flipped ? 'vic-card--flipped' : ''}`}>

        {/* ═══════════════════════════════ FRONT ═══════════════════════════════ */}
        <div className="vic-face vic-front">
          {/* Header band */}
          <div className="vic-header" style={{ background: meta.gradient }}>
            <div className="vic-header-brand">
              <div className="vic-brand-icon">
                <RoleIcon size={16} color="#fff" />
              </div>
              <div>
                <div className="vic-brand-name">{collegeName}</div>
                <div className="vic-brand-sub">{meta.label} ID {branchName ? `• ${branchName}` : ''}</div>
              </div>
            </div>
            {/* decorative circles */}
            <div className="vic-header-deco vic-deco-1" />
            <div className="vic-header-deco vic-deco-2" />
          </div>

          {/* Avatar + name block */}
          <div className="vic-identity">
            <div className="vic-avatar-wrap">
              {photo ? (
                <img
                  src={photo}
                  alt={fullName}
                  className="vic-avatar-img"
                />
              ) : (
                <div
                  className="vic-avatar-placeholder"
                  style={{ background: meta.gradient }}
                >
                  {initials}
                </div>
              )}
              <span
                className="vic-role-dot"
                style={{ background: meta.accent }}
                title={meta.label}
              />
            </div>

            <div className="vic-name-block">
              <h2 className="vic-name">{fullName}</h2>
              <p className="vic-meta-role" style={{ color: meta.accent }}>
                {positionTitle ? `${positionTitle} (${meta.label})` : meta.label}
              </p>
              {delegatedBadge ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '1rem',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: delegatedBadge.color,
                    background: delegatedBadge.bg,
                    border: `1px solid ${delegatedBadge.border}`,
                    marginTop: '0.25rem',
                    boxShadow: `0 0 8px ${delegatedBadge.bg}`,
                  }}
                >
                  {delegatedBadge.icon} {delegatedBadge.label}
                </span>
              ) : user?.role === 'student' ? (
                <StatusBadge status={user?.status || 'active'} />
              ) : null}
            </div>
          </div>

          {/* Divider */}
          <div className="vic-divider" style={{ background: meta.accentSoft }} />

          {/* Info fields */}
          <div className="vic-fields">
            <FieldSet user={user ?? {}} accent={meta.accent} />
          </div>

          {/* Footer */}
          <div className="vic-footer">
            <span className="vic-id-chip">
              <ShieldCheck size={11} style={{ marginRight: 4 }} />
              {systemId}
            </span>
            <button
              className="vic-flip-btn"
              onClick={onFlip}
              title="View QR code"
              style={{ '--accent': meta.accent }}
            >
              <RotateCcw size={13} />
              View QR
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════ BACK ════════════════════════════════ */}
        <div className="vic-face vic-back">
          {/* Header band (same gradient, reversed direction) */}
          <div
            className="vic-header"
            style={{
              background: meta.gradient.replace('135deg', '315deg'),
            }}
          >
            <div className="vic-header-brand">
              <div className="vic-brand-icon">
                <ShieldCheck size={16} color="#fff" />
              </div>
              <div>
                <div className="vic-brand-name">{collegeName}</div>
                <div className="vic-brand-sub">Verification Card</div>
              </div>
            </div>
            <div className="vic-header-deco vic-deco-1" />
            <div className="vic-header-deco vic-deco-2" />
          </div>

          {/* QR */}
          <div className="vic-qr-section">
            <div className="vic-qr-wrap">
              <QRCodeSVG
                value={qrPayload}
                size={148}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="H"
                includeMargin={false}
              />
            </div>
            <p className="vic-qr-hint">📲 Scan with Phone Camera to Text User</p>
          </div>

          {/* Verification meta */}
          <div className="vic-verify-meta">
            <div className="vic-verify-row">
              <span className="vic-verify-label">Full Name</span>
              <span className="vic-verify-val">{fullName}</span>
            </div>
            <div className="vic-verify-row">
              <span className="vic-verify-label">ID / Roll</span>
              <span className="vic-verify-val">{systemId}</span>
            </div>
            <div className="vic-verify-row">
              <span className="vic-verify-label">College</span>
              <span className="vic-verify-val">{collegeName}</span>
            </div>
            {branchName && (
              <div className="vic-verify-row">
                <span className="vic-verify-label">Branch</span>
                <span className="vic-verify-val">{branchName}</span>
              </div>
            )}
            <div className="vic-verify-row">
              <span className="vic-verify-label">Role / Position</span>
              <span className="vic-verify-val">{positionTitle ? `${positionTitle} (${meta.label})` : meta.label}</span>
            </div>
            <div className="vic-verify-row">
              <span className="vic-verify-label">Issued</span>
              <span className="vic-verify-val">
                {new Date().toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Security strip */}
          <div className="vic-security-strip" style={{ background: meta.gradient }} />

          {/* Footer */}
          <div className="vic-footer" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
            <button
              className="vic-flip-btn"
              onClick={onFlip}
              title="Back to front"
              style={{ '--accent': meta.accent }}
            >
              <RotateCcw size={13} />
              Front View
            </button>
            {onOpenScanner && (
              <button
                className="vic-flip-btn"
                onClick={onOpenScanner}
                title="Scan another student or faculty ID QR"
                style={{ '--accent': meta.accent }}
              >
                <Scan size={13} />
                Scan an ID
              </button>
            )}
            <button
              className="vic-flip-btn"
              onClick={() => {
                const targetId = user?.id || user?.user_id || user?.studentId || '';
                const targetName = user?.name || user?.full_name || 'Member';
                const targetEmail = user?.email || '';
                navigate(`/chats?userId=${encodeURIComponent(targetId)}&name=${encodeURIComponent(targetName)}&email=${encodeURIComponent(targetEmail)}`);
              }}
              title="Text this member on Campus Connect"
              style={{ '--accent': meta.accent }}
            >
              <MessageSquare size={13} />
              Text User
            </button>
            <button
              className="vic-flip-btn"
              onClick={onDownload}
              title="Download ID card"
              style={{ '--accent': meta.accent }}
            >
              <Download size={13} />
              Download
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
