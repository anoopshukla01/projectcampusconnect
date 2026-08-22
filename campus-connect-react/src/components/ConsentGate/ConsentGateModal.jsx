/**
 * ConsentGateModal.jsx
 * ────────────────────
 * Mandatory Permissions, User Guide & Legal Consent Gate for Campus Connect.
 * Enforces explicit legal consent (Terms of Service, Privacy Policy & DPDP compliance, User Guidelines)
 * and grants granular device permissions (Geolocation for automated attendance, Notifications, Storage).
 */

import { useState, useCallback } from 'react';
import {
  ShieldCheck, MapPin, Bell, Folder, ChevronDown, ChevronUp,
  Lock, CheckCircle2, AlertCircle, Loader2, ArrowRight, LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionContext';
import './ConsentGateModal.css';

export default function ConsentGateModal() {
  const { user, consentRequired, recordConsent, logout } = useAuth();
  const { grantPermission } = usePermissions?.() || {};

  // Permission toggles
  const [locationConsent, setLocationConsent] = useState(true);
  const [notifConsent, setNotifConsent] = useState(true);
  const [storageConsent, setStorageConsent] = useState(true);

  // Mandatory legal agreements
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [guidelinesAccepted, setGuidelinesAccepted] = useState(false);

  // Accordion state for legal reviews
  const [expandedDoc, setExpandedDoc] = useState(null); // 'terms' | 'privacy' | 'guidelines' | null
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const toggleDoc = (docKey) => {
    setExpandedDoc(prev => (prev === docKey ? null : docKey));
  };

  const handleAccept = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!termsAccepted || !guidelinesAccepted) {
      setErrorMsg('Please check both required agreements before continuing.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // Sync device permissions to PermissionContext if available
      if (grantPermission) {
        if (locationConsent) grantPermission('location', false);
        if (notifConsent) grantPermission('notifications', false);
        if (storageConsent) grantPermission('documents', false);
      }

      // Record immutable consent with backend
      const res = await recordConsent({
        location_consent: locationConsent,
        notif_consent: notifConsent,
        storage_consent: storageConsent,
        terms_accepted: termsAccepted,
        guidelines_accepted: guidelinesAccepted,
        agreement_version: '1.0.0',
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Unable to record consent. Please try again.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  }, [termsAccepted, guidelinesAccepted, locationConsent, notifConsent, storageConsent, grantPermission, recordConsent]);

  if (!consentRequired || !user) return null;

  return (
    <div className="cgm-overlay" role="dialog" aria-modal="true" aria-labelledby="cgm-title">
      <div className="cgm-card">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="cgm-header">
          <div className="cgm-header-icon">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 className="cgm-title" id="cgm-title">Permissions & Legal Compliance Gate</h2>
            <p className="cgm-subtitle">
              Welcome, <strong>{user?.name || 'Campus Member'}</strong>. Please review device permissions and accept our institutional policies to access your dashboard.
            </p>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="cgm-body">

          {/* Section 1: Device Permissions */}
          <div className="cgm-section">
            <h3 className="cgm-section-title">
              <Lock size={13} /> Required System Permissions
            </h3>
            <div className="cgm-perm-list">

              {/* Geolocation */}
              <div className="cgm-perm-item">
                <div className="cgm-perm-left">
                  <div className="cgm-perm-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h4 className="cgm-perm-name">Automated Geofence Attendance</h4>
                    <p className="cgm-perm-desc">
                      Verifies your physical presence inside classroom and lecture hall boundaries during live attendance sessions.
                    </p>
                  </div>
                </div>
                <label className="cgm-switch">
                  <input
                    type="checkbox"
                    checked={locationConsent}
                    onChange={(e) => setLocationConsent(e.target.checked)}
                  />
                  <span className="cgm-slider" />
                </label>
              </div>

              {/* Notifications */}
              <div className="cgm-perm-item">
                <div className="cgm-perm-left">
                  <div className="cgm-perm-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' }}>
                    <Bell size={18} />
                  </div>
                  <div>
                    <h4 className="cgm-perm-name">Real-Time Broadcasts & Placement Alerts</h4>
                    <p className="cgm-perm-desc">
                      Get urgent notifications when placement drives open, schedule revisions occur, or classes start.
                    </p>
                  </div>
                </div>
                <label className="cgm-switch">
                  <input
                    type="checkbox"
                    checked={notifConsent}
                    onChange={(e) => setNotifConsent(e.target.checked)}
                  />
                  <span className="cgm-slider" />
                </label>
              </div>

              {/* Storage */}
              <div className="cgm-perm-item">
                <div className="cgm-perm-left">
                  <div className="cgm-perm-icon-wrap" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed' }}>
                    <Folder size={18} />
                  </div>
                  <div>
                    <h4 className="cgm-perm-name">ID Photo & Academic File Storage</h4>
                    <p className="cgm-perm-desc">
                      Enables drag-and-drop ID badge photo changes, resume uploads, and assignment PDF submissions.
                    </p>
                  </div>
                </div>
                <label className="cgm-switch">
                  <input
                    type="checkbox"
                    checked={storageConsent}
                    onChange={(e) => setStorageConsent(e.target.checked)}
                  />
                  <span className="cgm-slider" />
                </label>
              </div>

            </div>
          </div>

          {/* Section 2: Policy Accordion */}
          <div className="cgm-section">
            <h3 className="cgm-section-title">
              Institutional Policies & Guidelines (v1.0.0)
            </h3>
            <div className="cgm-accordion">

              {/* Terms */}
              <div className="cgm-accordion-item">
                <button
                  type="button"
                  className="cgm-accordion-header"
                  onClick={() => toggleDoc('terms')}
                >
                  <span>Terms of Service & Academic Honor Code</span>
                  {expandedDoc === 'terms' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                {expandedDoc === 'terms' && (
                  <div className="cgm-accordion-body">
                    <p>
                      By accessing Campus Connect, you agree to maintain complete academic integrity. Proxy attendance, unauthorized material distribution, tampering with timetable records, or sharing account credentials will lead to immediate disciplinary actions by the university administration.
                    </p>
                  </div>
                )}
              </div>

              {/* Privacy */}
              <div className="cgm-accordion-item">
                <button
                  type="button"
                  className="cgm-accordion-header"
                  onClick={() => toggleDoc('privacy')}
                >
                  <span>Privacy Policy & DPDP Act 2023 Compliance</span>
                  {expandedDoc === 'privacy' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                {expandedDoc === 'privacy' && (
                  <div className="cgm-accordion-body">
                    <p>
                      Your personal data (CGPA, attendance, contact details) is protected under the Digital Personal Data Protection Act 2023. Data is stored on encrypted campus databases and shared solely with authorized faculty and verified corporate recruiters during recruitment drives.
                    </p>
                  </div>
                )}
              </div>

              {/* User Guidelines */}
              <div className="cgm-accordion-item">
                <button
                  type="button"
                  className="cgm-accordion-header"
                  onClick={() => toggleDoc('guidelines')}
                >
                  <span>Campus Connect User Guidelines & Community Conduct</span>
                  {expandedDoc === 'guidelines' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                {expandedDoc === 'guidelines' && (
                  <div className="cgm-accordion-body">
                    <p>
                      Campus Connect channels, marketplace listings, and discussion boards must remain professional, respectful, and free from harassment or spam. Violations may result in feature suspension.
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Section 3: Mandatory Agreement Checkboxes */}
          <div className="cgm-check-group">
            <label className="cgm-checkbox-label">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span>
                I have read and agree to the <strong>Terms of Service</strong> and <strong>Privacy Policy (DPDP 2023)</strong>.
              </span>
            </label>

            <label className="cgm-checkbox-label">
              <input
                type="checkbox"
                checked={guidelinesAccepted}
                onChange={(e) => setGuidelinesAccepted(e.target.checked)}
              />
              <span>
                I agree to abide by the <strong>Campus Connect User Guidelines & Honor Code</strong>.
              </span>
            </label>
          </div>

          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontSize: '0.8rem', fontWeight: 600 }}>
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

        </div>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="cgm-footer">
          <button
            type="button"
            className="cgm-btn-secondary"
            onClick={logout}
          >
            <LogOut size={13} style={{ display: 'inline', marginRight: '4px' }} />
            Decline & Sign Out
          </button>

          <button
            type="button"
            className="cgm-btn-primary"
            disabled={!termsAccepted || !guidelinesAccepted || submitting}
            onClick={handleAccept}
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="cgm-spin" />
                Recording Consent…
              </>
            ) : (
              <>
                Accept & Enter Campus Connect
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
