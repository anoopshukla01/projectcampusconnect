/**
 * StudentAttendanceDashboard Component
 * =====================================
 * Master orchestrator for student-facing attendance analytics:
 * - Live Session Presence Banner
 * - Overview Statistics & 75% Eligibility Bunk Calculator
 * - Subject-Wise Progress Cards
 * - Chronological Session Audit Trail
 */

import React, { useState, useEffect } from 'react';
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

  // Active live GPS presence tracker hook
  const { presenceState, sendHeartbeatNow } = useLivePresenceTracker({
    activeSubject: { code: 'CS401', name: 'Operating Systems' },
    activeRoom: 'Room 302',
    enabled: true,
  });

  const fetchAnalytics = async () => {
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
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading && !data) {
    return (
      <div className="sad-loading">
        <div className="sad-spinner" />
        <p>Loading attendance analytics & presence records...</p>
      </div>
    );
  }

  const { overall = {}, subject_breakdown = [], history_logs = [] } = data || {};

  return (
    <div className="sad-container">
      {/* ── 1. Live Session Presence Banner ───────────────────────────────── */}
      <LiveSessionBanner
        activeSubject={{ code: 'CS401', name: 'Operating Systems' }}
        activeRoom="Room 302"
        presenceState={presenceState}
        onManualPing={sendHeartbeatNow}
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
