/**
 * GeofenceRadar Component
 * =======================
 * Live Radar Scanner & Zero-Touch Automated GPS Attendance Card:
 * - Animated radar wave / pulse visualization.
 * - Real-time GPS coordinates, horizontal accuracy, and distance.
 * - Continuous dwell-time countdown progress bar.
 * - Verified check-in status card with instantaneous badge.
 * - Dev simulation buttons for fast live demonstration.
 */

import React, { useState } from 'react';
import {
  Radio,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Compass,
  Zap,
  Clock,
  ShieldCheck,
  Navigation,
} from 'lucide-react';
import { useGeofenceAttendance } from '../../lib/attendance/useGeofenceAttendance';
import './GeofenceRadar.css';

export default function GeofenceRadar({
  activeSubject = null,
  activeRoom = 'Room 302',
  onAttendanceMarked = null,
}) {
  const [autoEnabled, setAutoEnabled] = useState(true);

  const {
    gpsStatus,
    coords,
    distance,
    inRange,
    accuracyAccepted,
    dwellProgress,
    checkedIn,
    checkInDetails,
    submitting,
    gpsError,
    classroom,
    simulated,
    simulateInRange,
    simulateOutOfRange,
    manualCheckInNow,
  } = useGeofenceAttendance({
    activeSubject,
    activeRoom,
    autoCheckInEnabled: autoEnabled,
    onCheckInSuccess: onAttendanceMarked,
  });

  return (
    <div className="gr-card">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="gr-header">
        <div className="gr-title-group">
          <div className={`gr-icon-badge ${checkedIn ? 'checked-in' : inRange ? 'in-range' : 'searching'}`}>
            <Radio size={18} className={!checkedIn ? 'gr-pulse-icon' : ''} />
          </div>
          <div>
            <div className="gr-eyebrow">Zero-Touch Automated Engine</div>
            <h3 className="gr-title">GPS Geofence Live Radar</h3>
          </div>
        </div>

        <div className="gr-controls">
          <label className="gr-toggle-label" title="Enable zero-touch automatic check-in when dwelling inside classroom">
            <input
              type="checkbox"
              checked={autoEnabled}
              onChange={(e) => setAutoEnabled(e.target.checked)}
              disabled={checkedIn}
            />
            <span>Auto Check-in</span>
          </label>
        </div>
      </div>

      {/* ── Main Radar & Status Area ───────────────────────────────────────── */}
      <div className="gr-body">
        {/* Radar Scanner Graphic */}
        <div className={`gr-radar-wrapper ${inRange ? 'radar-active' : ''} ${checkedIn ? 'radar-locked' : ''}`}>
          <div className="gr-radar-ring ring-1" />
          <div className="gr-radar-ring ring-2" />
          <div className="gr-radar-ring ring-3" />
          <div className="gr-radar-sweep" />

          {/* Center Target (Classroom) */}
          <div className="gr-target-pin" title={classroom.name}>
            <MapPin size={20} />
          </div>

          {/* User Blip */}
          {coords && (
            <div
              className={`gr-user-blip ${inRange ? 'blip-in' : 'blip-out'}`}
              style={{
                transform: inRange
                  ? 'translate(-50%, -50%) scale(1.1)'
                  : 'translate(-15%, -120%) scale(0.9)',
              }}
              title={`Distance: ${distance !== null ? `${distance}m` : 'Calculating...'}`}
            >
              <div className="blip-core" />
              <div className="blip-wave" />
            </div>
          )}
        </div>

        {/* Status Metrics Panel */}
        <div className="gr-info-panel">
          {/* Target Classroom Bar */}
          <div className="gr-classroom-banner">
            <div className="gr-cr-left">
              <Compass size={16} className="gr-accent-icon" />
              <div>
                <div className="gr-cr-name">{classroom.name} ({classroom.code})</div>
                <div className="gr-cr-meta">{classroom.block} · {classroom.radiusMeters}m Geofence</div>
              </div>
            </div>
            <div className="gr-distance-tag">
              {distance !== null ? (
                <span className={inRange ? 'dist-green' : 'dist-amber'}>
                  {distance <= 1 ? 'Inside Classroom' : `${distance} m away`}
                </span>
              ) : (
                <span className="dist-muted">Locating...</span>
              )}
            </div>
          </div>

          {/* GPS Live Diagnostics */}
          <div className="gr-metrics-grid">
            <div className="gr-metric-box">
              <span className="gr-metric-label">GPS Accuracy</span>
              <span className="gr-metric-val">
                {coords?.accuracy ? (
                  <span className={accuracyAccepted ? 'metric-good' : 'metric-warn'}>
                    ±{Math.round(coords.accuracy)} m
                  </span>
                ) : 'Acquiring...'}
              </span>
            </div>
            <div className="gr-metric-box">
              <span className="gr-metric-label">Geofence Status</span>
              <span className="gr-metric-val">
                {checkedIn ? (
                  <span className="metric-good">Verified Present</span>
                ) : inRange ? (
                  <span className="metric-good">Inside Perimeter</span>
                ) : (
                  <span className="metric-muted">Out of Range</span>
                )}
              </span>
            </div>
          </div>

          {/* Dwell Progress / Check-in State */}
          {!checkedIn ? (
            <div className="gr-dwell-section">
              <div className="gr-dwell-header">
                <span className="gr-dwell-title">
                  <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  {inRange ? 'Dwell Verification' : 'Waiting for Classroom Arrival'}
                </span>
                <span className="gr-dwell-pct">{dwellProgress}%</span>
              </div>
              <div className="gr-dwell-track">
                <div
                  className={`gr-dwell-fill ${dwellProgress === 100 ? 'complete' : ''}`}
                  style={{ width: `${dwellProgress}%` }}
                />
              </div>

              {inRange && !autoEnabled && (
                <button
                  className="gr-btn-checkin"
                  onClick={manualCheckInNow}
                  disabled={submitting}
                >
                  <Zap size={14} />
                  {submitting ? 'Verifying Coordinates...' : 'Confirm Check-In Now'}
                </button>
              )}
            </div>
          ) : (
            <div className="gr-success-box">
              <ShieldCheck size={20} className="gr-success-icon" />
              <div>
                <div className="gr-success-title">Zero-Touch Attendance Marked!</div>
                <div className="gr-success-meta">
                  Logged at {checkInDetails?.timestamp} · Accuracy ±{checkInDetails?.accuracy}m · Haversine {checkInDetails?.distance}m
                </div>
              </div>
            </div>
          )}

          {gpsError && (
            <div className="gr-error-banner">
              <AlertTriangle size={14} />
              <span>{gpsError}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Simulator Toolbar for Testing / Verification ───────────────── */}
      <div className="gr-footer-sim">
        <span className="gr-sim-label">
          <Navigation size={12} style={{ display: 'inline', marginRight: '3px' }} />
          GPS Engine Simulator:
        </span>
        <button
          className={`gr-sim-btn ${simulated && inRange ? 'active' : ''}`}
          onClick={simulateInRange}
          title="Simulate student GPS coordinates 6 meters inside classroom"
        >
          Simulate Inside (6m)
        </button>
        <button
          className={`gr-sim-btn ${simulated && !inRange ? 'active' : ''}`}
          onClick={simulateOutOfRange}
          title="Simulate student GPS coordinates 180 meters away"
        >
          Simulate Outside (180m)
        </button>
      </div>
    </div>
  );
}
