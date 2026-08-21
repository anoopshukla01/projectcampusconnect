/**
 * LiveSessionBanner Component (Refactored & Dynamic)
 * =================================================
 * Displays active live lecture presence status for students:
 * - Dynamic ongoing classroom, subject, professor, and time.
 * - Idle state display when no class is active.
 * - Real-time GPS verification states: Locating, In Bounds, Out of Bounds.
 * - Immediate [Mark Attendance] trigger.
 */

import React from 'react';
import { Activity, Radio, MapPin, Clock, ShieldCheck, ShieldAlert, CheckCircle2, User, RefreshCw } from 'lucide-react';

export default function LiveSessionBanner({
  activeSession = null,
  presenceState = {
    inGeofence: false,
    dwellMinutes: 0,
    status: 'LOCATING',
    firstSeenAt: null,
    distance: null,
    accuracy: null,
    immutableHash: null,
  },
  onManualPing = null,
  onCheckIn = null,
  isPinging = false,
}) {
  // If no active lecture scheduled right now
  if (!activeSession || !activeSession.is_active) {
    return (
      <div className="lsb-banner lsb-banner--idle">
        <div className="lsb-idle-content">
          <div className="lsb-idle-icon">
            <Clock size={20} />
          </div>
          <div>
            <h4 className="lsb-idle-title">No Active Lecture Scheduled</h4>
            <p className="lsb-idle-sub">
              Your next class geofence will automatically unlock when scheduled lecture time commences.
            </p>
          </div>
        </div>
        {onManualPing && (
          <button className="lsb-ping-btn" onClick={onManualPing} disabled={isPinging}>
            <RefreshCw size={13} className={isPinging ? 'spin' : ''} />
            Check Schedule
          </button>
        )}
      </div>
    );
  }

  const {
    course_name = 'Core Lecture',
    course_code = 'CS401',
    room = 'Room 302',
    professor_name = 'Faculty Member',
    time_slot = 'Active Slot',
  } = activeSession;

  const dwellPct = Math.min(100, Math.round((presenceState.dwellMinutes / 50) * 100));
  const firstSeen = presenceState.firstSeenAt
    ? new Date(presenceState.firstSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Just now';

  const distanceMeters = presenceState.distance ? Math.round(presenceState.distance) : null;
  const isVerified = presenceState.status === 'PRESENT' || presenceState.status === 'LATE';

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
              <MapPin size={11} /> {room}
            </span>
            <span className="lsb-time-badge">
              <Clock size={11} /> {time_slot}
            </span>
            {isVerified ? (
              <span className="lsb-verified-badge">
                <ShieldCheck size={11} /> Verified ({distanceMeters !== null ? `${distanceMeters}m` : 'In Bounds'})
              </span>
            ) : presenceState.inGeofence ? (
              <span className="lsb-bounds-badge">
                <ShieldCheck size={11} /> Within Classroom Bounds ({distanceMeters}m)
              </span>
            ) : (
              <span className="lsb-out-badge">
                <ShieldAlert size={11} /> Out of Bounds ({distanceMeters !== null ? `${distanceMeters}m away` : 'Locating...'})
              </span>
            )}
          </div>

          <h3 className="lsb-subject-title">
            {course_name} <span className="lsb-code">({course_code})</span>
          </h3>

          <div className="lsb-meta-line">
            <span>
              <User size={12} /> {professor_name}
            </span>
            <span>•</span>
            <span>
              Entry: <strong>{firstSeen}</strong>
            </span>
            <span>•</span>
            <span>
              Continuous Dwell: <strong>{presenceState.dwellMinutes} / 50 mins ({dwellPct}%)</strong>
            </span>
            {presenceState.immutableHash && (
              <>
                <span>•</span>
                <span className="lsb-hash-tag" title="Immutable cryptographic ledger hash">
                  🔒 {presenceState.immutableHash.slice(0, 10)}...
                </span>
              </>
            )}
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
            {isVerified ? '✓ Verified Present' : dwellPct >= 70 ? 'Presence threshold met' : 'Dwell in progress...'}
          </span>
        </div>

        <div className="lsb-actions">
          {onCheckIn && !isVerified && (
            <button className="lsb-checkin-btn" onClick={onCheckIn} disabled={isPinging}>
              <CheckCircle2 size={14} />
              Mark Attendance Now
            </button>
          )}
          {onManualPing && (
            <button className="lsb-ping-btn" onClick={onManualPing} disabled={isPinging}>
              <RefreshCw size={13} className={isPinging ? 'spin' : ''} />
              Refresh GPS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
