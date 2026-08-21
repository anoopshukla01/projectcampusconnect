/**
 * AttendanceHistoryLog Component
 * ===============================
 * Filterable chronological audit trail of all student attendance records & session logs:
 * - Entry time (firstSeenAt)
 * - Exit time (lastSeenAt / leftAt)
 * - Continuous dwell duration
 * - Tamper-proof status pill (Present, Late, Partial / Early Exit, Absent)
 */

import React, { useState } from 'react';
import { History, Clock, MapPin, CheckCircle2, AlertCircle, DoorOpen, XCircle, Filter } from 'lucide-react';

export default function AttendanceHistoryLog({ logs = [] }) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = logs.filter((item) => {
    // Status filter
    if (statusFilter === 'PRESENT' && item.status !== 'PRESENT') return false;
    if (statusFilter === 'LATE' && item.status !== 'LATE') return false;
    if (statusFilter === 'PARTIAL' && !item.early_exit && item.status !== 'PARTIAL_ATTENDANCE') return false;
    if (statusFilter === 'ABSENT' && item.status !== 'ABSENT') return false;

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchCode = (item.course_code || '').toLowerCase().includes(q);
      const matchName = (item.course_name || '').toLowerCase().includes(q);
      const matchRoom = (item.room || '').toLowerCase().includes(q);
      if (!matchCode && !matchName && !matchRoom) return false;
    }

    return true;
  });

  return (
    <div className="ahl-card">
      <div className="ahl-header">
        <div>
          <h3 className="ahl-heading">Session Presence History & Audit Trail</h3>
          <p className="ahl-sub">Immutable timestamp logs for all verified lecture & lab sessions</p>
        </div>

        {/* Filter Buttons */}
        <div className="ahl-filters">
          {['ALL', 'PRESENT', 'LATE', 'PARTIAL', 'ABSENT'].map((tab) => (
            <button
              key={tab}
              className={`ahl-filter-btn ${statusFilter === tab ? 'active' : ''}`}
              onClick={() => setStatusFilter(tab)}
            >
              {tab === 'ALL' ? 'All Sessions' : tab === 'PARTIAL' ? 'Early Exit / Partial' : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="ahl-empty">
          <History size={28} className="ahl-empty-icon" />
          <p>No attendance session records matching this filter.</p>
        </div>
      ) : (
        <div className="ahl-table-wrap">
          <table className="ahl-table">
            <thead>
              <tr>
                <th>Date & Subject</th>
                <th>Room</th>
                <th>Entry (First Seen)</th>
                <th>Exit (Last Seen)</th>
                <th>Dwell Time</th>
                <th>Status / Verification</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const entryTime = log.first_seen_at
                  ? new Date(log.first_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '—';
                const exitTime = log.left_at
                  ? new Date(log.left_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : log.last_seen_at
                  ? new Date(log.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '—';
                const sessionDate = log.session_date || 'Recent';

                return (
                  <tr key={log.id}>
                    <td>
                      <div className="ahl-subject-row">
                        <strong className="ahl-subject-name">{log.course_name}</strong>
                        <code className="ahl-subject-code">{log.course_code}</code>
                      </div>
                      <span className="ahl-date-sub">{sessionDate}</span>
                    </td>

                    <td>
                      <span className="ahl-room-tag">
                        <MapPin size={11} /> {log.room || 'Room 302'}
                      </span>
                    </td>

                    <td>
                      <div className="ahl-time-cell">
                        <Clock size={12} className="text-muted" />
                        <span>{entryTime}</span>
                      </div>
                    </td>

                    <td>
                      <div className="ahl-time-cell">
                        {log.early_exit ? (
                          <DoorOpen size={12} className="text-warning" />
                        ) : (
                          <Clock size={12} className="text-muted" />
                        )}
                        <span>{exitTime}</span>
                      </div>
                    </td>

                    <td>
                      <div className="ahl-dwell-cell">
                        <span className="ahl-dwell-val">{log.dwell_minutes || 0} mins</span>
                        <div className="ahl-mini-bar">
                          <div
                            className={`ahl-mini-fill ${log.dwell_minutes >= 40 ? 'fill-green' : 'fill-amber'}`}
                            style={{ width: `${Math.min(100, (log.dwell_minutes / 50) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td>
                      {log.early_exit ? (
                        <span className="ahl-status-pill pill-partial">
                          <DoorOpen size={12} /> Left Early ({log.dwell_minutes}m)
                        </span>
                      ) : log.status === 'PRESENT' ? (
                        <span className="ahl-status-pill pill-present">
                          <CheckCircle2 size={12} /> Present
                        </span>
                      ) : log.status === 'LATE' ? (
                        <span className="ahl-status-pill pill-late">
                          <AlertCircle size={12} /> Late Entry
                        </span>
                      ) : (
                        <span className="ahl-status-pill pill-absent">
                          <XCircle size={12} /> Absent
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
