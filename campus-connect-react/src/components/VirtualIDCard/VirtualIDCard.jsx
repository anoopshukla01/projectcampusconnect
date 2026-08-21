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
import { QRCodeSVG } from 'qrcode.react';
import {
  User, Mail, Phone, MapPin, BadgeCheck, Building2,
  GraduationCap, Briefcase, ShieldCheck, RotateCcw,
  Download, Link2, Calendar
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

// ── Build vCard / QR payload ──────────────────────────────────────────────────
function buildQRPayload(user) {
  const role = ROLE_META[user?.role]?.label ?? user?.role ?? 'Member';
  const name = user?.name ?? user?.full_name ?? 'Campus Member';
  const sysId = user?.systemId ?? user?.rollNo ?? user?.roll_no ?? user?.facultyId ?? user?.employee_id ?? user?.officerId ?? user?.adminId ?? user?.id ?? 'N/A';
  return [
    `BEGIN:VCARD`,
    `VERSION:3.0`,
    `FN:${name}`,
    `TITLE:${role}`,
    `EMAIL:${user?.email ?? ''}`,
    `TEL:${user?.phone ?? ''}`,
    `ORG:Campus Connect`,
    `NOTE:ID:${sysId}`,
    `END:VCARD`,
  ].join('\n');
}

// ── Field row helper ──────────────────────────────────────────────────────────
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

// ── Role-specific field sets ──────────────────────────────────────────────────
function StudentFields({ user, accent }) {
  return (
    <>
      <Field Icon={BadgeCheck} label="Roll No"    value={user?.rollNo ?? user?.roll_no ?? user?.id}    accent={accent} />
      <Field Icon={Building2}  label="Branch"     value={user?.branch}    accent={accent} />
      <Field Icon={Calendar}   label="Batch"      value={user?.batch ?? user?.batch_year}     accent={accent} />
      <Field Icon={GraduationCap} label="Year"   value={user?.year ?? (user?.semester ? `Semester ${user.semester}` : null)}      accent={accent} />
      <Field Icon={Mail}       label="Email"      value={user?.email}     accent={accent} />
      <Field Icon={Phone}      label="Phone"      value={user?.phone}     accent={accent} />
    </>
  );
}

function ProfessorFields({ user, accent }) {
  return (
    <>
      <Field Icon={BadgeCheck} label="Faculty ID"   value={user?.facultyId ?? user?.employee_id ?? user?.id}    accent={accent} />
      <Field Icon={Building2}  label="Department"   value={user?.department ?? user?.branch}   accent={accent} />
      <Field Icon={Briefcase}  label="Designation"  value={user?.designation}  accent={accent} />
      <Field Icon={Mail}       label="Email"         value={user?.email}        accent={accent} />
      <Field Icon={Phone}      label="Contact"       value={user?.phone}        accent={accent} />
      <Field Icon={MapPin}     label="Office"        value={user?.office}       accent={accent} />
    </>
  );
}

function TpoFields({ user, accent }) {
  return (
    <>
      <Field Icon={BadgeCheck} label="Officer ID"  value={user?.officerId ?? user?.id}   accent={accent} />
      <Field Icon={Building2}  label="Department"  value={user?.department ?? 'Placement Cell'}  accent={accent} />
      <Field Icon={Briefcase}  label="Position"    value={user?.position ?? 'Placement Officer'}    accent={accent} />
      <Field Icon={Mail}       label="Email"        value={user?.email}       accent={accent} />
      <Field Icon={Phone}      label="Direct Line"  value={user?.phone}       accent={accent} />
    </>
  );
}

function AdminFields({ user, accent }) {
  return (
    <>
      <Field Icon={BadgeCheck}  label="Admin ID"    value={user?.adminId ?? user?.id ?? 'ADM-001'}     accent={accent} />
      <Field Icon={ShieldCheck} label="Role Level"  value={user?.roleLevel ?? 'Administrator'}   accent={accent} />
      <Field Icon={Mail}        label="Email"        value={user?.email}       accent={accent} />
      <Field Icon={Phone}       label="Contact"      value={user?.phone}       accent={accent} />
    </>
  );
}

const FIELD_SETS = {
  student:   StudentFields,
  professor: ProfessorFields,
  tpo:       TpoFields,
  admin:     AdminFields,
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function VirtualIDCard({ user, flipped, onFlip, cardRef, onDownload }) {
  const role = user?.role ?? 'student';
  const meta = ROLE_META[role] ?? ROLE_META.student;
  const RoleIcon = meta.icon;
  const FieldSet = FIELD_SETS[role] ?? StudentFields;
  const qrPayload = buildQRPayload(user ?? {});

  const fullName = user?.name || user?.full_name || 'Campus Member';
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'CC';

  const systemId =
    user?.rollNo ?? user?.roll_no ?? user?.facultyId ?? user?.employee_id ?? user?.officerId ?? user?.adminId ?? user?.id ?? 'N/A';
  const photo = user?.photo || user?.profile_photo_url;

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
                <div className="vic-brand-name">Campus Connect</div>
                <div className="vic-brand-sub">{meta.label} ID</div>
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
                {meta.label}
              </p>
              {user?.role === 'student' && (
                <StatusBadge status={user?.status || 'active'} />
              )}
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
                <div className="vic-brand-name">Campus Connect</div>
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
            <p className="vic-qr-hint">Scan to verify identity</p>
          </div>

          {/* Verification meta */}
          <div className="vic-verify-meta">
            <div className="vic-verify-row">
              <span className="vic-verify-label">Full Name</span>
              <span className="vic-verify-val">{user?.name ?? '—'}</span>
            </div>
            <div className="vic-verify-row">
              <span className="vic-verify-label">ID</span>
              <span className="vic-verify-val">{systemId}</span>
            </div>
            <div className="vic-verify-row">
              <span className="vic-verify-label">Role</span>
              <span className="vic-verify-val">{meta.label}</span>
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
          <div className="vic-footer">
            <button
              className="vic-flip-btn"
              onClick={onFlip}
              title="Back to front"
              style={{ '--accent': meta.accent }}
            >
              <RotateCcw size={13} />
              Front View
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
