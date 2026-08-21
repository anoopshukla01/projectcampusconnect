/**
 * LiveSessionBanner Component
 * ============================
 * Displays active live lecture presence status for students:
 * - Current ongoing classroom & subject.
 * - Live dwell-time tracker.
 * - Real-time GPS verification status.
 */

import React from 'react';
import { Activity, Radio, MapPin, Clock, ShieldCheck, DoorOpen } from 'lucide-react';

export default function LiveSessionBanner({
  activeSubject = { code: 'CS401', name: 'Operating Systems' },
  activeRoom = 'Room 302',
  presenceState = {
    inGeofence: true,
    dwellMinutes: 28,
    status: 'PRESENT',
    firstSeenAt: new Date().toISOString(),
    distance: 12.4,
    accuracy: 8.5,
  },
  onManualPing = null,
}) {
  const dwellPct = Math.min(100, Math.round((presenceState.dwellMinutes / 50) * 100));
  const firstSeen = presenceState.firstSeenAt
    ? new Date(presenceState.firstSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Just now';

  return (
    <div className="lsb-banner">
      <div className="lsb-left">
        <div className="lsb-beacon-wrap">
          <span className="lsb-pulse-ring" />
          <Radio size={20} className="lsb-radio-icon" />
        </div>

        <div className="lsb-info">
          <div className="lsb-tag-row">
            <span className="lsb-live-badge">
              <Activity size={12} className="lsb-pulse-icon" />
              LIVE SESSION ACTIVE
            </span>
            <span className="lsb-room-badge">
              <MapPin size={11} /> {activeRoom}
            </span>
            {presenceState.inGeofence && (
              <span className="lsb-verified-badge">
                <ShieldCheck size={11} /> GPS Verified ({Math.round(presenceState.distance || 10)}m)
              </span>
            )}
          </div>

          <h3 className="lsb-subject-title">
            {activeSubject.name} ({activeSubject.code})
          </h3>

          <div className="lsb-meta-line">
            <span>
              <Clock size={12} /> Entry Recorded: <strong>{firstSeen}</strong>
            </span>
            <span>•</span>
            <span>
              Continuous Dwell: <strong>{presenceState.dwellMinutes} / 50 mins ({dwellPct}%)</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="lsb-right">
        <div className="lsb-dwell-meter">
          <div className="lsb-meter-bar">
            <div
              className={`lsb-meter-fill ${dwellPct >= 70 ? 'fill-green' : 'fill-amber'}`}
              style={{ width: `${dwellPct}%` }}
            />
          </div>
          <span className="lsb-meter-label">
            {dwellPct >= 70 ? '✓ Presence Threshold Met' : 'Dwell in progress...'}
          </span>
        </div>

        {onManualPing && (
          <button className="lsb-ping-btn" onClick={onManualPing}>
            Refresh GPS
          </button>
        )}
      </div>
    </div>
  );
}
