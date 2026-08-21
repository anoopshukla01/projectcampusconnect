/**
 * AttendanceOverviewCards Component
 * =================================
 * Displays top summary statistics:
 * 1. Overall Attendance % with visual radial gauge.
 * 2. Total Attended vs. Conducted lecture count.
 * 3. 75% Exam Eligibility status & Bunk/Required class margin calculator.
 */

import React from 'react';
import { ShieldCheck, AlertTriangle, XCircle, CheckCircle2, TrendingUp, Calendar, Zap } from 'lucide-react';

function RadialGauge({ pct }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  const strokeColor = pct >= 75 ? '#10b981' : pct >= 65 ? '#f59e0b' : '#ef4444';

  return (
    <div className="sac-radial-wrap">
      <svg className="sac-radial-svg" viewBox="0 0 100 100">
        <circle
          className="sac-radial-bg"
          cx="50"
          cy="50"
          r={radius}
        />
        <circle
          className="sac-radial-bar"
          cx="50"
          cy="50"
          r={radius}
          stroke={strokeColor}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="sac-radial-val">
        <span className="sac-pct-num">{pct}%</span>
        <span className="sac-pct-sub">Overall</span>
      </div>
    </div>
  );
}

export default function AttendanceOverviewCards({ overall = {} }) {
  const {
    percentage = 0,
    total_attended = 0,
    total_conducted = 0,
    eligibility = 'ELIGIBLE',
    bunk_margin = 0,
    classes_needed = 0,
    criteria_threshold = 75,
  } = overall;

  const isEligible = percentage >= criteria_threshold;
  const isAtRisk = percentage >= 65 && percentage < criteria_threshold;

  return (
    <div className="sac-cards-grid">
      {/* ── Card 1: Overall Percentage with Radial Gauge ───────────────────── */}
      <div className="sac-card sac-card-overall">
        <div className="sac-card-inner">
          <div className="sac-meta">
            <span className="sac-label">Aggregate Attendance</span>
            <div className="sac-status-pill-wrap">
              {isEligible ? (
                <span className="sac-pill pill-safe">
                  <ShieldCheck size={13} /> Exam Eligible (≥75%)
                </span>
              ) : isAtRisk ? (
                <span className="sac-pill pill-warning">
                  <AlertTriangle size={13} /> At Risk (65-74%)
                </span>
              ) : (
                <span className="sac-pill pill-danger">
                  <XCircle size={13} /> Shortage / Detained
                </span>
              )}
            </div>
            <p className="sac-desc">Computed across all enrolled theory & lab sessions</p>
          </div>
          <RadialGauge pct={percentage} />
        </div>
      </div>

      {/* ── Card 2: Total Lecture Volume ───────────────────────────────────── */}
      <div className="sac-card">
        <div className="sac-card-top">
          <span className="sac-label">Total Conducted Lectures</span>
          <div className="sac-icon-badge icon-blue">
            <Calendar size={18} />
          </div>
        </div>
        <div className="sac-metric-big">
          <span className="sac-big-num">{total_attended}</span>
          <span className="sac-big-sub">/ {total_conducted} Attended</span>
        </div>
        <div className="sac-card-footer">
          <span className="sac-footer-text">
            Missed <strong>{Math.max(0, total_conducted - total_attended)}</strong> total slots this term
          </span>
        </div>
      </div>

      {/* ── Card 3: 75% Bunk & Attendance Calculator ───────────────────────── */}
      <div className="sac-card sac-card-calc">
        <div className="sac-card-top">
          <span className="sac-label">75% Criteria Calculator</span>
          <div className="sac-icon-badge icon-purple">
            <Zap size={18} />
          </div>
        </div>

        {isEligible ? (
          <div className="sac-calc-body">
            <div className="sac-metric-big text-green">
              <span className="sac-big-num">+{bunk_margin}</span>
              <span className="sac-big-sub">Safe Bunk Margin</span>
            </div>
            <p className="sac-calc-hint">
              You can miss up to <strong>{bunk_margin}</strong> more classes while staying strictly above 75%.
            </p>
          </div>
        ) : (
          <div className="sac-calc-body">
            <div className="sac-metric-big text-red">
              <span className="sac-big-num">+{classes_needed}</span>
              <span className="sac-big-sub">Consecutive Needed</span>
            </div>
            <p className="sac-calc-hint text-warning-hint">
              Must attend the next <strong>{classes_needed}</strong> classes consecutively without missing to hit 75%.
            </p>
          </div>
        )}

        <div className="sac-card-footer">
          <span className="sac-footer-text">
            Mandatory criteria: <strong>{criteria_threshold}%</strong> required for semester exam hall ticket.
          </span>
        </div>
      </div>
    </div>
  );
}
