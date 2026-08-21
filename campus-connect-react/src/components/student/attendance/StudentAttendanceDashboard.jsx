/**
 * StudentAttendanceDashboard Component (Refactored & Dynamic)
 * ============================================================
 * Master orchestrator for student-facing attendance analytics:
 * - Dynamic Live Session Presence Banner with Geofence Check-in
 * - Overview Statistics & 75% Eligibility Bunk / Shortage Calculator
 * - Dynamic Subject-Wise Progress Table
 * - Chronological Immutable Session Audit Trail with Filter Tabs
 */

import React, { useState, useEffect, useCallback } from 'react';
import { academicsApi } from '../../../services/api';
import { useLivePresenceTracker } from '../../../lib/attendance/useLivePresenceTracker';
import AttendanceOverviewCards from './AttendanceOverviewCards';
import SubjectWiseAttendanceTable from './SubjectWiseAttendanceTable';
import LiveSessionBanner from './LiveSessionBanner';
import AttendanceHistoryLog from './AttendanceHistoryLog';
import './StudentAttendance.css';

export default function StudentAttendanceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await academicsApi.getStudentAttendanceAnalytics();
      if (res && res.overall) {
        setData(res);
      }
    } catch (err) {
      console.error('Failed to load attendance analytics:', err);
      setError('Could not load attendance analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const activeSession = data?.active_session || null;

  // Active live GPS presence tracker hook linked dynamically to active session
  const { presenceState, isPinging, sendHeartbeatNow, checkInNow } = useLivePresenceTracker({
    activeSubject: activeSession
      ? { code: activeSession.course_code, name: activeSession.course_name }
      : null,
    activeRoom: activeSession?.room || 'Room 302',
    slotId: activeSession?.slot_id || null,
    enabled: !!(activeSession && activeSession.is_active),
  });

  const handleCheckIn = async () => {
    const res = await checkInNow();
    if (res.ok) {
      setActionFeedback({ type: 'success', message: res.data.message });
      fetchAnalytics();
    } else {
      setActionFeedback({ type: 'error', message: res.error });
    }
    setTimeout(() => setActionFeedback(null), 5000);
  };

  if (loading && !data) {
    return (
      <div className="sad-loading">
        <div className="sad-skeleton-header" />
        <div className="sad-skeleton-grid">
          <div className="sad-skeleton-card" />
          <div className="sad-skeleton-card" />
          <div className="sad-skeleton-card" />
          <div className="sad-skeleton-card" />
        </div>
      </div>
    );
  }

  const { overall = {}, subject_breakdown = [], history_logs = [] } = data || {};

  return (
    <div className="sad-container">
      {actionFeedback && (
        <div className={`sad-toast-banner ${actionFeedback.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          <span>{actionFeedback.message}</span>
          <button onClick={() => setActionFeedback(null)}>✕</button>
        </div>
      )}

      {/* ── 1. Live Session Presence Banner ───────────────────────────────── */}
      <LiveSessionBanner
        activeSession={activeSession}
        presenceState={presenceState}
        onManualPing={sendHeartbeatNow}
        onCheckIn={handleCheckIn}
        isPinging={isPinging}
      />

      {/* ── 2. Top Metric Cards (Overall % + 75% Bunk Calculator) ─────────── */}
      <AttendanceOverviewCards overall={overall} />

      {/* ── 3. Subject-Wise Progress Grid ─────────────────────────────────── */}
      <SubjectWiseAttendanceTable subjects={subject_breakdown} />

      {/* ── 4. Chronological Session Audit Log ────────────────────────────── */}
      <AttendanceHistoryLog logs={history_logs} />
    </div>
  );
}
