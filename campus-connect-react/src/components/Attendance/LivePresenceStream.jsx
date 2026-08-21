/**
 * LivePresenceStream Component
 * =============================
 * Real-Time Session Presence Dashboard for Professors:
 * - Live attendee streaming ticker with active student cards.
 * - Continuous dwell meters, arrival timestamps, and departure alerts.
 * - Early exit & late arrival detection flags.
 * - 1-Click "Commit Live Attendance" button to mark records into gradebook.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  ArrowRight,
  ShieldCheck,
  DoorOpen,
} from 'lucide-react';
import { presenceApi, academicsApi } from '../../services/api';
import './LivePresenceStream.css';

export default function LivePresenceStream({
  activeCourse = null,
  activeRoom = 'Room 302',
  slotId = null,
  onSessionFinalized = null,
}) {
  const [sessionData, setSessionData] = useState({
    total_logged: 0,
    total_active_now: 0,
    avg_dwell_minutes: 0,
    students: [],
  });
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState(false);

  const fetchLiveSession = useCallback(async () => {
    try {
      const res = await presenceApi.getLiveSession({
        course_code: activeCourse?.course_code || activeCourse?.code || 'CS401',
      });
      if (res && res.students) {
        setSessionData(res);
      }
    } catch (err) {
      console.error('Failed to fetch live session presence:', err);
    }
  }, [activeCourse]);

  useEffect(() => {
    fetchLiveSession();

    if (autoRefresh) {
      const interval = setInterval(fetchLiveSession, 8000); // 8s polling
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchLiveSession]);

  const handleFinalizeAttendance = async () => {
    if (sessionData.students.length === 0) return;

    setCommitting(true);
    try {
      const presentRolls = sessionData.students
        .filter(s => s.status !== 'ABSENT' && !s.early_exit)
        .map(s => s.roll_no);

      const res = await academicsApi.markAttendance({
        slot_id: slotId || undefined,
        present_roll_nos: presentRolls,
      });

      if (res && (res.success || !res.error)) {
        setCommitSuccess(true);
        setTimeout(() => setCommitSuccess(false), 4000);
        onSessionFinalized?.(res);
      }
    } catch (err) {
      console.error('Finalize session failed:', err);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="lps-card">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="lps-header">
        <div className="lps-header-left">
          <div className="lps-live-badge">
            <span className="lps-live-dot" />
            LIVE SESSION MONITOR
          </div>
          <div>
            <h3 className="lps-title">
              {activeCourse?.course_name || activeCourse?.name || 'Computer Science Lecture'} ({activeRoom})
            </h3>
            <p className="lps-sub">Session-locked GPS dwell tracker streaming real-time student presence</p>
          </div>
        </div>

        <div className="lps-actions">
          <button
            className="lps-refresh-btn"
            onClick={() => { setLoading(true); fetchLiveSession().then(() => setLoading(false)); }}
            title="Refresh stream"
          >
            <RefreshCw size={14} className={loading ? 'lps-spin' : ''} />
          </button>

          <button
            className="lps-finalize-btn"
            onClick={handleFinalizeAttendance}
            disabled={committing || sessionData.students.length === 0}
          >
            <ShieldCheck size={16} />
            {committing ? 'Saving Attendance...' : commitSuccess ? 'Attendance Finalized!' : 'Commit Session Attendance'}
          </button>
        </div>
      </div>

      {/* ── Metric Summary Tiles ───────────────────────────────────────────── */}
      <div className="lps-metrics-row">
        <div className="lps-stat-box">
          <span className="lps-stat-label">Active Inside Geofence</span>
          <div className="lps-stat-val text-green">
            <Activity size={18} />
            <span>{sessionData.total_active_now} Active Now</span>
          </div>
        </div>

        <div className="lps-stat-box">
          <span className="lps-stat-label">Total Verified Check-Ins</span>
          <div className="lps-stat-val text-blue">
            <Users size={18} />
            <span>{sessionData.total_logged} Students</span>
          </div>
        </div>

        <div className="lps-stat-box">
          <span className="lps-stat-label">Average Session Dwell</span>
          <div className="lps-stat-val text-violet">
            <Clock size={18} />
            <span>{sessionData.avg_dwell_minutes} Minutes</span>
          </div>
        </div>
      </div>

      {/* ── Live Attendees Grid ────────────────────────────────────────────── */}
      <div className="lps-grid-header">
        <span className="lps-grid-title">Real-Time Presence Roster</span>
        <span className="lps-grid-count">{sessionData.students.length} recorded</span>
      </div>

      {sessionData.students.length === 0 ? (
        <div className="lps-empty-state">
          <div className="lps-empty-radar" />
          <p className="lps-empty-text">Awaiting student GPS arrivals inside {activeRoom}...</p>
          <span className="lps-empty-hint">Students entering the classroom will stream onto this board automatically.</span>
        </div>
      ) : (
        <div className="lps-students-grid">
          {sessionData.students.map((student) => {
            const firstSeenTime = student.first_seen_at
              ? new Date(student.first_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '—';
            const dwellPct = Math.min(100, Math.round((student.dwell_minutes / 50) * 100));

            return (
              <div
                key={student.id || student.roll_no}
                className={`lps-student-card ${student.is_live_now ? 'card-live' : 'card-inactive'} ${student.early_exit ? 'card-early-exit' : ''}`}
              >
                <div className="lps-card-top">
                  <div className="lps-avatar-col">
                    <div className="lps-avatar">
                      {student.name.slice(0, 2).toUpperCase()}
                      {student.is_live_now && <span className="lps-beacon" />}
                    </div>
                  </div>

                  <div className="lps-info-col">
                    <div className="lps-name-row">
                      <span className="lps-student-name">{student.name}</span>
                      {student.early_exit ? (
                        <span className="lps-tag tag-exit">
                          <DoorOpen size={11} /> Early Exit
                        </span>
                      ) : student.is_live_now ? (
                        <span className="lps-tag tag-live">● Inside Room</span>
                      ) : (
                        <span className="lps-tag tag-idle">Departed</span>
                      )}
                    </div>
                    <code className="lps-student-roll">{student.roll_no}</code>
                  </div>
                </div>

                {/* Dwell Progress Bar */}
                <div className="lps-dwell-wrap">
                  <div className="lps-dwell-meta">
                    <span className="lps-dwell-text">
                      <Clock size={11} /> Entry: {firstSeenTime}
                    </span>
                    <span className="lps-dwell-duration">{student.dwell_minutes}m in class</span>
                  </div>
                  <div className="lps-progress-bar">
                    <div
                      className={`lps-progress-fill ${dwellPct >= 75 ? 'fill-safe' : 'fill-warning'}`}
                      style={{ width: `${dwellPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
