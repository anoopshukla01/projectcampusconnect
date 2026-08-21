/**
 * SubjectWiseAttendanceTable Component
 * =====================================
 * Subject-wise breakdown of student attendance with dynamic threshold progress bars
 * and status indicators.
 */

import React from 'react';
import { BookOpen, Check, AlertCircle, AlertTriangle } from 'lucide-react';

export default function SubjectWiseAttendanceTable({ subjects = [] }) {
  if (!subjects || subjects.length === 0) {
    return (
      <div className="sat-card">
        <h3 className="sat-heading">Subject-Wise Breakdown</h3>
        <p className="sat-empty">No subject attendance records found for this term.</p>
      </div>
    );
  }

  return (
    <div className="sat-card">
      <div className="sat-header">
        <div>
          <h3 className="sat-heading">Subject-Wise Breakdown</h3>
          <p className="sat-sub">Progress tracking against the mandatory 75% institutional attendance threshold</p>
        </div>
        <span className="sat-count-badge">{subjects.length} Enrolled Courses</span>
      </div>

      <div className="sat-grid">
        {subjects.map((sub) => {
          const pct = sub.percentage != null ? parseFloat(sub.percentage) : 0;
          const isSafe = pct >= 75;
          const isWarning = pct >= 65 && pct < 75;

          const barColor = isSafe ? '#10b981' : isWarning ? '#f59e0b' : '#ef4444';
          const missed = Math.max(0, (sub.total_classes || 0) - (sub.attended_classes || 0));

          // Subject-level bunk margin
          const subBunk = isSafe
            ? Math.floor((sub.attended_classes - 0.75 * sub.total_classes) / 0.75)
            : 0;
          const subNeeded = !isSafe
            ? Math.ceil((0.75 * sub.total_classes - sub.attended_classes) / 0.25)
            : 0;

          return (
            <div key={sub.id || sub.subject_code} className="sat-item-card">
              <div className="sat-item-top">
                <div className="sat-item-title-col">
                  <div className="sat-code-row">
                    <span className="sat-subject-code">{sub.subject_code}</span>
                    {isSafe ? (
                      <span className="sat-status-badge badge-safe">
                        <Check size={11} /> Safe (≥75%)
                      </span>
                    ) : isWarning ? (
                      <span className="sat-status-badge badge-warning">
                        <AlertTriangle size={11} /> Warning
                      </span>
                    ) : (
                      <span className="sat-status-badge badge-critical">
                        <AlertCircle size={11} /> Critical Shortage
                      </span>
                    )}
                  </div>
                  <h4 className="sat-subject-name">{sub.subject_name}</h4>
                </div>

                <div className="sat-pct-col">
                  <span className="sat-pct-value" style={{ color: barColor }}>
                    {pct}%
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="sat-bar-track">
                <div
                  className="sat-bar-fill"
                  style={{ width: `${Math.min(100, pct)}%`, background: barColor }}
                />
                {/* 75% threshold guide marker */}
                <div className="sat-threshold-marker" title="75% Minimum Criteria" />
              </div>

              {/* Card Footer Details */}
              <div className="sat-item-footer">
                <span className="sat-stat-text">
                  Attended: <strong>{sub.attended_classes}</strong> / {sub.total_classes} ({missed} missed)
                </span>
                <span className="sat-margin-text">
                  {isSafe ? (
                    <span className="text-safe-sub">+{subBunk} Safe Bunks</span>
                  ) : (
                    <span className="text-need-sub">+{subNeeded} Classes Needed</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
